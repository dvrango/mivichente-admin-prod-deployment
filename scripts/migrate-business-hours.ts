#!/usr/bin/env npx tsx
/**
 * Migrates legacy `businesses.schedule` (free-text) → `business_hours` table.
 *
 * day_of_week: 0=Sunday, 1=Monday, ..., 6=Saturday
 * Closed days: no row inserted (absence = closed)
 * Multiple time slots per day: corrido (first open → last close)
 * "24 hours": 00:00–23:59
 *
 * Run:
 *   LOCAL:  npx tsx scripts/migrate-business-hours.ts
 *   PROD:   DATABASE_URL=postgresql://... npx tsx scripts/migrate-business-hours.ts
 */

import { Client } from 'pg'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// Uses direct postgres connection to bypass PostgREST/RLS entirely
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@100.96.221.80:54322/postgres'

const db = new Client({ connectionString: DATABASE_URL, ssl: false })

// ─── Day parsing ────────────────────────────────────────────────────────────

const DAY_TO_DOW: Record<string, number> = {
  Lun: 1,
  Mar: 2,
  Mié: 3,
  Jue: 4,
  Vie: 5,
  Sáb: 6,
  Dom: 0,
}
const WEEK_ORDER = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function expandDays(dayPart: string): number[] {
  const clean = dayPart.replace(/:$/, '').trim()
  if (clean.includes('-')) {
    const [s, e] = clean.split('-')
    const si = WEEK_ORDER.indexOf(s.trim())
    const ei = WEEK_ORDER.indexOf(e.trim())
    if (si === -1 || ei === -1) return []
    return WEEK_ORDER.slice(si, ei + 1).map((d) => DAY_TO_DOW[d])
  }
  return DAY_TO_DOW[clean] !== undefined ? [DAY_TO_DOW[clean]] : []
}

// ─── Time parsing ────────────────────────────────────────────────────────────

function to24h(h: number, m: number, period?: string): string {
  if (period) {
    const p = period.toUpperCase()
    if (p === 'AM' && h === 12) h = 0
    if (p === 'PM' && h !== 12) h += 12
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}

interface TimeToken {
  raw: string
  period?: string
}

function tokenizeTimeStr(timeStr: string): TimeToken[] {
  const re = /(\d{1,2}:\d{2})\s*([AaPp][Mm])?/g
  const tokens: TimeToken[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(timeStr)) !== null) {
    tokens.push({ raw: m[1], period: m[2]?.trim() || undefined })
  }
  return tokens
}

interface Slot {
  opens: string
  closes: string
}

function parseTimeRange(timeStr: string): Slot | null {
  if (!timeStr || /cerrado|closed/i.test(timeStr)) return null
  if (/24\s*hour/i.test(timeStr)) return { opens: '00:00:00', closes: '23:59:00' }

  // Normalize separators
  const norm = timeStr
    .replace(/–/g, '-')
    .replace(/\s+a\s+/gi, '-')
    .replace(/\s*-\s*/g, '-')
    .trim()

  const hasAMPM = /[AaPp][Mm]/.test(norm)
  const tokens = tokenizeTimeStr(norm)
  if (tokens.length < 2) return null

  // Pair tokens into (open, close) slots
  const slots: { open: string; close: string }[] = []
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    const openTok = tokens[i]
    const closeTok = tokens[i + 1]

    let openTime: string | null = null
    let closeTime: string | null = null

    if (hasAMPM) {
      const closePeriod = closeTok.period ?? norm.match(/[AaPp][Mm]/)?.[0] ?? 'PM'
      const openPeriod = openTok.period ?? closePeriod
      const [oh, om] = openTok.raw.split(':').map(Number)
      const [ch, cm] = closeTok.raw.split(':').map(Number)
      openTime = to24h(oh, om, openPeriod)
      closeTime = to24h(ch, cm, closeTok.period ?? closePeriod)
    } else {
      const [oh, om] = openTok.raw.split(':').map(Number)
      const [ch, cm] = closeTok.raw.split(':').map(Number)
      openTime = to24h(oh, om)
      closeTime = to24h(ch, cm)
    }

    if (openTime && closeTime) slots.push({ open: openTime, close: closeTime })
  }

  if (slots.length === 0) return null

  // Corrido: first open → last close
  return { opens: slots[0].open, closes: slots[slots.length - 1].close }
}

// ─── Schedule parser ─────────────────────────────────────────────────────────

interface HoursRow {
  day_of_week: number
  opens_at: string
  closes_at: string
}

const DAY_ABBREVS = '(?:Lun|Mar|Mié|Jue|Vie|Sáb|Dom)'
const DAY_PART_RE = new RegExp(`^(${DAY_ABBREVS}(?:-${DAY_ABBREVS})?):?\\s*(.*)$`)

function parseSchedule(schedule: string): HoursRow[] {
  const results: HoursRow[] = []
  const seen = new Set<number>()

  for (const seg of schedule.split(',').map((s) => s.trim())) {
    const m = seg.match(DAY_PART_RE)
    if (!m) continue

    const days = expandDays(m[1])
    const slot = parseTimeRange(m[2].trim())
    if (!slot) continue

    for (const dow of days) {
      if (seen.has(dow)) continue // first segment wins
      seen.add(dow)
      results.push({ day_of_week: dow, opens_at: slot.opens, closes_at: slot.closes })
    }
  }

  return results
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  await db.connect()

  const { rows: businesses } = await db.query<{ id: string; name: string; schedule: string }>(
    `SELECT id, name, schedule FROM businesses WHERE schedule IS NOT NULL AND schedule != ''`,
  )

  console.log(`Found ${businesses.length} businesses with schedule\n`)

  let ok = 0
  let skipped = 0
  let failed = 0

  for (const biz of businesses) {
    const rows = parseSchedule(biz.schedule)

    if (rows.length === 0) {
      console.log(`[SKIP] ${biz.name} — no parseable hours`)
      skipped++
      continue
    }

    try {
      for (const r of rows) {
        await db.query(
          `INSERT INTO business_hours (business_id, day_of_week, opens_at, closes_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (business_id, day_of_week) DO UPDATE
             SET opens_at = EXCLUDED.opens_at, closes_at = EXCLUDED.closes_at`,
          [biz.id, r.day_of_week, r.opens_at, r.closes_at],
        )
      }
      console.log(`[ OK ] ${biz.name} — ${rows.length} días`)
      ok++
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[FAIL] ${biz.name} — ${msg}`)
      failed++
    }
  }

  console.log(`\n✓ ${ok} migrados  ⚠ ${skipped} sin parsear  ✗ ${failed} errores`)
  await db.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
