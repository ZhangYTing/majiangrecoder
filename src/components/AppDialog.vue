<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import AppIcon from "./AppIcon.vue";
defineProps({ title: String, subtitle: String, wide: Boolean });
const emit = defineEmits(["close"]);
const dialog = ref(null);
let opener;
onMounted(() => {
  opener = document.activeElement;
  dialog.value.showModal();
});
onUnmounted(() => {
  if (opener?.isConnected) opener.focus();
});
</script>

<template>
  <dialog
    ref="dialog"
    class="app-dialog"
    :class="{ wide }"
    aria-labelledby="dialog-title"
    @cancel.prevent="emit('close')"
    @click="
      (event) => {
        if (event.target === dialog) emit('close');
      }
    "
  >
    <header class="dialog-header">
      <div>
        <h2 id="dialog-title">{{ title }}</h2>
        <p v-if="subtitle" class="muted">{{ subtitle }}</p>
      </div>
      <button class="icon-button" aria-label="关闭弹窗" @click="emit('close')">
        <AppIcon name="close" />
      </button>
    </header>
    <div class="dialog-body"><slot /></div>
    <footer v-if="$slots.footer" class="dialog-footer">
      <slot name="footer" />
    </footer>
  </dialog>
</template>
