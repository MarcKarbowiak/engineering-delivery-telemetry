import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { SqliteEventStore, defaultDbPath, generateSimulatedEvents } from "@packages/storage-sqlite";
import { buildMetricsResponse, buildSummaryResponse, createWindow, parseWindowParam } from "./metrics.js";
import { normalizeEvents } from "./normalizer.js";

const fastify = Fastify({ logger: true });
const LEAD_TIME_LOOKBACK_DAYS = 30;

await fastify.register(cors, {
  origin: true
});

const dbPath = process.env.DB_PATH ?? defaultDbPath();
const store = new SqliteEventStore(dbPath);
await store.init();

fastify.addHook("onClose", async () => {
  await store.close();
});

fastify.get("/health", async () => {
  return {
    status: "ok",
    timestamp: new Date().toISOString()
  };
});

fastify.get("/metrics", async (request) => {
  const querySchema = z.object({
    window: z.string().optional()
  });

  const parsed = querySchema.parse(request.query);
  const days = parseWindowParam(parsed.window);
  const now = new Date();
  const currentWindow = createWindow(now, days);
  const events = await store.listEvents({
    start: new Date(
      currentWindow.start.getTime() - LEAD_TIME_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
    ),
    end: currentWindow.end
  });

  return buildMetricsResponse(events, currentWindow, days);
});

fastify.get("/summary", async (request) => {
  const querySchema = z.object({
    window: z.string().optional()
  });

  const parsed = querySchema.parse(request.query);
  const days = parseWindowParam(parsed.window);
  const now = new Date();

  const currentWindow = createWindow(now, days);
  const previousWindow = {
    start: new Date(currentWindow.start.getTime() - days * 24 * 60 * 60 * 1000),
    end: new Date(currentWindow.start.getTime() - 1)
  };

  const events = await store.listEvents({
    start: new Date(
      previousWindow.start.getTime() - LEAD_TIME_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
    ),
    end: currentWindow.end
  });

  return buildSummaryResponse(events, currentWindow, previousWindow);
});

fastify.post("/seed", async (request) => {
  const bodySchema = z.object({
    days: z.number().int().positive().max(365).optional()
  });

  const parsed = bodySchema.safeParse(request.body ?? {});
  const days = parsed.success ? parsed.data.days ?? 30 : 30;

  const rawEvents = generateSimulatedEvents(days).map((event) => ({
    ...event,
    timestamp: event.timestamp.toISOString()
  }));
  const events = normalizeEvents(rawEvents);
  await store.insertEvents(events);
  const totalEvents = await store.countEvents();

  return {
    inserted: events.length,
    totalEvents
  };
});

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await fastify.listen({ port, host });
} catch (error) {
  fastify.log.error(error);
  process.exit(1);
}
