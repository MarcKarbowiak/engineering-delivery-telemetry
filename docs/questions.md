# Repository Interview Question Bank

## Topics
- Architecture and system design
- Technology and tooling tradeoffs
- Code structure and implementation patterns
- DevSecOps and supply chain controls
- Reliability and testing strategy
- Observability and telemetry
- Progressive delivery and deployment model
- Governance and risk (including decision support outputs)
- Scalability and performance
- Cost and operational tradeoffs
- Consulting style diagnostics and leadership communication
- Hard panel pressure testing

## 1. Architecture & System Design
1. This repo enforces layering (normalizer, SQLite store, DORA engine pure functions, reporting engine, API, dashboard). Where do you draw the boundary between domain logic and orchestration, and which boundary is most likely to erode over time?
2. The system is intentionally source agnostic via a canonical `DeliveryEvent`. What is the minimal event contract that still supports all four DORA metrics, and what fields are accidental complexity for the current implementation?
3. Why store raw normalized events and compute metrics on read, instead of persisting precomputed aggregates or rollups? Under what workloads would you switch?
4. The API computes lead time using a fixed lookback (currently 30 days) beyond the requested window. What failure modes does that introduce, and how would you make it configurable or data driven?
5. The storage layer indexes only `(type, timestamp)`. What query patterns does this architecture assume, and what index strategy would you choose if service level drilldowns become a primary use case?
6. The reporting engine generates executive insights from metric deltas. How do you ensure the insights remain consistent, non misleading, and explainable as the metric definitions evolve?
7. The dashboard directly fetches `/metrics` and `/summary` and renders charts. What is the contract stability strategy between API and UI, and how do you version it without freezing the system?
8. If you were asked to add a real ingestion pipeline (webhook or polling adapters) without rewriting core logic, where would you place adapter code and what backpressure mechanisms would you require?
9. How do you reason about event time vs processing time here? What do you do when a late arriving `commit` event arrives after the associated `deployment_succeeded` already exists?
10. The system currently treats `service` as a first class dimension, but the API endpoints do not accept `service` filters. Is that deliberate? What is your future query surface, and how do you avoid creating an API that forces cross partition scans?
11. The normalizer throws on unsupported types and invalid timestamps. At scale, would you prefer fail fast or best effort ingestion? Describe the architecture changes you would make to support partial ingestion and auditability.
12. How do you define correctness for MTTR pairing logic when correlation IDs are missing and the code falls back to service order matching? What scenarios produce incorrect pairing, and how do you detect or limit that?
13. Where would you place the boundary for multi tenant support (tenant in partition key, tenant in event model, separate databases)? Explain the tradeoffs for operational isolation vs query complexity.
14. If a product leader asks for DORA metrics per environment (staging vs production), what changes are required across event model, storage, and metric computations, and how do you keep backward compatibility?
15. The repo ships both a local Node workflow and Docker Compose. What is your intended runtime truth: local dev only, single node demo, or a production reference architecture? What architectural risks come from trying to be all three?
16. Describe a migration path from SQLite to a managed database while keeping the DORA engine pure and testable. What interfaces need to exist before the migration begins?
17. The current design sorts events in memory for lead time and MTTR calculations. What is the architectural implication of doing heavy data processing in the API process, and where would you move that compute when volume grows?
18. If you needed real time metrics (near live updates), would you compute incrementally on ingest, stream update aggregates, or cache queries? Justify the approach with expected consistency semantics.
19. In your architecture, what are the explicit invariants for a `DeliveryEvent` stream (ordering, uniqueness, idempotency), and where are they enforced today?
20. What does data retention mean in this system? Who owns deletion policy, and how do you keep DORA metrics reproducible over time when events are removed?

