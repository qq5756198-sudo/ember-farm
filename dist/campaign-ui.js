// 当前主线的界面入口。game.js 只从这里取前哨相关的界面；每一轮新加的层在这里串起来。
// 链：outpost (v0.14) → winter (v0.15) → seasons (v0.16) → farlands (v0.17) → daily (v0.18) → thief (v0.19) → garden (v0.20) → gear (v0.22) → feel (v0.23) → undertow (v0.24) → longnight (v0.25) → tidy (v0.26) → bounty (v0.27) → bustle (v0.28) → almanac (v0.29) → kin (v0.30)
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
import { tidyLnHud, patchTidyView, handleTidyAction } from "./tidy-ui.js";
// v0.27：水网、堆肥桶、订单板，这块田卡片上的肥和抢收，告示牌上的水和图鉴，照看机、喷灌头、温室、鸡舍的设施卡
import { renderBountyView, bountyTitle, handleBountyAction, patchBoard, patchOrderLinks } from "./bounty-ui.js";
// v0.28：动静格、电台指令、红薯跑商、设施改良、伤员、舒适度、广场上的食堂和节庆供品、往事一柜、江伯的鱼汛
import { stationExtras as bustleStationExtras, renderBustleView, bustleTitle, handleBustleAction, noiseHud } from "./bustle-ui.js";
// v0.29：顶栏日期带时节、日历上的四个时节、告示牌和选种的当季反季、电台的手气签，腌缸、土酒坛、果树、摆件、鸡舍、药柜的设施卡
import { buildingExtras, almanacDate, renderAlmanacView, patchAlmanacBoard, almanacBuildExtras, handleAlmanacAction } from "./almanac-ui.js";
// v0.30：人物关系页（这会儿在哪、喜好、送礼、心里话、搭伙、收留的孩子）、心里话和说开、广场上节庆的事、鱼类图鉴、许医生验水样
import { renderKinView, kinTitle, handleKinAction } from "./kin-ui.js";
export { buildingExtras };
// v0.25：开始新游戏选出身、二周目、设置里的“带着记忆重新开始”
export { restartTitle, restartText, restartPicker, restartState, ngPlusRow, exportLine } from "./longnight-ui.js";
import {
  renderFarMap,
  buildCardExtras as farBuildCardExtras,
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
// 建设页每一格下面：贺满仓垫付；旧物摆件挑哪一件、果树的枝条去哪剪
export const buildCardExtras = (e, id) => farBuildCardExtras(e, id) + almanacBuildExtras(e, id);
export { hungerDeathNote, itemLinks, settingsExtras, applyAccess, mapKey, keyLabel, keyCaptureActive, cancelKeyCapture, captureKey, helpRows, readPad };
export const stationExtras = (e, b) => {
  const html = seasonsStationExtras(e, b) + gardenStationExtras(e, b) + gearStationExtras(e, b) + bustleStationExtras(e, b);
  return e?.bt ? patchOrderLinks(html) : html;
};
export const campaignTitle = (ui) => kinTitle(ui, (u3) => bustleTitle(u3, (u2) => bountyTitle(u2, (u1) => longNightTitle(u1, (u0) => gearTitle(u0, (u) => gardenTitle(u, winterTitle))))));
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
export const renderCampaignView = (e, ui) => patchTidyView(e, ui, renderKinView(e, ui, (eK, uK) => renderAlmanacView(eK, uK, (e0, u0) => renderBustleView(e0, u0, (e1, u1) => renderBountyView(e1, u1, renderViewBase)))));
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
  if (tab === "farm" && !ui?.tool && !ui?.guided && e.g) return `<div class="outpost-page view-gBoard">${patchAlmanacBoard(e, patchBoard(e, renderGardenBoard(e)))}</div>`;
  const html = renderManualSeasons(e, tab, h, ui, fui);
  if (!(ui?.tool?.menu === "frontier" && ui.tool.tab === "combat" && e.gr)) return html;
  const bench = renderGearBench(e, h);
  return html.endsWith(PAGE_TAIL) ? html.slice(0, -PAGE_TAIL.length) + bench + PAGE_TAIL : `<div class="place-page"><div class="detail-scroll">${html}${bench}</div></div>`;
};
// 顶栏：口粮、袭击横幅（长夜里换成长夜的）、日期（带时节）变红、寒潮标签、警报栏、手记上的“新”点。
export function campaignHud(e) {
  const base = outpostHud(e);
  if (!base) return null;
  const ln = tidyLnHud(e);
  return { ...base, raid: ln?.banner || base.raid, lnRed: !!ln?.red, season: winterHud(e), alerts: patchAlerts(e, alertBar(e)), fresh: !!seasonsHud(e)?.fresh, daily: dailyHud(e), noise: noiseHud(e), date: almanacDate(e) };
}
// 动作：人情 → 四时 → 热闹 → 丰年 → 整顿 → 长夜 → 暗涌 → 手感 → 装备 → 菜地 → 妙手 → 每日 → 远方 → 四季 → 寒潮 → 前哨，谁认得谁处理。
export function handleCampaignAction(action, el, ctx) {
  return handleKinAction(action, el, ctx) || handleAlmanacAction(action, el, ctx) || handleBustleAction(action, el, ctx) || handleBountyAction(action, el, ctx) || handleTidyAction(action, el, ctx) || handleLongNightAction(action, el, ctx) || handleUnderAction(action, el, ctx) || handleFeelAction(action, el, ctx) || handleGearAction(action, el, ctx) || handleGardenAction(action, el, ctx) || handleWinterAction(action, el, ctx) || handleOutpostAction(action, el, ctx);
}

// v0.25：到这里所有层的物品都登记过了，把还没挂上的新小图挂上
assignItemIcons();
