# Orchestration Service

A Fastify-based microservice that orchestrates multi-step workflows using [Netflix Conductor](https://conductor.netflix.com/) as the workflow engine.

## Architecture

The service follows a **worker-poll model**: it registers task and workflow definitions with Conductor, then continuously polls for tasks to execute via handler functions.

### User Onboarding Workflow (`user_onboarding`)

1. **validate_identity** — Validates email format and name length, generates an `identityId`
2. **provision_account** — Creates an account from the validated identity, generates an `accountId`
3. **send_welcome_email** — Sends a welcome email with account details

Each task has its own retry policy (fixed or exponential backoff) and timeout configuration defined in [src/definitions.ts](src/definitions.ts).

## Key Files

| File | Role |
|------|------|
| [src/app.ts](src/app.ts) | Fastify server setup, registers definitions with Conductor, starts workers |
| [src/conductor.ts](src/conductor.ts) | REST client wrapper for the Conductor API |
| [src/definitions.ts](src/definitions.ts) | Task definitions and workflow schema with retry policies |
| [src/worker-runner.ts](src/worker-runner.ts) | Polls Conductor for tasks and dispatches to handlers |
| [src/workers/](src/workers/) | Task handler implementations (pure functions) |

## REST Endpoints

- `GET /health` — Health check
- `POST /onboard` — Triggers the onboarding workflow. Accepts `{ email, name }`, returns `{ workflowId }`

## Configuration

| Variable | Default |
|----------|---------|
| `ORCHESTRATION_PORT` | `4010` |
| `ORCHESTRATION_HOST` | `0.0.0.0` |
| `CONDUCTOR_URL` | `http://conductor:8080/api` |

## Infrastructure

Depends on **Conductor** (backed by PostgreSQL and Redis), configured in the devcontainer [docker-compose.yml](../../.devcontainer/docker-compose.yml). The related [conductor-cdc](../conductor-cdc/) service streams Conductor workflow events via Redpanda (Kafka-compatible) for event-driven updates.

## Development

```sh
pnpm dev    # Start with hot reload (tsx watch)
pnpm build  # Compile to dist/ via tsup
```
