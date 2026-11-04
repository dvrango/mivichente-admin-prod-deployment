#!/usr/bin/env bash
#
# Lista las migraciones que trae HEAD y que todavía no están en lo desplegado.
#
# Uso: scripts/deploy/check-migrations.sh <desplegado> [<nuevo>]
#
# <desplegado> es lo que tiene hoy el repo espejo de Vercel (en el workflow,
# `mirror/master`), no el `before` del push. Si un deploy anterior se detuvo por una
# migración, el espejo se quedó atrás, y el siguiente merge, aunque no traiga
# migraciones, empujaría también el código que la necesita. Comparar contra el espejo
# cubre todo lo que falta desplegar.
#
# Imprime un archivo por línea y no imprime nada si no hay migraciones nuevas. Termina
# con error si <desplegado> no es ancestro de <nuevo>: el espejo divergió y el push no
# entraría en fast-forward.
#
set -euo pipefail

DESPLEGADO="${1:?Uso: $0 <desplegado> [<nuevo>]}"
NUEVO="${2:-HEAD}"

if ! git merge-base --is-ancestor "$DESPLEGADO" "$NUEVO"; then
  echo "Error: $DESPLEGADO no es ancestro de $NUEVO. La historia del espejo divergió." >&2
  exit 2
fi

# --no-renames: un rename dentro de migrations/ es una versión nueva para el CLI de
# Supabase, y sin esto saldría como R en vez de A.
git diff --name-only --no-renames --diff-filter=A "$DESPLEGADO" "$NUEVO" -- supabase/migrations/
