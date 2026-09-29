<script setup>
import { computed } from "vue";
import {
  KIND_LABELS,
  money,
  roundScores,
  SEATS,
  sessionScores,
} from "../domain/recorder.js";
const props = defineProps({
  session: Object,
  round: Object,
  number: Number,
  players: Array,
  kind: String,
  winner: String,
  disabled: Boolean,
});
const emit = defineEmits(["update:kind", "update:winner", "confirm"]);
const previous = computed(() => sessionScores(props.session));
const preview = computed(() => {
  const before = roundScores(props.session, props.round);
  const after = roundScores(props.session, {
    kind: props.kind,
    winnerId: props.kind === "draw" ? null : props.winner,
  });
  return Object.fromEntries(
    props.players.map((player) => [
      player.id,
      previous.value[player.id] - before[player.id] + after[player.id],
    ]),
  );
});
const name = (id) =>
  props.players.find((player) => player.id === id)?.name || "";
</script>

<template>
  <form
    id="round-correction"
    class="correction-form"
    @submit.prevent="emit('confirm')"
  >
    <p class="confirm-copy">
      第 <strong>{{ number }}</strong> 局原记录：
      {{
        round.kind === "draw"
          ? "流局"
          : `${name(round.winnerId)} ${KIND_LABELS[round.kind]}`
      }}
    </p>
    <div class="correction-fields">
      <label
        >正确结果<select
          :value="kind"
          :disabled="disabled"
          aria-label="正确结果"
          @change="emit('update:kind', $event.target.value)"
        >
          <option v-for="(label, key) in KIND_LABELS" :key="key" :value="key">
            {{ label }}
          </option>
        </select></label
      >
      <label
        >胡牌玩家<select
          :value="winner"
          :disabled="disabled || kind === 'draw'"
          aria-label="胡牌玩家"
          @change="emit('update:winner', $event.target.value)"
        >
          <option
            v-for="seat in SEATS"
            :key="seat.key"
            :value="session.seats[seat.key]"
          >
            {{ seat.label }} · {{ name(session.seats[seat.key]) }}
          </option>
        </select></label
      >
    </div>
    <h3 class="correction-preview-title">修改后的本场净输赢</h3>
    <div class="correction-preview" aria-live="polite">
      <div v-for="player in players" :key="player.id">
        <span :title="player.name">{{ player.name }}</span>
        <small>原 {{ money(previous[player.id], true) }} 元</small>
        <strong
          :class="{
            positive: preview[player.id] > 0,
            negative: preview[player.id] < 0,
          }"
          >{{ money(preview[player.id], true) }}<small> 元</small></strong
        >
      </div>
    </div>
    <p class="help-note">
      确认后自动更新本场金额、结算清单及总账，保留原时间、座位和底注。
    </p>
    <p v-if="session.endedAt" class="correction-warning">
      本场已归档。如果已经结清，请重新核对付款差额。
    </p>
  </form>
</template>
