import test from "node:test";
import assert from "node:assert/strict";
import { pageCapacity, resizedPage } from "../src/layout/pagination.js";

test("历史页根据可用高度、列数和间距计算容量", () => {
  assert.equal(
    pageCapacity({
      height: 500,
      itemHeight: 240,
      gap: 16,
      columns: 2,
      max: 12,
    }),
    4,
  );
  assert.equal(
    pageCapacity({
      height: 300,
      itemHeight: 240,
      gap: 16,
      columns: 1,
      max: 12,
    }),
    1,
  );
});
test("极小窗口至少保留一项，超大窗口不超出分页上限", () => {
  assert.equal(
    pageCapacity({ height: 0, itemHeight: 240, columns: 2, max: 12 }),
    1,
  );
  assert.equal(
    pageCapacity({ height: 10000, itemHeight: 150, columns: 3, max: 12 }),
    12,
  );
});
test("缩放后原来查看的第一条记录仍在页面范围内", () => {
  const page = resizedPage(3, 2, 5, 20);
  assert.equal(page, 1);
  assert.ok(page * 5 <= 6 && (page + 1) * 5 > 6);
});
test("数据减少或为空时页码不会指向不存在的页", () => {
  assert.equal(resizedPage(8, 2, 3, 4), 1);
  assert.equal(resizedPage(8, 2, 3, 0), 0);
});
