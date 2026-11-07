// URL de la DB local del minipc, en un solo lugar para todos los scripts de `admin/`.
//
// Sale de `LOCAL_DATABASE_URL`; sin la variable, es la DB local de siempre. Así se
// puede apuntar `db:migrate:local`, `db:schema:snapshot`, `db:rls:check` y
// `db:local:check` a otra base sin editar cada script.
//
//   import { LOCAL_DATABASE_URL } from './db-local-url.mjs'   desde Node
//   node scripts/db-local-url.mjs                             desde un shell: la imprime
//
// Solo acepta hosts locales: el minipc o la propia máquina. Con la variable apuntando a
// prod, `db:migrate:local` migraría prod, y eso lo hace el usuario con `db:push`.
//
// No aplica a `db-replay-check.sh` (corre en el minipc y ve la DB como `localhost`), a
// los scripts de `backup/`, que viven en el minipc con sus propias variables, ni a
// `migrate-business-hours.ts`, un script de una sola vez que también apunta a prod.

import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const DEFAULT_LOCAL_DATABASE_URL =
  'postgresql://postgres:postgres@100.96.221.80:54322/postgres'

const HOSTS_LOCALES = new Set(['100.96.221.80', 'localhost', '127.0.0.1'])

// Todos los que la importan son scripts de línea de comandos: salir con un mensaje
// claro es más útil que un stack trace.
function salir(mensaje) {
  console.error(`✗ ${mensaje}`)
  process.exit(1)
}

function urlLocal() {
  const url = process.env.LOCAL_DATABASE_URL || DEFAULT_LOCAL_DATABASE_URL
  let host
  try {
    host = new URL(url).hostname
  } catch {
    salir('LOCAL_DATABASE_URL no es una URL de Postgres válida.')
  }
  if (!HOSTS_LOCALES.has(host)) {
    salir(
      `LOCAL_DATABASE_URL apunta a ${host}, que no es la DB local. Hosts permitidos: ${[...HOSTS_LOCALES].join(', ')}.`,
    )
  }
  return url
}

export const LOCAL_DATABASE_URL = urlLocal()

// realpath en los dos lados: Node resuelve los symlinks en import.meta.url y argv[1]
// llega tal cual se escribió. Sin esto, llamado desde un cwd con symlink no imprime nada.
function esMain() {
  if (!process.argv[1]) return false
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])
  } catch {
    return false
  }
}

if (esMain()) process.stdout.write(LOCAL_DATABASE_URL)
