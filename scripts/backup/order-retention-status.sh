#!/usr/bin/env bash
#
# Says when the order retention purge last ran, read from the nightly data dump.
# The purge is the pg_cron job purge-order-customer-data in prod (mikitasks
# uuyrkazz7); each run leaves a row in public.order_retention_runs, which travels
# in the dump like any other table of public.
#
#   order-retention-status.sh <data.sql.gz>
#
# Prints one line in Spanish for the Discord message and exits with:
#   0  the purge ran within the last ORDER_RETENTION_MAX_DAYS days (default 2)
#   1  it stopped: its last run is older than that, or it never ran
#   2  the dump has no order_retention_runs table: the migration is not in prod
#   3  this script itself failed (unreadable dump, unparseable date)
#
# pg_cron failing silently is the case this exists for: nothing errors, the
# customers' data just stays. Runs on the minipc (GNU date), called by
# backup-prod.sh.
#
set -euo pipefail
# A failure here must not read as "the purge stopped" (exit 1).
trap 'exit 3' ERR

DUMP="${1:?usage: order-retention-status.sh <data.sql.gz>}"
MAX_DAYS="${ORDER_RETENTION_MAX_DAYS:-2}"

# The column positions come from the COPY header, not from the table's current
# order, so a future column does not shift what is read. awk reads the whole
# file instead of exiting early: an early exit sends SIGPIPE to gzip and, with
# pipefail, that fails the script (same trap as the business count in
# backup-prod.sh).
last="$(gzip -dc "$DUMP" | awk -F'\t' '
  /^COPY "?public"?\."?order_retention_runs"? / {
    found = 1; inside = 1
    header = $0
    sub(/^[^(]*\(/, "", header); sub(/\).*$/, "", header); gsub(/[" ]/, "", header)
    n = split(header, cols, ",")
    for (i = 1; i <= n; i++) {
      if (cols[i] == "ran_at") at = i
      if (cols[i] == "orders_purged") count = i
    }
    next
  }
  inside && /^\\\.$/ { inside = 0; next }
  inside && $at > latest { latest = $at; purged = $count }
  END {
    if (!found) print "missing"
    else if (latest == "") print "empty"
    else print latest "\t" purged
  }
')"

case "$last" in
  missing)
    echo "Limpieza de pedidos: todavía no está en prod (falta el db:push de su migración)."
    exit 2
    ;;
  empty)
    echo "⚠️ Limpieza de pedidos: **nunca ha corrido**. Los datos de los clientes no se están borrando."
    exit 1
    ;;
esac

ran_at="${last%%$'\t'*}"
purged="${last#*$'\t'}"
age_days=$(( ( $(date +%s) - $(date -d "$ran_at" +%s) ) / 86400 ))
day="$(date -d "$ran_at" +%Y-%m-%d)"

if [ "$age_days" -ge "$MAX_DAYS" ]; then
  echo "⚠️ Limpieza de pedidos: la última corrida fue el \`${day}\`, hace **${age_days}** días. Dejó de correr y los datos de los clientes no se están borrando."
  exit 1
fi

echo "Limpieza de pedidos: última corrida \`${day}\` · ${purged} pedidos limpiados"
