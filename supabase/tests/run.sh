#!/usr/bin/env bash
# Runs the migrations and RLS checks against a throwaway local Postgres database.
# Usage: PGHOST=/tmp PGPORT=55432 PGUSER=postgres supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
psql -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists hustle_test" -c "create database hustle_test"
psql -q -v ON_ERROR_STOP=1 -d hustle_test -f tests/supabase_stub.sql
for f in migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d hustle_test -f "$f"; done
psql -q -t -v ON_ERROR_STOP=1 -d hustle_test -f tests/rls_test.sql 2>&1 | grep -E "ok:|FAIL|PASSED|ERROR" | sed 's/.*NOTICE:  //'
