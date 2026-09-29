<script setup>
import { computed } from "vue";
import { money } from "../domain/recorder.js";
import { settlementTransfers } from "../domain/settlement.js";
const props = defineProps({ scores: Object, players: Array });
const transfers = computed(() => settlementTransfers(props.scores));
const name = (id) =>
  props.players.find((player) => player.id === id)?.name || "";
</script>

<template>
  <section class="settlement-list" aria-label="建议结算清单">
    <div class="settlement-heading">
      <h3>建议结算</h3>
      <span>{{ transfers.length }} 笔付款</span>
    </div>
    <ol v-if="transfers.length">
      <li
        v-for="transfer in transfers"
        :key="`${transfer.fromId}-${transfer.toId}`"
      >
        <span class="settlement-person" :title="name(transfer.fromId)">{{
          name(transfer.fromId)
        }}</span>
        <span class="settlement-arrow">付给 →</span>
        <span class="settlement-person" :title="name(transfer.toId)">{{
          name(transfer.toId)
        }}</span>
        <strong>{{ money(transfer.amountCents) }}<small> 元</small></strong>
      </li>
    </ol>
    <p v-else class="settlement-zero">本场四人输赢为零，无需付款。</p>
    <p class="help-note">
      按本场净输赢合并付款，尽量减少笔数；请自行确认实际收付款。
    </p>
  </section>
</template>
