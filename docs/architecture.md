# Architecture

## System Layering

1. `Telemetry Source (simulated)`
2. `Event Normalizer`
3. `SQLite Event Store`
4. `DORA Engine (pure functions)`
5. `Reporting Engine`
6. `Fastify API`
7. `React Dashboard`

The design keeps metric logic deterministic and independent from persistence and transport concerns.

## Separation Of Concerns

- `packages/event-model`
  - Defines canonical event contracts and shared domain types.
  - No database or API responsibilities.
- `packages/storage-sqlite`
  - Owns SQLite schema, indexes, and event persistence/query.
  - Converts rows to domain events.
- `packages/dora-engine`
  - Contains pure DORA computations over event arrays.
  - No IO side effects.
- `packages/reporting-engine`
  - Converts metric deltas into executive insights.
  - Heuristic recommendation generation.
- `apps/api`
  - Orchestrates requests, window parsing, storage reads, and engine composition.
  - Hosts normalizer for ingestion flow.
- `apps/dashboard`
  - Consumes JSON endpoints and renders metric/summary views.

## Extensibility Model

Adapters for Azure DevOps, GitHub, Jira, or other tools should output canonical `DeliveryEvent` objects (or raw payloads transformed by the normalizer).

Proposed adapter contract:

```ts
interface TelemetryAdapter {
  fetchRawEvents(): Promise<unknown[]>;
  normalize(raw: unknown[]): DeliveryEvent[];
}
```

Because DORA and reporting engines are source-agnostic, adding adapters does not require metric code changes.