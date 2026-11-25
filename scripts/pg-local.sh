#!/usr/bin/env bash

set -e
cd "$HOME/workspace/bnt-topup"
if [ ! -x /tmp/pgbin/bin/postgres ]; then
  rm -rf /tmp/pgbin && cp -a "$HOME/workspace/tools/pg/dist" /tmp/pgbin && chmod -R a+rX /tmp/pgbin
fi
if [ ! -d /tmp/pg-data-topup ]; then
  runuser -u nobody -- mkdir -p /tmp/pg-data-topup /tmp/pg-home
  runuser -u nobody -- env LD_LIBRARY_PATH=/tmp/pgbin/lib HOME=/tmp/pg-home /tmp/pgbin/bin/initdb -D /tmp/pg-data-topup -U postgres --auth=trust -E UTF8 > /dev/null
fi
runuser -u nobody -- env LD_LIBRARY_PATH=/tmp/pgbin/lib HOME=/tmp/pg-home /tmp/pgbin/bin/pg_ctl -D /tmp/pg-data-topup -o "-p 5434 -k /tmp -c listen_addresses=127.0.0.1" -l /tmp/pg-topup.log start || true
sleep 1
export DATABASE_URL="postgresql://postgres@127.0.0.1:5434/postgres?schema=public"
export PRISMA_QUERY_ENGINE_LIBRARY="$PWD/node_modules/@prisma/engines/libquery_engine-debian-openssl-3.0.x.so.node"
export PRISMA_SCHEMA_ENGINE_BINARY="$PWD/node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x"
npx prisma db push
npx tsx prisma/seed.ts
echo "PG Top-Up sẵn sàng: postgresql://postgres@127.0.0.1:5434/postgres"
