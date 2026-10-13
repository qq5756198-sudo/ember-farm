// 当前主线的界面入口。game.js 只从这里取前哨相关的界面；每一轮新加的层在这里串起来。
// 链：outpost (v0.14) → winter (v0.15) → seasons (v0.16) → farlands (v0.17) → daily (v0.18) → thief (v0.19) → garden (v0.20) → gear (v0.22) → feel (v0.23) → undertow (v0.24) → longnight (v0.25) → tidy (v0.26)
// v0.25：其余物品的小图重画（接在装备小图后面）；各层的物品都登记好以后再挂一次
import { assignItemIcons } from "./item-sprites.js";
import { outpostHud, hungerDeathNote } from "./outpost-ui.js";
import { winterHud, alertBar, winterTitle, renderWinterView, handleWinterAction } from "./winter-ui.js";
import { handleOutpostAction } from "./outpost-ui.js";
import { renderManualSeasons, stationExtras as seasonsStationExtras, itemLinks, seasonsHud } from "./seasons-ui.js";
import { dailyHud, dailyLocked } from "./daily-ui.js";
import { renderSkillPage, menuLock as thiefMenuLock, menuKey, thiefFrame } from "./thief-ui.js";
import { renderGardenJournal, gardenTitle, renderGardenView, handleGardenAction, renderGardenBoard, placeTitle, gardenStationExtras } from "./garden-ui.js";
import { gearTitle, renderGearView, handleGearAction, gearStationExtras, gearStatusHtml, renderGearPanel as gearPanel, gearUI, renderGearBench, gearDetailHtml } from "./gear-ui.js";
import { paintDoll, paintGearIcon } from "./gear-sprites.js";
import { slotOf } from "./gear-data.js";
import { soundRows, helpHtml, patchPadHelp, radialItems, radialHtml, radialPick, coachHtml, CueQueue, patchDailyCard, patchJournal, patchCollection, patchPhone, careerHtml, todayHtml, handleFeelAction } from "./feel-ui.js";
import { bossBarHtml, patchUnderMap, patchUnderJournal, patchMuseum, patchUnderCollection, handleUnderAction } from "./undertow-ui.js";
import { patchAlerts, patchLnJournal, longNightTitle, renderLongNightView, patchLnMuseum, patchLnCollection, patchLnCalendar, handleLongNightAction, originLine, patchLegacyBook, patchSummaryExport } from "./longnight-ui.js";
// v0.26：设施卡、心情三档、挂牌、机床加急、警钟、整顿清单、队员卡带徒
import { buildingExtras, tidyLnHud, patchTidyView, handleTidyAction } from "./tidy-ui.js";
export { buildingExtras };
// v0.25：开始新游戏选出身、二周目、设置里的“带着记忆重新开始”
export { restartTitle, restartText, restartPicker, restartState, ngPlusRow, exportLine } from "./longnight-ui.js";
import {
  renderFarMap,
  buildCardExtras,
  settingsExtras,
  applyAccess,
  mapKey,
  keyLabel,
  keyCaptureActive,
  cancelKeyCapture,
  captureKey,
  helpRows,
  readPad,
} from "./farlands-ui.js";