## 2. Technology & Tooling Choices
1. Why Fastify for the API? What properties do you rely on (logging, plugin model, performance), and what would make you pick a different framework?
2. The monorepo uses npm workspaces and TypeScript with ESM. What are the tradeoffs versus a tool like pnpm or a build system like Nx, and how do you prevent dependency drift across packages?
3. SQLite is chosen for the event store. Explain the durability and concurrency constraints you accepted, and how you would communicate those limits to stakeholders.
4. The DB path is configured via `DB_PATH` with a default to a `data` directory. How do you manage environment specific configuration across local, CI, and containers without introducing config sprawl?
5. The Docker Compose design uses a named volume for SQLite data. What data integrity assumptions are you making during rebuilds and container restarts?
6. Zod is used for query and body parsing in the API. Why not JSON Schema validation or Fastify built in schema compilation? What performance and maintainability tradeoffs matter here?
7. The dashboard uses Vite and fetch based calls. Why not generate a typed client (OpenAPI or codegen) to reduce contract mismatch?
8. The CI pipeline builds Docker images after building and testing Node code. Would you reorder steps, and why? What is the best signal to fail fast on?
9. The test approach is custom Node scripts compiled via a test tsconfig. Why not a standard test runner? What benefits do you get, and what do you lose in reporting, watch mode, and ecosystem tooling?
10. The reporting engine uses heuristics and canned recommendations. Why not make those rules data driven? What would a rules engine buy you, and what complexity would it add?
11. CORS is configured with `origin: true`. What is the security and UX reason, and what is the minimum safe configuration for production?
12. The API uses a single process with an in process SQLite connection. What would you need to change to support horizontal scaling behind a load balancer?

## 3. Code Structure & Implementation Patterns
1. Walk through how `calculateDoraMetrics` scopes events for each metric. Why does lead time use the full event set while CFR and MTTR use window scoped events, and what does that imply?
2. In `calculateLeadTimeSamples`, the earliest commit timestamp per association key is tracked in a map. What is the worst case memory growth for that map, and how would you bound it?
3. The association keys include `commitId` and `correlationId` when different. What edge cases exist when both are present but refer to different concepts across telemetry sources?
4. `calculateMTTR` matches incident resolves to opens first by correlation ID then by service order. What happens when incidents overlap for the same service, and how would you improve correctness?
5. `SqliteEventStore.insertEvents` wraps inserts in an explicit transaction and uses `INSERT OR REPLACE`. What are the consequences for auditability, accidental overwrites, and idempotency semantics?
6. `listEvents` queries by timestamp string comparisons. What assumptions does that make about timestamp format, timezone normalization, and SQLite collation behavior?
7. The API creates `previousWindow` ending at `currentWindow.start - 1ms`. Why is that boundary chosen? What bugs appear around day boundaries and DST if local time leaks in?
8. `buildDailyTrend` computes a metric per day by repeatedly calling `calculateDoraMetrics`. What is the time complexity, and how do you refactor it for larger windows without changing outputs?
9. The dashboard performs two fetches in parallel for each window change. How would you handle partial failures, non ok responses, and retries without turning the UI into a state machine mess?
10. The API uses zod parsing for query and seed body, but there is no schema for telemetry ingestion beyond `/seed`. If you add ingestion, where do you validate, where do you normalize, and where do you reject?
11. Tests use random IDs in helpers. How do you ensure deterministic behavior, and what failures could be masked by randomness?
12. The reporting engine uses a 2 percent deadband for stable classification. Why 2, and how do you justify thresholds to a leadership audience?
13. `calculateDeltaPercent` returns 100 when previous is zero and current is nonzero. Is that mathematically and product wise correct? What does 100 mean there?
14. The UI uses `toFixed` and percentage formatting. How do you avoid misleading precision in executive dashboards, and where should rounding happen?
15. If you were to add service or environment filters end to end, name the exact modules and functions you would touch, and how you would keep the DORA engine pure.

