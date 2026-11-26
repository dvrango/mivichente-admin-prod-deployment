// Retention of the customer's data on orders (uuyrkazz7): 90 days after the last
// status change the customer data and the item notes are erased, whatever state
// the order ended in. Only the local DB.
//
//   node scripts/order-retention-check.mjs
//
// Everything runs in one transaction that is rolled back at the end, so it leaves
// no fixtures behind. The status times are only written by orders_guard, so the
// fixtures are inserted with triggers off (session_replication_role = replica);
// the purge itself runs with the trigger on, the same way pg_cron runs it.
import { execFileSync } from 'node:child_process'
import pg from 'pg'
import { LOCAL_DATABASE_URL } from './db-local-url.mjs'

execFileSync(process.execPath, ['scripts/db-local-check.mjs'], { stdio: 'inherit' })

const c = new pg.Client({ connectionString: LOCAL_DATABASE_URL, ssl: false })
const results = []
const check = (name, ok, detail = '') => results.push({ name, ok: ok ? 'OK' : 'FAIL', detail })

const CUSTOMER_COLUMNS = [
  'customer_name',
  'customer_phone',
  'delivery_lat',
  'delivery_lng',
  'delivery_directions',
  'delivery_references',
  'pays_with',
]
const KEPT_COLUMNS = [
  'status',
  'mode',
  'subtotal_cents',
  'delivery_fee_cents',
  'total_cents',
  'created_at',
  'accepted_at',
  'rejected_at',
  'preparing_at',
  'on_the_way_at',
  'delivered_at',
]

async function attempt(sql, args = []) {
  await c.query('savepoint attempt')
  try {
    await c.query(sql, args)
    await c.query('release savepoint attempt')
    return 'allowed'
  } catch (error) {
    await c.query('rollback to savepoint attempt')
    return error.code === '42501' ? 'denied' : `error ${error.code}: ${error.message}`
  }
}

async function asRole(role, fn) {
  await c.query('savepoint as_role')
  await c.query(`set local role ${role}`)
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role })])
  try {
    return await fn()
  } finally {
    await c.query('rollback to savepoint as_role')
  }
}

// Times are days ago. The status times say which states the order went through.
const days = (n) => (n == null ? null : `${n} days`)

const fixtures = []

async function order(
  label,
  {
    status,
    mode = 'delivery',
    created,
    accepted,
    rejected,
    preparing,
    onTheWay,
    delivered,
    customer = true,
  },
) {
  const items = [
    {
      service_id: '00000000-0000-0000-0000-000000000001',
      name: 'Tacos',
      variant_id: null,
      variant_name: null,
      options: [],
      quantity: 2,
      unit_price_cents: 2000,
      line_total_cents: 4000,
      note: 'Soy Juan, la casa azul junto a la tienda',
    },
    {
      service_id: '00000000-0000-0000-0000-000000000002',
      name: 'Agua',
      variant_id: null,
      variant_name: null,
      options: [],
      quantity: 1,
      unit_price_cents: 1500,
      line_total_cents: 1500,
      note: null,
    },
  ]
  const delivery = mode === 'delivery'
  const { rows } = await c.query(
    `insert into orders (business_id, status, mode, items, subtotal_cents, delivery_fee_cents,
       total_cents, customer_name, customer_phone, delivery_lat, delivery_lng,
       delivery_directions, delivery_references, pays_with, created_at, accepted_at,
       rejected_at, preparing_at, on_the_way_at, delivered_at)
     values ($1, $2, $3, $4, 5500, $5, 5500 + $5, $6, $7, $8, $9, $10, $11, $12,
       now() - $13::interval, now() - $14::interval, now() - $15::interval,
       now() - $16::interval, now() - $17::interval, now() - $18::interval)
     returning id, token`,
    [
      businessId,
      status,
      mode,
      JSON.stringify(items),
      delivery ? 2500 : 0,
      customer ? 'Juan Pérez' : null,
      customer ? '6181234567' : null,
      customer && delivery ? 24.0 : null,
      customer && delivery ? -104.0 : null,
      customer && delivery ? 'Por la calle del templo' : null,
      customer && delivery ? 'Portón negro' : null,
      customer ? '500' : null,
      days(created),
      days(accepted),
      days(rejected),
      days(preparing),
      days(onTheWay),
      days(delivered),
    ],
  )
  const row = (await c.query('select * from orders where id = $1', [rows[0].id])).rows[0]
  fixtures.push({ label, id: row.id, token: row.token, before: row })
  return row
}

