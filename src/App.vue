<script setup>
import { computed, onUnmounted, ref } from "vue";
import {
  createState,
  finishSession,
  KIND_LABELS,
  money,
  recordRound,
  renamePlayers,
  SEATS,
  sessionScores,
  startSession,
  undoRound,
} from "./domain/recorder.js";
import { useRecorder } from "./composables/useRecorder.js";
import { dateTime, fullDate } from "./format.js";
import AppDialog from "./components/AppDialog.vue";
import AppIcon from "./components/AppIcon.vue";
import CurrentSession from "./components/CurrentSession.vue";
import HistoryView from "./components/HistoryView.vue";
import RoundList from "./components/RoundList.vue";
import SessionSetup from "./components/SessionSetup.vue";
import StatsView from "./components/StatsView.vue";

const { state, error, blocked, stale, saving, lastSaved, transact, stats } =
  useRecorder();
const view = ref("score");
const setupEpoch = ref(0);
const logoUrl = `${import.meta.env.BASE_URL}favicon.svg`;
function reloadPage() {
  window.location.reload();
}
const dialog = ref(null);
const detail = ref(null);
const confirmationSession = ref(null);
const editedNames = ref([]);
const busy = ref(false);
const toast = ref("");
let toastTimer, busyTimer;
onUnmounted(() => {
  clearTimeout(toastTimer);
  clearTimeout(busyTimer);
});
const locked = computed(() => blocked.value || stale.value);
const working = computed(() => busy.value || saving.value);
const allSessions = computed(() => [
  ...state.value.sessions,
  ...(state.value.active ? [state.value.active] : []),
]);
const totalRounds = computed(() =>
  allSessions.value.reduce((sum, s) => sum + s.rounds.length, 0),
);
const namesById = computed(() =>
  Object.fromEntries(state.value.players.map((p) => [p.id, p.name])),
);
const activeScores = computed(() => sessionScores(confirmationSession.value));
const lastRound = computed(() => confirmationSession.value?.rounds.at(-1));
const navs = [
  { key: "score", title: "记分", icon: "table" },
  { key: "history", title: "历史", icon: "history" },
  { key: "stats", title: "总账", icon: "chart" },
];
const headings = {
  score: ["今天的牌桌", "一桌四人，输赢清楚。"],
  history: ["场次历史", "每一场的输赢，都有据可查。"],
  stats: ["四人总账", "从第一局开始，记下每一次输赢。"],
};

