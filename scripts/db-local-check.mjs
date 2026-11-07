// Falla si la DB local tiene aplicada una migración que no es de `origin/master` ni de
// la rama actual.
//
// Por qué existe: la DB local del minipc es una sola para todas las ramas. Si otra
// tarea ya aplicó su migración, el snapshot de esta rama la arrastra, `db:schema:check`
// falla en ramas que no tocaron la DB y el `rls-check` mide policies que no son de aquí.
// Las tareas con migración van una a la vez, y este check es el que lo hace cumplir:
// `db:migrate:local` y `db:schema:snapshot` lo corren antes y se detienen si falla.
//
//   npm run db:local:check
//
// Compara las versiones de `supabase_migrations.schema_migrations` contra los archivos
// de `supabase/migrations/` en `origin/master` y en el árbol de trabajo (la rama actual,
// con lo que todavía no se commitea). Una versión que local tiene y ninguno de los dos
// trae es ajena: el check busca en qué rama vive su archivo para decir de qué tarea es.
//
// No revierte nada. Qué hacer con la migración ajena lo decide el usuario: esperar a que
// esa tarea se mergee, o revertirla a mano si la tarea se abandonó.

import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

import { LOCAL_DATABASE_URL } from './db-local-url.mjs'

const ADMIN = join(dirname(fileURLToPath(import.meta.url)), '..')
const MIGRACIONES = 'supabase/migrations'
const BASE = 'origin/master'

function git(...args) {
  return execFileSync('git', args, { cwd: ADMIN, encoding: 'utf8' }).trim()
}

// `20261107120000_owner_snapshot.sql` → `20261107120000`, como lo guarda el CLI.
function versionDe(archivo) {
  const m = /^(\d+)_.*\.sql$/.exec(archivo)
  return m ? m[1] : null
}

function versiones(archivos) {
  const out = new Map()
  for (const archivo of archivos) {
    const v = versionDe(archivo)
    if (v) out.set(v, archivo)
  }
  return out
}

// Sin fetch, una migración que se mergeó después del último fetch saldría como ajena.
// Si no hay red, se sigue con el `origin/master` que haya y se avisa.
try {
  execFileSync('git', ['fetch', 'origin', '--quiet'], {
    cwd: ADMIN,
    stdio: 'ignore',
    timeout: 20000,
    // Sin esto, una llave SSH con passphrase pide la clave por la terminal y cuelga el check.
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_SSH_COMMAND: 'ssh -o BatchMode=yes' },
  })
} catch {
  console.warn(
    `! No se pudo hacer git fetch; se compara contra el ${BASE} local, que puede estar viejo.`,
  )
}

const enBase = versiones(
  git('ls-tree', '--name-only', `${BASE}:${MIGRACIONES}`).split('\n').filter(Boolean),
)
const enRama = versiones(readdirSync(join(ADMIN, MIGRACIONES)))
const rama = git('rev-parse', '--abbrev-ref', 'HEAD')

const client = new pg.Client({
  connectionString: LOCAL_DATABASE_URL,
  ssl: false,
  connectionTimeoutMillis: 10000,
})
let enLocal
try {
  await client.connect()
  const { rows } = await client.query(
    'select version, name from supabase_migrations.schema_migrations order by version',
  )
  enLocal = new Map(rows.map((r) => [r.version, r.name]))
} catch (e) {
  console.error(`✗ No se pudo leer schema_migrations de la DB local: ${e.message}`)
  console.error('  ¿Está prendida la DB local del minipc? La URL sale de LOCAL_DATABASE_URL.')
  process.exit(1)
} finally {
  await client.end().catch(() => {})
}

