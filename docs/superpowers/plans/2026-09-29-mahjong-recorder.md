# 麻将记分器 Implementation Plan

> **For agentic workers:** Use executing-plans inline, task by task. User has approved development in the current project root. This root is an empty non-Git directory; no worktree or commits apply.

**Goal:** 为固定四人创建可本地保存、多场归档及跨场统计的记分器。

**Architecture:** 独立的纯函数计算与状态转换；存储层负责校验和先保存后更新；Vue 组件展示记分、历史和总账。

**Tech Stack:** Vue 3.5.43、Vite 7.3.6、JavaScript、原生 CSS、Node 内置测试。兼容当前 Node 22.17.1。

**Spec:** `docs/superpowers/specs/2026-09-29-mahjong-design.md`

## Global Constraints

- 固定四位玩家，身份 ID 永久固定；名称可更改，成绩仍跟随身份。
- 点炮所有另外三人各付一个底注，自摸各付两倍底注，默认底注 1 元。无杠和庄奖励。
- 金额以整数分计算，从局记录推导本场和总账。
- 保存成功才更新界面，异常存储不得自动覆盖。
- 不增加后端、同步、历史删除或手牌判断。

## Task 1: 计分、场次与总账

Files: `src/domain/recorder.js`, `tests/recorder.test.js`。
Interfaces: `createState()`, `renamePlayers(state,names)`, `startSession(state,seats,baseCents)`, `recordRound(state,kind,winnerId)`, `undoRound(state)`, `finishSession(state)`, `sessionScores(session)`, `allStats(state)`, `parseBase(value)`。

- [x] 测试先行，手算固定结果：东点炮 `[300,-100,-100,-100]`；西自摸 `[-200,-200,600,-200]`，同时覆盖其余方位。
- [x] 运行 `npm test`，观察测试因尚未实现行为失败。
- [x] 实现状态转换，不原地修改旧数据；从每局推导分数及统计。
- [x] 验证流局、撤销、空场归档、改名、换座、零和、非法底注及异常操作。

## Task 2: 持久化与备份

Files: `src/domain/backup.js`, `src/storage.js`, `tests/storage.test.js`。
Interfaces: `decodeBackup(text)`, `encodeBackup(state)`, `createRepository(storage)` 返回 `load()`, `save(state)`, `replace(state)`, `raw()`。

- [x] 编写备份往返、无效 ID、金额、日期、重复记录、非法结构、坏 JSON 和旧版本测试；运行确认失败。
- [x] 实现白名单规范化校验，导入只接受本项目结构；先保存后返回状态。
- [x] 使用最小内存 Storage 适配器测试实际序列化与多标签页冲突，及 setItem 失败时保留旧记录。
- [x] 测试有效备份替换异常记录，同时确保普通保存不会覆盖异常数据。

## Task 3: 手机界面和操作流

Files: `src/App.vue`, `src/components/*.vue`, `src/composables/useRecorder.js`, `src/style.css`, `src/main.js`, `index.html`, `vite.config.js`, `public/favicon.svg`。

- [x] 连接 domain 与 repository：按钮确认操作调用转换函数，持久化成功后提交 Vue 状态。
- [x] 制作四人牌桌、胡牌方式、金额预览、流局、撤销与本场明细。
- [x] 制作开场、人员设置、历史详情、总账、备份导入摘要与确认弹窗。
- [x] 加入键盘可操作标签、焦点管理、保存失败提示、空页面、手机布局和防重复提交。
- [x] 运行 `npm run build`，修正编译错误。

## Task 4: 交付验证

Files: `README.md`, `docs/verification.md`。

- [x] 在真实浏览器检查开场、胡牌、刷新、撤销、归档、第二场换座和跨场统计。
- [x] 检查手机布局、历史详情、改名和导入导出，不把仅构建当作页面测试。
- [x] 运行 `npm test` 和 `npm run build`，进行代码审查，修正有证据的问题。
- [x] 写明启动命令、稳定地址、本地保存边界、备份方法与实际验证结果。

