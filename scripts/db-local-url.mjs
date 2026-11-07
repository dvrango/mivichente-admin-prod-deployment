// URL de la DB local del minipc, en un solo lugar para todos los scripts de `admin/`.
//
// Sale de `LOCAL_DATABASE_URL`; sin la variable, es la DB local de siempre. Así se
// puede apuntar `db:migrate:local`, `db:schema:snapshot`, `db:rls:check` y
// `db:local:check` a otra base sin editar cada script.
//
//   import { LOCAL_DATABASE_URL } from './db-local-url.mjs'   desde Node
//   node scripts/db-local-url.mjs                             desde un shell: la imprime
//
// No aplica a `db-replay-check.sh` (corre en el minipc y ve la DB como `localhost`) ni a
// los scripts de `backup/`, que viven en el minipc con sus propias variables.

import { pathToFileURL } from 'node:url'

export const DEFAULT_LOCAL_DATABASE_URL =
  'postgresql://postgres:postgres@100.96.221.80:54322/postgres'

export const LOCAL_DATABASE_URL = process.env.LOCAL_DATABASE_URL || DEFAULT_LOCAL_DATABASE_URL

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(LOCAL_DATABASE_URL)
}
