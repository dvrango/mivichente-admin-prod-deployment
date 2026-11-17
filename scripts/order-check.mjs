// Pedido con estados (ypol0a1j4): integración real contra la DB LOCAL, como
// anon y como service_role, incluida una carrera con conexiones distintas.
//
//   node scripts/order-check.mjs
//
// Quién lee la tabla y quién enciende el flujo lo prueba rls-check.mjs; aquí va
// lo que hacen las funciones: precios recalculados, lo que se rechaza, las
// transiciones y la confirmación del cliente. Los fixtures son exclusivos de
// esta corrida y se eliminan en finally. Contra prod NO se corre.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import pg from 'pg'
import { LOCAL_DATABASE_URL } from './db-local-url.mjs'

execFileSync(process.execPath, ['scripts/db-local-check.mjs'], { stdio: 'inherit' })
const run = randomUUID().slice(0, 8)
const businesses = []
const live = new Set()
let passed = 0
const admin = new pg.Client({ connectionString: LOCAL_DATABASE_URL, ssl: false })

async function connection(role) {
  const c = new pg.Client({ connectionString: LOCAL_DATABASE_URL, ssl: false })
  await c.connect()
  live.add(c)
  await c.query('begin')
  await c.query("set local lock_timeout = '4s'")
  await c.query("set local statement_timeout = '8s'")
  await c.query(`set local role ${role}`)
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role })])
  return c
}

async function close(c) {
  live.delete(c)
  await c.end()
}

// Corre y confirma: lo que hace la función queda escrito, como en la app.
async function call(role, sql, args = []) {
  const c = await connection(role)
  try {
    const result = await c.query(sql, args)
    await c.query('commit')
    return result.rows
  } catch (error) {
    await c.query('rollback')
    throw error
  } finally {
    await close(c)
  }
}

function ok(name, condition, detail) {
  assert.ok(condition, detail ? `${name} — ${detail}` : name)
  passed++
  console.log(`  ok   ${name}`)
}

async function rejects(name, role, sql, args, message) {
  await assert.rejects(() => call(role, sql, args), message, name)
  passed++
  console.log(`  ok   ${name}`)
}

async function business(fields = {}) {
  const f = {
    accepts_orders: true,
    order_tracking: true,
    has_delivery: true,
    delivery_fee: 25,
    whatsapp_phone: '6181112233',
    ...fields,
  }
  const id = (
    await admin.query(
      `insert into businesses (name, phone, municipio, is_active, accepts_orders, order_tracking,
         has_delivery, delivery_fee, whatsapp_phone)
       values ($1, '6180000000', 'Vicente Guerrero', true, $2, $3, $4, $5, $6)
       returning id`,
      [
        `Prueba pedidos ${run} ${businesses.length}`,
        f.accepts_orders,
        f.order_tracking,
        f.has_delivery,
        f.delivery_fee,
        f.whatsapp_phone,
      ],
    )
  ).rows[0].id
  businesses.push(id)
  return id
}

const insertOne = async (sql, args) => (await admin.query(sql, args)).rows[0].id
const service = (biz, name, price, published = true) =>
  insertOne(
    `insert into business_services (business_id, name, price, is_published)
     values ($1, $2, $3, $4) returning id`,
    [biz, name, price, published],
  )
const variant = (svc, name, price) =>
  insertOne(
    `insert into business_service_variants (service_id, business_id, name, price)
     select $1, s.business_id, $2, $3 from business_services s where s.id = $1 returning id`,
    [svc, name, price],
  )
const group = (svc, name, min, max) =>
  insertOne(
    `insert into business_service_option_groups (service_id, business_id, name, min_select, max_select)
     select $1, s.business_id, $2, $3, $4 from business_services s where s.id = $1 returning id`,
    [svc, name, min, max],
  )
const option = (grp, name, delta) =>
  insertOne(
    `insert into business_service_options (group_id, business_id, name, price_delta)
     select $1, g.business_id, $2, $3 from business_service_option_groups g where g.id = $1
     returning id`,
    [grp, name, delta],
  )

