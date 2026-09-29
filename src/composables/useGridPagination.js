import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { pageCapacity, resizedPage } from "../layout/pagination.js";

export function useGridPagination(container, total, maximum = 12) {
  const page = ref(0);
  const pageSize = ref(1);
  let observer;
  let measuredWidth = 0;
  let minimumHeight = 0;
  function measure() {
    const element = container.value;
    if (!element) return;
    const style = getComputedStyle(element);
    const baseHeight =
      parseFloat(style.getPropertyValue("--page-item-height")) || 220;
    if (measuredWidth !== element.clientWidth) {
      measuredWidth = element.clientWidth;
      minimumHeight = baseHeight;
    }
    // 大金额等内容超过卡片时减少行数，不通过裁切掩盖溢出。
    for (const card of element.children) {
      if (card.scrollHeight > card.clientHeight + 1)
        minimumHeight = Math.max(minimumHeight, card.scrollHeight + 2);
    }
    const nextSize = pageCapacity({
      height: element.clientHeight,
      itemHeight: Math.max(baseHeight, minimumHeight),
      gap: parseFloat(style.rowGap) || 0,
      columns: style.gridTemplateColumns.split(/\s+/).length,
      max: maximum,
    });
    const nextPage = resizedPage(
      page.value,
      pageSize.value,
      nextSize,
      total.value,
    );
    pageSize.value = nextSize;
    page.value = nextPage;
  }
  onMounted(() => {
    observer = new ResizeObserver(measure);
    if (container.value) observer.observe(container.value);
    measure();
  });
  onBeforeUnmount(() => observer?.disconnect());
  watch(total, () => nextTick(measure));
  watch([page, pageSize], () => nextTick(measure));
  watch(container, (element, previous) => {
    if (previous) observer?.unobserve(previous);
    if (element) observer?.observe(element);
    nextTick(measure);
  });
  return { page, pageSize };
}