## 4. DevSecOps & Supply Chain Controls
1. The CI workflow runs typecheck, test, build, and Docker builds. What security controls would you add first (dependency audit, SAST, container scanning), and how would you keep noise manageable?
2. What is your policy for pinning dependencies, and how do you handle transitive dependency risk in npm workspaces?
3. How do you ensure the Docker images are minimal and do not include dev dependencies, test artifacts, or secrets? What checks would you automate?
4. The API enables CORS broadly. What threat model do you assume for browser clients, and what origin policy should exist for a production deployment?
5. There is a `/seed` endpoint that mutates the database. How do you secure it, and what is the operational policy for enabling it in different environments?
6. SQLite file access is a key asset. How do you prevent path traversal or unsafe path configuration via `DB_PATH`, and what file system permissions model do you require?
7. What is your approach to secret management for future adapters (GitHub tokens, Azure DevOps PATs)? Where do they live, how are they rotated, and how do you prevent leakage in logs?
8. How do you implement provenance and integrity for ingested telemetry events (signature, origin tagging, replay protection) if this becomes a compliance relevant system?
9. What is your vulnerability response process? Which artifacts in this repo would you add to support it (security policy, SBOM, release notes)?
10. If this repo is used inside a regulated enterprise, what minimum governance artifacts are missing to satisfy audit expectations (threat model, data classification, retention policy)?
11. How would you implement authorization for read endpoints if metrics are sensitive by service or by tenant? What claims must be present and how do you enforce them consistently?
12. What is your position on running SQLite in container volumes for anything beyond demo usage? What is the security and backup story?

## 5. Reliability & Testing Strategy
1. What are the system reliability goals for `/metrics` and `/summary` (availability, latency, freshness)? How do those goals shape your architecture choices?
2. The API initializes the SQLite store at startup and closes it on `onClose`. What happens on process crash, and how do you ensure the DB is not left in a bad state?
3. How do you test correctness around window boundaries (inclusive end timestamps, off by one, empty windows), and what specific tests are missing today?
4. The DORA engine tests include a lead time lookback scenario and MTTR pairing. What other pathological cases should be covered (out of order events, duplicate IDs, overlapping incidents, late resolves)?
5. The dashboard has no tests. What would you test first to reduce production risk: contract parsing, formatting, empty states, or fetch failure handling?
6. Would you add contract tests between API and UI, and if so, how would you keep them stable without blocking iteration?
7. How do you validate that the simulator produces realistic distributions and does not encode misleading assumptions about failure rates and incident durations?
8. What chaos and failure injection would you run on the API (SQLite lock, disk full, corrupted DB file, slow queries) and what user visible behavior should result?
9. How do you decide whether to compute daily trend points in the API vs precomputing? What are the failure risks of doing it inline per request?
10. The test harness is custom and runs via node. How do you collect coverage, flake detection, and parallelism? Do you care, and why?
11. What is your rollback strategy for metric definition changes that could change executive reporting? How do you prevent silent regressions?
12. If you had to add multi region support, what reliability and consistency changes are required, and which parts of the system are hardest to evolve?

## 6. Observability & Telemetry
1. Fastify logging is enabled. What is your logging schema (fields, correlation IDs, log levels), and how do you prevent log spam from high volume endpoints?
2. What is the observability strategy for metric computation time, DB query latency, and memory usage during trend calculations?
3. The system is a telemetry product but does not expose its own operational metrics. What metrics would you export first and why?
4. How would you instrument the DORA engine computations to detect data quality issues (missing correlation IDs, unmatched incidents, lead time samples dropped) without polluting the pure functions?
5. What traces would you expect for a `/summary` request, and how do you propagate context through Fastify, storage, and engine layers?
6. How do you detect and alert on silent data correctness failures where the API returns 200 but metrics are wrong due to skewed event streams?
7. The dashboard currently assumes responses are valid JSON. How do you surface backend errors to users and keep the UI debuggable?
8. How do you handle privacy concerns in logs, given event IDs and correlation IDs may be sensitive identifiers in real integrations?
9. What is the telemetry retention strategy for the product itself (logs, metrics, traces), and how do you keep costs predictable?
10. What runbooks should exist for operators when metrics suddenly drop to zero across all services?

