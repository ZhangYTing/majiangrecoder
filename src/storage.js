import { createState } from "./domain/recorder.js";
import { decodeBackup, validateState } from "./domain/backup.js";

export const STORAGE_KEY = "mahjong-recorder-v1";
export function createRepository(storage) {
  let snapshot,
    loaded = false,
    healthy = false;
  function raw() {
    try {
      return storage.getItem(STORAGE_KEY);
    } catch {
      throw new Error("无法读取本地保存。请允许浏览器使用网站存储，然后刷新。");
    }
  }
  function load() {
    snapshot = raw();
    loaded = true;
    healthy = false;
    const state = snapshot === null ? createState() : decodeBackup(snapshot);
    healthy = true;
    return state;
  }
  function write(state, replace) {
    if (!loaded) load();
    if (!replace && !healthy)
      throw new Error(
        "已有记录无法读取，已停止记分以保护原数据。请检查浏览器存储权限后刷新。",
      );
    if (raw() !== snapshot)
      throw new Error("另一个页面更新了记录，请刷新本页后继续。");
    const normalized = validateState(state);
    const text = JSON.stringify(normalized);
    try {
      storage.setItem(STORAGE_KEY, text);
    } catch {
      throw new Error(
        "本地保存失败，本次操作未写入。请检查浏览器存储权限或剩余空间后重试。",
      );
    }
    snapshot = text;
    healthy = true;
    return normalized;
  }
  return {
    load,
    raw,
    save: (state) => write(state, false),
    replace: (state) => write(state, true),
  };
}
