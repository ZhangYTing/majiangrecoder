export const PLAYER_IDS = ["p1", "p2", "p3", "p4"];
export const SEATS = [
  { key: "east", label: "东" },
  { key: "south", label: "南" },
  { key: "west", label: "西" },
  { key: "north", label: "北" },
];
export const DEFAULT_SEATS = {
  east: "p1",
  south: "p2",
  west: "p3",
  north: "p4",
};
export const KIND_LABELS = { discard: "点炮胡", self: "自摸", draw: "流局" };

function id() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

export function createState() {
  return {
    version: 1,
    players: PLAYER_IDS.map((id, index) => ({ id, name: `玩家${index + 1}` })),
    sessions: [],
    active: null,
  };
}

export function validateNames(names) {
  if (!Array.isArray(names) || names.length !== 4)
    throw new Error("请填写四位玩家的名字。");
  const trimmed = names.map((name) =>
    typeof name === "string" ? name.trim() : "",
  );
  if (trimmed.some((name) => !name || name.length > 12))
    throw new Error("名字需要 1～12 个字。");
  if (new Set(trimmed).size !== 4) throw new Error("四位玩家的名字不能重复。");
  return trimmed;
}

export function renamePlayers(state, names) {
  const valid = validateNames(names);
  return {
    ...state,
    players: state.players.map((player, index) => ({
      ...player,
      name: valid[index],
    })),
  };
}

export function parseBase(value) {
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text))
    throw new Error("底注请输入金额，最多两位小数。");
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > 1000000)
    throw new Error("底注应在 0.01～10000 元之间。");
  return cents;
}

export function startSession(state, seats, baseCents) {
  if (state.active) throw new Error("请先结束当前场，再开始新的一场。");
  if (!Number.isInteger(baseCents) || baseCents < 1 || baseCents > 1000000)
    throw new Error("底注金额不正确。");
  const assigned = SEATS.map((seat) => seats?.[seat.key]);
  if (
    new Set(assigned).size !== 4 ||
    assigned.some((player) => !PLAYER_IDS.includes(player))
  ) {
    throw new Error("东南西北必须分别安排不同的玩家。");
  }
  if (state.sessions.length >= 5000)
    throw new Error("场次已达到保存上限，无法开始新场。");
  return {
    ...state,
    active: {
      id: id(),
      startedAt: new Date().toISOString(),
      endedAt: null,
      seats: Object.fromEntries(
        SEATS.map((seat) => [seat.key, seats[seat.key]]),
      ),
      baseCents,
      rounds: [],
    },
  };
}

function requireActive(state) {
  if (!state.active) throw new Error("请先开始一场。");
  return state.active;
}

function validateRoundResult(kind, winnerId) {
  if (!Object.hasOwn(KIND_LABELS, kind)) throw new Error("胡牌方式不正确。");
  if (kind === "draw" ? winnerId !== null : !PLAYER_IDS.includes(winnerId))
    throw new Error("请选择正确的胡牌玩家。");
}

export function recordRound(state, kind, winnerId = null) {
  const session = requireActive(state);
  validateRoundResult(kind, winnerId);
  const count = state.sessions.reduce(
    (sum, s) => sum + s.rounds.length,
    session.rounds.length,
  );
  if (count >= 100000) throw new Error("局数已达到保存上限，无法继续记分。");
  return {
    ...state,
    active: {
      ...session,
      rounds: [
        ...session.rounds,
        { id: id(), at: new Date().toISOString(), kind, winnerId },
      ],
    },
  };
}

export function undoRound(state) {
  const session = requireActive(state);
  if (!session.rounds.length) throw new Error("还没有可以撤销的记录。");
  return {
    ...state,
    active: { ...session, rounds: session.rounds.slice(0, -1) },
  };
}

export function correctRound(state, sessionId, roundId, kind, winnerId = null) {
  validateRoundResult(kind, winnerId);
  const active = state.active?.id === sessionId;
  const session = active
    ? state.active
    : state.sessions.find((item) => item.id === sessionId);
  if (!session) throw new Error("找不到要修改的场次。");
  if (!session.rounds.some((round) => round.id === roundId))
    throw new Error("找不到要修改的这一局。");
  // 保留局号、时间、底注和座位，只替换结果；所有金额由记录重新计算。
  const corrected = {
    ...session,
    rounds: session.rounds.map((round) =>
      round.id === roundId ? { ...round, kind, winnerId } : round,
    ),
  };
  return active
    ? { ...state, active: corrected }
    : {
        ...state,
        sessions: state.sessions.map((item) =>
          item.id === sessionId ? corrected : item,
        ),
      };
}

export function finishSession(state) {
  const session = requireActive(state);
  if (!session.rounds.length) throw new Error("至少记录一局后才能结束归档。");
  return {
    ...state,
    sessions: [
      ...state.sessions,
      { ...session, endedAt: new Date().toISOString() },
    ],
    active: null,
  };
}

// 总分只由每局结果计算，存储中不重复保存金额，撤销与恢复不会产生两份账。
export function roundScores(session, round) {
  const paid = session.baseCents * (round.kind === "self" ? 2 : 1);
  return Object.fromEntries(
    PLAYER_IDS.map((id) => [
      id,
      round.kind === "draw" ? 0 : round.winnerId === id ? 3 * paid : -paid,
    ]),
  );
}

export function sessionScores(session) {
  const scores = Object.fromEntries(PLAYER_IDS.map((id) => [id, 0]));
  for (const round of session?.rounds ?? []) {
    const delta = roundScores(session, round);
    for (const id of PLAYER_IDS) scores[id] += delta[id];
  }
  return scores;
}

export function allStats(
  state,
  sessions = [...state.sessions, ...(state.active ? [state.active] : [])],
) {
  return state.players.map((player) => {
    let netCents = 0,
      wins = 0,
      discardWins = 0,
      selfWins = 0;
    for (const session of sessions) {
      netCents += sessionScores(session)[player.id];
      for (const round of session.rounds) {
        if (round.winnerId !== player.id) continue;
        wins += 1;
        if (round.kind === "self") selfWins += 1;
        else discardWins += 1;
      }
    }
    return {
      ...player,
      netCents,
      wins,
      discardWins,
      selfWins,
      sessions: sessions.length,
    };
  });
}

export function money(cents, signed = false) {
  const amount = (Math.abs(cents) / 100)
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1");
  return `${cents < 0 ? "−" : signed && cents > 0 ? "+" : ""}${amount}`;
}
