// Order notice by WhatsApp (njr8m6mp2): the two API routes end to end against
// the LOCAL database, with a fake Meta that records what the panel sends.
//
//   node scripts/order-notify-check.mjs
//
// Starts `next dev` on $MIKITASKS_PORT (or 3120) with fake WhatsApp settings
// pointing at the fake Meta, creates real orders with create_order as anon,
// calls /api/orders/notify and signs webhook calls the way Meta does. Its
// fixtures are only this run's and are deleted in finally. Never against prod.
import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { createHmac, randomUUID } from 'node:crypto'
import http from 'node:http'
import pg from 'pg'
import { LOCAL_DATABASE_URL } from './db-local-url.mjs'

execFileSync(process.execPath, ['scripts/db-local-check.mjs'], { stdio: 'inherit' })

const PORT = Number(process.env.MIKITASKS_PORT || 3120)
const BASE = `http://localhost:${PORT}`
const PHONE_NUMBER_ID = '1000000000001'
const APP_SECRET = `secret-${randomUUID()}`
const VERIFY_TOKEN = `verify-${randomUUID()}`
const OWNER = '6185550101'
const run = randomUUID().slice(0, 8)
const businesses = []
let passed = 0

function ok(name, condition, detail) {
  assert.ok(condition, detail ? `${name} — ${JSON.stringify(detail)}` : name)
  passed++
  console.log(`  ok   ${name}`)
}

// --- fake Meta -------------------------------------------------------------
const sent = []
let failNext = null
const meta = http.createServer((req, res) => {
  let raw = ''
  req.on('data', (c) => (raw += c))
  req.on('end', () => {
    const body = JSON.parse(raw || '{}')
    sent.push({ path: req.url, auth: req.headers.authorization, body })
    res.setHeader('Content-Type', 'application/json')
    if (failNext) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: failNext }))
      failNext = null
      return
    }
    res.end(JSON.stringify({ messages: [{ id: `wamid.fake.${sent.length}` }] }))
  })
})
await new Promise((resolve) => meta.listen(0, '127.0.0.1', resolve))
const META_URL = `http://127.0.0.1:${meta.address().port}`

// --- the panel ---------------------------------------------------------------
const next = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
  env: {
    ...process.env,
    WHATSAPP_ACCESS_TOKEN: 'fake-access-token',
    WHATSAPP_PHONE_NUMBER_ID: PHONE_NUMBER_ID,
    WHATSAPP_APP_SECRET: APP_SECRET,
    WHATSAPP_VERIFY_TOKEN: VERIFY_TOKEN,
    WHATSAPP_GRAPH_URL: META_URL,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let serverLog = ''
next.stdout.on('data', (c) => (serverLog += c))
next.stderr.on('data', (c) => (serverLog += c))

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`${BASE}/api/whatsapp/webhook`)
      if (r.status) return
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`next dev no arrancó:\n${serverLog}`)
}

// --- database ------------------------------------------------------------
const admin = new pg.Client({ connectionString: LOCAL_DATABASE_URL, ssl: false })

async function asAnon(sql, args) {
  const c = new pg.Client({ connectionString: LOCAL_DATABASE_URL, ssl: false })
  await c.connect()
  try {
    await c.query('begin')
    await c.query('set local role anon')
    const r = await c.query(sql, args)
    await c.query('commit')
    return r.rows
  } finally {
    await c.end()
  }
}

async function business() {
  const id = (
    await admin.query(
      `insert into businesses (name, phone, municipio, is_active, accepts_orders, order_tracking,
         has_delivery, delivery_fee, whatsapp_phone)
       values ($1, '6180000000', 'Vicente Guerrero', true, true, true, true, 20, $2)
       returning id`,
      [`Prueba aviso ${run} ${businesses.length}`, OWNER],
    )
  ).rows[0].id
  businesses.push(id)
  return id
}

const createSql = `select create_order(
  p_business_id => $1, p_items => $2::jsonb, p_mode => $3, p_customer_name => $4,
  p_customer_phone => $5, p_expected_total_cents => $6, p_delivery_lat => $7,
  p_delivery_lng => $8, p_delivery_directions => $9, p_delivery_references => $10,
  p_pays_with => $11) as token`

