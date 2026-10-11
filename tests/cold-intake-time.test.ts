import assert from "node:assert/strict";
import { test } from "node:test";
import { coldIntakeTimeSchema } from "../src/lib/validations/schemas";
import { parseBeijingDateTime, formatDateTime } from "../src/lib/utils";

test("冷库入库时间校验规则 (coldIntakeTimeSchema)", () => {
  // 有效时间 (北京时间)
  const validTime = "2026-10-09T14:30";
  assert.equal(coldIntakeTimeSchema.safeParse({ intakeTime: validTime }).success, true);

  const parsedDate = parseBeijingDateTime(validTime);
  assert.equal(formatDateTime(parsedDate).replace(" ", "T"), validTime);

  // 无效时间格式
  assert.equal(coldIntakeTimeSchema.safeParse({ intakeTime: "" }).success, false);
  assert.equal(coldIntakeTimeSchema.safeParse({ intakeTime: "invalid" }).success, false);
  assert.equal(coldIntakeTimeSchema.safeParse({ intakeTime: "2026-02-30T12:00" }).success, false);
  assert.equal(coldIntakeTimeSchema.safeParse({ intakeTime: "2026-10-10T25:00" }).success, false);

  // 未来时间拦截
  const futureTime = "2099-01-01T12:00";
  assert.equal(coldIntakeTimeSchema.safeParse({ intakeTime: futureTime }).success, false);
});
