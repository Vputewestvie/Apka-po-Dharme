import { existsSync, mkdirSync } from "node:fs";
import { createApp } from "./main";
import type { ApiRequest } from "./types";

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function ensureDataDir() {
  const sourcePath = fileURLToPath(import.meta.url);
  const dataDir = resolve(dirname(sourcePath), "../data");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  return resolve(dataDir, "smoke-test.sqlite");
}

function assertOk(result: unknown, message: string) {
  if (!result || typeof result !== "object" || !("ok" in result)) {
    throw new Error(`${message}: unexpected response ${JSON.stringify(result)}`);
  }

  const response = result as { ok: boolean; error?: string; status?: number };
  if (!response.ok) {
    throw new Error(`${message}: ${response.error ?? "unknown error"} (status=${response.status ?? "?"})`);
  }
}

async function main() {
  const databasePath = ensureDataDir();
  const app = await createApp(databasePath);
  const userId = "demo-user";
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  console.log("1/6 health check");
  assertOk(await app.handleRequest({ method: "GET", pathname: "/health", query: {}, context: { requestId: "smoke-1", userId } } as ApiRequest), "health check");

  console.log("2/6 create practice");
  const createPracticeResult = await app.handleRequest({
    method: "POST",
    pathname: "/practices",
    body: {
      userId,
      title: "Smoke practice",
      description: "Smoke practice description",
      category: "Духовная",
      defaultDurationMinutes: 5,
      color: "#688b76",
      icon: "leaf",
      image: {
        kind: "builtin",
        ref: "https://example.com/image.png",
      },
      notes: "Smoke test",
    },
    context: { requestId: "smoke-2", userId },
  } as ApiRequest);
  assertOk(createPracticeResult, "create practice");
  const practiceId = (createPracticeResult as { ok: true; data: { id: string } }).data.id;

  console.log("3/6 create schedule");
  const createScheduleResult = await app.handleRequest({
    method: "POST",
    pathname: "/schedule",
    body: {
      userId,
      date,
      title: "Smoke day",
      practices: [
        {
          practiceId,
          plannedStartTime: null,
          plannedDurationMinutes: 5,
          order: 0,
        },
      ],
    },
    context: { requestId: "smoke-3", userId },
  } as ApiRequest);
  assertOk(createScheduleResult, "create schedule");
  const scheduledPracticeId = (createScheduleResult as { ok: true; data: { items: Array<{ id: string }> } }).data.items[0]?.id;
  if (!scheduledPracticeId) throw new Error("Failed to create scheduled practice");

  console.log("4/6 start timer");
  assertOk(
    await app.handleRequest({
      method: "POST",
      pathname: "/timer/start",
      body: {
        userId,
        scheduledPracticeId,
        practiceId,
        plannedDurationMinutes: 5,
      },
      context: { requestId: "smoke-4", userId },
    } as ApiRequest),
    "start timer",
  );

  console.log("5/6 pause timer");
  assertOk(
    await app.handleRequest({
      method: "POST",
      pathname: "/timer/pause",
      body: {
        scheduledPracticeId,
        timestamp: new Date().toISOString(),
      },
      context: { requestId: "smoke-5", userId },
    } as ApiRequest),
    "pause timer",
  );

  console.log("6/6 complete timer");
  assertOk(
    await app.handleRequest({
      method: "POST",
      pathname: "/timer/complete",
      body: {
        scheduledPracticeId,
        timestamp: new Date().toISOString(),
      },
      context: { requestId: "smoke-6", userId },
    } as ApiRequest),
    "complete timer",
  );

  console.log("API smoke test passed");
}

main().catch((error) => {
  console.error("API smoke test failed", error);
  process.exit(1);
});
