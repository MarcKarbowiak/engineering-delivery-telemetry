import { mkdir } from "node:fs/promises";
import path from "node:path";
import sqlite3 from "sqlite3";
import { Database, open } from "sqlite";
import type { DeliveryEvent, DeliveryEventType, TimeWindow } from "@packages/event-model";

interface EventRow {
  id: string;
  type: DeliveryEventType;
  timestamp: string;
  service: string;
  environment: string | null;
  commitId: string | null;
  correlationId: string | null;
}

function toRow(event: DeliveryEvent): EventRow {
  return {
    id: event.id,
    type: event.type,
    timestamp: event.timestamp.toISOString(),
    service: event.service,
    environment: event.environment ?? null,
    commitId: event.commitId ?? null,
    correlationId: event.correlationId ?? null
  };
}

function toEvent(row: EventRow): DeliveryEvent {
  return {
    id: row.id,
    type: row.type,
    timestamp: new Date(row.timestamp),
    service: row.service,
    environment: row.environment ?? undefined,
    commitId: row.commitId ?? undefined,
    correlationId: row.correlationId ?? undefined
  };
}

export class SqliteEventStore {
  private db: Database | null = null;

  constructor(private readonly dbPath: string) {}

  async init(): Promise<void> {
    await mkdir(path.dirname(this.dbPath), { recursive: true });

    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database
    });

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS delivery_events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        service TEXT NOT NULL,
        environment TEXT,
        commitId TEXT,
        correlationId TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_delivery_events_type_timestamp
      ON delivery_events (type, timestamp);
    `);
  }

  private getDatabase(): Database {
    if (!this.db) {
      throw new Error("SQLite store not initialized. Call init() first.");
    }
    return this.db;
  }

  async insertEvents(events: DeliveryEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const db = this.getDatabase();
    await db.exec("BEGIN");
    try {
      for (const event of events) {
        const row = toRow(event);
        await db.run(
          `INSERT OR REPLACE INTO delivery_events
           (id, type, timestamp, service, environment, commitId, correlationId)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          row.id,
          row.type,
          row.timestamp,
          row.service,
          row.environment,
          row.commitId,
          row.correlationId
        );
      }
      await db.exec("COMMIT");
    } catch (error) {
      await db.exec("ROLLBACK");
      throw error;
    }
  }

  async listEvents(window?: TimeWindow): Promise<DeliveryEvent[]> {
    const db = this.getDatabase();

    if (!window) {
      const rows = await db.all<EventRow[]>(
        `SELECT id, type, timestamp, service, environment, commitId, correlationId
         FROM delivery_events
         ORDER BY timestamp ASC`
      );
      return rows.map(toEvent);
    }

    const rows = await db.all<EventRow[]>(
      `SELECT id, type, timestamp, service, environment, commitId, correlationId
       FROM delivery_events
       WHERE timestamp >= ? AND timestamp <= ?
       ORDER BY timestamp ASC`,
      window.start.toISOString(),
      window.end.toISOString()
    );

    return rows.map(toEvent);
  }

  async countEvents(): Promise<number> {
    const db = this.getDatabase();
    const row = await db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM delivery_events"
    );
    return row?.count ?? 0;
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}

const SERVICES = ["payments", "checkout", "catalog", "search"];
const ENVIRONMENTS = ["staging", "production"];

function randomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

function probability(chance: number): boolean {
  return Math.random() < chance;
}

export function generateSimulatedEvents(days: number): DeliveryEvent[] {
  const now = new Date();
  const events: DeliveryEvent[] = [];

  for (let dayOffset = days - 1; dayOffset >= 0; dayOffset -= 1) {
    const day = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
    const deploymentsPerDay = 1 + randomInt(3);

    for (let index = 0; index < deploymentsPerDay; index += 1) {
      const service = SERVICES[randomInt(SERVICES.length)];
      const environment = ENVIRONMENTS[randomInt(ENVIRONMENTS.length)];
      const correlationId = `corr-${day.getTime()}-${index}-${randomInt(1000)}`;
      const commitId = `commit-${day.getTime()}-${index}-${randomInt(1000)}`;

      const commitTs = new Date(day.getTime() + randomInt(12) * 60 * 60 * 1000);
      const deployStartTs = new Date(commitTs.getTime() + (30 + randomInt(180)) * 60 * 1000);
      const deployEndTs = new Date(deployStartTs.getTime() + (5 + randomInt(25)) * 60 * 1000);
      const failed = probability(0.18);

      events.push({
        id: `commit-${correlationId}`,
        type: "commit",
        timestamp: commitTs,
        service,
        commitId,
        correlationId
      });

      events.push({
        id: `deploy-start-${correlationId}`,
        type: "deployment_started",
        timestamp: deployStartTs,
        service,
        environment,
        commitId,
        correlationId
      });

      events.push({
        id: `deploy-end-${correlationId}`,
        type: failed ? "deployment_failed" : "deployment_succeeded",
        timestamp: deployEndTs,
        service,
        environment,
        commitId,
        correlationId
      });

      if (failed) {
        const incidentOpenedTs = new Date(deployEndTs.getTime() + (2 + randomInt(30)) * 60 * 1000);
        const incidentResolvedTs = new Date(
          incidentOpenedTs.getTime() + (20 + randomInt(360)) * 60 * 1000
        );

        events.push({
          id: `incident-open-${correlationId}`,
          type: "incident_opened",
          timestamp: incidentOpenedTs,
          service,
          correlationId
        });

        events.push({
          id: `incident-resolve-${correlationId}`,
          type: "incident_resolved",
          timestamp: incidentResolvedTs,
          service,
          correlationId
        });
      }
    }
  }

  return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

export function defaultDbPath(): string {
  return path.resolve(process.cwd(), "data", "delivery-events.db");
}
