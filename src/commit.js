export function createCommitter(repository, locks) {
  return async (state, replace = false) => {
    const write = () =>
      replace ? repository.replace(state) : repository.save(state);
    // localStorage 的比较与写入不是原子操作；支持时将整个提交置于同一个跨页面独占锁内。
    if (locks?.request)
      return locks.request(
        "mahjong-recorder-v1-write",
        { mode: "exclusive" },
        write,
      );
    // 非安全上下文可能没有 Web Locks，此时要求只在一个页面记账。
    return write();
  };
}
