<script setup>
defineProps({ name: String, size: { type: Number, default: 20 } });
const paths = {
  table: "M4 4h16v16H4z M4 10h16 M10 10v10",
  history: "M3 11a9 9 0 1 1 3 7 M3 4v7h7 M12 7v5l3 2",
  chart: "M4 4v16h16 M8 15v-4 M13 15V7 M18 15v-7",
  download: "M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5",
  upload: "M12 16V4 m-5 5 5-5 5 5 M4 16v5h16v-5",
  settings: "M4 7h16 M4 17h16 M8 4v6 M16 14v6",
  trash: "M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
  arrow: "M5 12h14 m-5-5 5 5-5 5",
  chevron: "m9 5 7 7-7 7",
  plus: "M12 5v14 M5 12h14",
  check: "m5 12 4 4L19 6",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z m-4 9 3 3 5-6",
  undo: "M4 4v6h6 M4 10c2-7 16-7 16 3 0 5-6 8-11 6",
  close: "m6 6 12 12 M6 18 18 6",
  clock: "M12 7v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  info: "M12 11v6 M12 7v.1 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
};
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name] || paths.info" />
  </svg>
</template>
