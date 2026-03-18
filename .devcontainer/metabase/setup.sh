#!/usr/bin/env bash
set -euo pipefail

# Idempotent Metabase first-boot setup.
# Completes the setup wizard and adds the aegir database as a data source.
# Safe to run multiple times — skips if already configured.

METABASE_URL="${METABASE_URL:-http://localhost:3030}"
SETUP_TOKEN_ENDPOINT="$METABASE_URL/api/session/properties"
SETUP_ENDPOINT="$METABASE_URL/api/setup"
DATABASE_ENDPOINT="$METABASE_URL/api/database"

# Admin credentials (local dev only)
ADMIN_EMAIL="admin@aegir.local"
ADMIN_PASSWORD="aegir_admin_dev1!"
ADMIN_FIRST="Aegir"
ADMIN_LAST="Admin"

echo "[metabase-setup] waiting for metabase to be ready..."
until curl -sf "$METABASE_URL/api/health" | grep -q '"status":"ok"'; do
  sleep 3
done
echo "[metabase-setup] metabase is ready"

# Check if setup has already been completed
SETUP_TOKEN=$(curl -sf "$SETUP_TOKEN_ENDPOINT" | python3 -c "
import sys, json
props = json.load(sys.stdin)
token = props.get('setup-token')
if token:
    print(token)
" 2>/dev/null || true)

if [ -z "$SETUP_TOKEN" ]; then
  echo "[metabase-setup] already configured — skipping initial setup"
else
  echo "[metabase-setup] running first-time setup..."
  curl -sf -X POST "$SETUP_ENDPOINT" \
    -H "Content-Type: application/json" \
    -d "$(cat <<EOF
{
  "token": "$SETUP_TOKEN",
  "user": {
    "email": "$ADMIN_EMAIL",
    "password": "$ADMIN_PASSWORD",
    "first_name": "$ADMIN_FIRST",
    "last_name": "$ADMIN_LAST",
    "site_name": "Aegir Shipyard"
  },
  "database": {
    "engine": "postgres",
    "name": "Aegir (read-only)",
    "details": {
      "host": "postgres",
      "port": 5432,
      "dbname": "aegir",
      "user": "analytics_ro",
      "password": "analytics_ro_dev",
      "schema-filters-type": "all",
      "ssl": false
    }
  },
  "prefs": {
    "site_name": "Aegir Shipyard",
    "site_locale": "en",
    "allow_tracking": false
  }
}
EOF
)" > /dev/null
  echo "[metabase-setup] initial setup complete"
fi

# Add the read-write connection if it doesn't already exist
EXISTING_DBS=$(curl -sf "$METABASE_URL/api/database" \
  -H "Content-Type: application/json" 2>/dev/null || echo '{"data":[]}')

if echo "$EXISTING_DBS" | grep -q "Aegir (read-write)"; then
  echo "[metabase-setup] read-write database already exists — skipping"
else
  # Get a session token by logging in
  SESSION=$(curl -sf -X POST "$METABASE_URL/api/session" \
    -H "Content-Type: application/json" \
    -d "{\"username\": \"$ADMIN_EMAIL\", \"password\": \"$ADMIN_PASSWORD\"}" \
    | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null || true)

  if [ -n "$SESSION" ]; then
    curl -sf -X POST "$DATABASE_ENDPOINT" \
      -H "Content-Type: application/json" \
      -H "X-Metabase-Session: $SESSION" \
      -d "$(cat <<EOF
{
  "engine": "postgres",
  "name": "Aegir (read-write)",
  "details": {
    "host": "postgres",
    "port": 5432,
    "dbname": "aegir",
    "user": "analytics_rw",
    "password": "analytics_rw_dev",
    "schema-filters-type": "all",
    "ssl": false
  }
}
EOF
)" > /dev/null
    echo "[metabase-setup] read-write database added"
  else
    echo "[metabase-setup] WARNING: could not authenticate — skipping read-write database"
  fi
fi

echo "[metabase-setup] done"
