<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { KIND_LABELS, money, roundScores, SEATS } from "../domain/recorder.js";
import { dateTime } from "../format.js";
import AppIcon from "./AppIcon.vue";
import { pageCapacity, resizedPage } from "../layout/pagination.js";
const props = defineProps({
  session: Object,
  players: Array,
  fitContainer: { type: Boolean, default: true },
  editable: Boolean,
  disabled: Boolean,
});
const emit = defineEmits(["edit"]);
const container = ref(null);
const pageSize = ref(20);
const page = ref(0);
const pages = computed(() =>
  Math.max(1, Math.ceil(props.session.rounds.length / pageSize.value)),
);
const rounds = computed(() =>
  props.session.rounds
    .map((r, i) => ({ ...r, number: i + 1 }))
    .reverse()
    .slice(page.value * pageSize.value, (page.value + 1) * pageSize.value),
);
// 明细按实际面板空间分页，页数变化不会影响保存的记录。
let measuredWidth = 0;
let largestRowHeight = 150;
function fitPage() {
  const element = container.value;
  if (!element || !props.fitContainer) return;
  const fits =
    getComputedStyle(element).getPropertyValue("--fit-rounds").trim() === "1";
  if (element.clientWidth !== measuredWidth) {
    measuredWidth = element.clientWidth;
    largestRowHeight =
      parseFloat(
        getComputedStyle(element).getPropertyValue("--page-item-height"),
      ) || 125;
  }
  // 记住当前宽度下最高的记录，避免长短姓名混排时页容量反复切换。
  if (fits)
    largestRowHeight = Math.max(
      largestRowHeight,
      ...Array.from(
        element.querySelectorAll(".round-item"),
        (row) => row.getBoundingClientRect().height,
      ),
    );
  const nextSize = fits
    ? pageCapacity({
        height: element.clientHeight - 64,
        itemHeight: largestRowHeight,
      })
    : 20;
  if (nextSize !== pageSize.value) {
    // 缩放后仍保留原来正在查看的那部分记录。
    const nextPage = resizedPage(
      page.value,
      pageSize.value,
      nextSize,
      props.session.rounds.length,
    );
    pageSize.value = nextSize;
    page.value = nextPage;
  }
}
let resizeObserver;
let observedList;
function observeList() {
  const list = container.value?.querySelector("ol");
  if (list === observedList || !resizeObserver) return;
  if (observedList) resizeObserver.unobserve(observedList);
  observedList = list;
  if (list) resizeObserver.observe(list);
}
onMounted(() => {
  if (!props.fitContainer) return;
  resizeObserver = new ResizeObserver(() => {
    observeList();
    fitPage();
  });
  resizeObserver.observe(container.value);
  observeList();
  fitPage();
});
onBeforeUnmount(() => resizeObserver?.disconnect());
watch(
  () => props.session.rounds.length,
  () => {
    page.value = 0;
    nextTick(() => {
      observeList();
      fitPage();
    });
  },
);
watch(page, () => nextTick(fitPage));
const name = (id) => props.players.find((p) => p.id === id)?.name || "";
</script>

<template>
  <div ref="container" class="rounds-content">
    <div v-if="!session.rounds.length" class="empty-rounds">
      <div class="empty-icon"><AppIcon name="history" :size="28" /></div>
      <h3>第一局，等你记下</h3>
      <p>选中胡牌的人和方式，<br />这一局的输赢就会出现在这里。</p>
    </div>
    <div v-else class="round-list">
      <ol>
        <li v-for="round in rounds" :key="round.id" class="round-item">
          <div class="round-top">
            <div class="round-number">
              {{ String(round.number).padStart(2, "0") }}
            </div>
            <div class="round-description">
              <strong>{{
                round.kind === "draw"
                  ? "本局流局"
                  : `${name(round.winnerId)} 胡牌`
              }}</strong
              ><span>{{ dateTime(round.at, true) }}</span>
            </div>
            <div class="round-tools">
              <span class="kind-badge" :class="round.kind">{{
                KIND_LABELS[round.kind]
              }}</span>
              <button
                v-if="editable"
                class="round-edit-button"
                :disabled="disabled"
                :aria-label="`修改第${round.number}局`"
                @click="emit('edit', round)"
              >
                修改
              </button>
            </div>
          </div>
          <div class="round-deltas">
            <div v-for="seat in SEATS" :key="seat.key">
              <span :title="name(session.seats[seat.key])"
                >{{ seat.label }} · {{ name(session.seats[seat.key]) }}</span
              ><strong
                :class="{
                  positive:
                    roundScores(session, round)[session.seats[seat.key]] > 0,
                  negative:
                    roundScores(session, round)[session.seats[seat.key]] < 0,
                }"
                >{{
                  money(
                    roundScores(session, round)[session.seats[seat.key]],
                    true,
                  )
                }}</strong
              >
            </div>
          </div>
        </li>
      </ol>
      <div v-if="pages > 1" class="pagination">
        <button class="text-button" :disabled="page === 0" @click="page--">
          较新的局</button
        ><span>{{ page + 1 }} / {{ pages }}</span
        ><button
          class="text-button"
          :disabled="page >= pages - 1"
          @click="page++"
        >
          较早的局
        </button>
      </div>
    </div>
  </div>
</template>
