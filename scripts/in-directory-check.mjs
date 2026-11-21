// Businesses outside the directory (gr96hhp28): hiding, the admin-only flag,
// the Durango default and the region metrics. Only the local DB.
// node scripts/in-directory-check.mjs
// Everything runs in one transaction that is rolled back at the end, so it
// leaves no fixtures behind. It needs the admin and the Villa Unión reviewer
// that the local copy of prod already has.
import { execFileSync } from 'node:child_process'
import pg from 'pg'
import { LOCAL_DATABASE_URL } from './db-local-url.mjs'

execFileSync(process.execPath, ['scripts/db-local-check.mjs'], { stdio: 'inherit' })

const c = new pg.Client({ connectionString: LOCAL_DATABASE_URL, ssl: false })
const results = []
const check = (name, ok, detail = '') => results.push({ name, ok: ok ? 'OK' : 'FAIL', detail })

async function asRole(role, sub, fn) {
  await c.query('savepoint as_role')
  await c.query(`set local role ${role}`)
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify(sub ? { sub, role } : { role }),
  ])
  try {
    return await fn()
  } finally {
    await c.query('rollback to savepoint as_role')
  }
}

async function weekly() {
  return (await c.query(`select * from admin_weekly_metrics() where week_index = 0`)).rows[0]
}

await c.connect()
await c.query('begin')

