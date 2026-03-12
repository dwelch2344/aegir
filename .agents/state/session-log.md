# Session Log

## 2026-03-11 — Fork Cleanup

### What was done

Forked from a healthcare contracting prototype and stripped domain-specific code:

1. **Removed**: `legal` service (contracts, Select Health workflows, workflow notes)
2. **Removed frontend**: office/contracting pages, `useContracting` composable
3. **Removed**: prototype-specific env vars (AGENT_INTEL, DOCUSIGN, GOOGLE_DRIVE, SH_* carrier configs)
4. **Removed**: prototype-specific docs (overview, agent-loop, todo, notes, biz/, dev/notes)
5. **Cleaned up**: gateway (removed legal subgraph ref), traefik (removed legal route), postgres init (removed legal_svc), dashboard cards genericized
6. **Kept**: Conductor + orchestration + conductor-cdc + agents (restored after initial removal)

### What remains

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
