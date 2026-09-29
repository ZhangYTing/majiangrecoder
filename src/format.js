export function dateTime(value, timeOnly = false) {
  const date = new Date(value);
  return date.toLocaleString(
    "zh-CN",
    timeOnly
      ? { hour: "2-digit", minute: "2-digit", hour12: false }
      : {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        },
  );
}

export function fullDate(value) {
  return new Date(value).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
