// Integración real y carreras con conexiones distintas. Solo DB local.
// node scripts/stamp-card-check.mjs
// Los fixtures son exclusivos de esta corrida y se eliminan en finally.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import pg from 'pg'
import { LOCAL_DATABASE_URL } from './db-local-url.mjs'

execFileSync(process.execPath, ['scripts/db-local-check.mjs'], { stdio: 'inherit' })
const run = randomUUID()
const owner = randomUUID()
const businesses = []
let passed = 0
const admin = new pg.Client({ connectionString: LOCAL_DATABASE_URL, ssl: false })
const live = new Set()

async function connection(uid = owner, role = 'authenticated') {
  const c = new pg.Client({ connectionString: LOCAL_DATABASE_URL, ssl: false })
  await c.connect()
  live.add(c)
  await c.query('begin')
  await c.query("set local lock_timeout = '4s'")
  await c.query("set local statement_timeout = '8s'")
  if (role === 'authenticated') await c.query('set local role authenticated')
  if (role === 'anon') await c.query('set local role anon')
  await c.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: uid, role }),
  ])
  return c
}

async function close(c) {
  live.delete(c)
  await c.end()
}

async function call(sql, args = [], uid = owner, role = 'authenticated') {
  const c = await connection(uid, role)
  try {
    const result = await c.query(sql, args)
    await c.query('commit')
    return result.rows[0]
  } finally {
    await c.query('rollback')
    await close(c)
  }
}

function ok(name, condition) {
  assert.ok(condition, name)
  passed++
  console.log(`  ok   ${name}`)
}

async function denied(name, sql, args, message, uid = owner, role = 'authenticated') {
  await assert.rejects(() => call(sql, args, uid, role), message)
  ok(name, true)
}

async function business(demo, owned = true) {
  const b = (
    await admin.query(
      `insert into businesses (name, phone, municipio, is_active, is_demo,
         stamp_card_active, stamp_card_stamps_required, stamp_card_reward)
       values ($1, '6180000000', 'Vicente Guerrero', true, $2, true, 3, 'café')
       returning id, slug`,
      [`Prueba sellos ${run} ${businesses.length}`, demo],
    )
  ).rows[0]
  businesses.push(b.id)
  if (owned) {
    await admin.query('insert into business_owners (profile_id, business_id) values ($1, $2)', [
      owner,
      b.id,
    ])
  }
  return b
}

async function customer(b) {
  const token = (
    await admin.query('select get_or_create_stamp_card($1, $2) as token', [b.slug, randomUUID()])
  ).rows[0].token
  const row = (await admin.query('select id from business_customers where token = $1', [token]))
    .rows[0]
  const physical = (
    await admin.query(
      `insert into physical_cards (business_id, customer_id, linked_at)
       values ($1, $2, now()) returning token`,
      [b.id, row.id],
    )
  ).rows[0].token
  return { token, physical, id: row.id }
}

const stampSql = 'select * from owner_add_stamp($1, $2)'
const stamp = (token, id = randomUUID()) => call(stampSql, [token, id])
const read = (token) => call('select * from owner_get_stamp_card($1)', [token])
const redeem = (id) => call('select * from owner_redeem_stamp_card($1)', [id])
const count = async (id) =>
  Number(
    (await admin.query('select count(*) from stamp_card_stamps where customer_id = $1', [id]))
      .rows[0].count,
  )

