<script setup>
import { computed, ref } from "vue";
import { localDateKey, resolveDateRange } from "../domain/date-range.js";
import AppDialog from "./AppDialog.vue";
const props = defineProps({ modelValue: Object });
const emit = defineEmits(["update:modelValue"]);
const choosing = ref(false);
const from = ref("");
const to = ref("");
const error = ref("");
const presets = [
  { key: "all", label: "全部" },
  { key: "today", label: "今天" },
  { key: "month", label: "本月" },
  { key: "custom", label: "自选日期" },
];
const caption = computed(() => {
  const range = resolveDateRange(props.modelValue);
  if (props.modelValue.preset === "all")
    return "按开场日期筛选，跨午夜整场计入";
  if (!range.to) return `${range.from} 起 · 开场日期`;
  if (!range.from) return `截至 ${range.to} · 开场日期`;
  return `${range.from} 至 ${range.to} · 开场日期`;
});
function choose(preset) {
  error.value = "";
  if (preset === "custom") {
    const range = resolveDateRange(props.modelValue);
    from.value = range.from || localDateKey(new Date());
    to.value = range.to || "";
    choosing.value = !choosing.value;
    return;
  }
  choosing.value = false;
  emit("update:modelValue", { preset, from: "", to: "" });
}
function apply() {
  const selection = { preset: "custom", from: from.value, to: to.value };
  try {
    resolveDateRange(selection);
    emit("update:modelValue", selection);
    choosing.value = false;
    error.value = "";
  } catch (cause) {
    error.value = cause.message;
  }
}
</script>

<template>
  <div class="date-filter">
    <div class="date-filter-bar">
      <div class="date-presets" role="group" aria-label="日期筛选">
        <button
          v-for="preset in presets"
          :key="preset.key"
          type="button"
          :aria-pressed="modelValue.preset === preset.key"
          @click="choose(preset.key)"
        >
          {{ preset.label }}
        </button>
      </div>
      <span class="date-filter-caption">{{ caption }}</span>
    </div>
    <AppDialog
      v-if="choosing"
      title="选择开场日期"
      subtitle="包含起止日期，可留空其中一项。"
      @close="choosing = false"
    >
      <form
        id="date-filter-form"
        class="date-filter-form"
        @submit.prevent="apply"
      >
        <label
          >开始日期<input v-model="from" type="date" aria-label="开始日期"
        /></label>
        <label
          >结束日期<input v-model="to" type="date" aria-label="结束日期"
        /></label>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      </form>
      <template #footer
        ><button class="button secondary" @click="choosing = false">取消</button
        ><button class="button primary" type="submit" form="date-filter-form">
          应用日期
        </button></template
      >
    </AppDialog>
  </div>
</template>
