#!/usr/bin/env bash
set -euo pipefail

# Idempotent infrastructure initialization script.
# Safe to run multiple times — creates only what's missing.

PG_HOST="${PG_HOST:-postgres}"
PG_PORT="${PG_PORT:-5432}"
PG_SUPERUSER="${PG_SUPERUSER:-aegir}"
PG_SUPERPASS="${PG_SUPERPASS:-aegir_dev}"

PSQL="psql -h $PG_HOST -p $PG_PORT -U $PG_SUPERUSER -v ON_ERROR_STOP=0"
export PGPASSWORD="$PG_SUPERPASS"

echo "[init] waiting for postgres..."
until pg_isready -h "$PG_HOST" -p "$PG_PORT" -U "$PG_SUPERUSER" -q 2>/dev/null; do
  sleep 1
done
echo "[init] postgres is ready"

# ──────────────────────────────────────────────
# Helper: idempotent user + database creation
# ──────────────────────────────────────────────
ensure_user() {
  local user="$1" pass="$2" extra="${3:-}"
  $PSQL -d aegir -tc "SELECT 1 FROM pg_roles WHERE rolname='$user'" | grep -q 1 \
    || $PSQL -d aegir -c "CREATE USER $user WITH ENCRYPTED PASSWORD '$pass' $extra;"
  echo "[init] user '$user' ready"
}

ensure_database() {
  local db="$1" owner="$2"
  $PSQL -d aegir -tc "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1 \
    || $PSQL -d aegir -c "CREATE DATABASE $db OWNER $owner;"
  $PSQL -d aegir -c "GRANT ALL PRIVILEGES ON DATABASE $db TO $owner;" 2>/dev/null || true
  echo "[init] database '$db' ready"
}

ensure_schema() {
  local db="$1" schema="$2" owner="$3"
  $PSQL -d "$db" -c "CREATE SCHEMA IF NOT EXISTS $schema AUTHORIZATION $owner;"
  $PSQL -d "$db" -c "GRANT ALL ON SCHEMA $schema TO $owner;"
  echo "[init] schema '$db.$schema' ready"
}

# ──────────────────────────────────────────────
# Keycloak
# ──────────────────────────────────────────────
ensure_user keycloak keycloak_dev
ensure_database keycloak keycloak

# ──────────────────────────────────────────────
# IAM service (schema in aegir DB)
# ──────────────────────────────────────────────
ensure_user iam_svc iam_dev
$PSQL -d aegir -c "GRANT ALL PRIVILEGES ON DATABASE aegir TO iam_svc;" 2>/dev/null || true
ensure_schema aegir iam iam_svc

# ──────────────────────────────────────────────
# Projects service (schema in aegir DB)
# ──────────────────────────────────────────────
ensure_schema aegir projects "$PG_SUPERUSER"

# ──────────────────────────────────────────────
# Practices service (schema in aegir DB)
# ──────────────────────────────────────────────
ensure_schema aegir practices "$PG_SUPERUSER"

# ──────────────────────────────────────────────
# System service (schema in aegir DB)
# ──────────────────────────────────────────────
ensure_schema aegir system "$PG_SUPERUSER"

# ──────────────────────────────────────────────
# Agents service (schema in aegir DB)
# ──────────────────────────────────────────────
ensure_schema aegir agents "$PG_SUPERUSER"

# ──────────────────────────────────────────────
# Conductor (workflow engine) — needs REPLICATION for CDC
# ──────────────────────────────────────────────
ensure_user conductor conductor_dev REPLICATION
ensure_database conductor conductor

# ──────────────────────────────────────────────
# Conductor CDC (normalized events sink)
# ──────────────────────────────────────────────
ensure_database conductor_cdc "$PG_SUPERUSER"

# ──────────────────────────────────────────────
# Conductor events (materialized in aegir DB)
# ──────────────────────────────────────────────
ensure_schema aegir conductor "$PG_SUPERUSER"

# ──────────────────────────────────────────────
# Replication access for Debezium CDC
# ──────────────────────────────────────────────
# Ensure pg_hba.conf allows replication from docker network
docker exec aegir-postgres sh -c \
  'grep -q "host replication conductor 0.0.0.0/0" /var/lib/postgresql/data/pg_hba.conf 2>/dev/null \
   || echo "host replication conductor 0.0.0.0/0 md5" >> /var/lib/postgresql/data/pg_hba.conf' \
  2>/dev/null || true
docker exec -u postgres aegir-postgres pg_ctl reload -D /var/lib/postgresql/data 2>/dev/null || true

echo ""
echo "[init] all databases and users initialized successfully"
