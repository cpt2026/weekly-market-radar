import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("weekly snapshots are unique and VIX statuses follow thresholds", async () => {
  const data = JSON.parse(await readFile(new URL("../data/weekly_snapshots.json", import.meta.url)));
  const weeks = data.snapshots.map((row) => row.weekStart);
  assert.equal(new Set(weeks).size, weeks.length);
  for (const row of data.snapshots) {
    const expected = row.vix.high >= 30 ? "red" : row.vix.high >= 27 ? "yellow" : "green";
    assert.equal(row.vix.status, expected);
  }
  assert.equal(data.snapshots.at(-1).weekEnd, data.metadata.latestCompleteWeek);
});

test("dashboard source includes noindex and no private paths", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /每週市場 Radar/);
  assert.match(layout, /index: false/);
  assert.doesNotMatch(`${layout}\n${dashboard}`, /\/Users\/|sk-[a-zA-Z0-9]/);
});