const createSql = `select create_order(
  p_business_id => $1, p_items => $2::jsonb, p_mode => $3, p_customer_name => $4,
  p_customer_phone => $5, p_expected_total_cents => $6, p_delivery_lat => $7,
  p_delivery_lng => $8, p_delivery_directions => $9, p_delivery_references => $10,
  p_pays_with => $11) as token`

function order(biz, items, expected, extra = {}) {
  const o = {
    mode: 'delivery',
    name: 'Cliente de prueba',
    phone: '+52 1 618 123 4567',
    lat: 23.73,
    lng: -103.98,
    directions: null,
    references: 'Casa azul',
    paysWith: '500',
    ...extra,
  }
  return [
    biz,
    JSON.stringify(items),
    o.mode,
    o.name,
    o.phone,
    expected,
    o.lat,
    o.lng,
    o.directions,
    o.references,
    o.paysWith,
  ]
}

const create = async (args) => (await call('anon', createSql, args))[0].token
const read = async (token) => (await call('anon', 'select * from get_order($1)', [token]))[0]
const row = async (token) =>
  (await admin.query('select * from orders where token = $1', [token])).rows[0]
const setStatus = async (id, status) =>
  (await call('service_role', 'select * from set_order_status($1, $2)', [id, status]))[0]
const confirm = async (token) =>
  (await call('anon', 'select confirm_order_received($1) as status', [token]))[0].status

// Confirma que la segunda conexión espera el bloqueo de la primera antes de
// soltarla. Promise.all solo también puede correr las dos llamadas en serie.
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

