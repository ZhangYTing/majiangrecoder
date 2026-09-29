import { PLAYER_IDS, SEATS, KIND_LABELS, validateNames } from "./recorder.js";

export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

function check(condition, message) {
  if (!condition) throw new Error(`记录校验失败：${message}`);
}

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function timestamp(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

// 只重建已知字段，不接受外部提供的总分、统计或其他运行状态。
export function validateState(input) {
  check(object(input) && input.version === 1, "文件格式或版本不支持。");
  check(
    Array.isArray(input.players) && input.players.length === 4,
    "需要四位玩家。",
  );
  check(
    input.players.every((p, i) => object(p) && p.id === PLAYER_IDS[i]),
    "玩家身份不正确。",
  );
  const names = validateNames(input.players.map((p) => p.name));
  check(
    Array.isArray(input.sessions) && input.sessions.length <= 5000,
    "历史场次格式不正确。",
  );
  check(input.active === null || object(input.active), "当前场格式不正确。");
  const ids = new Set();
  let totalRounds = 0,
    lastEndedAt = "";
  function unique(value) {
    check(
      typeof value === "string" &&
        value.length > 0 &&
        value.length <= 100 &&
        !ids.has(value),
      "记录身份为空或重复。",
    );
    ids.add(value);
    return value;
  }
  function session(value, archived) {
    check(object(value), "场次格式不正确。");
    const id = unique(value.id);
    check(timestamp(value.startedAt), "开场时间无效。");
    check(
      !lastEndedAt || value.startedAt >= lastEndedAt,
      "场次时间顺序不正确。",
    );
    check(
      archived
        ? timestamp(value.endedAt) && value.endedAt >= value.startedAt
        : value.endedAt === null,
      "结束时间或场次状态不正确。",
    );
    check(object(value.seats), "座位格式不正确。");
    const assigned = SEATS.map((s) => value.seats[s.key]);
    check(
      new Set(assigned).size === 4 &&
        assigned.every((p) => PLAYER_IDS.includes(p)),
      "四人座位重复或无效。",
    );
    check(
      Number.isInteger(value.baseCents) &&
        value.baseCents >= 1 &&
        value.baseCents <= 1000000,
      "底注金额不正确。",
    );
    check(
      Array.isArray(value.rounds) && (!archived || value.rounds.length > 0),
      "局记录格式不正确或历史场为空。",
    );
    totalRounds += value.rounds.length;
    check(totalRounds <= 100000, "局数超过上限。");
    let lastAt = value.startedAt;
    const rounds = value.rounds.map((r) => {
      check(object(r), "局记录格式不正确。");
      const roundId = unique(r.id);
      check(
        timestamp(r.at) &&
          r.at >= lastAt &&
          (!archived || r.at <= value.endedAt),
        "局记录时间不正确。",
      );
      check(Object.hasOwn(KIND_LABELS, r.kind), "胡牌方式无效。");
      check(
        r.kind === "draw"
          ? r.winnerId === null
          : PLAYER_IDS.includes(r.winnerId),
        "胡牌玩家无效。",
      );
      lastAt = r.at;
      return { id: roundId, at: r.at, kind: r.kind, winnerId: r.winnerId };
    });
    if (archived) lastEndedAt = value.endedAt;
    return {
      id,
      startedAt: value.startedAt,
      endedAt: value.endedAt,
      seats: Object.fromEntries(SEATS.map((s) => [s.key, value.seats[s.key]])),
      baseCents: value.baseCents,
      rounds,
    };
  }
  const sessions = input.sessions.map((s) => session(s, true));
  const active = input.active ? session(input.active, false) : null;
  return {
    version: 1,
    players: PLAYER_IDS.map((id, i) => ({ id, name: names[i] })),
    sessions,
    active,
  };
}

export function decodeBackup(text) {
  check(
    typeof text === "string" && text.length <= MAX_BACKUP_BYTES,
    "文件太大。",
  );
  let input;
  try {
    input = JSON.parse(text);
  } catch {
    throw new Error(
      "无法读取记录：本地数据不是有效的 JSON，已停止记分以保护原数据。",
    );
  }
  return validateState(input);
}

export function encodeBackup(state) {
  return JSON.stringify(validateState(state), null, 2);
}