function notify(text) {
  toast.value = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.value = "";
  }, 3500);
}
function openDialog(type) {
  if (["undo", "finish", "draw"].includes(type))
    confirmationSession.value = state.value.active;
  if (type === "names")
    editedNames.value = state.value.players.map((p) => p.name);
  dialog.value = type;
}
function closeDialog() {
  dialog.value = null;
  detail.value = null;
  confirmationSession.value = null;
}
async function begin(payload) {
  // 只有首次开场才从入座表单设置姓名，后续场次不再提交表单缓存的名字。
  if (
    await transact((s) =>
      startSession(
        s.sessions.length ? s : renamePlayers(s, payload.names),
        payload.seats,
        payload.baseCents,
      ),
    )
  )
    notify("已开场，记下今天的第一局吧。");
}
async function record(kind, winnerId) {
  if (working.value || locked.value) return false;
  busy.value = true;
  const success = await transact((s) => recordRound(s, kind, winnerId));
  if (success)
    notify(
      kind === "draw"
        ? "流局已保存，四人金额不变。"
        : "这一局已记下，并保存到本地。",
    );
  busyTimer = setTimeout(() => {
    busy.value = false;
  }, 650);
  return success;
}
async function confirmAction() {
  const action = dialog.value;
  if (action === "reset") {
    if (await transact(createState(), true)) {
      // 重建入座表单，同时重置尚未提交的姓名、座位和底注。
      setupEpoch.value++;
      view.value = "score";
      closeDialog();
      notify("全部记录已清空，四位玩家姓名已初始化。");
    }
    return;
  }
  let success = false;
  if (action === "undo") success = await transact(undoRound);
  if (action === "finish") success = await transact(finishSession);
  if (action === "draw") {
    if (await record("draw", null)) closeDialog();
    return;
  }
  if (success) {
    notify(
      action === "finish"
        ? "本场已归档，历史和总账已更新。"
        : "上一局已撤销，本场金额已恢复。",
    );
    closeDialog();
  }
}
async function saveNames() {
  if (await transact((s) => renamePlayers(s, editedNames.value))) {
    closeDialog();
    notify("姓名已保存，所有历史成绩保持关联。");
  }
}
function showDetail(session) {
  detail.value = session;
  dialog.value = "detail";
}
const modalTitles = {
  reset: "清空全部记录？",
  names: "四位固定牌友",
  undo: "撤销上一局？",
  finish: "结束并保存本场？",
  draw: "记录本局流局？",
  detail: "本场明细",
};
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <a
        href="#"
        class="brand"
        aria-label="四方账 麻将记分器"
        @click.prevent="view = 'score'"
        ><img :src="logoUrl" alt="" width="42" height="42" /><span
          ><strong>四方账</strong><small>麻将记分器</small></span
        ></a
      >
      <div class="sidebar-label">牌桌上的小账本</div>
      <nav class="main-nav" aria-label="主要页面">
        <button
          v-for="nav in navs"
          :key="nav.key"
          :class="{ active: view === nav.key }"
          :aria-current="view === nav.key ? 'page' : undefined"
          :disabled="locked && nav.key !== 'score'"
          @click="view = nav.key"
        >
          <AppIcon :name="nav.icon" /><span>{{ nav.title }}</span
          ><span
            v-if="nav.key === 'history' && state.sessions.length"
            class="nav-count"
            >{{ state.sessions.length }}</span
          >
        </button>
      </nav>
      <div class="sidebar-bottom">
        <div class="local-info">
          <span class="local-icon"><AppIcon name="shield" :size="21" /></span
          ><strong>记录留在你的设备</strong>
          <p>自动保存每一次记分。<br />刷新或重新打开，继续记账。</p>
        </div>
        <div class="sidebar-rule">四位牌友 · 一局一胡</div>
      </div>
    </aside>

    <div
      class="workspace window-layout"
      :class="{
        'playing-layout': view === 'score' && state.active,
      }"
    >
      <header class="topbar">
        <div class="mobile-brand">
          <img :src="logoUrl" width="30" height="30" alt="" /><strong
            >四方账</strong
          >
        </div>
        <div class="breadcrumb">
          我的牌桌<span>/</span>{{ navs.find((n) => n.key === view)?.title }}
        </div>
        <div class="topbar-actions">
          <span class="save-state" :class="{ warning: error || locked }"
            ><i></i
            >{{
              locked
                ? "记录暂不可用"
                : error
                  ? "保存异常"
                  : lastSaved
                    ? `已保存 ${dateTime(lastSaved, true)}`
                    : "本地自动保存"
            }}</span
          ><button
            class="button secondary settings-button"
            :disabled="locked || saving"
            aria-label="设置四人姓名"
            title="设置四人姓名"
            @click="openDialog('names')"
          >
            <AppIcon name="settings" :size="18" />玩家设置
          </button>
          <button
            class="button secondary reset-button"
            :disabled="stale || working"
            @click="openDialog('reset')"
          >
            <AppIcon name="trash" :size="17" />清空全部记录
          </button>
        </div>
      </header>
      <main id="main-content" class="main-content">
        <div class="page-heading">
          <div>
            <div class="eyebrow">固定四人 · 本地记账</div>
            <h1>{{ headings[view][0] }}</h1>
            <p>{{ headings[view][1] }}</p>
          </div>
          <span class="today-date">{{ fullDate(new Date()) }}</span>
        </div>
        <div
          class="page-body"
          :class="
            view === 'score'
              ? state.active
                ? 'page-playing'
                : 'page-setup'
              : `page-${view}`
          "
        >
          <div v-if="error || stale" class="error-banner" role="alert">
            <AppIcon name="info" />
            <div>
              <strong>{{
                stale ? "另一个页面更新了记录" : "操作尚未完成"
              }}</strong>
              <p>
                {{ stale ? "为避免覆盖新记录，请刷新本页后继续。" : error }}
              </p>
            </div>
            <button v-if="stale" class="button secondary" @click="reloadPage">
              刷新页面
            </button>
          </div>
          <section v-if="locked" class="panel recovery-panel">
            <AppIcon name="shield" :size="40" />
            <h2>{{ stale ? "刷新后继续记分" : "本地记录暂时无法读取" }}</h2>
            <p>
              原有本地记录会保留，不会被自动覆盖。请检查浏览器存储权限后刷新页面。
            </p>
            <button class="button primary" @click="reloadPage">
              刷新页面<AppIcon name="arrow" />
            </button>
          </section>
          <template v-else-if="view === 'score'">
            <CurrentSession
              v-if="state.active"
              :session="state.active"
              :players="state.players"
              :number="state.sessions.length + 1"
              :disabled="locked || saving"
              :busy="working"
              @record="record"
              @undo="openDialog('undo')"
              @finish="openDialog('finish')"
              @draw="openDialog('draw')"
            />
            <div v-else class="welcome-layout">
              <section class="panel welcome-panel">
                <div class="welcome-heading">
                  <span class="welcome-tile" aria-hidden="true"
                    ><i></i><i></i><i></i
                  ></span>
                  <div>
                    <span class="live-badge ready"><i></i>牌桌已就绪</span>
                    <h2>
                      {{
                        state.sessions.length
                          ? "下一场，再聚一桌。"
                          : "四方入座，轻松记账。"
                      }}
                    </h2>
                    <p class="muted">
                      {{
                        state.sessions.length
                          ? "上一场已经保存，今天的输赢从零开始。"
                          : "填好名字和座位，剩下的交给小账本。"
                      }}
                    </p>
                  </div>
                </div>
                <SessionSetup
                  :key="`${state.sessions.length}-${setupEpoch}`"
                  :state="state"
                  :disabled="locked || saving"
                  @start="begin"
                />
              </section>
              <div class="welcome-aside">
                <section class="panel rules-panel">
                  <div class="eyebrow">本地玩法</div>
                  <h2>熟悉的玩法，简单的账</h2>
                  <div class="rule-item">
                    <span class="rule-number">01</span>
                    <div>
                      <h3>点炮胡 · 三家各付一份</h3>
                      <p>
                        底注 1 元时，胡牌者赢 3 元，<br />另外三人各付 1 元。
                      </p>
                    </div>
                  </div>
                  <div class="rule-item">
                    <span class="rule-number">02</span>
                    <div>
                      <h3>自摸 · 三家各付两份</h3>
                      <p>
                        底注 1 元时，胡牌者赢 6 元，<br />另外三人各付 2 元。
                      </p>
                    </div>
                  </div>
                  <div class="rules-footnote">
                    108 张数牌 · 无杠牌、庄家额外奖励
                  </div>
                </section>
                <section class="little-summary">
                  <div>
                    <span>已留存</span
                    ><strong
                      >{{ state.sessions.length }} <small>场</small></strong
                    >
                  </div>
                  <div>
                    <span>已记录</span
                    ><strong>{{ totalRounds }} <small>局</small></strong>
                  </div>
                  <AppIcon name="history" :size="38" />
                </section>
                <p class="quiet-note">
                  不必心算，也不必记在纸上。<br />聚在一桌，安心打牌。
                </p>
              </div>
            </div>
          </template>
          <HistoryView
            v-else-if="view === 'history'"
            :state="state"
            @detail="showDetail"
            @go-score="view = 'score'"
          />
          <StatsView v-else :state="state" :stats="stats" />
        </div>
        <footer class="page-footer">
          <span>四方账 <i>·</i> 只记输赢，轻松上桌</span
          ><span><AppIcon name="shield" :size="14" />本地保存，无需登录</span>
        </footer>
      </main>
    </div>

    <div v-if="toast" class="toast" role="status">
      <AppIcon name="check" :size="18" />{{ toast }}
    </div>
    <AppDialog
      v-if="dialog"
      :title="
        dialog === 'detail'
          ? `第 ${detail.number} 场 · 每局明细`
          : modalTitles[dialog]
      "
      :subtitle="
        dialog === 'names'
          ? '固定四个人。修改姓名不会改变历史成绩。'
          : undefined
      "
      :wide="dialog === 'detail'"
      @close="closeDialog"
    >
      <template v-if="dialog === 'names'"
        ><form id="player-names" @submit.prevent="saveNames">
          <div class="name-input-grid">
            <label v-for="(player, i) in state.players" :key="player.id"
              >固定玩家 {{ i + 1
              }}<input
                v-model="editedNames[i]"
                maxlength="12"
                required
                :aria-label="`固定玩家${i + 1}姓名`"
            /></label>
          </div>
          <p class="help-note">这里修改的是同一个人的名字，不是替换玩家。</p>
        </form></template
      >
      <template v-else-if="dialog === 'reset'">
        <p class="confirm-copy">
          将清空全部历史、四人总账和当前进行中的场次，并把姓名恢复为
          <strong>玩家1、玩家2、玩家3、玩家4</strong>。
        </p>
        <p class="form-error">此操作不可撤销，清空后将回到首次开场页面。</p>
      </template>
      <template v-else-if="dialog === 'undo'"
        ><p class="confirm-copy">
          将撤销第
          <strong>{{ confirmationSession.rounds.length }}</strong> 局：{{
            lastRound.kind === "draw"
              ? "流局"
              : `${namesById[lastRound.winnerId]} ${KIND_LABELS[lastRound.kind]}`
          }}。
        </p>
        <p class="muted">
          四人的本场金额会自动恢复到上一局之前。撤销后可以重新记下正确的结果。
        </p></template
      >
      <template v-else-if="dialog === 'draw'"
        ><p class="confirm-copy">
          将第
          <strong>{{ confirmationSession.rounds.length + 1 }}</strong>
          局记为流局。
        </p>
        <p class="muted">
          四人本局金额均为 0 元，计入局数，不计入胡牌次数。
        </p></template
      >
      <template v-else-if="dialog === 'finish'"
        ><p class="confirm-copy">
          本场共记录
          <strong>{{ confirmationSession.rounds.length }}</strong>
          局，最终净输赢：
        </p>
        <div class="history-scores finish-scores">
          <div v-for="player in state.players" :key="player.id">
            <span>{{ player.name }}</span
            ><strong
              :class="{
                positive: activeScores[player.id] > 0,
                negative: activeScores[player.id] < 0,
              }"
              >{{ money(activeScores[player.id], true)
              }}<small>元</small></strong
            >
          </div>
        </div>
        <p class="help-note">
          归档后可在历史中查看，无法继续记分或撤销。新的一场从零计分，总账继续累计。
        </p></template
      >
      <template v-else-if="dialog === 'detail'"
        ><div class="detail-meta">
          <span>{{ fullDate(detail.startedAt) }}</span
          ><span
            >{{ detail.rounds.length }} 局 · 底注
            {{ money(detail.baseCents) }} 元</span
          >
        </div>
        <div class="detail-seats">
          <span v-for="seat in SEATS" :key="seat.key"
            >{{ seat.label }} · {{ namesById[detail.seats[seat.key]] }}</span
          >
        </div>
        <RoundList :session="detail" :players="state.players"
      /></template>
      <p v-if="error" class="form-error dialog-error" role="alert">
        {{ error }}
      </p>
      <template v-if="dialog !== 'detail'" #footer
        ><button class="button secondary" @click="closeDialog">取消</button
        ><button
          v-if="dialog === 'names'"
          type="submit"
          form="player-names"
          class="button primary"
          :disabled="locked || saving"
        >
          保存姓名</button
        ><button
          v-else
          class="button"
          :class="['undo', 'reset'].includes(dialog) ? 'danger' : 'primary'"
          :disabled="(dialog === 'reset' ? stale : locked) || working"
          @click="confirmAction"
        >
          {{
            dialog === "reset"
              ? "确认清空并初始化"
              : dialog === "undo"
                ? "确认撤销"
                : dialog === "finish"
                  ? "结束并归档"
                  : "确认流局"
          }}
        </button></template
      >
    </AppDialog>
  </div>
</template>
