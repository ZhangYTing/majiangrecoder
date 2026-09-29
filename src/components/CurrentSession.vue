<script setup>
import { computed, ref, watch } from "vue";
import { money, SEATS, sessionScores } from "../domain/recorder.js";
import { dateTime } from "../format.js";
import AppIcon from "./AppIcon.vue";
import RoundList from "./RoundList.vue";
const props = defineProps({
  session: Object,
  players: Array,
  number: Number,
  disabled: Boolean,
  busy: Boolean,
});
const emit = defineEmits(["record", "undo", "finish", "draw"]);
const winner = ref(null);
const kind = ref("discard");
const pane = ref("table");
const scores = computed(() => sessionScores(props.session));
const playerName = (id) => props.players.find((p) => p.id === id)?.name || "";
const winnerSeat = computed(
  () => SEATS.find((s) => props.session.seats[s.key] === winner.value)?.label,
);
const paid = computed(
  () => props.session.baseCents * (kind.value === "self" ? 2 : 1),
);
watch(
  () => props.session.rounds.length,
  () => {
    winner.value = null;
  },
);
</script>

<template>
  <div class="current-layout" :data-pane="pane">
    <div class="compact-view-switch" role="group" aria-label="当前牌局视图">
      <button
        class="button secondary"
        :aria-pressed="pane === 'table'"
        @click="pane = 'table'"
      >
        牌桌记分
      </button>
      <button
        class="button secondary"
        :aria-pressed="pane === 'records'"
        @click="pane = 'records'"
      >
        本场明细 {{ session.rounds.length }}
      </button>
    </div>
    <section class="panel table-panel" aria-labelledby="table-title">
      <header class="panel-header">
        <div>
          <div class="eyebrow">当前牌局</div>
          <h2 id="table-title">
            第 {{ number }} 场 <span class="live-badge"><i></i>进行中</span>
          </h2>
        </div>
        <button
          class="button secondary finish-button"
          :disabled="disabled || !session.rounds.length || busy"
          @click="emit('finish')"
        >
          结束本场<AppIcon name="chevron" :size="16" />
        </button>
      </header>
      <div class="table-meta">
        <span
          ><AppIcon name="clock" :size="15" />{{
            dateTime(session.startedAt)
          }}
          开场</span
        ><span
          >底注 <strong>¥{{ money(session.baseCents) }}</strong></span
        >
      </div>
      <div class="mahjong-table" role="group" aria-label="选择胡牌玩家">
        <button
          v-for="seat in SEATS"
          :key="seat.key"
          class="player-tile"
          :class="[seat.key, { selected: winner === session.seats[seat.key] }]"
          :aria-pressed="winner === session.seats[seat.key]"
          :aria-label="`选择${seat.label}位${playerName(session.seats[seat.key])}`"
          :disabled="disabled || busy"
          @click="winner = session.seats[seat.key]"
        >
          <span class="seat-mark">{{ seat.label }}</span
          ><span
            class="player-name"
            :title="playerName(session.seats[seat.key])"
            >{{ playerName(session.seats[seat.key]) }}</span
          ><strong
            class="player-money"
            :class="{
              positive: scores[session.seats[seat.key]] > 0,
              negative: scores[session.seats[seat.key]] < 0,
            }"
            >{{ money(scores[session.seats[seat.key]], true)
            }}<small>元</small></strong
          ><span
            v-if="winner === session.seats[seat.key]"
            class="selected-check"
            ><AppIcon name="check" :size="12"
          /></span>
        </button>
        <div class="table-center">
          <div class="center-dots" aria-hidden="true">
            <i></i><i></i><i></i>
          </div>
          <span>准备记录</span
          ><strong>第 {{ session.rounds.length + 1 }} 局</strong
          ><span class="table-center-tip">{{
            winner ? `${winnerSeat}位胡牌` : "点击胡牌的人"
          }}</span>
        </div>
      </div>
      <p class="table-caption">四人金额为本场累计 · 选中胡牌的人开始记录</p>
      <div class="scoring-controls">
        <div class="control-label">
          <span>胡牌方式</span><small>另外三人都需支付</small>
        </div>
        <div class="kind-options" role="group" aria-label="胡牌方式">
          <button
            :class="{ active: kind === 'discard' }"
            :aria-pressed="kind === 'discard'"
            :disabled="disabled || busy"
            @click="kind = 'discard'"
          >
            <span>点炮胡</span
            ><small>每人付 {{ money(session.baseCents) }} 元</small></button
          ><button
            :class="{ active: kind === 'self' }"
            :aria-pressed="kind === 'self'"
            :disabled="disabled || busy"
            @click="kind = 'self'"
          >
            <span>自摸</span
            ><small>每人付 {{ money(session.baseCents * 2) }} 元</small>
          </button>
        </div>
        <div class="score-preview" aria-live="polite">
          <template v-if="winner"
            ><span
              >{{ playerName(winner) }} 本局赢
              <strong>+{{ money(paid * 3) }} 元</strong></span
            ><small>其余三人各 −{{ money(paid) }} 元</small></template
          ><span v-else class="muted">请先在牌桌上选择胡牌的人</span>
        </div>
        <button
          class="button primary record-button"
          :disabled="!winner || disabled || busy"
          @click="emit('record', kind, winner)"
        >
          <AppIcon name="plus" /><span>{{
            busy ? "正在保存…" : "记下这一局"
          }}</span
          ><span v-if="winner && !busy" class="button-amount"
            >+{{ money(paid * 3) }} 元</span
          >
        </button>
        <div class="secondary-actions">
          <button
            class="button secondary draw-button"
            :disabled="disabled || busy"
            @click="emit('draw')"
          >
            本局流局</button
          ><button
            class="button secondary undo-button"
            :disabled="disabled || !session.rounds.length || busy"
            @click="emit('undo')"
          >
            <AppIcon name="undo" :size="16" />撤销上一局
          </button>
        </div>
      </div>
    </section>
    <section class="panel rounds-panel" aria-labelledby="rounds-title">
      <header class="panel-header">
        <div>
          <div class="eyebrow">记分明细</div>
          <h2 id="rounds-title">
            本场记录
            <span class="count-badge">{{ session.rounds.length }}</span>
          </h2>
        </div>
        <span class="muted tiny">最近的局在前</span>
      </header>
      <RoundList :session="session" :players="players" fit-container />
    </section>
  </div>
</template>
