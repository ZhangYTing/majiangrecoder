<script setup>
import { computed, ref } from "vue";
import { money, sessionScores } from "../domain/recorder.js";
import { dateTime, fullDate } from "../format.js";
import AppIcon from "./AppIcon.vue";
import { useGridPagination } from "../composables/useGridPagination.js";
const props = defineProps({ state: Object });
const emit = defineEmits(["detail", "go-score"]);
const grid = ref(null);
const { page, pageSize } = useGridPagination(
  grid,
  computed(() => props.state.sessions.length),
);
const pages = computed(() =>
  Math.max(1, Math.ceil(props.state.sessions.length / pageSize.value)),
);
const sessions = computed(() =>
  props.state.sessions
    .map((s, i) => ({ ...s, number: i + 1 }))
    .reverse()
    .slice(page.value * pageSize.value, (page.value + 1) * pageSize.value),
);
</script>

<template>
  <div class="history-view">
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
    <template v-else>
      <div class="history-summary">
        <span>共 {{ state.sessions.length }} 场已结束</span
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
            查看每局明细<AppIcon name="arrow" :size="17" />
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