## 7. Progressive Delivery & Deployment Model
1. This repo provides Dockerfiles and Compose. What is the intended deployment topology and what is explicitly out of scope?
2. If you were to deploy to a managed platform, what changes are required for config, storage, and health checks?
3. How would you introduce blue green or canary deployment for the API given the DB state lives in a local SQLite file?
4. What is your approach for database migrations in SQLite today, and how would that change when moving to a server database?
5. How do you version the event schema and apply forward and backward compatibility guarantees during deployment rollouts?
6. Where do you store build artifacts, and how do you ensure reproducible builds across CI and local developer machines?
7. What release criteria do you enforce before shipping (tests, typecheck, container build, security scan), and which are gating vs advisory?
8. How do you handle feature flags for new metric definitions or new reporting narratives without breaking executive trust?
9. What is the rollback story for dashboard deployments when the API contract changes?
10. If you needed to add a job that backfills events or rebuilds aggregates, how do you deploy it and ensure it is safe to run repeatedly?

## 8. Governance & Risk (AI specific if relevant)
1. The reporting engine outputs recommendations that may influence decisions. What governance do you apply to decision support text even if it is rule based rather than ML?
2. How do you ensure metric definitions and reporting narratives are documented, reviewed, and versioned, and who is the approving authority?
3. What is your stance on explainability: should every recommendation cite the delta and the threshold that triggered it?
4. If this system is extended with generative AI summarization, what controls must exist for prompt versioning, output safety, and audit trails?
5. What are the top risks of misuse of DORA metrics in organizations (gaming, perverse incentives), and how would you design the product to discourage that?
6. How do you handle disagreements about canonical event meaning across sources (what counts as a deployment, what counts as incident)? Who arbitrates?
7. What data classification applies to delivery telemetry in enterprises, and what access controls are required by default?
8. What is your policy on data retention and right to delete? How does it impact reproducibility of historical reports?
9. What is the threat model for telemetry ingestion and event tampering, and what defenses do you apply at the normalizer and store layers?
10. What compliance artifacts would you produce if a customer requests assurance (SOC2 like controls, change management evidence, incident response policy)?

## 9. Scalability & Performance
1. Scenario: event volume grows to 50 million events across hundreds of services. What breaks first in this design and what is your first architectural pivot?
2. Scenario: users request metrics for 90 day windows with daily trends. What is the worst case CPU cost per request, and how do you keep tail latency under control?
3. Scenario: adapters ingest out of order events and duplicates frequently. How do you maintain correctness for lead time and MTTR while keeping ingestion idempotent?
4. Scenario: a single service becomes hot and generates most events. How do you prevent that service from dominating query time and storage contention?
5. Scenario: multi tenant SaaS where each tenant has different retention policies. How do you model storage and keys to keep queries targeted and enforce isolation?
6. Scenario: executives want drilldowns by service and environment and by week. Where do you place aggregates, and what are the tradeoffs between precompute vs ad hoc compute?
7. Scenario: API instances are scaled horizontally. How do you avoid SQLite locking and ensure consistent reads during writes?
8. Scenario: dashboard users refresh frequently, causing duplicate identical requests. Would you add caching, ETags, or server side memoization? Justify with correctness requirements.
9. Scenario: you move to a server DB. What queries should be pushed down to SQL, and which should remain in the application layer? Explain why.
10. Scenario: you introduce streaming updates. How do you handle recomputation when late events change historical metrics?
11. Scenario: window parsing supports only values like 7d, 14d, 30d, capped at 90. How do you avoid accidental expensive queries if you later accept arbitrary ranges?
12. Scenario: an integration sends malformed timestamps. What is your strategy to avoid poisoning the dataset while preserving evidence for debugging?

