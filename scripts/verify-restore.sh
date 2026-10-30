#!/usr/bin/env bash
# Proves a database dump can be restored: bash scripts/verify-restore.sh <dump file>
# Uses a throwaway Postgres container, removed on exit. Prints row counts; nothing leaves this machine.
set -euo pipefail

dump="${1:?Usage: verify-restore.sh <dump file>}"
[ -s "$dump" ] || { echo "No dump at $dump, or it is empty" >&2; exit 1; }

name="xbul-restore-$$"
trap 'docker rm -f -v "$name" > /dev/null 2>&1 || true' EXIT
docker run -d --name "$name" -e POSTGRES_PASSWORD=postgres postgres:17 > /dev/null

# Over TCP, because Postgres's first start during setup listens on its socket only and would look ready too early.
for _ in $(seq 1 60); do
  docker exec "$name" pg_isready -h localhost -U postgres > /dev/null 2>&1 && break
  sleep 1
done
docker exec "$name" pg_isready -h localhost -U postgres > /dev/null || { echo "Postgres did not start" >&2; exit 1; }

docker exec -i "$name" pg_restore --no-owner --no-privileges -U postgres -d postgres < "$dump"

count() { docker exec "$name" psql -U postgres -d postgres -tAc "select count(*) from $1"; }
companies="$(count companies)"
echo "companies: $companies"
claims="$(count claims)"
users="$(count '"user"')"
echo "claims: $claims"
echo "users: $users"
[ "$companies" -gt 0 ] || { echo "The restore has no companies" >&2; exit 1; }
echo "Restore works."
