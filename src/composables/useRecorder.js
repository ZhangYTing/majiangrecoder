import { computed, onMounted, onUnmounted, ref, shallowRef } from "vue";
import { allStats, createState } from "../domain/recorder.js";
import { createRepository, STORAGE_KEY } from "../storage.js";
import { createCommitter } from "../commit.js";

export function useRecorder() {
  const repository = createRepository({
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
  });
  const state = shallowRef(createState());
  const commit = createCommitter(repository, window.navigator.locks);
  const saving = ref(false);
  const error = ref("");
  const blocked = ref(false);
  const stale = ref(false);
  const lastSaved = ref(null);
  try {
    state.value = repository.load();
  } catch (e) {
    error.value = e.message;
    blocked.value = true;
  }

  async function transact(change, replace = false) {
    if (saving.value) return false;
    saving.value = true;
    try {
      if (stale.value)
        throw new Error("另一个页面更新了记录，请刷新本页后继续。");
      if (blocked.value && !replace)
        throw new Error(
          "已有记录无法读取，已停止记分以保护原数据。请检查浏览器存储权限后刷新。",
        );
      const next = typeof change === "function" ? change(state.value) : change;
      // 先持久化，成功后才更新视图，避免出现“显示已记账，实际未保存”。
      state.value = await commit(next, replace);
      error.value = "";
      blocked.value = false;
      lastSaved.value = new Date();
      return true;
    } catch (e) {
      error.value = e.message;
      return false;
    } finally {
      saving.value = false;
    }
  }

  function storageChanged(event) {
    if (event.key === STORAGE_KEY || event.key === null) stale.value = true;
  }
  onMounted(() => window.addEventListener("storage", storageChanged));
  onUnmounted(() => window.removeEventListener("storage", storageChanged));
  return {
    state,
    error,
    blocked,
    stale,
    saving,
    lastSaved,
    transact,
    stats: computed(() => allStats(state.value)),
  };
}