## 10. Cost & Operational Tradeoffs
1. What cost drivers dominate this design as it scales (storage, compute, egress, observability), and which is most sensitive to product growth?
2. How do you estimate cost per tenant per day given event ingest and query patterns? What telemetry do you need to compute that?
3. What is the tradeoff between storing raw events and storing derived aggregates in terms of cost, debuggability, and trust?
4. When do you choose to cache metric results, and how do you define cache invalidation given that late events can change historical answers?
5. What is the operational cost of SQLite backups and restores, and what is the equivalent plan when you move to a managed DB?
6. How do you decide data retention defaults to balance historical reporting value vs storage and query cost?
7. What is your strategy to prevent runaway CI cost if Docker builds become heavy (layer caching, matrix builds, selective builds)?

## 11. Consulting & Leadership Framing
1. Explain this architecture to a CTO in two minutes, focusing on the why rather than the how.
2. Explain to a skeptical engineering director why pure function metric computation is a meaningful design choice.
3. Present the top three risks of shipping this as a production system, and propose mitigations without overbuilding.
4. Describe how you would align stakeholders on what a deployment means across GitHub, Azure DevOps, and manual releases.
5. You are told the DORA numbers are being used to rank teams. How do you push back and what product guardrails do you propose?
6. Make the case for or against keeping SQLite for the first paid customer.
7. A customer says the executive summary recommendations are wrong. How do you debug, communicate, and restore trust?
8. Describe an adoption plan that starts with one team and scales to an enterprise without creating a consulting only product.
9. Explain how you would measure whether this product is improving engineering outcomes rather than just reporting them.
10. You discover that metric definition changes will shift historical baselines. How do you communicate this and manage change governance?

## 12. Hard Panel Questions
1. Point to one place where the current design could produce a numerically correct but conceptually misleading metric. Defend or change it.
2. The MTTR pairing logic can silently ignore incident resolves without opens. Is that acceptable? What alternative is better and how do you quantify the impact?
3. The system computes lead time using events outside the requested window. How do you prevent an attacker or a buggy integration from inflating lead time by injecting old commits?
4. Why is CORS permissive? If you say demo only, prove how that is enforced in deployment configuration, not just in intent.
5. The dashboard does not check HTTP status before parsing JSON. If a reverse proxy returns HTML, what happens and what is the user experience?
6. Your tests compile TypeScript then run node scripts. Why should I trust that setup in a large org with thousands of tests and parallel execution needs?
7. The database uses `INSERT OR REPLACE`, which can delete and recreate rows. How does that interact with referential integrity if you add more tables later?
8. If two deployments share a correlation ID accidentally, what does the lead time algorithm do, and how would you detect the anomaly?
9. The simulator uses fixed probabilities and distributions. How do you ensure stakeholders do not confuse simulated output with real benchmark quality?
10. If asked to make this FedRAMP ready or similar, what is the first uncomfortable truth you tell the team about the gap between this repo and those requirements?

# Learning Gap Signals
- Missing governance artifacts: ADRs, threat model, data classification, retention policy, access control model, SLOs and error budgets, rollback and migration strategy.
- Security posture gaps: no dependency scanning, no container scanning, no SBOM, permissive CORS, mutable seed endpoint without auth.
- Reliability gaps: no API level integration tests, no end to end tests for dashboard, limited failure mode handling in UI and API.
- Observability gaps: no explicit operational metrics, no tracing, no defined log schema, no runbooks or alerting strategy.
- Performance risks: repeated full in memory sorts and per day recomputation, no query caching, index strategy may not support service drilldowns.
- Data correctness risks: MTTR fallback matching by service, lead time association key semantics across sources, late arriving and duplicate events, timestamp parsing assumptions.
- Delivery maturity gaps: no lint or formatting enforcement, empty vitest config suggests drift, CI lacks release or artifact versioning strategy.
