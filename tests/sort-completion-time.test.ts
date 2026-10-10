import assert from "node:assert/strict";
import { test } from "node:test";
import prisma from "../src/lib/prisma";
import { completeSortTaskAction, batchCompleteSortTasksAction } from "../src/actions/production";
import { formatDateTime } from "../src/lib/utils";

test("分拣完成时间按北京时间保存，单笔与批量保持数量守恒", async (t) => {
  const previousTZ = process.env.TZ;
  process.env.TZ = "UTC";
  const original = {
    findUnique: prisma.sortTask.findUnique,
    findMany: prisma.sortTask.findMany,
    update: prisma.sortTask.update,
    transaction: prisma.$transaction,
  };
  t.after(() => {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
    prisma.sortTask.findUnique = original.findUnique;
    prisma.sortTask.findMany = original.findMany;
    prisma.sortTask.update = original.update;
    prisma.$transaction = original.transaction;
  });
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-10T00:30:00+08:00") });
  const tasks = ["first", "second"].map((id) => ({
    id, code: id, inputCount: 100, status: "PENDING", gender: "MALE", weightTier: "4.0两",
  }));
  prisma.sortTask.findUnique = (async () => tasks[0]) as any;
  prisma.sortTask.findMany = (async () => tasks) as any;
  const writes: any[] = [];
  prisma.sortTask.update = (async ({ data }: any) => {
    writes.push(data);
    return data;
  }) as any;
  prisma.$transaction = ((updates: any[]) => Promise.all(updates)) as any;

  const items = tasks.map(({ id }) => ({ taskId: id, qualifiedCount: 98 }));
  const selectedTime = "2026-10-09T23:45";
  assert.equal((await completeSortTaskAction("first", 98, selectedTime)).success, true);
  assert.equal((await batchCompleteSortTasksAction(items, selectedTime)).success, true);
  assert.equal(writes.length, 3);
  for (const saved of writes) {
    assert.equal(saved.doneAt.toISOString(), "2026-10-09T15:45:00.000Z");
    assert.equal(formatDateTime(saved.doneAt), "2026-10-09 23:45");
    assert.equal(saved.status, "COMPLETED");
    assert.equal(saved.qualifiedCount, 98);
    assert.equal(100 - saved.qualifiedCount, saved.lossCount);
  }

  for (const doneAt of ["", "invalid", "2026-02-30T12:00", "2026-10-10T25:00", "2026-10-10T00:31"]) {
    assert.equal((await completeSortTaskAction("first", 98, doneAt)).success, false);
    assert.equal((await batchCompleteSortTasksAction(items, doneAt)).success, false);
  }
  assert.equal((await completeSortTaskAction("first", 101, selectedTime)).success, false);
  assert.equal((await batchCompleteSortTasksAction([
    items[0], { taskId: "second", qualifiedCount: 101 },
  ], selectedTime)).success, false);
  assert.equal(writes.length, 3, "非法时间与超额完成数量不能写入数据库");

  assert.equal((await completeSortTaskAction("first", 98)).success, true);
  assert.equal((await batchCompleteSortTasksAction(items)).success, true);
  for (const saved of writes.slice(3)) {
    assert.equal(saved.doneAt.toISOString(), "2026-10-09T16:30:00.000Z", "旧调用默认当前时间");
  }
});