let businessId

await c.connect()
await c.query('begin')

try {
  businessId = (
    await c.query(
      `insert into businesses (name, phone, municipio, is_active, accepts_orders, order_tracking,
         has_delivery, delivery_fee, whatsapp_phone)
       values ('Retention check', '6180000000', 'Vicente Guerrero', true, true, true, true, 25,
         '6181112233')
       returning id`,
    )
  ).rows[0].id

  await c.query('set local session_replication_role = replica')

  // Last change 91 days ago: every way an order can end or be left.
  const expired = [
    await order('pendiente que nadie contestó', { status: 'pending', created: 91 }),
    await order('rechazado', { status: 'rejected', created: 92, rejected: 91 }),
    await order('aceptado y nada más', { status: 'accepted', created: 93, accepted: 91 }),
    await order('en preparación y nada más', {
      status: 'preparing',
      created: 93,
      accepted: 92,
      preparing: 91,
    }),
    await order('en camino sin confirmar', {
      status: 'on_the_way',
      created: 94,
      accepted: 93,
      preparing: 92,
      onTheWay: 91,
    }),
    await order('entregado', {
      status: 'delivered',
      created: 95,
      accepted: 94,
      preparing: 93,
      onTheWay: 92,
      delivered: 91,
    }),
    await order('entregado, paso por él', {
      status: 'delivered',
      mode: 'pickup',
      created: 95,
      accepted: 94,
      preparing: 93,
      onTheWay: 92,
      delivered: 91,
    }),
    await order('solo le queda la nota del platillo', {
      status: 'rejected',
      created: 120,
      rejected: 119,
      customer: false,
    }),
  ]

  // Last change 89 days ago: not yet.
  const recent = [
    await order('pendiente a 89 días', { status: 'pending', created: 89 }),
    await order('rechazado a 89 días', { status: 'rejected', created: 95, rejected: 89 }),
    await order('en camino a 89 días', {
      status: 'on_the_way',
      created: 95,
      accepted: 94,
      preparing: 93,
      onTheWay: 89,
    }),
    await order('entregado a 89 días', {
      status: 'delivered',
      created: 95,
      accepted: 94,
      preparing: 93,
      onTheWay: 92,
      delivered: 89,
    }),
    // Created long ago, but its last change is recent: counts from the change.
    await order('creado hace 100 días, entregado hace 10', {
      status: 'delivered',
      created: 100,
      accepted: 99,
      preparing: 50,
      onTheWay: 11,
      delivered: 10,
    }),
  ]

  // An old run row past the 400 days the purge keeps.
  await c.query(
    `insert into order_retention_runs (ran_at, orders_purged) values (now() - interval '401 days', 0)`,
  )

  await c.query('set local session_replication_role = origin')

  // --- First run ------------------------------------------------------------
  const purged = (await c.query('select public.purge_order_customer_data() as n')).rows[0].n
  check(
    'la primera corrida cuenta al menos los pedidos vencidos',
    purged >= expired.length,
    `limpió ${purged}`,
  )

  const read = async (id) => (await c.query('select * from orders where id = $1', [id])).rows[0]
  const withoutNotes = (items) => items.map((item) => ({ ...item, note: undefined }))

  for (const f of fixtures.filter((f) => expired.some((e) => e.id === f.id))) {
    const after = await read(f.id)
    const leftover = CUSTOMER_COLUMNS.filter((col) => after[col] !== null)
    check(`${f.label}: sin datos del cliente`, leftover.length === 0, leftover.join(', '))
    const notes = after.items.filter((i) => i.note !== null).length
    check(`${f.label}: sin notas en los platillos`, notes === 0, `${notes} con nota`)
    check(
      `${f.label}: los platillos siguen iguales`,
      JSON.stringify(withoutNotes(after.items)) === JSON.stringify(withoutNotes(f.before.items)),
    )
    const changed = KEPT_COLUMNS.filter((col) => String(after[col]) !== String(f.before[col]))
    check(
      `${f.label}: total, fechas y estado se conservan`,
      changed.length === 0,
      changed.join(', '),
    )
  }

  for (const f of fixtures.filter((f) => recent.some((r) => r.id === f.id))) {
    const after = await read(f.id)
    const changed = [...CUSTOMER_COLUMNS, 'items'].filter(
      (col) => JSON.stringify(after[col]) !== JSON.stringify(f.before[col]),
    )
    check(`${f.label}: no se toca`, changed.length === 0, changed.join(', '))
  }

  // The purge ran with orders_guard on: the guard still refuses to write the
  // customer data back on a cleaned order.
  const cleaned = fixtures.find((f) => f.label === 'entregado')
  const rewrite = await attempt(`update orders set customer_phone = '6189999999' where id = $1`, [
    cleaned.id,
  ])
  check(
    'orders_guard siguió activo: no deja reescribir el teléfono borrado',
    rewrite === 'denied',
    rewrite,
  )

  // The client app reads its order by token; it still works on a cleaned order.
  const viaToken = await asRole(
    'anon',
    async () =>
      (await c.query('select status, total_cents from get_order($1)', [cleaned.token])).rows,
  )
  check(
    'get_order sigue leyendo un pedido limpiado',
    viaToken.length === 1 && viaToken[0].status === 'delivered',
  )

  // --- Second run -----------------------------------------------------------
  const again = (await c.query('select public.purge_order_customer_data() as n')).rows[0].n
  check('la segunda corrida no limpia nada', again === 0, `limpió ${again}`)

  // --- Run log --------------------------------------------------------------
  const runs = (
    await c.query(
      `select orders_purged from order_retention_runs
        where ran_at > now() - interval '1 minute' order by id`,
    )
  ).rows.map((r) => r.orders_purged)
  check(
    'cada corrida deja su registro con la cantidad',
    runs.length === 2 && runs[0] === purged && runs[1] === 0,
    JSON.stringify(runs),
  )
  const columns = (
    await c.query(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'order_retention_runs' order by ordinal_position`,
    )
  ).rows.map((r) => r.column_name)
  check(
    'el registro no guarda nada del pedido',
    JSON.stringify(columns) === JSON.stringify(['id', 'ran_at', 'orders_purged']),
    columns.join(', '),
  )
  const stale = Number(
    (
      await c.query(
        `select count(*) from order_retention_runs where ran_at < now() - interval '400 days'`,
      )
    ).rows[0].count,
  )
  check('los registros de más de 400 días se recortan', stale === 0, `${stale} quedan`)

  // --- Who can run it -------------------------------------------------------
  for (const role of ['public', 'anon', 'authenticated', 'service_role']) {
    const can = (
      await c.query(
        `select has_function_privilege($1, 'public.purge_order_customer_data()', 'execute') as p`,
        [role],
      )
    ).rows[0].p
    check(`${role} no tiene execute en purge_order_customer_data`, can === false, String(can))
  }
  for (const role of ['anon', 'authenticated', 'service_role']) {
    const run = await asRole(role, () => attempt('select public.purge_order_customer_data()'))
    check(`${role} NO corre el borrado`, run === 'denied', run)
    const log = await asRole(role, () => attempt('select * from order_retention_runs'))
    check(`${role} NO lee el registro de corridas`, log === 'denied', log)
  }

  // --- The schedule ---------------------------------------------------------
  const job = (
    await c.query(
      `select schedule, command, username, active from cron.job where jobname = 'purge-order-customer-data'`,
    )
  ).rows
  check(
    'pg_cron tiene el borrado diario a las 09:00 UTC',
    job.length === 1 &&
      job[0].schedule === '0 9 * * *' &&
      job[0].command === 'select public.purge_order_customer_data()' &&
      job[0].username === 'postgres' &&
      job[0].active,
    JSON.stringify(job),
  )
} finally {
  await c.query('rollback')
  await c.end()
}

console.table(results)
const failed = results.filter((r) => r.ok !== 'OK')
if (failed.length) {
  console.error(`\n✗ ${failed.length} de ${results.length} fallaron`)
  process.exit(1)
}
console.log(`\n✓ ${results.length} checks OK (todo en rollback)`)
