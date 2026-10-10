import assert from "node:assert/strict";
import { getLedgerRange, LedgerRangeError } from "../src/lib/ledger-range";

const defaults = getLedgerRange({}, "2026-10-10");
assert.equal(defaults.start, "2026-09-10");
assert.equal(defaults.end, "2026-10-10");
assert.equal(getLedgerRange({}, "2026-03-31").start, "2026-02-28");
assert.equal(getLedgerRange({ date: "2025-01-01" }).start, "2025-01-01");
assert.equal(getLedgerRange({ date: "2025-01-01" }).end, "2025-01-01");
const range = getLedgerRange({ start: "2026-01-31", end: "2026-04-30" });
assert.equal(range.filter.gte.toISOString(), "2026-01-30T16:00:00.000Z");
assert.equal(range.filter.lte.toISOString(), "2026-04-30T15:59:59.999Z");
assert.equal(getLedgerRange({ start: "2023-11-30", end: "2024-02-29" }).end, "2024-02-29");
for (const params of [
  { start: "2026-01-01" },
  { start: "2026-01-31", end: "2026-05-01" },
  { start: "2026-10-11", end: "2026-10-10" },
  { start: "2026-02-29", end: "2026-03-01" },
  { start: "2026-13-01", end: "2026-13-02" },
  { start: "2026-1-1", end: "2026-01-02" },
]) assert.throws(() => getLedgerRange(params), LedgerRangeError);
console.log("ledger range checks passed");
