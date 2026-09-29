import test from "node:test";
import assert from "node:assert/strict";
import { createCommitter } from "../src/commit.js";
import { createRepository, STORAGE_KEY } from "../src/storage.js";
import {
  createState,
  DEFAULT_SEATS,
  recordRound,
  startSession,
} from "../src/domain/recorder.js";

test("两个页面的提交必须等待独占锁，旧快照不能覆盖先提交的局", async () => {
  let value = null;
  const storage = {
    getItem: () => value,
    setItem: (key, text) => {
      assert.equal(key, STORAGE_KEY);
      value = text;
    },
  };
  const first = createRepository(storage),
    second = createRepository(storage);
  first.load();
  second.load();
  let release;
  let queue = new Promise((resolve) => {
    release = resolve;
  });
  // 模拟真实 Web Locks 的队列：锁未交付前禁止读比较及写入。
  const locks = {
    request(name, options, action) {
      assert.equal(name, `${STORAGE_KEY}-write`);
      assert.equal(options.mode, "exclusive");
      const job = queue.then(action);
      queue = job.catch(() => {});
      return job;
    },
  };
  const state = recordRound(
    startSession(createState(), DEFAULT_SEATS, 100),
    "discard",
    "p1",
  );
  const a = createCommitter(first, locks)(state);
  const b = createCommitter(second, locks)(createState());
  const result = Promise.allSettled([a, b]);
  assert.equal(value, null, "锁尚未交付时，不能写入");
  release();
  const settled = await result;
  assert.equal(settled[0].status, "fulfilled");
  assert.equal(settled[1].status, "rejected");
  assert.match(settled[1].reason.message, /刷新/);
  assert.equal(createRepository(storage).load().active.rounds.length, 1);
});

test("单页面在没有 Web Locks 的浏览器仍能保存，并保留验证结果", async () => {
  let value = null;
  const repository = createRepository({
    getItem: () => value,
    setItem: (_, text) => {
      value = text;
    },
  });
  repository.load();
  const state = recordRound(
    startSession(createState(), DEFAULT_SEATS, 100),
    "self",
    "p2",
  );
  const saved = await createCommitter(repository)(state);
  assert.deepEqual(saved, state);
  assert.equal(
    createRepository({ getItem: () => value }).load().active.rounds[0].winnerId,
    "p2",
  );
});
