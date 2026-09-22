// Verifica contra la DB LOCAL que las policies de RLS hagan lo que dicen.
//
// Por qué existe: ~14 server actions del admin no chequean rol en código y
// dependen 100% de RLS. Si una policy queda mal, no hay red abajo — y leer los
// archivos de migración no sirve para saber qué hay vivo (pasó el 2026-08-10:
// una migración decía `using (true)` y en prod ya estaba corregida).
//
// Cómo funciona: se conecta como `postgres`, abre una transacción, impersona a
// cada perfil con `set local role authenticated` + `request.jwt.claims` (que es
// de donde lee `auth.uid()`), corre lecturas y escrituras reales, y termina con
// ROLLBACK. No deja rastro en la base.
//
//   node scripts/rls-check.mjs
//
// Contra prod NO se corre: crea filas (aunque las revierta) y monta un usuario
// de auth de mentiras. El flujo es verificar en local y después `db:push`.

import pg from 'pg'

const CONN =
  process.env.LOCAL_DATABASE_URL ?? 'postgresql://postgres:postgres@100.96.221.80:54322/postgres'
const PENDING_ID = '00000000-0000-4000-8000-00000000dead'

let pass = 0
let fail = 0

function check(name, ok, detail) {
  if (ok) {
    pass++
    console.log(`  ok   ${name}`)
  } else {
    fail++
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function as(c, uid, fn) {
  await c.query('savepoint sp')
  await c.query('set local role authenticated')
  await c.query(
    `set local request.jwt.claims = '${JSON.stringify({ sub: uid, role: 'authenticated' })}'`,
  )
  try {
    await fn()
  } finally {
    await c.query('rollback to savepoint sp')
    await c.query('reset role')
  }
}

// anon no lleva `request.jwt.claims`: es una petición sin sesión, y auth.uid()
// devuelve null. Por eso no reusa `as()`, que sí los setea.
async function asAnon(c, fn) {
  await c.query('savepoint sp_anon')
  await c.query('set local role anon')
  try {
    await fn()
  } finally {
    await c.query('rollback to savepoint sp_anon')
    await c.query('reset role')
  }
}

// Corre una escritura y clasifica el resultado. Ojo con la diferencia: un
// INSERT bloqueado por RLS tira error, pero un DELETE bloqueado por RLS
// simplemente no encuentra la fila y afecta 0 — las dos cosas son "denegado".
async function attempt(c, sql, params) {
  await c.query('savepoint w')
  try {
    const r = await c.query(sql, params)
    await c.query('release savepoint w')
    return { outcome: 'ok', rows: r.rowCount }
  } catch (e) {
    await c.query('rollback to savepoint w')
    const denied = /row-level security|permission denied/i.test(e.message)
    return { outcome: denied ? 'denied' : `error: ${e.message}`, rows: 0 }
  }
}

async function main() {
  const c = new pg.Client({ connectionString: CONN, ssl: false })
  await c.connect()
  await c.query('begin')

  // --- a quién impersonar ------------------------------------------------
  const admin = (await c.query("select id from profiles where role = 'admin' limit 1")).rows[0]
  const reviewer = (
    await c.query(
      "select id, municipio from profiles where role = 'reviewer' and municipio is not null limit 1",
    )
  ).rows[0]

  if (!admin || !reviewer) {
    console.error(
      'Falta un admin o un reviewer con municipio en la base local. Sin eso no hay nada que verificar.',
    )
    process.exit(1)
  }

  const suyo = reviewer.municipio
  const otro = (
    await c.query('select municipio from businesses where municipio <> $1 limit 1', [suyo])
  ).rows[0]?.municipio

  if (!otro) {
    console.error(`Sólo hay negocios de "${suyo}": no se puede probar el scoping por municipio.`)
    process.exit(1)
  }

  console.log(`reviewer de "${suyo}" contra negocios de "${otro}"\n`)

  const bizSuyo = (await c.query('select id from businesses where municipio = $1 limit 1', [suyo]))
    .rows[0].id
  const bizOtro = (await c.query('select id from businesses where municipio = $1 limit 1', [otro]))
    .rows[0].id

  const negocioDefaultPedidos = (
    await c.query(
      "insert into businesses (name, phone) values ('RLS check acepta pedidos', '6180000000') returning accepts_orders",
    )
  ).rows[0]
  check(
    'negocio nuevo nace con pedidos apagados',
    negocioDefaultPedidos.accepts_orders === false,
    String(negocioDefaultPedidos.accepts_orders),
  )

  // Una fila real evita que los checks de lectura/update/delete de la nueva
  // telemetría pasen por vacío. Se crea como postgres y el rollback final la
  // elimina junto con el resto de fixtures.
  const eventoPedido = (
    await c.query(
      `insert into order_funnel_events (device_id, business_id, step)
       values ('rls-check', $1, 'menu_viewed') returning id`,
      [bizSuyo],
    )
  ).rows[0].id

  // --- fixtures ----------------------------------------------------------
  const fotoSuyo = (
    await c.query(
      "insert into business_photos (business_id, url, kind) values ($1, 'https://x/a.webp', 'otro') returning id",
      [bizSuyo],
    )
  ).rows[0].id
  const fotoOtro = (
    await c.query(
      "insert into business_photos (business_id, url, kind) values ($1, 'https://x/b.webp', 'otro') returning id",
      [bizOtro],
    )
  ).rows[0].id
  const repSuyo = (
    await c.query(
      "insert into business_reports (business_id, reason) values ($1, 'cerrado') returning id",
      [bizSuyo],
    )
  ).rows[0].id
  const repOtro = (
    await c.query(
      "insert into business_reports (business_id, reason) values ($1, 'cerrado') returning id",
      [bizOtro],
    )
  ).rows[0].id

  // Una solicitud de registro con su foto en el bucket privado. Van de fixture y
  // no se dan por sentadas de la base de seed: `registration-photos` está vacío
  // en local, así que ahí un `count(*) = 0` pasa sin probar nada. Ese vacío es
  // justo cómo este harness dio verde el 2026-09-11 con la policy del bucket
  // abierta a todo el staff en vez de sólo al admin.
  await c.query(
    `insert into business_registrations (business_name, phone, contact_name, municipio, photo_paths)
     values ('RLS check', '6180000000', 'RLS check', $1, array['rls-check.webp'])`,
    [suyo],
  )
  const fotoAlta = (
    await c.query(
      `insert into storage.objects (bucket_id, name, owner)
       values ('registration-photos', 'rls-check.webp', $1) returning id`,
      [admin.id],
    )
  ).rows[0].id

  // Opciones de un platillo (sabor, extras). Dos platillos del MISMO negocio,
  // uno publicado y otro en borrador: lo que separa lo que anon ve de lo que no
  // es `is_published`, no el negocio. El negocio se elige activo a propósito —
  // sobre uno inactivo anon no vería nada y los checks pasarían sin probar
  // nada, que es el mismo vacío que dejó pasar la policy del bucket el
  // 2026-09-11.
  const bizActivo = (
    await c.query('select id from businesses where municipio = $1 and is_active limit 1', [suyo])
  ).rows[0]?.id

  if (!bizActivo) {
    console.error(`No hay un negocio activo en "${suyo}": los checks de anon no probarían nada.`)
    process.exit(1)
  }

  const svcPub = (
    await c.query(
      `insert into business_services (business_id, name, price, is_published)
       values ($1, 'RLS check publicado', 40, true) returning id`,
      [bizActivo],
    )
  ).rows[0].id
  const svcDraft = (
    await c.query(
      `insert into business_services (business_id, name, price, is_published)
       values ($1, 'RLS check borrador', 40, false) returning id`,
      [bizActivo],
    )
  ).rows[0].id

  const grupoPub = (
    await c.query(
      `insert into business_service_option_groups (service_id, business_id, name)
       values ($1, $2, 'Sabor') returning id`,
      [svcPub, bizActivo],
    )
  ).rows[0].id
  const grupoDraft = (
    await c.query(
      `insert into business_service_option_groups (service_id, business_id, name)
       values ($1, $2, 'Sabor') returning id`,
      [svcDraft, bizActivo],
    )
  ).rows[0].id
  await c.query(
    `insert into business_service_options (group_id, business_id, name, price_delta)
     values ($1, $2, 'Capuchino', 0)`,
    [grupoPub, bizActivo],
  )
  await c.query(
    `insert into business_service_options (group_id, business_id, name, price_delta)
     values ($1, $2, 'Capuchino', 0)`,
    [grupoDraft, bizActivo],
  )

  const svcOtro = (
    await c.query(
      `insert into business_services (business_id, name, price, is_published)
       values ($1, 'RLS check otro municipio', 40, true) returning id`,
      [bizOtro],
    )
  ).rows[0].id

  // Tercer fixture: platillo PUBLICADO de un negocio INACTIVO. Sin él, los
  // checks de anon de arriba sólo ejercen la pata `is_published` de la policy y
  // pasarían igual de verde si alguien quitara el join a `businesses` con
  // `b.is_active = true` — que es el mismo vacío de fixture que estos checks
  // dicen estar evitando, movido un renglón más abajo.
  const bizInactivo = (await c.query('select id from businesses where is_active = false limit 1'))
    .rows[0]?.id

  if (!bizInactivo) {
    console.error(
      'No hay ningún negocio inactivo en la base local: la pata is_active no se prueba.',
    )
    process.exit(1)
  }

  const svcInactivo = (
    await c.query(
      `insert into business_services (business_id, name, price, is_published)
       values ($1, 'RLS check negocio inactivo', 40, true) returning id`,
      [bizInactivo],
    )
  ).rows[0].id
  const grupoInactivo = (
    await c.query(
      `insert into business_service_option_groups (service_id, business_id, name)
       values ($1, $2, 'Sabor') returning id`,
      [svcInactivo, bizInactivo],
    )
  ).rows[0].id
  await c.query(
    `insert into business_service_options (group_id, business_id, name, price_delta)
     values ($1, $2, 'Capuchino', 0)`,
    [grupoInactivo, bizInactivo],
  )

  // Cuenta recién registrada: el trigger handle_new_user() le crea el perfil.
  await c.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-check@ejemplo.com', 'x', now(), now(), now())`,
    [PENDING_ID],
  )

  console.log('cuenta recién registrada')
  const rolNuevo = (await c.query('select role from profiles where id = $1', [PENDING_ID])).rows[0]
  check('nace en rol pending', rolNuevo?.role === 'pending', `rol = ${rolNuevo?.role}`)

  await as(c, PENDING_ID, async () => {
    const n = (q) => c.query(q).then((r) => Number(r.rows[0].count))
    check('no lee negocios', (await n('select count(*) from businesses')) === 0)
    check('no lee fotos', (await n('select count(*) from business_photos')) === 0)
    check('no lee servicios', (await n('select count(*) from business_services')) === 0)
    check('no lee reportes', (await n('select count(*) from business_reports')) === 0)
    check('no lee horarios', (await n('select count(*) from business_hours')) === 0)
    check(
      'no lee grupos de opciones',
      (await n('select count(*) from business_service_option_groups')) === 0,
    )
    check('no lee opciones', (await n('select count(*) from business_service_options')) === 0)
    check('no lee altas de negocio', (await n('select count(*) from business_registrations')) === 0)
    check(
      'no lee registration-photos',
      (await n("select count(*) from storage.objects where bucket_id = 'registration-photos'")) ===
        0,
    )

    const ins = await attempt(
      c,
      "insert into business_photos (business_id, url, kind) values ($1, 'https://x/hack.webp', 'otro')",
      [bizSuyo],
    )
    check('no inserta fotos', ins.outcome === 'denied', ins.outcome)

    const del = await attempt(c, 'delete from business_photos where id = $1', [fotoSuyo])
    check('no borra fotos', del.rows === 0, `${del.outcome} (${del.rows} filas)`)

    const delRep = await attempt(c, 'delete from business_reports where id = $1', [repSuyo])
    check('no borra reportes', delRep.rows === 0, `${delRep.outcome} (${delRep.rows} filas)`)

    const delAlta = await attempt(c, 'delete from storage.objects where id = $1', [fotoAlta])
    check(
      'no borra registration-photos',
      delAlta.rows === 0,
      `${delAlta.outcome} (${delAlta.rows} filas)`,
    )

    const insGrupo = await attempt(
      c,
      "insert into business_service_option_groups (service_id, business_id, name) values ($1, $2, 'Hack')",
      [svcPub, bizActivo],
    )
    check('no inserta grupos de opciones', insGrupo.outcome === 'denied', insGrupo.outcome)

    const insOpcion = await attempt(
      c,
      "insert into business_service_options (group_id, business_id, name, price_delta) values ($1, $2, 'Hack', 99)",
      [grupoPub, bizActivo],
    )
    check('no inserta opciones', insOpcion.outcome === 'denied', insOpcion.outcome)

    const st = await attempt(
      c,
      "insert into storage.objects (bucket_id, name, owner) values ('business-photos', $1 || '/hack.webp', $2)",
      [bizSuyo, PENDING_ID],
    )
    check('no sube a storage (carpeta de negocio)', st.outcome === 'denied', st.outcome)

    const stRaiz = await attempt(
      c,
      "insert into storage.objects (bucket_id, name, owner) values ('business-photos', 'hack.webp', $1)",
      [PENDING_ID],
    )
    check('no sube a storage (raíz)', stRaiz.outcome === 'denied', stRaiz.outcome)
  })

  console.log('\nreviewer')
  await as(c, reviewer.id, async () => {
    const n = (q, p) => c.query(q, p).then((r) => Number(r.rows[0].count))
    check(
      'lee negocios de otros municipios',
      (await n('select count(*) from businesses where municipio = $1', [otro])) > 0,
    )
    check('lee fotos', (await n('select count(*) from business_photos')) > 0)
    check('lee reportes', (await n('select count(*) from business_reports')) >= 2)

    const permisoPedidos = await attempt(
      c,
      'update businesses set accepts_orders = not accepts_orders where id = $1',
      [bizSuyo],
    )
    check(
      'NO cambia si un negocio acepta pedidos',
      permisoPedidos.outcome === 'denied',
      permisoPedidos.outcome,
    )

    const edicionPermitida = await attempt(
      c,
      'update businesses set description = description where id = $1',
      [bizSuyo],
    )
    check(
      'sigue editando campos permitidos del negocio',
      edicionPermitida.rows === 1,
      `${edicionPermitida.outcome} (${edicionPermitida.rows})`,
    )

    const insSuyo = await attempt(
      c,
      "insert into business_photos (business_id, url, kind) values ($1, 'https://x/ok.webp', 'otro')",
      [bizSuyo],
    )
    check('inserta foto en su municipio', insSuyo.outcome === 'ok', insSuyo.outcome)

    const insOtro = await attempt(
      c,
      "insert into business_photos (business_id, url, kind) values ($1, 'https://x/no.webp', 'otro')",
      [bizOtro],
    )
    check('NO inserta foto en otro municipio', insOtro.outcome === 'denied', insOtro.outcome)

    const delSuyo = await attempt(c, 'delete from business_photos where id = $1', [fotoSuyo])
    check('borra foto de su municipio', delSuyo.rows === 1, `${delSuyo.outcome} (${delSuyo.rows})`)

    const delOtro = await attempt(c, 'delete from business_photos where id = $1', [fotoOtro])
    check(
      'NO borra foto de otro municipio',
      delOtro.rows === 0,
      `${delOtro.outcome} (${delOtro.rows})`,
    )

    const rSuyo = await attempt(c, 'delete from business_reports where id = $1', [repSuyo])
    check('descarta reporte de su municipio', rSuyo.rows === 1, `${rSuyo.outcome} (${rSuyo.rows})`)

    const rOtro = await attempt(c, 'delete from business_reports where id = $1', [repOtro])
    check(
      'NO descarta reporte de otro municipio',
      rOtro.rows === 0,
      `${rOtro.outcome} (${rOtro.rows})`,
    )

    // Grupos de opciones: mismo scope por municipio que el resto del menú. El
    // reviewer lee los de todos (incluido el borrador, que anon no ve) pero
    // sólo escribe en los suyos.
    check(
      'lee grupos de opciones de platillos en borrador',
      (await n('select count(*) from business_service_option_groups where service_id = $1', [
        svcDraft,
      ])) === 1,
    )

    const grupoSuyo = await attempt(
      c,
      "insert into business_service_option_groups (service_id, business_id, name) values ($1, $2, 'Leche')",
      [svcPub, bizActivo],
    )
    check('inserta grupo en su municipio', grupoSuyo.outcome === 'ok', grupoSuyo.outcome)

    const grupoOtro = await attempt(
      c,
      "insert into business_service_option_groups (service_id, business_id, name) values ($1, $2, 'Leche')",
      [svcOtro, bizOtro],
    )
    check('NO inserta grupo en otro municipio', grupoOtro.outcome === 'denied', grupoOtro.outcome)

    // El business_id se lo pone el trigger desde el platillo padre, así que
    // mandar el de un negocio propio no alcanza para colar un grupo en un
    // platillo ajeno: la policy ve el business_id ya corregido.
    const grupoSuplantado = await attempt(
      c,
      "insert into business_service_option_groups (service_id, business_id, name) values ($1, $2, 'Suplantado')",
      [svcOtro, bizActivo],
    )
    check(
      'NO cuela un grupo en un platillo ajeno mandando su propio business_id',
      grupoSuplantado.outcome === 'denied',
      grupoSuplantado.outcome,
    )

    const opcionSuya = await attempt(
      c,
      "insert into business_service_options (group_id, business_id, name, price_delta) values ($1, $2, 'Deslactosada', 0)",
      [grupoPub, bizActivo],
    )
    check('inserta opción en su municipio', opcionSuya.outcome === 'ok', opcionSuya.outcome)

    // La suplantación también tiene que estar cerrada por UPDATE, no sólo por
    // INSERT: el trigger es `before insert or update of service_id,
    // business_id`. Si alguien lo acotara a `before insert`, un reviewer podría
    // mover un grupo suyo al platillo de otro municipio con un update y el
    // harness seguiría verde.
    const mueveGrupo = await attempt(
      c,
      'update business_service_option_groups set service_id = $1 where id = $2',
      [svcOtro, grupoPub],
    )
    check(
      'NO mueve un grupo suyo a un platillo de otro municipio',
      mueveGrupo.outcome === 'denied' || mueveGrupo.rows === 0,
      `${mueveGrupo.outcome} (${mueveGrupo.rows})`,
    )

    const mueveOpcion = await attempt(
      c,
      'update business_service_options set group_id = $1 where group_id = $2',
      [grupoInactivo, grupoPub],
    )
    check(
      'NO mueve una opción suya a un grupo de otro negocio',
      mueveOpcion.outcome === 'denied' || mueveOpcion.rows === 0,
      `${mueveOpcion.outcome} (${mueveOpcion.rows})`,
    )

    // TRUNCATE no pasa por RLS: lo único que lo detiene es el grant de tabla.
    // Por eso las dos tablas se otorgan operación por operación en vez de con
    // `grant all`, y por eso este check existe — un `grant all` que vuelva a
    // colarse no cambiaría ninguna policy y ningún otro check lo vería.
    const truncGrupos = await attempt(c, 'truncate business_service_option_groups cascade')
    check(
      'NO puede truncar los grupos de opciones',
      truncGrupos.outcome === 'denied',
      truncGrupos.outcome,
    )

    const truncOpciones = await attempt(c, 'truncate business_service_options')
    check(
      'NO puede truncar las opciones',
      truncOpciones.outcome === 'denied',
      truncOpciones.outcome,
    )

    const delGrupoOtro = await attempt(
      c,
      'delete from business_service_option_groups where service_id = $1',
      [svcOtro],
    )
    check(
      'NO borra grupos de otro municipio',
      delGrupoOtro.rows === 0,
      `${delGrupoOtro.outcome} (${delGrupoOtro.rows})`,
    )

    const stSuyo = await attempt(
      c,
      "insert into storage.objects (bucket_id, name, owner) values ('business-photos', $1 || '/ok.webp', $2)",
      [bizSuyo, reviewer.id],
    )
    check('sube a la carpeta de un negocio suyo', stSuyo.outcome === 'ok', stSuyo.outcome)

    const stOtro = await attempt(
      c,
      "insert into storage.objects (bucket_id, name, owner) values ('business-photos', $1 || '/no.webp', $2)",
      [bizOtro, reviewer.id],
    )
    check('NO sube a la carpeta de otro municipio', stOtro.outcome === 'denied', stOtro.outcome)

    // La raíz del bucket queda abierta al staff a propósito: el form de
    // escritorio sube la foto antes de que el negocio exista.
    const stRaiz = await attempt(
      c,
      "insert into storage.objects (bucket_id, name, owner) values ('business-photos', 'nuevo.webp', $1)",
      [reviewer.id],
    )
    check('sube a la raíz (negocio aún sin crear)', stRaiz.outcome === 'ok', stRaiz.outcome)

    // Las solicitudes de registro son solo-admin, y eso incluye el bucket
    // privado donde viven sus fotos. Son fotos que manda un negocio por el
    // formulario público de la landing y que todavía no aprueba nadie: el
    // reviewer no ve la solicitud en el panel, así que tampoco debe poder
    // listar, firmar ni borrar sus archivos. Sin estos tres checks la policy
    // se puede aflojar a is_staff() otra vez y el harness no se entera.
    check('NO lee altas de negocio', (await n('select count(*) from business_registrations')) === 0)
    check(
      'NO lee registration-photos',
      (await n("select count(*) from storage.objects where bucket_id = 'registration-photos'")) ===
        0,
    )

    const delAlta = await attempt(c, 'delete from storage.objects where id = $1', [fotoAlta])
    check(
      'NO borra registration-photos',
      delAlta.rows === 0,
      `${delAlta.outcome} (${delAlta.rows})`,
    )
  })

  console.log('\nadmin')
  await as(c, admin.id, async () => {
    const n = (q, p) => c.query(q, p).then((r) => Number(r.rows[0].count))
    check('lee negocios', (await n('select count(*) from businesses')) > 0)

    const activaPedidos = await attempt(
      c,
      'update businesses set accepts_orders = true where id = $1',
      [bizSuyo],
    )
    check(
      'activa pedidos',
      activaPedidos.rows === 1,
      `${activaPedidos.outcome} (${activaPedidos.rows})`,
    )
    check(
      'lee pedidos activados',
      (await n('select count(*) from businesses where id = $1 and accepts_orders', [bizSuyo])) ===
        1,
    )

    const desactivaPedidos = await attempt(
      c,
      'update businesses set accepts_orders = false where id = $1',
      [bizSuyo],
    )
    check(
      'desactiva pedidos',
      desactivaPedidos.rows === 1,
      `${desactivaPedidos.outcome} (${desactivaPedidos.rows})`,
    )

    const ins = await attempt(
      c,
      "insert into business_photos (business_id, url, kind) values ($1, 'https://x/adm.webp', 'otro')",
      [bizOtro],
    )
    check('inserta foto en cualquier municipio', ins.outcome === 'ok', ins.outcome)

    const rep = await attempt(c, 'delete from business_reports where id = $1', [repOtro])
    check('descarta cualquier reporte', rep.rows === 1, `${rep.outcome} (${rep.rows})`)

    const st = await attempt(
      c,
      "insert into storage.objects (bucket_id, name, owner) values ('business-photos', $1 || '/adm.webp', $2)",
      [bizOtro, admin.id],
    )
    check('sube a cualquier carpeta', st.outcome === 'ok', st.outcome)

    // La contraparte de los checks del reviewer: cerrar el bucket no debe
    // romper /registrations, que es su único consumidor.
    check('lee altas de negocio', (await n('select count(*) from business_registrations')) > 0)
    check(
      'lee registration-photos',
      (await n("select count(*) from storage.objects where bucket_id = 'registration-photos'")) > 0,
    )

    const delAlta = await attempt(c, 'delete from storage.objects where id = $1', [fotoAlta])
    check('borra registration-photos', delAlta.rows === 1, `${delAlta.outcome} (${delAlta.rows})`)
  })

  // anon es el principal MÁS expuesto: su key va en el bundle web, o sea que
  // cualquiera la tiene. Hoy sus policies están bien; lo que faltaba era la red
  // que impida aflojarlas sin que nadie se entere.
  console.log('\nanon (la key pública)')
  await asAnon(c, async () => {
    // A anon lo pueden frenar DOS cosas distintas, y las dos cuentan como
    // "no ve": la policy de RLS (devuelve 0 filas) o el GRANT de tabla, que
    // tira 42501 antes de llegar a RLS. `profiles` y `business_reports` son
    // del segundo tipo. Tratar el error como falla haría fallar el harness por
    // un permiso MÁS estricto, que es al revés de lo que queremos.
    const noVe = async (label, sql) => {
      const r = await attempt(c, sql)
      if (r.outcome === 'denied') return check(label, true)
      if (r.outcome !== 'ok') return check(label, false, r.outcome)
      const filas = Number((await c.query(sql)).rows[0].count)
      check(label, filas === 0, `${filas} filas`)
    }

    await noVe(
      'solo ve negocios activos',
      'select count(*) from businesses where is_active = false',
    )
    await noVe('no ve altas de negocio', 'select count(*) from business_registrations')
    await noVe('no ve reportes de abuso', 'select count(*) from business_reports')
    await noVe('no ve perfiles', 'select count(*) from profiles')
    await noVe('no ve eventos del embudo de pedido', 'select count(*) from order_funnel_events')
    await noVe('no ve dispositivos excluidos', 'select count(*) from excluded_devices')
    await noVe(
      'no ve registration-photos',
      "select count(*) from storage.objects where bucket_id = 'registration-photos'",
    )

    // Opciones: anon las ve sólo si vería el platillo. Los dos platillos son
    // del mismo negocio activo, así que lo único que los separa es
    // `is_published` — si la policy se aflojara a "existe el platillo", el
    // borrador se colaría y este check es lo único que lo diría.
    const ve = async (label, sql, params, esperado) => {
      const r = await attempt(c, sql, params)
      if (r.outcome !== 'ok') return check(label, false, r.outcome)
      const filas = Number((await c.query(sql, params)).rows[0].count)
      check(label, filas === esperado, `${filas} filas`)
    }

    await ve(
      've el grupo de un platillo publicado',
      'select count(*) from business_service_option_groups where service_id = $1',
      [svcPub],
      1,
    )
    await ve(
      'NO ve el grupo de un platillo en borrador',
      'select count(*) from business_service_option_groups where service_id = $1',
      [svcDraft],
      0,
    )
    await ve(
      've la opción de un platillo publicado',
      'select count(*) from business_service_options where group_id = $1',
      [grupoPub],
      1,
    )
    await ve(
      'NO ve la opción de un platillo en borrador',
      'select count(*) from business_service_options where group_id = $1',
      [grupoDraft],
      0,
    )
    await ve(
      'NO ve el grupo de un platillo publicado de un negocio inactivo',
      'select count(*) from business_service_option_groups where service_id = $1',
      [svcInactivo],
      0,
    )
    await ve(
      'NO ve la opción de un platillo publicado de un negocio inactivo',
      'select count(*) from business_service_options where group_id = $1',
      [grupoInactivo],
      0,
    )

    const insGrupo = await attempt(
      c,
      "insert into business_service_option_groups (service_id, business_id, name) values ($1, $2, 'Hack')",
      [svcPub, bizActivo],
    )
    check('no inserta grupos de opciones', insGrupo.outcome === 'denied', insGrupo.outcome)

    const insOpcion = await attempt(
      c,
      "insert into business_service_options (group_id, business_id, name, price_delta) values ($1, $2, 'Hack', 99)",
      [grupoPub, bizActivo],
    )
    check('no inserta opciones', insOpcion.outcome === 'denied', insOpcion.outcome)

    const insEvento = await attempt(
      c,
      `insert into order_funnel_events (device_id, business_id, step)
       values ('rls-check-anon', $1, 'item_added')`,
      [bizActivo],
    )
    check('inserta eventos del embudo de pedido', insEvento.outcome === 'ok', insEvento.outcome)

    const cambiaEvento = await attempt(
      c,
      "update order_funnel_events set step = 'checkout_started' where id = $1",
      [eventoPedido],
    )
    check(
      'no cambia eventos del embudo de pedido',
      cambiaEvento.outcome === 'denied' || cambiaEvento.rows === 0,
      `${cambiaEvento.outcome} (${cambiaEvento.rows})`,
    )

    const borraEvento = await attempt(c, 'delete from order_funnel_events where id = $1', [
      eventoPedido,
    ])
    check(
      'no borra eventos del embudo de pedido',
      borraEvento.outcome === 'denied' || borraEvento.rows === 0,
      `${borraEvento.outcome} (${borraEvento.rows})`,
    )

    const insExcluido = await attempt(
      c,
      "insert into excluded_devices (device_id, label) values ('hack', 'Hack')",
    )
    check(
      'no administra dispositivos excluidos',
      insExcluido.outcome === 'denied',
      insExcluido.outcome,
    )

    const upOpcion = await attempt(
      c,
      'update business_service_options set price_delta = 0 where group_id = $1',
      [grupoPub],
    )
    check(
      'no cambia el precio de una opción',
      upOpcion.rows === 0,
      `${upOpcion.outcome} (${upOpcion.rows})`,
    )
  })

  console.log('\nbucket business-photos')
  const bucket = (
    await c.query(
      "select file_size_limit, allowed_mime_types from storage.buckets where id = 'business-photos'",
    )
  ).rows[0]
  check(
    'tiene límite de tamaño',
    Number(bucket.file_size_limit) === 5242880,
    String(bucket.file_size_limit),
  )
  check(
    'tiene lista de mime types',
    Array.isArray(bucket.allowed_mime_types) && bucket.allowed_mime_types.includes('image/webp'),
    JSON.stringify(bucket.allowed_mime_types),
  )

  await c.query('rollback')
  await c.end()

  console.log(`\n${pass} ok, ${fail} fail`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