// Qué rama trae el archivo de una versión. Busca el commit que lo agregó en cualquier
// ref y lista las ramas que lo contienen; el `taskId` sale del nombre `{taskId}-{repo}`.
function duenoDe(version) {
  const commit = git(
    'log',
    '--all',
    '--diff-filter=A',
    '--format=%H',
    '-1',
    '--',
    `${MIGRACIONES}/${version}_*.sql`,
  )
  if (!commit) return null
  const ramas = git('branch', '-a', '--contains', commit, '--format=%(refname:short)')
    .split('\n')
    .filter(Boolean)
    .map((r) => r.replace(/^origin\//, ''))
  const unicas = [...new Set(ramas)].filter((r) => r !== 'HEAD' && r !== 'origin')
  const tareas = [...new Set(unicas.map((r) => /^([a-z0-9]{9})-/.exec(r)?.[1]).filter(Boolean))]
  return { ramas: unicas, tareas }
}

const ajenas = [...enLocal.keys()].filter((v) => !enBase.has(v) && !enRama.has(v))
// En master y en local, pero no en esta rama: la rama salió antes de que se mergeara. El
// snapshot de aquí arrastraría ese schema y `migration up` no podría correr.
const rezagadas = [...enBase.keys()].filter((v) => !enRama.has(v) && enLocal.has(v))
const atrasadas = [...enBase.keys()].filter((v) => enRama.has(v) && !enLocal.has(v))

const propias = [...enRama.keys()].filter((v) => !enBase.has(v))
console.log(
  `DB local: ${enLocal.size} migraciones. ${BASE}: ${enBase.size}. Propias de ${rama}: ${propias.length}.`,
)

const aplicadasRama = propias.filter((v) => enLocal.has(v))
const pendientesRama = propias.filter((v) => !enLocal.has(v))
if (aplicadasRama.length) {
  console.log(`  Aplicadas de esta rama: ${aplicadasRama.map((v) => enRama.get(v)).join(', ')}`)
}
if (pendientesRama.length) {
  console.log(`  Sin aplicar de esta rama: ${pendientesRama.map((v) => enRama.get(v)).join(', ')}`)
}
if (atrasadas.length) {
  console.warn(
    `! A local le faltan ${atrasadas.length} migraciones de ${BASE}: ${atrasadas.map((v) => enBase.get(v)).join(', ')}`,
  )
  console.warn(
    '  Corre npm run db:migrate:local antes de confiar en el snapshot o en el rls-check. Si ya',
  )
  console.warn(
    '  aplicaste una migración propia con timestamp posterior, el CLI va a pedir --include-all.',
  )
}

let falla = false

if (rezagadas.length) {
  falla = true
  console.error()
  console.error(
    `✗ La rama ${rama} está atrás de ${BASE}: local ya tiene ${rezagadas.length} migración(es) de ${BASE} que esta rama no trae:`,
  )
  for (const v of rezagadas) console.error(`  - ${enBase.get(v)}`)
  console.error(`  Rebasea la rama sobre ${BASE} antes de migrar o de regenerar el snapshot.`)
}

if (ajenas.length) {
  falla = true
  const deOtraTarea = []
  console.error()
  console.error(
    `✗ La DB local tiene ${ajenas.length} migración(es) que no son de ${BASE} ni de la rama ${rama}:`,
  )
  for (const v of ajenas) {
    const nombre = enLocal.get(v) ? `${v}_${enLocal.get(v)}` : v
    const dueno = duenoDe(v)
    if (!dueno || dueno.ramas.length === 0) {
      deOtraTarea.push(v)
      console.error(
        `  - ${nombre}: no está en ninguna rama de este clon. Se aplicó desde un archivo sin commitear, desde otra máquina o a mano.`,
      )
    } else if (dueno.ramas.includes(rama) || dueno.ramas.includes('master')) {
      // El archivo existió en esta rama o en master y ya no está: lo renombraron (otro
      // timestamp) o lo borraron, y local se quedó con la versión vieja.
      const donde = dueno.ramas.includes(rama) ? `esta rama (${rama})` : 'master'
      console.error(
        `  - ${nombre}: es una versión vieja de ${donde}, renombrada o borrada. Hay que revertirla en local.`,
      )
    } else {
      deOtraTarea.push(v)
      const tareas = dueno.tareas.length ? ` (tarea ${dueno.tareas.join(', ')})` : ''
      console.error(`  - ${nombre}: rama ${dueno.ramas.join(', ')}${tareas}`)
    }
  }
  if (deOtraTarea.length) {
    console.error()
    console.error(
      'Otra tarea tiene una migración aplicada en local. Las tareas con migración van una a la vez:',
    )
    console.error(
      'no apliques la tuya ni confíes en db:schema:snapshot, db:schema:check o db:rls:check hasta',
    )
    console.error(
      'que esa tarea se mergee a master. Si se abandonó, revertirla en local lo decide el usuario.',
    )
  }
}

if (falla) process.exit(1)
console.log(`✓ Local coincide con ${BASE} más la rama actual.`)
