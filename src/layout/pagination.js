// 分页只影响展示，不修改账本。窗口过小时仍保留一项供查看。
export function pageCapacity({
  height,
  itemHeight,
  gap = 0,
  columns = 1,
  max = 20,
}) {
  const rows = Math.floor(
    (Math.max(0, height) + gap) / (Math.max(1, itemHeight) + gap),
  );
  return Math.max(1, Math.min(max, rows * Math.max(1, columns)));
}

export function resizedPage(page, oldSize, newSize, total) {
  const lastPage = Math.max(0, Math.ceil(total / newSize) - 1);
  return Math.min(Math.floor((page * oldSize) / newSize), lastPage);
}
