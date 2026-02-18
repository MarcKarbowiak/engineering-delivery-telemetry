# Engineering Delivery Telemetry

Source-agnostic Delivery Intelligence platform implementing DORA metrics, telemetry normalization, and executive reporting.

## Architecture

```mermaid
flowchart LR
  Telemetry[Telemetry Source (simulated)] --> Normalizer[Event Normalizer]
  Normalizer --> Store[(SQLite Event Store)]
  Store --> Dora[DORA Engine\nPure Functions]
  Dora --> Reporting[Reporting Engine]
  Reporting --> Api[Fastify API]
  Api --> Dash[React Dashboard]
```

## Repository Structure

```text
/apps
  /api
  /dashboard
/packages
  /event-model
  /dora-engine
  /reporting-engine
  /storage-sqlite
/docs
  architecture.md
  dora-math.md
/docker
  api.Dockerfile
  dashboard.Dockerfile
docker-compose.yml
README.md
```

## Core Contracts

Canonical event model in `packages/event-model/src/index.ts`:

- `DeliveryEventType`
  - `commit`
  - `pr_merged`
  - `deployment_started`
  - `deployment_succeeded`
  - `deployment_failed`
  - `incident_opened`
  - `incident_resolved`
- `DeliveryEvent`
  - `id`, `type`, `timestamp`, `service`, optional `environment`, `commitId`, `correlationId`

SQLite table: `delivery_events`

- `id TEXT PRIMARY KEY`
- `type TEXT NOT NULL`
- `timestamp DATETIME NOT NULL`
- `service TEXT NOT NULL`
- `environment TEXT`
- `commitId TEXT`
- `correlationId TEXT`
- Index: `(type, timestamp)`

## API Endpoints

- `GET /health`
- `GET /metrics`
- `GET /metrics?window=7d`
- `GET /summary`
- `POST /seed`

## Local Run (Node)

```bash
npm install
npm run dev:api
npm run dev:dashboard
```

Seed simulated telemetry:

```bash
curl -X POST http://localhost:3000/seed
```

## Docker Run

```bash
docker compose up --build
```

Services:

- API: `http://localhost:3000`
- Dashboard: `http://localhost:5173`

## Test

```bash
npm run test
```

DORA pure-function tests are under `packages/dora-engine/test`.

## Separation Of Concerns

- No persistence logic inside DORA computations.
- No HTTP logic inside metric math.
- Ingestion normalization is separate from storage.
- API orchestrates storage + engines only.

## Staged Implementation Mapping

1. Monorepo scaffold + base structure
2. Canonical event model + SQLite storage
3. Pure DORA engine + unit tests
4. Reporting engine
5. Fastify API
6. React dashboard
7. Docker support
8. Documentation polish