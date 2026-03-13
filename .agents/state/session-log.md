# Session Log

## 2026-03-11 — Reverse Fork

### What was abstracted

- `@aegir/common` — shared utilities
- `@aegir/domain` — Identity, Organization types
- `@aegir/gateway` — Mercurius federated GraphQL gateway (:4000)
- `@aegir/iam` — identity & organization subgraph (:4001)
- `@aegir/agents` — AI conversation subgraph (:4003)
- `@aegir/orchestration` — Conductor workflow task workers (:4010)
- `@aegir/conductor-cdc` — change data capture from Conductor
- `@aegir/app` — Nuxt 3 SSR frontend (:3000)
- DevContainer stack: Postgres, Keycloak, Conductor, MinIO, Redpanda, Redis, Debezium, Mailhog, Grafana/Tempo/Loki/Promtail, Traefik
- OpenTofu infra, scripts
