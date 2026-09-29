import test from "node:test";
import assert from "node:assert/strict";
import * as recorder from "../src/domain/recorder.js";
import * as settlement from "../src/domain/settlement.js";
import * as dates from "../src/domain/date-range.js";
import { createRepository, STORAGE_KEY } from "../src/storage.js";

const start = () =>
  recorder.startSession(recorder.createState(), recorder.DEFAULT_SEATS, 100);
const amounts = (state) => recorder.allStats(state).map((p) => p.netCents);

test("结算把三位输家的钱分配给唯一赢家，金额精确到分", () => {
  assert.deepEqual(
    settlement.settlementTransfers({ p1: 375, p2: -125, p3: -125, p4: -125 }),
    [
      { fromId: "p2", toId: "p1", amountCents: 125 },
      { fromId: "p3", toId: "p1", amountCents: 125 },
      { fromId: "p4", toId: "p1", amountCents: 125 },
    ],
  );
});
test("结算选择两笔即可结清的组合，避免贪心产生第三笔", () => {
  const scores = { p1: 500, p2: 700, p3: -700, p4: -500 };
  assert.deepEqual(settlement.settlementTransfers(scores), [
    { fromId: "p3", toId: "p2", amountCents: 700 },
    { fromId: "p4", toId: "p1", amountCents: 500 },
  ]);
  assert.deepEqual(scores, { p1: 500, p2: 700, p3: -700, p4: -500 });
});
test("零输赢无需结算，不平衡或非整数金额不能给出付款建议", () => {
  assert.deepEqual(
    settlement.settlementTransfers({ p1: 0, p2: 0, p3: 0, p4: 0 }),
    [],
  );
  assert.throws(() =>
    settlement.settlementTransfers({ p1: 1, p2: 0, p3: 0, p4: 0 }),
  );
  assert.throws(() =>
    settlement.settlementTransfers({ p1: 0.5, p2: -0.5, p3: 0, p4: 0 }),
  );
});
test("修改当前场中间一局，后续局及原快照保留，总账重新计算", () => {
  let before = recorder.recordRound(start(), "discard", "p1");
  before = recorder.recordRound(before, "self", "p2");
  const original = structuredClone(before);
  const target = before.active.rounds[0];
  const after = recorder.correctRound(
    before,
    before.active.id,
    target.id,
    "self",
    "p3",
  );
  assert.deepEqual(amounts(after), [-400, 400, 400, -400]);
  assert.deepEqual(before, original);
  assert.deepEqual(after.active.rounds[1], before.active.rounds[1]);
  assert.deepEqual(after.active.rounds[0], {
    ...target,
    kind: "self",
    winnerId: "p3",
  });
  assert.equal(after.active.baseCents, 100);
  assert.deepEqual(after.active.seats, recorder.DEFAULT_SEATS);
});
test("归档后纠错会同步总账并保留归档时间，其他场次不受影响", () => {
  let before = recorder.finishSession(
    recorder.recordRound(start(), "discard", "p1"),
  );
  before = recorder.recordRound(
    recorder.startSession(before, recorder.DEFAULT_SEATS, 100),
    "self",
    "p4",
  );
  const archived = before.sessions[0];
  const after = recorder.correctRound(
    before,
    archived.id,
    archived.rounds[0].id,
    "discard",
    "p2",
  );
  assert.deepEqual(amounts(after), [-300, 100, -300, 500]);
  assert.equal(after.sessions[0].endedAt, archived.endedAt);
  assert.deepEqual(after.active, before.active);
  assert.deepEqual(
    recorder.allStats(after).map((p) => p.wins),
    [0, 1, 0, 1],
  );
});
test("胡牌改为流局、流局改为胡牌时同步金额及胡牌次数", () => {
  const before = recorder.recordRound(start(), "self", "p1");
  const sessionId = before.active.id,
    roundId = before.active.rounds[0].id;
  const draw = recorder.correctRound(before, sessionId, roundId, "draw", null);
  assert.deepEqual(amounts(draw), [0, 0, 0, 0]);
  assert.deepEqual(
    recorder.allStats(draw).map((p) => p.wins),
    [0, 0, 0, 0],
  );
  const win = recorder.correctRound(draw, sessionId, roundId, "discard", "p4");
  assert.deepEqual(amounts(win), [-100, -100, -100, 300]);
  assert.equal(win.active.rounds.length, 1);
});
test("纠错拒绝不存在的场次或局、错误玩家与非法方式", () => {
  const before = recorder.recordRound(start(), "discard", "p1");
  const sessionId = before.active.id,
    roundId = before.active.rounds[0].id;
  for (const args of [
    ["unknown", roundId, "self", "p2"],
    [sessionId, "unknown", "self", "p2"],
    [sessionId, roundId, "self", "unknown"],
    [sessionId, roundId, "invalid", "p2"],
    [sessionId, roundId, "draw", "p1"],
  ])
    assert.throws(() => recorder.correctRound(before, ...args));
  assert.deepEqual(amounts(before), [300, -100, -100, -100]);
});
test("纠错保存后重新读取仍保留原版本、记录时间和正确总账", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const repository = createRepository(storage);
  repository.load();
  const before = recorder.finishSession(
    recorder.recordRound(start(), "discard", "p1"),
  );
  repository.save(before);
  const target = before.sessions[0];
  repository.save(
    recorder.correctRound(before, target.id, target.rounds[0].id, "self", "p4"),
  );
  const reloaded = createRepository(storage).load();
  assert.equal(reloaded.version, 1);
  assert.equal(reloaded.sessions[0].rounds[0].at, target.rounds[0].at);
  assert.deepEqual(amounts(reloaded), [-200, -200, -200, 600]);
});
test("纠错写入失败时原始历史与总账保留", () => {
  let saved = null,
    fail = false;
  const repository = createRepository({
    getItem: () => saved,
    setItem: (key, value) => {
      assert.equal(key, STORAGE_KEY);
      if (fail) throw new Error("storage full");
      saved = value;
    },
  });
  repository.load();
  const before = recorder.finishSession(
    recorder.recordRound(start(), "discard", "p1"),
  );
  repository.save(before);
  const snapshot = saved,
    target = before.sessions[0];
  fail = true;
  assert.throws(() =>
    repository.save(
      recorder.correctRound(
        before,
        target.id,
        target.rounds[0].id,
        "self",
        "p4",
      ),
    ),
  );
  assert.equal(saved, snapshot);
  assert.deepEqual(amounts(repository.load()), [300, -100, -100, -100]);
});
const at = (year, month, day, hour = 12, minute = 0) =>
  new Date(year, month - 1, day, hour, minute).toISOString();
