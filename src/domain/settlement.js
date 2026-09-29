import { PLAYER_IDS } from "./recorder.js";

export function settlementTransfers(scores) {
  const balances = PLAYER_IDS.map((id) => scores[id]);
  if (
    balances.some((amount) => !Number.isSafeInteger(amount)) ||
    balances.reduce((sum, amount) => sum + amount, 0) !== 0
  )
    throw new Error("结算金额必须精确到分，且四人合计为零。");

  // 四人的组合很小，枚举抵扣顺序，选出付款笔数最少的方案。
  function search(remaining) {
    const debtor = remaining.findIndex((amount) => amount < 0);
    if (debtor < 0) return [];
    let best = null;
    for (let creditor = 0; creditor < remaining.length; creditor += 1) {
      if (remaining[creditor] <= 0) continue;
      const amountCents = Math.min(-remaining[debtor], remaining[creditor]);
      const next = [...remaining];
      next[debtor] += amountCents;
      next[creditor] -= amountCents;
      const candidate = [
        { fromId: PLAYER_IDS[debtor], toId: PLAYER_IDS[creditor], amountCents },
        ...search(next),
      ];
      if (best === null || candidate.length < best.length) best = candidate;
    }
    return best;
  }
  return search(balances);
}
