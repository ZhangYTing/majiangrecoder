# 结算、单局纠错与日期筛选实施计划

**Goal:** 完成用户批准的三个优化，保留纯前端、四人固定身份和全页面窗口适配。

**Architecture:** 金额继续以整数分保存，金额及结算清单从局记录推导。纠错沿用先保存后更新和跨页面提交保护。日期按浏览器本地的开场日筛选整场，默认全部，历史和总账共用筛选条件。

**Tech Stack:** Vue 3、Vite、Node 内置测试；不新增依赖。

**Spec:** 用户本轮确认上一轮建议的 1、2、3 点。

## 约束

- 不更改 `mahjong-recorder-v1` 的存储键、版本或字段，不自动迁移、清空账本。
- 纠错只改变指定局的 `kind`、`winnerId`，保留 ID、顺序、时间、座位与底注；不加入删除记录功能。
- 结算仅提供付款分配建议，不记录实际已付款状态；归档后纠错提示重新核对已结清金额。
- 历史与总账可选全部、今天、本月、自选日期；自选日期包含起止日，允许单边日期，拒绝无效日期及倒序。
- 继续使用自适应分页和窗口框架，开发端口 5173；浏览器验证使用独立端口，不操作用户实际账本。
- 本轮在当前干净工作目录逐项执行，不自动提交、推送或部署。

## Task 1: 计算与存储行为

- [x] 在 `tests/improvements.test.js` 先写失败测试：一人赢三人输、最少付款笔数、分精度、零输赢、不平衡金额；当前/归档纠错与错误身份、非法结果；日期边界、本月、闰日、跨午夜整场筛选、筛选统计；纠错保存后重读及保存失败。
- [x] 运行 `node --test tests/improvements.test.js`，确认功能缺失导致失败。
- [x] `src/domain/settlement.js` 新增 `settlementTransfers(scores)`，固定四人，遍历付款组合选最少笔数。
- [x] `src/domain/recorder.js` 新增 `correctRound(state, sessionId, roundId, kind, winnerId)`，共享结果校验；`allStats(state, sessions)` 支持指定场次集合。
- [x] `src/domain/date-range.js` 新增 `localDateKey(value)`、`resolveDateRange(selection, now)` 和 `filterSessions(sessions, range)`。
- [x] 运行新测试与全部测试。

## Task 2: 页面接入

- [x] 新增 `SettlementList.vue`，在结束确认和历史详情的结算页签展示分配清单。
- [x] 新增 `RoundCorrection.vue`，提供方式、胡牌者、原结果、修改后的本场金额。`RoundList.vue` 新增每局修改入口，`App.vue` 处理当前场与归档修改和返回明细，取消不写入。
- [x] 新增 `DateFilter.vue`，自选日期提交前校验；历史筛选后保留原场次编号，筛选改变时回第一页；总账仅汇总所选整场。
- [x] `style.css` 添加范围明确的筛选、纠错、结算样式，复用现有绿色按钮及移动端布局。
- [x] 执行 `npm.cmd run build`，检查 Vue 模板与样式编译。

## Task 3: 验证与文档

- [x] 在独立预览地址用 UI 创建记录，检查结束结算、取消/确认当前局纠错、归档纠错、刷新读取、历史与总账日期范围、空结果及无效日期。
- [x] 检查 1366×768、1024×600、390×844、320×780，页面最右侧无整页滚动条，重要操作和数据可访问，保存截图。
- [x] 自行检查差异、金额校验、日期语义、取消路径和旧存储兼容；更新 README 与验证记录。
- [x] 最终运行 `npm.cmd test` 与 `npm.cmd run build`，关闭临时服务与浏览器页面，报告已验证结果和真机限制。
