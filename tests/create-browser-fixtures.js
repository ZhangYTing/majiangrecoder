// 仅用于独立测试地址上的浏览器验证，不随生产构建发布。
import { mkdir, writeFile } from "node:fs/promises";
import {
  createState,
  DEFAULT_SEATS,
  finishSession,
  recordRound,
  renamePlayers,
  startSession,
} from "../src/domain/recorder.js";
import { encodeBackup } from "../src/domain/backup.js";
await mkdir(new URL("./fixtures/", import.meta.url), { recursive: true });
let state = renamePlayers(createState(), [
  "备份一",
  "备份二",
  "备份三",
  "备份四",
]);
state = finishSession(
  recordRound(startSession(state, DEFAULT_SEATS, 100), "self", "p4"),
);
state = recordRound(startSession(state, DEFAULT_SEATS, 100), "discard", "p3");
await writeFile(
  new URL("./fixtures/restore.json", import.meta.url),
  encodeBackup(state),
);
await writeFile(
  new URL("./fixtures/empty.json", import.meta.url),
  encodeBackup(createState()),
);
await writeFile(
  new URL("./fixtures/invalid.json", import.meta.url),
  '{"version":999}',
);
