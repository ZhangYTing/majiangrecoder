import test from "node:test";
import assert from "node:assert/strict";
import * as recorder from "../src/domain/recorder.js";

const seats = { east: "p1", south: "p2", west: "p3", north: "p4" };
const start = (base = 100) =>
  recorder.startSession(recorder.createState(), seats, base);
const scores = (state) => Object.values(recorder.sessionScores(state.active));

test("四位玩家拥有固定身份，初始没有任何场次", () => {
  const state = recorder.createState();
  assert.deepEqual(
    state.players.map((p) => p.id),
    ["p1", "p2", "p3", "p4"],
  );
  assert.equal(state.active, null);
  assert.deepEqual(state.sessions, []);
});

for (const [winner, discard, self] of [
  ["p1", [300, -100, -100, -100], [600, -200, -200, -200]],
  ["p2", [-100, 300, -100, -100], [-200, 600, -200, -200]],
  ["p3", [-100, -100, 300, -100], [-200, -200, 600, -200]],
  ["p4", [-100, -100, -100, 300], [-200, -200, -200, 600]],
]) {
  test(`${winner} 点炮另外三人均支付底注`, () => {
    assert.deepEqual(
      scores(recorder.recordRound(start(), "discard", winner)),
      discard,
    );
  });
  test(`${winner} 自摸另外三人均支付两倍底注`, () => {
    assert.deepEqual(
      scores(recorder.recordRound(start(), "self", winner)),
      self,
    );
  });
}

test("连续胡牌、流局和撤销从明细推导，旧状态不会被改写", () => {
  const original = start();
  let state = recorder.recordRound(original, "discard", "p1");
  state = recorder.recordRound(state, "self", "p2");
  const twoRounds = state;
  state = recorder.recordRound(state, "draw");
  assert.equal(state.active.rounds.length, 3);
  assert.deepEqual(scores(state), [100, 500, -300, -300]);
  assert.equal(state.active.rounds[2].winnerId, null);
  state = recorder.undoRound(state);
  assert.deepEqual(state.active.rounds, twoRounds.active.rounds);
  state = recorder.undoRound(state);
  assert.deepEqual(scores(state), [300, -100, -100, -100]);
  assert.equal(original.active.rounds.length, 0);
});

test("跨场换座后总账仍跟随人，含当前场且流局不增加胡牌数", () => {
  let state = recorder.recordRound(start(), "discard", "p1");
  state = recorder.finishSession(state);
  assert.equal(state.active, null);
  assert.equal(state.sessions.length, 1);
  assert.ok(state.sessions[0].endedAt);
  state = recorder.startSession(
    state,
    { east: "p2", south: "p3", west: "p4", north: "p1" },
    100,
  );
  state = recorder.recordRound(state, "self", "p2");
  state = recorder.recordRound(state, "draw");
  const stats = recorder.allStats(state);
  assert.deepEqual(
    stats.map((p) => p.netCents),
    [100, 500, -300, -300],
  );
  assert.deepEqual(
    stats.map((p) => p.sessions),
    [2, 2, 2, 2],
  );
  assert.deepEqual(
    stats.map((p) => p.wins),
    [1, 1, 0, 0],
  );
  assert.equal(stats[0].discardWins, 1);
  assert.equal(stats[1].selfWins, 1);
  assert.equal(state.sessions[0].rounds.length, 1);
});

test("改名不改变身份和已归档金额", () => {
  const before = recorder.finishSession(
    recorder.recordRound(start(), "self", "p3"),
  );
  const after = recorder.renamePlayers(before, [
    "小王",
    "小李",
    "小张",
    "小陈",
  ]);
  assert.deepEqual(
    after.players.map((p) => p.id),
    ["p1", "p2", "p3", "p4"],
  );
  assert.equal(recorder.allStats(after)[2].name, "小张");
  assert.equal(recorder.allStats(after)[2].netCents, 600);
  assert.notEqual(before.players[0].name, "小王");
});

test("底注精确到分，拒绝不合理金额", () => {
  assert.equal(recorder.parseBase("0.10"), 10);
  assert.equal(recorder.parseBase("1.25"), 125);
  assert.equal(recorder.parseBase("10000"), 1000000);
  assert.deepEqual(
    scores(recorder.recordRound(start(10), "self", "p1")),
    [60, -20, -20, -20],
  );
  for (const amount of [
    "0",
    "-1",
    "1.001",
    "NaN",
    "Infinity",
    "",
    "10000.01",
    "1e2",
  ]) {
    assert.throws(() => recorder.parseBase(amount));
  }
});

test("拒绝重复座位、非法玩家、非法胡牌方式及无当前场操作", () => {
  assert.throws(() =>
    recorder.startSession(
      recorder.createState(),
      { ...seats, north: "p1" },
      100,
    ),
  );
  assert.throws(() => recorder.startSession(start(), seats, 100));
  assert.throws(() => recorder.recordRound(start(), "discard", "stranger"));
  assert.throws(() => recorder.recordRound(start(), "many", "p1"));
  assert.throws(() => recorder.recordRound(start(), "draw", "p1"));
  assert.throws(() =>
    recorder.recordRound(recorder.createState(), "self", "p1"),
  );
  assert.throws(() => recorder.undoRound(start()));
  assert.throws(() => recorder.finishSession(recorder.createState()));
  assert.throws(() => recorder.startSession(recorder.createState(), seats, 0));
  assert.throws(() =>
    recorder.renamePlayers(start(), ["同名", "同名", "三", "四"]),
  );
});

test("无记分的场次不能归档，避免误点产生空历史", () => {
  assert.throws(() => recorder.finishSession(start()));
});
