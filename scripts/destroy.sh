#!/usr/bin/env bash
set -euo pipefail

# Tears down all persistent state so init.sh can rebuild from scratch.
# Run from the devcontainer.

DEVCONTAINER_DIR="$(cd "$(dirname "$0")/../.devcontainer" && pwd)"

echo "[destroy] stopping all containers..."
docker compose -f "$DEVCONTAINER_DIR/docker-compose.yml" down -v --remove-orphans 2>/dev/null || true

echo "[destroy] removing persistent data volumes..."
rm -rf "$DEVCONTAINER_DIR/data/postgres"
rm -rf "$DEVCONTAINER_DIR/data/redis"
rm -rf "$DEVCONTAINER_DIR/data/conductor"
rm -rf "$DEVCONTAINER_DIR/data/redpanda"
rm -rf "$DEVCONTAINER_DIR/data/grafana"
rm -rf "$DEVCONTAINER_DIR/data/keycloak"
rm -rf "$DEVCONTAINER_DIR/data/s3"

echo ""
echo "[destroy] all infrastructure torn down"
echo "[destroy] run 'dc up -d && pnpm init:infra' to rebuild"
