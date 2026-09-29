<script setup>
import { computed } from "vue";
import { allStats, money } from "../domain/recorder.js";
import { filterSessions, resolveDateRange } from "../domain/date-range.js";
import DateFilter from "./DateFilter.vue";
import AppIcon from "./AppIcon.vue";
const props = defineProps({ state: Object, filter: Object });
const emit = defineEmits(["update:filter"]);
const sessions = computed(() =>
  filterSessions(
    [
      ...props.state.sessions,
      ...(props.state.active ? [props.state.active] : []),
    ],
    resolveDateRange(props.filter),
  ),
);
const stats = computed(() => allStats(props.state, sessions.value));
const scope = computed(() =>
  props.filter.preset === "all" ? "累计" : "所选范围",
);
const rounds = computed(() =>
  sessions.value.reduce((total, s) => total + s.rounds.length, 0),
);
const draws = computed(() =>
  sessions.value.reduce(
    (total, s) => total + s.rounds.filter((r) => r.kind === "draw").length,
    0,
  ),
);
</script>

<template>
  <div class="stats-view">
    <DateFilter
      :model-value="filter"
      @update:model-value="emit('update:filter', $event)"
    />
    <section class="panel totals-overview">
      <div>
        <div class="eyebrow">{{ scope }}成绩</div>
        <h2>四位牌友，一本总账</h2>
        <p class="muted">
          {{
            sessions.some((session) => !session.endedAt)
              ? "已计入范围内进行中的场次。"
              : "汇总范围内已结束场次。"
          }}改名字、换座位都不影响累计。
        </p>
      </div>
      <div class="overview-numbers">
        <div>
          <strong>{{ sessions.length }}</strong
          ><span>{{ scope }}场次</span>
        </div>
        <div>
          <strong>{{ rounds }}</strong
          ><span>{{ scope }}局数</span>
        </div>
        <div>
          <strong>{{ draws }}</strong
          ><span>流局</span>
        </div>
      </div>
    </section>
    <div class="stats-grid">
      <section
        v-for="(player, i) in stats"
        :key="player.id"
        class="panel player-stat"
      >
        <header>
          <span class="avatar" :class="`avatar-${i}`">{{
            player.name.slice(0, 1)
          }}</span>
          <div>
            <h2 :title="player.name">{{ player.name }}</h2>
            <span class="muted tiny">参加 {{ player.sessions }} 场</span>
          </div>
          <span class="player-index">0{{ i + 1 }}</span>
        </header>
        <div class="stat-net">
          <span>{{ scope }}净输赢</span
          ><strong
            :class="{
              positive: player.netCents > 0,
              negative: player.netCents < 0,
            }"
            >{{ money(player.netCents, true) }}<small>元</small></strong
          >
        </div>
        <div class="stat-detail">
          <div>
            <strong>{{ player.wins }}</strong
            ><span title="胡牌次数">胡牌</span>
          </div>
          <div>
            <strong>{{ player.discardWins }}</strong
            ><span>点炮胡</span>
          </div>
          <div>
            <strong>{{ player.selfWins }}</strong
            ><span>自摸</span>
          </div>
        </div>
      </section>
    </div>
    <p class="balance-note">
      <AppIcon name="check" :size="17" />四人净输赢合计
      {{ money(stats.reduce((sum, p) => sum + p.netCents, 0)) }} 元 ·
      每笔记录都有来有往
    </p>
  </div>
</template>
