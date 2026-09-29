<script setup>
import { computed, ref, watch } from "vue";
import { money, sessionScores } from "../domain/recorder.js";
import { dateTime, fullDate } from "../format.js";
import AppIcon from "./AppIcon.vue";
import DateFilter from "./DateFilter.vue";
import { filterSessions, resolveDateRange } from "../domain/date-range.js";
import { useGridPagination } from "../composables/useGridPagination.js";
const props = defineProps({ state: Object, filter: Object });
const emit = defineEmits(["detail", "go-score", "update:filter"]);
const filtered = computed(() =>
  filterSessions(
    props.state.sessions.map((session, index) => ({
      ...session,
      number: index + 1,
    })),
    resolveDateRange(props.filter),
  ),
);
const grid = ref(null);
const { page, pageSize } = useGridPagination(
  grid,
  computed(() => filtered.value.length),
);
const pages = computed(() =>
  Math.max(1, Math.ceil(filtered.value.length / pageSize.value)),
);
const sessions = computed(() =>
  [...filtered.value]
    .reverse()
    .slice(page.value * pageSize.value, (page.value + 1) * pageSize.value),
);
watch(
  () => props.filter,
  () => {
    page.value = 0;
  },
);
</script>

<template>
  <div class="history-view">
    <DateFilter
      :model-value="filter"
      @update:model-value="emit('update:filter', $event)"
    />
    <div v-if="!state.sessions.length" class="panel empty-page">
      <div class="empty-illustration" aria-hidden="true">
        <AppIcon name="history" :size="42" />
      </div>
      <h2>每一场，都留个记录</h2>
      <p>
        结束本场后，时间、每局明细和最终输赢<br />都会保存在这里，新场不会覆盖旧场。
      </p>
      <button class="button primary" @click="emit('go-score')">
        {{ state.active ? "回到当前场" : "开始第一场" }}<AppIcon name="arrow" />
      </button>
    </div>
    <div v-else-if="!filtered.length" class="panel empty-page">
      <div class="empty-illustration">
        <AppIcon name="history" :size="42" />
      </div>
      <h2>这个日期范围没有场次</h2>
      <p>可以调整日期，或选择全部查看已有记录。</p>
      <button
        class="button primary"
        @click="emit('update:filter', { preset: 'all', from: '', to: '' })"
      >
        查看全部历史
      </button>
    </div>
    <template v-else>
      <div class="history-summary">
        <span
          >所选 {{ filtered.length }} 场 · 全部
          {{ state.sessions.length }} 场已结束</span
        ><span class="muted">按结束顺序，最近的场次在前</span>
      </div>
      <div ref="grid" class="history-grid">
        <button
          v-for="session in sessions"
          :key="session.id"
          class="panel history-card"
          :aria-label="`查看第${session.number}场详情`"
          @click="emit('detail', session)"
        >
          <div class="history-card-header">
            <div>
              <span class="history-date">{{
                fullDate(session.startedAt)
              }}</span>
              <h2>第 {{ session.number }} 场</h2>
            </div>
            <span class="kind-badge finished">已结束</span>
          </div>
          <div class="history-meta">
            <span
              >{{ dateTime(session.startedAt, true) }} —
              {{ dateTime(session.endedAt) }}</span
            ><span
              >{{ session.rounds.length }} 局 · 底注
              {{ money(session.baseCents) }} 元</span
            >
          </div>
          <div class="history-scores">
            <div v-for="player in state.players" :key="player.id">
              <span :title="player.name">{{ player.name }}</span
              ><strong
                :class="{
                  positive: sessionScores(session)[player.id] > 0,
                  negative: sessionScores(session)[player.id] < 0,
                }"
                >{{ money(sessionScores(session)[player.id], true)
                }}<small>元</small></strong
              >
            </div>
          </div>
          <div class="history-card-footer">
            查看明细与结算<AppIcon name="arrow" :size="17" />
          </div>
        </button>
      </div>
      <div class="pagination">
        <button class="text-button" :disabled="!page" @click="page--">
          上一页</button
        ><span>{{ page + 1 }} / {{ pages }}</span
        ><button
          class="text-button"
          :disabled="page >= pages - 1"
          @click="page++"
        >
          下一页
        </button>
      </div>
    </template>
  </div>
</template>
