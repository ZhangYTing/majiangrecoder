import test from "node:test";
import assert from "node:assert/strict";
import {
  createState,
  startSession,
  recordRound,
  finishSession,
  DEFAULT_SEATS,
  allStats,
} from "../src/domain/recorder.js";
import { decodeBackup, encodeBackup } from "../src/domain/backup.js";
import { createRepository, STORAGE_KEY } from "../src/storage.js";

function fixture() {
  let state = recordRound(
    startSession(createState(), DEFAULT_SEATS, 125),
    "discard",
    "p1",
  );
  state = finishSession(state);
  return recordRound(startSession(state, DEFAULT_SEATS, 100), "self", "p4");
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("备份往返保留历史、当前场、人员和整数分计分", () => {
  const state = fixture();
  const result = decodeBackup(encodeBackup(state));
  assert.deepEqual(result, state);
  assert.deepEqual(
    allStats(result).map((p) => p.netCents),
    [175, -325, -325, 475],
  );
});

test("刷新通过新仓库实例读取刚才保存的完整记录", () => {
  const storage = memoryStorage();
  const first = createRepository(storage);
  first.load();
  first.save(fixture());
  const reloaded = createRepository(storage).load();
  assert.equal(reloaded.sessions.length, 1);
  assert.equal(reloaded.active.rounds[0].kind, "self");
  assert.deepEqual(
    allStats(reloaded).map((p) => p.netCents),
    [175, -325, -325, 475],
  );
});

for (const [name, corrupt] of [
  [
    "不支持的版本",
    (s) => {
      s.version = 999;
    },
  ],
  [
    "重复人员身份",
    (s) => {
      s.players[1].id = "p1";
    },
  ],
  [
    "重复玩家名字",
    (s) => {
      s.players[1].name = s.players[0].name;
    },
  ],
  [
    "重复座位",
    (s) => {
      s.active.seats.south = "p1";
    },
  ],
  [
    "小数分底注",
    (s) => {
      s.active.baseCents = 1.5;
    },
  ],
  [
    "负数底注",
    (s) => {
      s.active.baseCents = -100;
    },
  ],
  [
    "非法赢家",
    (s) => {
      s.active.rounds[0].winnerId = "other";
    },
  ],
  [
    "流局带赢家",
    (s) => {
      s.active.rounds[0].kind = "draw";
    },
  ],
  [
    "非法方式",
    (s) => {
      s.active.rounds[0].kind = "unexpected";
    },
  ],
  [
    "无效时间",
    (s) => {
      s.active.startedAt = "bad date";
    },
  ],
  [
    "结束早于开场",
    (s) => {
      s.sessions[0].endedAt = "2000-01-01T00:00:00.000Z";
    },
  ],
  [
    "重复局ID",
    (s) => {
      s.active.rounds.push({ ...s.active.rounds[0] });
    },
  ],
  [
    "重复场ID",
    (s) => {
      s.active.id = s.sessions[0].id;
    },
  ],
  [
    "已结束场混入当前场",
    (s) => {
      s.active.endedAt = s.active.startedAt;
    },
  ],
  [
    "未结束场混入历史",
    (s) => {
      s.sessions[0].endedAt = null;
    },
  ],
  [
    "空历史",
    (s) => {
      s.sessions[0].rounds = [];
    },
  ],
]) {
  test(`导入拒绝${name}`, () => {
    const state = fixture();
    corrupt(state);
    assert.throws(() => decodeBackup(JSON.stringify(state)));
  });
}

test("坏 JSON 和错误结构不能被当成新账本", () => {
  for (const text of ["{", "null", "[]", "{}", '{"version":1}'])
    assert.throws(() => decodeBackup(text));
});

test("导入白名单剔除额外字段，不信任外部预计算总分", () => {
  const state = fixture();
  state.total = 999;
  state.active.total = { p1: 999 };
  assert.equal(decodeBackup(JSON.stringify(state)).total, undefined);
  assert.equal(decodeBackup(JSON.stringify(state)).active.total, undefined);
});

test("存储失败不改变已保存的记录", () => {
  const storage = memoryStorage();
  const repository = createRepository(storage);
  repository.load();
  repository.save(createState());
  storage.setItem = () => {
    throw new Error("quota exceeded");
  };
  assert.throws(
    () => repository.save(fixture()),
    (error) => {
      assert.match(error.message, /保存/);
      assert.doesNotMatch(error.message, /备份|导入|导出/);
      return true;
    },
  );
  assert.equal(createRepository(storage).load().active, null);
});

test("损坏的本地记录不会被普通保存覆盖，但确认导入可恢复", () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, "{broken");
  const repository = createRepository(storage);
  assert.throws(() => repository.load());
  assert.throws(() => repository.save(createState()));
  assert.equal(storage.getItem(STORAGE_KEY), "{broken");
  repository.replace(fixture());
  assert.equal(createRepository(storage).load().sessions.length, 1);
});

test("两个标签页同时记账时阻止过期页面覆盖", () => {
  const storage = memoryStorage();
  const first = createRepository(storage);
  const second = createRepository(storage);
  first.load();
  second.load();
  first.save(fixture());
  assert.throws(() => second.save(createState()), /刷新/);
  assert.equal(createRepository(storage).load().sessions.length, 1);
});

test("确认清空后历史、当前场、姓名和总账初始化，刷新后仍为空且其他存储保留", () => {
  const storage = memoryStorage();
  storage.setItem("other-app", "保留这项数据");
  const repository = createRepository(storage);
  repository.load();
  const previous = fixture();
  previous.players[0].name = "原姓名";
  repository.save(previous);
  const reset = repository.replace(createState());
  assert.deepEqual(reset, createState());
  assert.deepEqual(createRepository(storage).load(), createState());
  assert.deepEqual(
    allStats(reset).map((p) => p.netCents),
    [0, 0, 0, 0],
  );
  assert.equal(storage.getItem("other-app"), "保留这项数据");
  assert.equal(previous.sessions.length, 1);
  assert.equal(previous.players[0].name, "原姓名");
});

test("清空写入失败时保留原姓名、历史和当前场", () => {
  const storage = memoryStorage();
  const repository = createRepository(storage);
  repository.load();
  const previous = fixture();
  previous.players[0].name = "原姓名";
  repository.save(previous);
  storage.setItem = () => {
    throw new Error("quota exceeded");
  };
  assert.throws(() => repository.replace(createState()), /保存/);
  assert.deepEqual(createRepository(storage).load(), previous);
});

test("备份替换也不能覆盖导入预览后另一页面写入的新记录", () => {
  const storage = memoryStorage();
  const first = createRepository(storage);
  const second = createRepository(storage);
  first.load();
  second.load();
  first.save(fixture());
  assert.throws(() => second.replace(createState()), /刷新/);
});