test("今天筛选包括当地午夜及当天最后一分钟，排除两侧日期", () => {
  const range = dates.resolveDateRange(
    { preset: "today" },
    new Date(2026, 8, 29, 12),
  );
  assert.deepEqual(range, { from: "2026-09-29", to: "2026-09-29" });
  const sessions = [
    { id: "before", startedAt: at(2026, 9, 28, 23, 59) },
    { id: "start", startedAt: at(2026, 9, 29, 0) },
    { id: "end", startedAt: at(2026, 9, 29, 23, 59) },
    { id: "after", startedAt: at(2026, 9, 30, 0) },
  ];
  assert.deepEqual(
    dates.filterSessions(sessions, range).map((s) => s.id),
    ["start", "end"],
  );
});
test("本月范围包括闰月最后一天，全部不限制日期", () => {
  assert.deepEqual(
    dates.resolveDateRange({ preset: "month" }, new Date(2024, 1, 15)),
    { from: "2024-02-01", to: "2024-02-29" },
  );
  const sessions = [
    { startedAt: at(2024, 1, 31) },
    { startedAt: at(2024, 2, 29) },
    { startedAt: at(2024, 3, 1) },
  ];
  assert.equal(
    dates.filterSessions(sessions, dates.resolveDateRange({ preset: "all" }))
      .length,
    3,
  );
  assert.equal(
    dates.filterSessions(
      sessions,
      dates.resolveDateRange({ preset: "month" }, new Date(2024, 1, 15)),
    ).length,
    1,
  );
});
test("自选日期包含起止日，支持单边范围，拒绝无效及倒序日期", () => {
  const sessions = [
    { startedAt: at(2026, 9, 28) },
    { startedAt: at(2026, 9, 29) },
    { startedAt: at(2026, 9, 30) },
  ];
  const range = dates.resolveDateRange({
    preset: "custom",
    from: "2026-09-28",
    to: "2026-09-29",
  });
  assert.equal(dates.filterSessions(sessions, range).length, 2);
  assert.equal(
    dates.filterSessions(
      sessions,
      dates.resolveDateRange({ preset: "custom", from: "2026-09-29", to: "" }),
    ).length,
    2,
  );
  for (const selection of [
    { preset: "custom", from: "2026-02-29", to: "" },
    { preset: "custom", from: "2026-09-30", to: "2026-09-29" },
    { preset: "custom", from: "", to: "" },
    { preset: "unknown" },
  ])
    assert.throws(() => dates.resolveDateRange(selection));
});
test("跨午夜的场次按开场日期整场筛选，统计只计入所选场次", () => {
  let state = recorder.finishSession(
    recorder.recordRound(start(), "discard", "p1"),
  );
  state.sessions[0].startedAt = at(2026, 9, 28, 23);
  state.sessions[0].endedAt = at(2026, 9, 29, 1);
  state = recorder.recordRound(
    recorder.startSession(state, recorder.DEFAULT_SEATS, 100),
    "self",
    "p2",
  );
  state.active.startedAt = at(2026, 9, 29, 12);
  const selected = dates.filterSessions(
    [...state.sessions, state.active],
    dates.resolveDateRange({ preset: "today" }, new Date(2026, 8, 29, 12)),
  );
  assert.deepEqual(
    recorder.allStats(state, selected).map((p) => p.netCents),
    [-200, 600, -200, -200],
  );
  assert.deepEqual(
    recorder.allStats(state, []).map((p) => p.netCents),
    [0, 0, 0, 0],
  );
  assert.deepEqual(amounts(state), [100, 500, -300, -300]);
});