async function createOrder(biz, service, mode = 'delivery') {
  const delivery = mode === 'delivery'
  const rows = await asAnon(createSql, [
    biz,
    JSON.stringify([{ service_id: service, quantity: 2, note: 'sin cebolla\ny bien dorado' }]),
    mode,
    'Cliente\tde prueba',
    '6181234567',
    delivery ? 12000 : 10000,
    delivery ? 23.73 : null,
    delivery ? -103.98 : null,
    delivery ? 'Por la calle\nde la iglesia' : null,
    delivery ? 'Casa azul' : null,
    '500',
  ])
  return rows[0].token
}

const orderRow = async (token) =>
  (await admin.query('select * from orders where token = $1', [token])).rows[0]

async function waitFor(check, label) {
  for (let i = 0; i < 50; i++) {
    const value = await check()
    if (value) return value
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`Se agotó la espera: ${label}`)
}

// --- calls -----------------------------------------------------------------
const notify = (token) =>
  fetch(`${BASE}/api/orders/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://app.vichente.com' },
    body: JSON.stringify({ token }),
  })

function webhookBody(value) {
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '520000000000', phone_number_id: PHONE_NUMBER_ID },
              ...value,
            },
          },
        ],
      },
    ],
  })
}

const sign = (raw, secret = APP_SECRET) =>
  `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`

function postWebhook(raw, signature = sign(raw)) {
  const headers = { 'Content-Type': 'application/json' }
  if (signature) headers['X-Hub-Signature-256'] = signature
  return fetch(`${BASE}/api/whatsapp/webhook`, { method: 'POST', headers, body: raw })
}

const tap = (orderId, action, from = `521${OWNER}`) =>
  webhookBody({
    messages: [
      {
        from,
        id: `wamid.in.${randomUUID()}`,
        type: 'interactive',
        interactive: {
          type: 'button_reply',
          button_reply: { id: `order:${orderId}:${action}`, title: 'x' },
        },
      },
    ],
  })

const templateParams = (message, component) =>
  Object.fromEntries(
    message.body.template.components
      .find((c) => c.type === component)
      .parameters.map((p) => [p.parameter_name, p.text]),
  )

// ---------------------------------------------------------------------------
await admin.connect()
try {
  console.log(`Arrancando next dev en ${BASE}…`)
  await waitForServer()

  const biz = await business()
  const service = (
    await admin.query(
      `insert into business_services (business_id, name, price, is_published)
       values ($1, 'Torta de pierna', 50, true) returning id`,
      [biz],
    )
  ).rows[0].id

  // --- subscription check -----------------------------------------------------
  {
    const good = await fetch(
      `${BASE}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=12345`,
    )
    ok(
      'la verificación de Meta devuelve el challenge',
      good.status === 200 && (await good.text()) === '12345',
    )
    const bad = await fetch(
      `${BASE}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=12345`,
    )
    ok('con otro token de verificación responde 403', bad.status === 403)
  }

  // --- the notice -------------------------------------------------------------
  const token = await createOrder(biz, service)
  {
    const pre = await fetch(`${BASE}/api/orders/notify`, { method: 'OPTIONS' })
    ok(
      'el preflight de la web app pasa',
      pre.status === 204 && pre.headers.get('access-control-allow-origin') === '*',
    )
    const bad = await fetch(`${BASE}/api/orders/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"token": 1}',
    })
    ok('un cuerpo sin token responde 400', bad.status === 400)
    const missing = await notify('token-que-no-existe-0000')
    ok('un token que no existe responde 404', missing.status === 404)
  }

  const first = await notify(token)
  const firstBody = await first.json()
  ok(
    'el aviso responde sent',
    first.status === 200 && firstBody.notify_status === 'sent',
    firstBody,
  )
  ok('la respuesta trae CORS', first.headers.get('access-control-allow-origin') === '*')
  const order = await orderRow(token)
  ok(
    'el pedido queda con notify_status sent',
    order.notify_status === 'sent' && order.notify_error === null,
  )

  const template = sent.at(-1)
  ok('se mandó una sola plantilla', sent.length === 1 && template.body.type === 'template')
  ok(
    'va al WhatsApp del negocio con +52, desde el número configurado',
    template.body.to === `52${OWNER}` &&
      template.path === `/v23.0/${PHONE_NUMBER_ID}/messages` &&
      template.auth === 'Bearer fake-access-token',
    template,
  )
  ok(
    'usa pedido_domicilio en es_MX con el id del pedido de vuelta',
    template.body.template.name === 'pedido_domicilio' &&
      template.body.template.language.code === 'es_MX' &&
      template.body.biz_opaque_callback_data === `order:${order.id}`,
  )
  {
    const header = templateParams(template, 'header')
    const body = templateParams(template, 'body')
    const all = [...Object.values(header), ...Object.values(body)]
    ok(
      'ningún parámetro lleva salto de línea, tabulador ni espacios seguidos',
      all.every((v) => v && !/[\n\t]| {5,}/.test(v)),
      { header, body },
    )
    ok('el encabezado lleva al cliente', header.cliente === 'Cliente de prueba', header)
    ok(
      'platillos, total, dónde y teléfono salen del pedido',
      body.platillos === '2× Torta de pierna – Nota: sin cebolla y bien dorado' &&
        body.total === '$120 con $20 de envío · paga con $500' &&
        body.donde ===
          'https://maps.google.com/?q=23.73,-103.98 · Por la calle de la iglesia · Referencias: Casa azul' &&
        body.telefono === '+52 618 123 4567',
      body,
    )
    const buttons = template.body.template.components.filter((c) => c.type === 'button')
    ok(
      'los botones llevan aceptar y rechazar con el id',
      buttons[0].parameters[0].payload === `order:${order.id}:accepted` &&
        buttons[1].parameters[0].payload === `order:${order.id}:rejected`,
    )
  }

  const again = await (await notify(token)).json()
  ok('llamar otra vez no manda otro mensaje', again.notify_status === 'sent' && sent.length === 1)

  // --- the webhook ------------------------------------------------------------
  {
    const raw = tap(order.id, 'accepted')
    const unsigned = await postWebhook(raw, null)
    const forged = await postWebhook(raw, sign(raw, 'otro-secreto'))
    const tampered = await postWebhook(raw.replace('accepted', 'rejected'), sign(raw))
    await new Promise((r) => setTimeout(r, 500))
    ok(
      'sin firma, con firma de otro secreto o con el cuerpo alterado responde 401',
      unsigned.status === 401 && forged.status === 401 && tampered.status === 401,
    )
    ok(
      'y el pedido no cambia ni se contesta nada',
      (await orderRow(token)).status === 'pending' && sent.length === 1,
    )

    const stranger = await postWebhook(tap(order.id, 'accepted', '5216180000000'))
    await new Promise((r) => setTimeout(r, 500))
    ok(
      'un toque desde otro número no cambia el pedido',
      stranger.status === 200 && (await orderRow(token)).status === 'pending' && sent.length === 1,
    )
  }

  const step = async (action, expected, label) => {
    const before = sent.length
    const response = await postWebhook(tap(order.id, action))
    ok(`${label}: el webhook responde 200`, response.status === 200)
    await waitFor(async () => sent.length > before, `respuesta a ${action}`)
    const status = (await orderRow(token)).status
    ok(`${label}: el pedido queda ${expected}`, status === expected, status)
    return sent.at(-1).body
  }

  let reply = await step('accepted', 'accepted', 'Aceptar')
  ok(
    'al aceptar llega el pedido para la cocina con el botón de preparar',
    reply.type === 'interactive' &&
      reply.to === `521${OWNER}` &&
      reply.interactive.body.text.includes(
        '2× Torta de pierna\n   Nota: sin cebolla\ny bien dorado',
      ) &&
      reply.interactive.action.buttons[0].reply.title === 'Lo estoy preparando',
    reply,
  )

  reply = await step('accepted', 'accepted', 'Aceptar repetido')
  ok(
    'el toque repetido contesta en qué va, con el botón siguiente',
    reply.interactive?.body.text === 'El pedido de Cliente de prueba ya está aceptado.' &&
      reply.interactive.action.buttons[0].reply.id === `order:${order.id}:preparing`,
    reply,
  )

  reply = await step('on_the_way', 'accepted', 'Saltarse preparar')
  ok(
    'saltar un paso no avanza el pedido',
    reply.interactive?.body.text.includes('ya está aceptado'),
  )

  reply = await step('preparing', 'preparing', 'Lo estoy preparando')
  ok(
    'en preparación ofrece «Ya salió»',
    reply.interactive?.action.buttons[0].reply.title === 'Ya salió',
  )

  reply = await step('rejected', 'preparing', 'Rechazar uno aceptado')
  ok(
    'rechazar uno aceptado pide llamar al cliente',
    reply.interactive?.body.text.startsWith('Ya aceptaste'),
  )

  reply = await step('on_the_way', 'on_the_way', 'Ya salió')
  ok(
    'en camino cierra sin botones',
    reply.type === 'text' &&
      reply.text.body === 'Listo. Cliente de prueba confirma en la app cuando lo reciba.',
  )

  reply = await step('preparing', 'on_the_way', 'Preparar de un mensaje viejo')
  ok('un mensaje viejo no hace retroceder el pedido', reply.type === 'text')

  // --- texto libre ------------------------------------------------------------
  {
    const before = sent.length
    await postWebhook(
      webhookBody({
        messages: [{ from: `521${OWNER}`, id: 'x', type: 'text', text: { body: 'hola' } }],
      }),
    )
    await waitFor(async () => sent.length > before, 'respuesta al texto')
    ok(
      'un texto recibe la respuesta de que nadie lee el número',
      sent.at(-1).body.text.body.startsWith('Este número'),
    )
  }

  // --- rechazo de Meta y aviso fallido después ------------------------------
  {
    const failing = await createOrder(biz, service)
    failNext = { code: 132001, message: 'Template name does not exist in the translation' }
    const r = await (await notify(failing)).json()
    const row = await orderRow(failing)
    ok(
      'un envío que Meta rechaza queda failed con el error',
      r.notify_status === 'failed' &&
        row.notify_status === 'failed' &&
        row.notify_error === '132001: Template name does not exist in the translation',
      row,
    )

    const later = await createOrder(biz, service)
    await notify(later)
    const laterRow = await orderRow(later)
    await postWebhook(
      webhookBody({
        statuses: [
          {
            id: 'wamid.x',
            status: 'failed',
            recipient_id: `52${OWNER}`,
            biz_opaque_callback_data: `order:${laterRow.id}`,
            errors: [{ code: 131026, title: 'Message undeliverable' }],
          },
        ],
      }),
    )
    const failedLater = await waitFor(async () => {
      const row = await orderRow(later)
      return row.notify_status === 'failed' ? row : null
    }, 'aviso de entrega fallida')
    ok(
      'un mensaje que Meta no pudo entregar pasa el aviso a failed',
      failedLater.notify_error === '131026: Message undeliverable',
    )
  }

  // --- para recoger -----------------------------------------------------------
  {
    const pickup = await createOrder(biz, service, 'pickup')
    await notify(pickup)
    const message = sent.at(-1).body
    ok(
      'un pedido para recoger usa pedido_recoger sin «dónde»',
      message.template.name === 'pedido_recoger' &&
        !('donde' in templateParams(sent.at(-1), 'body')) &&
        templateParams(sent.at(-1), 'body').total === '$100 · paga con $500',
    )
    const id = (await orderRow(pickup)).id
    const before = sent.length
    await postWebhook(tap(id, 'accepted'))
    await waitFor(async () => sent.length > before, 'aceptar para recoger')
    const prep = sent.length
    await postWebhook(tap(id, 'preparing'))
    await waitFor(async () => sent.length > prep, 'preparar para recoger')
    ok(
      'para recoger, el botón dice «Ya está listo»',
      sent.at(-1).body.interactive.action.buttons[0].reply.title === 'Ya está listo',
    )
  }

  console.log(`\n${passed} comprobaciones del aviso por WhatsApp OK`)
} catch (error) {
  console.error(`\nLog de next dev:\n${serverLog.slice(-4000)}`)
  throw error
} finally {
  await admin.query('delete from businesses where id = any($1::uuid[])', [businesses])
  await admin.end()
  next.kill('SIGTERM')
  meta.close()
}
