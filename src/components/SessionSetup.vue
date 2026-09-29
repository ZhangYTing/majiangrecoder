<script setup>
import { computed, ref, watch } from "vue";
import {
  DEFAULT_SEATS,
  money,
  parseBase,
  SEATS,
  validateNames,
} from "../domain/recorder.js";
import AppIcon from "./AppIcon.vue";
const props = defineProps({ state: Object, disabled: Boolean });
const emit = defineEmits(["start"]);
const names = ref(props.state.players.map((p) => p.name));
watch(
  () => props.state.players,
  (players) => {
    names.value = players.map((p) => p.name);
  },
);
const previous = props.state.sessions.at(-1);
const seats = ref({ ...(previous?.seats || DEFAULT_SEATS) });
const base = ref(previous ? money(previous.baseCents) : "1");
const error = ref("");
const step = ref(1);
const first = computed(() => !props.state.sessions.length);
const selfPrice = computed(() => {
  try {
    return money(parseBase(base.value) * 2);
  } catch {
    return "—";
  }
});

function assign(key, event) {
  const next = event.target.value;
  const other = SEATS.find((s) => s.key !== key && seats.value[s.key] === next);
  // 换一个座位时交换另一位，始终保证四人各占一个位置。
  if (other) seats.value[other.key] = seats.value[key];
  seats.value[key] = next;
}
function submit() {
  try {
    error.value = "";
    emit("start", {
      names: validateNames(names.value),
      seats: { ...seats.value },
      baseCents: parseBase(base.value),
    });
  } catch (e) {
    error.value = e.message;
  }
}
function advance() {
  try {
    if (first.value) validateNames(names.value);
    error.value = "";
    step.value = 2;
  } catch (e) {
    error.value = e.message;
  }
}
function back() {
  error.value = "";
  step.value = 1;
}
</script>

<template>
  <form
    id="session-setup"
    class="setup-form"
    @submit.prevent="step === 1 ? advance() : submit()"
  >
    <div class="setup-stage" v-if="step === 1">
      <div class="field-heading">
        <span class="step-number">1/2</span>
        <div>
          <h3>{{ first ? "先认识一下四位牌友" : "安排这一场的座位" }}</h3>
          <p class="muted">
            {{
              first
                ? "名字只需填一次，以后每场直接复用。"
                : "一场内座位固定，成绩始终跟着人走。"
            }}
          </p>
        </div>
      </div>
      <div v-if="first" class="name-input-grid">
        <label v-for="(p, i) in state.players" :key="p.id"
          >玩家 {{ i + 1
          }}<input
            v-model="names[i]"
            :aria-label="`玩家${i + 1}姓名`"
            maxlength="12"
            required
            autocomplete="off"
        /></label>
      </div>
      <div class="seat-input-grid">
        <label v-for="seat in SEATS" :key="seat.key"
          ><span class="seat-label">{{ seat.label }}位</span
          ><select
            :value="seats[seat.key]"
            :aria-label="`${seat.label}位玩家`"
            @change="assign(seat.key, $event)"
          >
            <option v-for="(p, i) in state.players" :key="p.id" :value="p.id">
              {{ names[i] || `玩家${i + 1}` }}
            </option>
          </select></label
        >
      </div>
    </div>
    <div class="setup-stage" v-else>
      <div class="field-heading">
        <span class="step-number">2/2</span>
        <div>
          <h3>定好本场底注</h3>
          <p class="muted">点炮每人付一份，自摸每人付两份。</p>
        </div>
      </div>
      <div class="base-setting">
        <label for="base-input">点炮每人付</label>
        <div class="amount-input">
          <span>¥</span
          ><input
            id="base-input"
            v-model="base"
            inputmode="decimal"
            aria-label="底注金额"
            required
          /><span>元</span>
        </div>
        <span class="self-base"
          >自摸每人 <strong>{{ selfPrice }}</strong> 元</span
        >
      </div>
      <div class="setup-review">
        <div v-for="seat in SEATS" :key="seat.key">
          <span>{{ seat.label }}位</span>
          <strong
            :title="
              names[state.players.findIndex((p) => p.id === seats[seat.key])]
            "
            >{{
              names[state.players.findIndex((p) => p.id === seats[seat.key])]
            }}</strong
          >
        </div>
      </div>
    </div>
    <p v-if="error" role="alert" class="form-error">{{ error }}</p>
    <button
      v-if="step === 1"
      class="button primary start-button"
      type="submit"
      :disabled="disabled"
    >
      下一步，设置底注<AppIcon name="arrow" />
    </button>
    <div v-else class="setup-action-row">
      <button class="button secondary" type="button" @click="back">
        返回上一步
      </button>
      <button
        class="button primary start-button"
        type="submit"
        :disabled="disabled"
      >
        {{ first ? "入座，开始记分" : "开始新的一场" }}<AppIcon name="arrow" />
      </button>
    </div>
    <p class="setup-note">
      <AppIcon name="shield" :size="15" />每局自动保存，新场保留所有历史。
    </p>
  </form>
</template>
