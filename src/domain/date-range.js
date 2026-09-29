export function localDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("日期不正确。");
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, "0"))
    .join("-");
}

function validateDate(value) {
  if (!value) return "";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    localDateKey(`${value}T12:00:00`) !== value
  )
    throw new Error("请输入有效日期。");
  return value;
}

export function resolveDateRange(selection, now = new Date()) {
  switch (selection.preset) {
    case "all":
      return { from: "", to: "" };
    case "today": {
      const today = localDateKey(now);
      return { from: today, to: today };
    }
    case "month":
      return {
        from: localDateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: localDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      };
    case "custom": {
      const from = validateDate(selection.from);
      const to = validateDate(selection.to);
      if (!from && !to) throw new Error("请至少选择一个日期。");
      if (from && to && from > to)
        throw new Error("开始日期不能晚于结束日期。");
      return { from, to };
    }
    default:
      throw new Error("日期筛选方式不正确。");
  }
}

// 按浏览器所在时区的开场日期整场计入，跨午夜不拆分一场。
export function filterSessions(sessions, range) {
  return sessions.filter((session) => {
    const date = localDateKey(session.startedAt);
    return (
      (!range.from || date >= range.from) && (!range.to || date <= range.to)
    );
  });
}