export { dailyLocked, renderSkillPage, menuKey, thiefFrame, placeTitle };
// v0.23：设置里的四个音量、按键说明、轮盘、开局提示条、声音提示、生涯记录
export { soundRows, helpHtml, patchPadHelp, radialItems, radialHtml, radialPick, coachHtml, CueQueue, careerHtml, todayHtml };
// v0.24：屏幕上方的头目血条
export { bossBarHtml };
// 放着的每日抉择卡从手记里打开时可以关上
export function menuLock(e, ui) {
  if (ui?.view === "daily" && e.dailyDeferred?.()) return "";
  return thiefMenuLock(e, ui);
}
// v0.22：行囊里的装备栏、场景里的状态小条、物品格子里的装备小图
export { gearUI, gearStatusHtml, paintDoll, paintGearIcon, slotOf, gearDetailHtml };
// 行囊里的装备栏上面写一句出身
export const renderGearPanel = (e, helpers) => {
  const html = gearPanel(e, helpers);
  return html ? originLine(e) + html : html;
};
export { hungerDeathNote, itemLinks, buildCardExtras, settingsExtras, applyAccess, mapKey, keyLabel, keyCaptureActive, cancelKeyCapture, captureKey, helpRows, readPad };
export const stationExtras = (e, b) => seasonsStationExtras(e, b) + gardenStationExtras(e, b) + gearStationExtras(e, b);
export const campaignTitle = (ui) => longNightTitle(ui, (u0) => gearTitle(u0, (u) => gardenTitle(u, winterTitle)));
const renderViewBase = (e, ui) => {
  const html = renderLongNightView(e, ui, (e1, u1) => renderGearView(e1, u1, (e2, u2) => renderGardenView(e2, u2, renderWinterView)));
  if (ui?.view === "daily") return patchDailyCard(e, html);
  if (ui?.view === "collection") return patchLegacyBook(e, patchLnCollection(e, patchUnderCollection(e, patchCollection(e, html))));
  if (ui?.view === "museum") return patchLnMuseum(e, patchMuseum(e, html));
  if (ui?.view === "calendar") return patchLnCalendar(e, html);
  if (ui?.view === "summary") return patchSummaryExport(e, html);
  if (ui?.view === "phone") return patchPhone(html);
  return html;
};
export const renderCampaignView = (e, ui) => patchTidyView(e, ui, renderViewBase(e, ui));
export const renderCampaignJournal = (e, ui) => {
  const html = renderGardenJournal(e, ui);
  return ui?.catalog ? html : patchLnJournal(e, patchUnderJournal(e, patchJournal(e, html)));
};
export const renderMapPlus = (e, ui) => patchUnderMap(e, ui, renderFarMap(e, ui));
// 去掉营地手册后，“农业”这一页就是菜地告示牌；其余每页只放那一处的内容
// v0.22：武器台的“武器与潜行”这一页下面接着修理与改装
// 放进同一个滚动区里（.frontier-body 的最后），整页一起上下滚
const PAGE_TAIL = "</div></div></div></div>";
export const renderManualPlus = (e, tab, h, ui, fui) => {
  if (tab === "farm" && !ui?.tool && !ui?.guided && e.g) return `<div class="outpost-page view-gBoard">${renderGardenBoard(e)}</div>`;
  const html = renderManualSeasons(e, tab, h, ui, fui);
  if (!(ui?.tool?.menu === "frontier" && ui.tool.tab === "combat" && e.gr)) return html;
  const bench = renderGearBench(e, h);
  return html.endsWith(PAGE_TAIL) ? html.slice(0, -PAGE_TAIL.length) + bench + PAGE_TAIL : `<div class="place-page"><div class="detail-scroll">${html}${bench}</div></div>`;
};
// 顶栏：口粮、袭击横幅（长夜里换成长夜的）、日期变红、季节标签、警报栏、手记上的“新”点。
export function campaignHud(e) {
  const base = outpostHud(e);
  if (!base) return null;
  const ln = tidyLnHud(e);
  return { ...base, raid: ln?.banner || base.raid, lnRed: !!ln?.red, season: winterHud(e), alerts: patchAlerts(e, alertBar(e)), fresh: !!seasonsHud(e)?.fresh, daily: dailyHud(e) };
}
// 动作：整顿 → 长夜 → 暗涌 → 手感 → 装备 → 菜地 → 妙手 → 每日 → 远方 → 四季 → 寒潮 → 前哨，谁认得谁处理。
export function handleCampaignAction(action, el, ctx) {
  return handleTidyAction(action, el, ctx) || handleLongNightAction(action, el, ctx) || handleUnderAction(action, el, ctx) || handleFeelAction(action, el, ctx) || handleGearAction(action, el, ctx) || handleGardenAction(action, el, ctx) || handleWinterAction(action, el, ctx) || handleOutpostAction(action, el, ctx);
}

// v0.25：到这里所有层的物品都登记过了，把还没挂上的新小图挂上
assignItemIcons();