try {
  // Two active Vicente Guerrero businesses with categories and hours.
  const { rows: picks } = await c.query(`
    select b.id, b.name, b.slug from businesses b
    where b.is_active and not b.is_demo and b.in_directory
      and b.municipio = 'Vicente Guerrero'
      and exists (select 1 from business_categories bc where bc.business_id = b.id)
      and exists (select 1 from business_hours h where h.business_id = b.id)
    order by b.name limit 2`)
  if (picks.length < 2) throw new Error('needs two active Vicente Guerrero businesses')
  const [hidden, normal] = picks
  const admin = (await c.query(`select id from profiles where role = 'admin' limit 1`)).rows[0]?.id
  const reviewer = (
    await c.query(
      `select id from profiles where role = 'reviewer' and municipio = 'Villa Unión' limit 1`,
    )
  ).rows[0]?.id
  if (!admin || !reviewer) throw new Error('needs an admin and a Villa Unión reviewer')

  // The local copy of prod keeps created_by/updated_by ids whose profiles were
  // not copied; the FK would fail on the second update of the same row.
  await c.query(`update businesses set updated_by = null, created_by = null where id = any($1)`, [
    [hidden.id, normal.id],
  ])

  const metricsBefore = await weekly()

  check(
    'default in_directory = true',
    (await c.query(`select in_directory from businesses where id = $1`, [hidden.id])).rows[0]
      .in_directory === true,
  )

  // A reviewer cannot take a business of their own municipio out of the directory.
  const vu = (await c.query(`select id from businesses where municipio = 'Villa Unión' limit 1`))
    .rows[0].id
  const revErr = await asRole('authenticated', reviewer, async () => {
    try {
      await c.query(`update businesses set in_directory = false where id = $1`, [vu])
      return null
    } catch (e) {
      return e.code
    }
  })
  check('reviewer cannot change in_directory', revErr === '42501', `code=${revErr}`)

  // Moving to Durango turns the flag off; a reviewer of another municipio cannot edit it.
  await c.query(`update businesses set municipio = 'Durango' where id = $1`, [hidden.id])
  check(
    'moving to Durango turns in_directory off',
    (await c.query(`select in_directory from businesses where id = $1`, [hidden.id])).rows[0]
      .in_directory === false,
  )
  const revEdit = await asRole('authenticated', reviewer, async () => {
    const r = await c.query(`update businesses set name = name || ' x' where id = $1`, [hidden.id])
    return r.rowCount
  })
  check('reviewer of another municipio cannot edit it', revEdit === 0, `rows=${revEdit}`)

  // The admin turns it back on; saving again with the same municipio keeps it on.
  await asRole('authenticated', admin, async () => {
    await c.query(`update businesses set in_directory = true where id = $1`, [hidden.id])
    await c.query(`update businesses set municipio = 'Durango', name = name where id = $1`, [
      hidden.id,
    ])
    const r = await c.query(`select in_directory from businesses where id = $1`, [hidden.id])
    check('admin turns it back on and a resave keeps it', r.rows[0].in_directory === true)
  })

  const created = (
    await c.query(`
      insert into businesses (name, phone, municipio, data_source)
      values ('in-directory-check Durango', '6181234567', 'Durango', 'admin')
      returning in_directory`)
  ).rows[0]
  check('a business created in Durango starts outside', created.in_directory === false)

  // From here on, `hidden` is outside the directory.
  await c.query(`update businesses set in_directory = false where id = $1`, [hidden.id])

  // Make both open right now so open-now can tell them apart.
  await c.query(`delete from business_hours where business_id = any($1)`, [[hidden.id, normal.id]])
  await c.query(
    `insert into business_hours (business_id, day_of_week, opens_at, closes_at)
     select id, extract(dow from now() at time zone 'America/Mexico_City')::int, '00:00', '00:00'
     from unnest($1::uuid[]) as id`,
    [[hidden.id, normal.id]],
  )

  await asRole('anon', null, async () => {
    const count = async (id) =>
      (
        await c.query(`select count(*)::int n from business_categories where business_id = $1`, [
          id,
        ])
      ).rows[0].n
    check('anon: no categories for the hidden business', (await count(hidden.id)) === 0)
    check('anon: categories for the normal business', (await count(normal.id)) > 0)
    const s = await c.query(`select id from search_businesses($1)`, [hidden.name])
    check('anon: search leaves it out', !s.rows.some((r) => r.id === hidden.id))
    const sN = await c.query(`select id from search_businesses($1)`, [normal.name])
    check(
      'anon: search finds the normal business',
      sN.rows.some((r) => r.id === normal.id),
    )
    const bySlug = await c.query(`select id from businesses where slug = $1`, [hidden.slug])
    check('anon: it still opens by slug', bySlug.rowCount === 1)
    const o = await c.query(`select id from businesses_open_now()`)
    check('anon: open-now leaves it out', !o.rows.some((r) => r.id === hidden.id))
    check(
      'anon: open-now keeps the normal business',
      o.rows.some((r) => r.id === normal.id),
    )
  })

  await asRole('authenticated', admin, async () => {
    const s = await c.query(`select id from search_businesses($1)`, [hidden.name])
    check(
      'staff: search still finds it',
      s.rows.some((r) => r.id === hidden.id),
    )
  })

  // Its telemetry is stored but stays out of the region metrics.
  const dev = 'in-directory-check'
  const contact = `insert into business_contacts (business_id, device_id, channel, source)
                   values ($1, $2, 'whatsapp', 'landing')`
  const event = `insert into order_funnel_events (business_id, device_id, step)
                 values ($1, $2, 'menu_viewed')`
  const dailyViews = async () =>
    (await c.query(`select sum(menu_devices)::int n from admin_order_daily()`)).rows[0].n

  const dailyBefore = await dailyViews()
  await c.query(contact, [hidden.id, dev])
  await c.query(event, [hidden.id, dev])
  check(
    'its contact is stored',
    (await c.query(`select count(*)::int n from business_contacts where device_id = $1`, [dev]))
      .rows[0].n === 1,
  )
  const metricsHidden = await weekly()
  check(
    'weekly: contacts unchanged',
    metricsHidden.contacts === metricsBefore.contacts,
    `${metricsBefore.contacts} -> ${metricsHidden.contacts}`,
  )
  check(
    'weekly: devices unchanged',
    metricsHidden.unique_devices === metricsBefore.unique_devices,
    `${metricsBefore.unique_devices} -> ${metricsHidden.unique_devices}`,
  )
  const funnel = await c.query(`select business_id from admin_order_funnel()`)
  check('funnel: no row for it', !funnel.rows.some((r) => r.business_id === hidden.id))
  check('daily: its menu view is left out', (await dailyViews()) === dailyBefore)

  // Control: the same events on a business in the directory do count.
  await c.query(contact, [normal.id, dev])
  await c.query(event, [normal.id, dev])
  const metricsNormal = await weekly()
  check(
    'control: weekly counts the normal contact',
    metricsNormal.contacts === metricsBefore.contacts + 1,
  )
  check(
    'control: weekly counts the device',
    metricsNormal.unique_devices === metricsBefore.unique_devices + 1,
  )
  const funnelN = await c.query(`select business_id from admin_order_funnel()`)
  check(
    'control: funnel has the normal row',
    funnelN.rows.some((r) => r.business_id === normal.id),
  )
  check('control: daily counts the normal view', (await dailyViews()) === dailyBefore + 1)
} finally {
  await c.query('rollback').catch(() => {})
  await c.end()
}

console.table(results)
const failed = results.filter((r) => r.ok !== 'OK').length
console.log(`${results.length - failed} ok, ${failed} fail`)
process.exit(failed ? 1 : 0)
