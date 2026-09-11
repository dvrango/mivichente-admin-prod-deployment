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
  })

  console.log('\nadmin')
  await as(c, admin.id, async () => {
    const n = (q, p) => c.query(q, p).then((r) => Number(r.rows[0].count))
    check('lee negocios', (await n('select count(*) from businesses')) > 0)

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