// Confirma que el segundo backend está esperando un bloqueo, antes de soltar
// el primero. Promise.all por sí solo también puede ejecutar dos llamadas en serie.
async function waitForLock(c) {
  for (let i = 0; i < 100; i++) {
    const state = (
      await admin.query('select wait_event_type from pg_stat_activity where pid = $1', [
        c.processID,
      ])
    ).rows[0]
    if (state?.wait_event_type === 'Lock') return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('La segunda conexión no llegó a esperar el bloqueo')
}

async function race(firstSql, firstArgs, secondSql, secondArgs, firstRole = 'authenticated') {
  const a = await connection(owner, firstRole)
  const b = await connection()
  try {
    const first = (await a.query(firstSql, firstArgs)).rows[0]
    const pending = b.query(secondSql, secondArgs).then(
      async (result) => {
        await b.query('commit')
        return { row: result.rows[0] }
      },
      async (error) => {
        await b.query('rollback')
        return { error: error.message }
      },
    )
    await waitForLock(b)
    await a.query('commit')
    return { first, second: await pending }
  } finally {
    await a.query('rollback')
    await b.query('rollback')
    await close(a)
    await close(b)
  }
}

try {
  await admin.connect()
  await admin.query('insert into auth.users (id, email) values ($1, $2)', [
    owner,
    `sellos-${run}@example.invalid`,
  ])
  await admin.query("update profiles set role = 'owner' where id = $1", [owner])
  const demo = await business(true)
  const real = await business(false)
  const other = await business(true, false)
  const d = await customer(demo)
  const r = await customer(real)
  const foreign = await customer(other)

  const oneId = randomUUID()
  const first = await stamp(d.token, oneId)
  ok(
    'demo: primer sello y señal de excepción',
    first.stamps === 1 && first.stamped_today && !first.daily_limit_applies,
  )
  const repeated = await stamp(d.physical, oneId)
  ok('mismo intento por física: no duplica', repeated.stamps === 1 && (await count(d.id)) === 1)
  await stamp(d.physical)
  const full = await stamp(d.token)
  ok('demo: digital y física llenan el mismo día', full.is_full && full.stamps === 3)
  await denied('no sobrellena demo', stampSql, [d.token, randomUUID()], /card_full/)
  const next = await redeem(full.card_id)
  ok('canje abre otra vuelta', next.stamps === 0 && next.card_id !== full.card_id)
  await denied(
    'canje único de la vuelta',
    'select * from owner_redeem_stamp_card($1)',
    [full.card_id],
    /already_redeemed/,
  )
  await stamp(d.token, oneId)
  ok(
    'respuesta perdida antes del canje: reintento no sella la vuelta nueva',
    (await count(d.id)) === 3,
  )
  ok('demo permite sellar otra vuelta hoy', (await stamp(d.physical)).stamps === 1)

  const realId = randomUUID()
  const rfirst = await stamp(r.physical, realId)
  ok('real: conserva el límite diario', rfirst.stamps === 1 && rfirst.daily_limit_applies)
  await denied(
    'real: física consume el límite de digital',
    stampSql,
    [r.token, randomUUID()],
    /already_stamped_today/,
  )
  await stamp(r.token, realId)
  ok('real: confirmar UUID propio no duplica', (await count(r.id)) === 1)
  const inverse = await customer(real)
  await stamp(inverse.token)
  await denied(
    'real: digital consume el límite de física',
    stampSql,
    [inverse.physical, randomUUID()],
    /already_stamped_today/,
  )
  await admin.query(
    `insert into stamp_card_stamps (card_id, customer_id, stamp_day)
     values ($1, $2, (now() at time zone 'America/Mexico_City')::date - 1),
            ($1, $2, (now() at time zone 'America/Mexico_City')::date - 2)`,
    [rfirst.card_id, r.id],
  )
  await redeem(rfirst.card_id)
  await denied(
    'real: el límite sigue después del canje',
    stampSql,
    [r.physical, randomUUID()],
    /already_stamped_today/,
  )

  await denied(
    'dueño no sella demo ajeno',
    stampSql,
    [foreign.token, randomUUID()],
    /not_your_business/,
  )
  await denied(
    'UUID de otro cliente no confirma el intento',
    stampSql,
    [r.token, oneId],
    /invalid_stamp_operation/,
  )
  await denied(
    'owner no inserta directamente',
    'insert into stamp_card_stamps (card_id, customer_id, stamp_day) values ($1, $2, current_date)',
    [full.card_id, d.id],
    /permission denied/,
  )
  const ownerUpdate = await call(
    'update businesses set is_demo = false where id = $1 returning id',
    [demo.id],
  )
  ok(
    'owner no cambia is_demo (RLS afecta cero filas)',
    !ownerUpdate &&
      (await admin.query('select is_demo from businesses where id = $1', [demo.id])).rows[0]
        .is_demo,
  )
  await denied(
    'anon no ejecuta sello',
    stampSql,
    [d.token, randomUUID()],
    /permission denied/,
    owner,
    'anon',
  )
  const adminProfile = (await admin.query("select id from profiles where role = 'admin' limit 1"))
    .rows[0]
  await denied(
    'admin sin propiedad no sella',
    stampSql,
    [d.token, randomUUID()],
    /not_your_business/,
    adminProfile.id,
  )

  const beforeTransition = await count(d.id)
  await admin.query('update businesses set is_demo = false where id = $1', [demo.id])
  await denied(
    'demo desmarcado: historial de hoy consume límite',
    stampSql,
    [d.token, randomUUID()],
    /already_stamped_today/,
  )
  ok(
    'demo a real conserva todo el historial',
    (await count(d.id)) === beforeTransition && (await read(d.token)).daily_limit_applies,
  )
  await admin.query(
    'update stamp_card_stamps set stamp_day = stamp_day - 1 where customer_id = $1',
    [d.id],
  )
  ok('siguiente día permite continuar en real', (await stamp(d.token)).stamps === 2)

  await admin.query(
    'update businesses set is_demo = true, stamp_card_active = false where id = $1',
    [demo.id],
  )
  await denied(
    'demo apagado no da sellos nuevos',
    stampSql,
    [d.token, randomUUID()],
    /stamp_card_not_available/,
  )
  await stamp(d.token, oneId)
  ok(
    'puede confirmar una escritura previa aunque el programa esté apagado',
    (await count(d.id)) === beforeTransition + 1,
  )
  await admin.query('update businesses set stamp_card_active = true where id = $1', [demo.id])

  const same = await customer(demo)
  const sameId = randomUUID()
  const sameRace = await race(stampSql, [same.token, sameId], stampSql, [same.physical, sameId])
  ok(
    'carrera del mismo UUID: ambas confirman, un sello',
    sameRace.first.stamps === 1 &&
      sameRace.second.row?.stamps === 1 &&
      (await count(same.id)) === 1,
  )
  const limited = await customer(real)
  const realRace = await race(stampSql, [limited.token, randomUUID()], stampSql, [
    limited.physical,
    randomUUID(),
  ])
  ok(
    'carrera real con UUID distintos: solo uno',
    realRace.second.error === 'already_stamped_today' && (await count(limited.id)) === 1,
  )
  const last = await customer(demo)
  await stamp(last.token)
  const lastRace = await race(stampSql, [last.token, randomUUID()], stampSql, [
    last.physical,
    randomUUID(),
  ])
  ok(
    'carrera demo: última plaza se ocupa sin sobrellenar',
    lastRace.second.row?.is_full && (await count(last.id)) === 3,
  )
  await denied(
    'ya lleno: siguiente intento falla',
    stampSql,
    [last.token, randomUUID()],
    /card_full/,
  )
  const almost = await customer(demo)
  await stamp(almost.token)
  await stamp(almost.token)
  const lastSlot = await race(stampSql, [almost.token, randomUUID()], stampSql, [
    almost.physical,
    randomUUID(),
  ])
  ok(
    'dos solicitudes por una plaza: una llena y la otra falla',
    lastSlot.first.is_full &&
      lastSlot.second.error === 'card_full' &&
      (await count(almost.id)) === 3,
  )

  const final = await customer(demo)
  await stamp(final.token)
  const second = await stamp(final.token)
  const raceLastId = randomUUID()
  const raceFull = await race(
    stampSql,
    [final.token, raceLastId],
    'select * from owner_redeem_stamp_card($1)',
    [second.card_id],
  )
  ok(
    'último sello y canje simultáneos no se traban',
    raceFull.first.is_full && raceFull.second.row?.stamps === 0,
  )
  const open = await read(final.token)
  const raceRound = await race(
    'select * from owner_redeem_stamp_card($1)',
    [lastRace.second.row.card_id],
    stampSql,
    [last.token, randomUUID()],
  )
  ok(
    'canje y sello siguiente: conserva vueltas separadas',
    raceRound.second.row?.stamps === 1 && (await count(last.id)) === 4 && open.stamps === 0,
  )

  const changing = await customer(demo)
  await stamp(changing.token)
  const transitionRace = await race(
    'update businesses set is_demo = false where id = $1',
    [demo.id],
    stampSql,
    [changing.token, randomUUID()],
    'postgres',
  )
  ok(
    'cambio a real concurrente aplica estado confirmado del negocio',
    transitionRace.second.error === 'already_stamped_today' && (await count(changing.id)) === 1,
  )

  const stampThenChange = await customer(demo)
  await admin.query('update businesses set is_demo = true where id = $1', [demo.id])
  const a = await connection()
  const b = await connection(owner, 'postgres')
  try {
    await a.query(stampSql, [stampThenChange.token, randomUUID()])
    const pending = b.query('update businesses set is_demo = false where id = $1', [demo.id])
    await waitForLock(b)
    await a.query('commit')
    await pending
    await b.query('commit')
  } finally {
    await a.query('rollback')
    await b.query('rollback')
    await close(a)
    await close(b)
  }
  await denied(
    'cambio a real espera un sello en curso y conserva su límite',
    stampSql,
    [stampThenChange.token, randomUUID()],
    /already_stamped_today/,
  )

  console.log(`\n${passed} comprobaciones de sellos OK`)
} finally {
  for (const c of live) {
    await c.query('rollback').catch(() => {})
    await c.end().catch(() => {})
  }
  // Solo identificadores generados por esta corrida; no se borran clientes reales.
  await admin.query('delete from businesses where id = any($1::uuid[])', [businesses])
  await admin.query('delete from auth.users where id = $1', [owner])
  await admin.end()
}