await admin.connect()
try {
  // --- menú de prueba ------------------------------------------------------
  const biz = await business()
  const taco = await service(biz, 'Taco', 50)
  const cafe = await service(biz, 'Café', null)
  const chico = await variant(cafe, 'Chico', 60)
  const grande = await variant(cafe, 'Grande', 80)
  const leche = await group(cafe, 'Leche', 1, 1)
  const entera = await option(leche, 'Entera', 0)
  const almendra = await option(leche, 'Almendra', 10)
  const extras = await group(cafe, 'Extras', 0, 2)
  const canela = await option(extras, 'Canela', 5)
  const crema = await option(extras, 'Crema', 7)
  const vainilla = await option(extras, 'Vainilla', 3)
  const oculto = await service(biz, 'Platillo oculto', 40, false)
  const sinPrecio = await service(biz, 'Precio a consultar', null)

  const otroNegocio = await business()
  const ajeno = await service(otroNegocio, 'De otro negocio', 50)
  const ajenoGrupo = await group(ajeno, 'Salsa', 0, 1)
  const ajenaOpcion = await option(ajenoGrupo, 'Verde', 0)

  const apagado = await business({ order_tracking: false })
  const apagadoTaco = await service(apagado, 'Taco', 50)
  const sinPedidos = await business({ accepts_orders: false })
  const sinPedidosTaco = await service(sinPedidos, 'Taco', 50)
  const sinWhatsapp = await business({ whatsapp_phone: null })
  const sinWhatsappTaco = await service(sinWhatsapp, 'Taco', 50)
  const sinEnvio = await business({ has_delivery: false })
  const sinEnvioTaco = await service(sinEnvio, 'Taco', 50)
  const envioPorConfirmar = await business({ delivery_fee: null })
  const porConfirmarTaco = await service(envioPorConfirmar, 'Taco', 50)

  const items = [
    { service_id: taco, quantity: 2, note: 'Sin cebolla' },
    { service_id: cafe, variant_id: grande, option_ids: [almendra, canela], quantity: 1 },
  ]
  // 2 × 50 + (80 + 10 + 5) = 195; envío 25 → 220.
  const total = 22000

  // --- crear y leer ----------------------------------------------------------
  console.log('crear y leer (anon)')
  const token = await create(order(biz, items, total))
  ok('anon crea un pedido y recibe un token', typeof token === 'string' && token.length >= 24)
  const r = await row(token)
  ok('queda pendiente, con hora de creación', r.status === 'pending' && r.created_at)
  ok(
    'subtotal, envío y total salen del menú',
    r.subtotal_cents === 19500 && r.delivery_fee_cents === 2500 && r.total_cents === 22000,
    JSON.stringify([r.subtotal_cents, r.delivery_fee_cents, r.total_cents]),
  )
  ok('el teléfono se guarda en 10 dígitos', r.customer_phone === '6181234567', r.customer_phone)
  ok(
    'guarda los datos de entrega',
    r.customer_name === 'Cliente de prueba' &&
      r.delivery_lat === 23.73 &&
      r.delivery_references === 'Casa azul' &&
      r.pays_with === '500',
  )
  const cafeLinea = r.items[1]
  ok(
    'los platillos quedan como foto con nombre, tamaño, opciones y precio',
    r.items[0].name === 'Taco' &&
      r.items[0].note === 'Sin cebolla' &&
      r.items[0].line_total_cents === 10000 &&
      cafeLinea.variant_name === 'Grande' &&
      cafeLinea.unit_price_cents === 9500 &&
      cafeLinea.options.map((o) => o.name).join(',') === 'Almendra,Canela' &&
      cafeLinea.options[0].group_name === 'Leche',
    JSON.stringify(r.items),
  )
  ok('el aviso al restaurante nace pendiente', r.notify_status === 'pending')

  const leido = await read(token)
  ok('anon lee su pedido con el token', leido.status === 'pending' && leido.total_cents === 22000)
  ok(
    'la lectura no trae nombre, teléfono ni ubicación',
    !['customer_name', 'customer_phone', 'delivery_lat', 'delivery_directions', 'token'].some(
      (k) => k in leido,
    ),
    Object.keys(leido).join(','),
  )
  ok(
    'un token inventado no devuelve nada',
    (await call('anon', 'select * from get_order($1)', ['x'])).length === 0,
  )

  await admin.query('update business_services set price = 55 where id = $1', [taco])
  ok(
    'el pedido no cambia aunque cambie el menú',
    (await row(token)).items[0].unit_price_cents === 5000,
  )
  await admin.query('update business_services set price = 50 where id = $1', [taco])

  const pickup = await create(
    order(biz, [{ service_id: taco, quantity: 1 }], 5000, { mode: 'pickup' }),
  )
  const rp = await row(pickup)
  ok(
    'paso por él: sin envío y sin ubicación',
    rp.delivery_fee_cents === 0 && rp.delivery_lat === null && rp.delivery_references === null,
  )
  const porConfirmar = await create(
    order(envioPorConfirmar, [{ service_id: porConfirmarTaco, quantity: 1 }], 5000),
  )
  ok(
    'envío por confirmar queda en null y no suma',
    (await row(porConfirmar)).delivery_fee_cents === null,
  )
  const sinPin = await create(
    order(biz, [{ service_id: taco, quantity: 1 }], 7500, {
      lat: null,
      lng: null,
      directions: 'Atrás de la iglesia',
    }),
  )
  ok('a domicilio sin pin, con cómo llegar', (await row(sinPin)).delivery_directions !== null)

  // --- lo que create_order rechaza ------------------------------------------
  console.log('\nlo que la base rechaza al crear')
  const one = [{ service_id: taco, quantity: 1 }]
  await rejects(
    'negocio con el flujo apagado',
    'anon',
    createSql,
    order(apagado, [{ service_id: apagadoTaco, quantity: 1 }], 7500),
    /orders_not_available/,
  )
  await rejects(
    'negocio que no recibe pedidos',
    'anon',
    createSql,
    order(sinPedidos, [{ service_id: sinPedidosTaco, quantity: 1 }], 7500),
    /orders_not_available/,
  )
  await rejects(
    'negocio sin WhatsApp',
    'anon',
    createSql,
    order(sinWhatsapp, [{ service_id: sinWhatsappTaco, quantity: 1 }], 7500),
    /business_without_whatsapp/,
  )
  await rejects(
    'a domicilio en un negocio sin envío',
    'anon',
    createSql,
    order(sinEnvio, [{ service_id: sinEnvioTaco, quantity: 1 }], 7500),
    /delivery_not_available/,
  )
  await rejects(
    'negocio que no existe',
    'anon',
    createSql,
    order(randomUUID(), one, 7500),
    /orders_not_available/,
  )
  await rejects(
    'total distinto del que vio el cliente',
    'anon',
    createSql,
    order(biz, items, total - 100),
    /price_changed/,
  )
  await rejects(
    'total más alto tampoco',
    'anon',
    createSql,
    order(biz, items, total + 100),
    /price_changed/,
  )
  await rejects(
    'platillo no publicado',
    'anon',
    createSql,
    order(biz, [{ service_id: oculto, quantity: 1 }], 6500),
    /item_not_available/,
  )
  await rejects(
    'platillo de otro negocio',
    'anon',
    createSql,
    order(biz, [{ service_id: ajeno, quantity: 1 }], 7500),
    /item_not_available/,
  )
  await rejects(
    'platillo sin precio',
    'anon',
    createSql,
    order(biz, [{ service_id: sinPrecio, quantity: 1 }], 2500),
    /item_without_price/,
  )
  await rejects(
    'platillo con tamaños sin tamaño',
    'anon',
    createSql,
    order(biz, [{ service_id: cafe, option_ids: [entera], quantity: 1 }], 8500),
    /item_not_available/,
  )
  await rejects(
    'tamaño de otro platillo',
    'anon',
    createSql,
    order(biz, [{ service_id: taco, variant_id: chico, quantity: 1 }], 8500),
    /item_not_available/,
  )
  await rejects(
    'opción de otro platillo',
    'anon',
    createSql,
    order(
      biz,
      [{ service_id: cafe, variant_id: chico, option_ids: [entera, ajenaOpcion], quantity: 1 }],
      8500,
    ),
    /item_not_available/,
  )
  await rejects(
    'grupo obligatorio sin elegir',
    'anon',
    createSql,
    order(biz, [{ service_id: cafe, variant_id: chico, quantity: 1 }], 8500),
    /item_options_invalid/,
  )
  await rejects(
    'más opciones que el máximo',
    'anon',
    createSql,
    order(
      biz,
      [
        {
          service_id: cafe,
          variant_id: chico,
          option_ids: [entera, canela, crema, vainilla],
          quantity: 1,
        },
      ],
      10000,
    ),
    /item_options_invalid/,
  )
  await rejects(
    'la misma opción dos veces',
    'anon',
    createSql,
    order(
      biz,
      [{ service_id: cafe, variant_id: chico, option_ids: [entera, entera], quantity: 1 }],
      8500,
    ),
    /invalid_items/,
  )
  await rejects(
    'cantidad cero',
    'anon',
    createSql,
    order(biz, [{ service_id: taco, quantity: 0 }], 2500),
    /invalid_items/,
  )
  await rejects(
    'cantidad con decimales',
    'anon',
    createSql,
    order(biz, [{ service_id: taco, quantity: 1.5 }], 10000),
    /invalid_items/,
  )
  await rejects('sin platillos', 'anon', createSql, order(biz, [], 2500), /invalid_items/)
  await rejects(
    'platillo sin cantidad',
    'anon',
    createSql,
    order(biz, [{ service_id: taco }], 7500),
    /invalid_items/,
  )
  await rejects(
    'teléfono incompleto',
    'anon',
    createSql,
    order(biz, one, 7500, { phone: '618 123' }),
    /invalid_customer_phone/,
  )
  await rejects(
    'sin teléfono',
    'anon',
    createSql,
    order(biz, one, 7500, { phone: null }),
    /invalid_customer_phone/,
  )
  await rejects(
    'sin nombre',
    'anon',
    createSql,
    order(biz, one, 7500, { name: '  ' }),
    /invalid_customer_name/,
  )
  await rejects(
    'a domicilio sin pin ni cómo llegar',
    'anon',
    createSql,
    order(biz, one, 7500, { lat: null, lng: null }),
    /location_required/,
  )
  await rejects(
    'pin a medias',
    'anon',
    createSql,
    order(biz, one, 7500, { lng: null }),
    /invalid_location/,
  )
  await rejects(
    'modo inventado',
    'anon',
    createSql,
    order(biz, one, 7500, { mode: 'dron' }),
    /invalid_mode/,
  )

  // --- estados ---------------------------------------------------------------
  console.log('\nestados (servidor y cliente)')
  const id = r.id
  await rejects(
    'el cliente no confirma un pedido pendiente',
    'anon',
    'select confirm_order_received($1)',
    [token],
    /order_not_on_the_way/,
  )
  let s = await setStatus(id, 'on_the_way')
  ok('de pendiente no salta a en camino', s.status === 'pending' && s.changed === false)
  s = await setStatus(id, 'preparing')
  ok('de pendiente no salta a en preparación', s.status === 'pending' && s.changed === false)
  s = await setStatus(id, 'accepted')
  ok('el servidor acepta', s.status === 'accepted' && s.changed === true)
  s = await setStatus(id, 'accepted')
  ok('aceptar otra vez no cambia nada', s.status === 'accepted' && s.changed === false)
  s = await setStatus(id, 'rejected')
  ok('un rechazo después de aceptar no cambia nada', s.status === 'accepted' && s.changed === false)
  s = await setStatus(id, 'preparing')
  ok('pasa a en preparación', s.status === 'preparing' && s.changed === true)
  s = await setStatus(id, 'accepted')
  ok('un botón viejo de aceptar no lo regresa', s.status === 'preparing' && s.changed === false)
  s = await setStatus(id, 'on_the_way')
  ok('pasa a en camino', s.status === 'on_the_way' && s.changed === true)
  await rejects(
    'el servidor no marca entregado ni escribiendo directo',
    'service_role',
    "update orders set status = 'delivered' where id = $1",
    [id],
    /only_customer_confirms_delivery/,
  )
  await rejects(
    'el servidor no marca entregado',
    'service_role',
    'select * from set_order_status($1, $2)',
    [id, 'delivered'],
    /invalid_status/,
  )
  await rejects(
    'estado inventado',
    'service_role',
    'select * from set_order_status($1, $2)',
    [id, 'perdido'],
    /invalid_status/,
  )
  await rejects(
    'pedido que no existe',
    'service_role',
    'select * from set_order_status($1, $2)',
    [randomUUID(), 'accepted'],
    /order_not_found/,
  )
  ok('el cliente confirma que lo recibió', (await confirm(token)) === 'delivered')
  ok('confirmar otra vez no falla ni cambia', (await confirm(token)) === 'delivered')
  await rejects(
    'confirmar con un token inventado',
    'anon',
    'select confirm_order_received($1)',
    ['x'],
    /order_not_found/,
  )
  s = await setStatus(id, 'on_the_way')
  ok('entregado es final', s.status === 'delivered' && s.changed === false)
  const fin = await row(token)
  ok(
    'cada estado guardó su hora, en orden',
    fin.created_at <= fin.accepted_at &&
      fin.accepted_at <= fin.preparing_at &&
      fin.preparing_at <= fin.on_the_way_at &&
      fin.on_the_way_at <= fin.delivered_at &&
      fin.rejected_at === null,
  )
  const leidoFin = await read(token)
  ok(
    'el cliente ve entregado y las horas',
    leidoFin.status === 'delivered' && leidoFin.delivered_at,
  )

  const rechazado = (await row(pickup)).id
  s = await setStatus(rechazado, 'rejected')
  ok('el servidor rechaza un pendiente', s.status === 'rejected' && s.changed === true)
  s = await setStatus(rechazado, 'accepted')
  ok('rechazado es final', s.status === 'rejected' && s.changed === false)
  await rejects(
    'el cliente no confirma un rechazado',
    'anon',
    'select confirm_order_received($1)',
    [pickup],
    /order_not_on_the_way/,
  )

  // --- escrituras directas del servidor ---------------------------------------
  console.log('\nescrituras directas de service_role')
  const directo = (await row(sinPin)).id
  const upd = (sql, args) => call('service_role', sql, args)
  await rejects(
    'no cambia el total',
    'service_role',
    'update orders set total_cents = 1 where id = $1',
    [directo],
    /order_is_immutable|orders_amounts_check/,
  )
  await rejects(
    'no cambia los platillos',
    'service_role',
    "update orders set items = '[{}]' where id = $1",
    [directo],
    /order_is_immutable/,
  )
  await rejects(
    'no reescribe el teléfono',
    'service_role',
    "update orders set customer_phone = '6189999999' where id = $1",
    [directo],
    /order_customer_data_is_immutable/,
  )
  await rejects(
    'no escribe la hora de un estado',
    'service_role',
    'update orders set accepted_at = now() where id = $1',
    [directo],
    /order_status_times_are_managed/,
  )
  await rejects(
    'no salta estados',
    'service_role',
    "update orders set status = 'delivered' where id = $1",
    [directo],
    /invalid_order_transition/,
  )
  await rejects(
    'no inserta pedidos directo: solo nacen por create_order',
    'service_role',
    `insert into orders (business_id, mode, items, subtotal_cents, delivery_fee_cents, total_cents)
     values ($1, 'pickup', '[{}]', 0, 0, 0)`,
    [biz],
    /permission denied/,
  )
  const inicial = await admin
    .query(
      `insert into orders (business_id, mode, items, subtotal_cents, delivery_fee_cents, total_cents, status)
       values ($1, 'pickup', '[{}]', 0, 0, 0, 'accepted')`,
      [biz],
    )
    .then(
      () => 'ok',
      (e) => e.message,
    )
  ok(
    'ni postgres inserta un pedido que no empiece pendiente',
    /order_must_start_pending/.test(inicial),
    inicial,
  )
  await upd(
    "update orders set notify_status = 'sending' where id = $1 and notify_status = 'pending'",
    [directo],
  )
  await upd(
    "update orders set notify_status = 'failed', notify_error = '131026 destinatario no registrado' where id = $1",
    [directo],
  )
  const fallido = await row(sinPin)
  ok(
    'un envío fallido queda registrado con su error y su hora',
    fallido.notify_status === 'failed' && fallido.notify_error && fallido.notify_updated_at,
  )
  ok('el cliente ve que el aviso falló', (await read(sinPin)).notify_status === 'failed')
  await rejects(
    'un error sin estado fallido no entra',
    'service_role',
    "update orders set notify_status = 'sent' where id = $1",
    [directo],
    /orders_notify_error_check/,
  )
  await upd('update orders set customer_phone = null, delivery_directions = null where id = $1', [
    directo,
  ])
  ok('los datos del cliente sí se pueden borrar', (await row(sinPin)).customer_phone === null)
  await upd(
    `update orders set items = (
       select jsonb_agg(e || '{"note": null}'::jsonb order by ord)
         from jsonb_array_elements(items) with ordinality as t(e, ord))
     where id = $1`,
    [id],
  )
  const sinNotas = (await row(token)).items
  ok(
    'las notas de los platillos sí se pueden borrar',
    sinNotas[0].note === null && sinNotas[0].name === 'Taco' && sinNotas[0].quantity === 2,
    JSON.stringify(sinNotas[0]),
  )
  await rejects(
    'fuera de las notas, los platillos no cambian',
    'service_role',
    `update orders set items = jsonb_set(items, '{0,name}', '"Otro"') where id = $1`,
    [id],
    /order_is_immutable/,
  )

  // --- carrera -----------------------------------------------------------------
  console.log('\ncarrera')
  const carrera = (await row(porConfirmar)).id
  const a = await connection('service_role')
  const b = await connection('service_role')
  try {
    const first = (await a.query("select * from set_order_status($1, 'accepted')", [carrera]))
      .rows[0]
    const pending = b.query("select * from set_order_status($1, 'rejected')", [carrera])
    await waitForLock(b)
    await a.query('commit')
    const second = (await pending).rows[0]
    await b.query('commit')
    ok(
      'aceptar y rechazar a la vez: gana el primero y el otro no cambia nada',
      first.changed === true && second.changed === false && second.status === 'accepted',
      JSON.stringify([first, second]),
    )
  } finally {
    await a.query('rollback').catch(() => {})
    await b.query('rollback').catch(() => {})
    await close(a)
    await close(b)
  }
  const final = await row(porConfirmar)
  ok(
    'queda aceptado, sin hora de rechazo',
    final.status === 'accepted' && final.rejected_at === null,
  )

  console.log(`\n${passed} comprobaciones de pedidos OK`)
} finally {
  for (const c of live) {
    await c.query('rollback').catch(() => {})
    await c.end().catch(() => {})
  }
  // Solo los negocios de esta corrida; sus pedidos y su menú se van en cascada.
  await admin.query('delete from businesses where id = any($1::uuid[])', [businesses])
  await admin.end()
}
