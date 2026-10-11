// 当前主线的界面入口。game.js 只从这里取前哨相关的界面；每一轮新加的层在这里串起来。
// 链：outpost (v0.14) → winter (v0.15) → seasons (v0.16) → farlands (v0.17) → daily (v0.18) → thief (v0.19) → garden (v0.20) → gear (v0.22)
import { outpostHud, hungerDeathNote } from "./outpost-ui.js";
import { winterHud, alertBar, winterTitle, renderWinterView, handleWinterAction } from "./winter-ui.js";
import { handleOutpostAction } from "./outpost-ui.js";
import { renderManualSeasons, stationExtras as seasonsStationExtras, itemLinks, seasonsHud } from "./seasons-ui.js";
import { dailyHud, dailyLocked } from "./daily-ui.js";
import { renderSkillPage, menuLock, menuKey, thiefFrame } from "./thief-ui.js";
import { renderGardenJournal, gardenTitle, renderGardenView, handleGardenAction, renderGardenBoard, placeTitle, gardenStationExtras } from "./garden-ui.js";
import { gearTitle, renderGearView, handleGearAction, gearStationExtras, gearStatusHtml, renderGearPanel, gearUI, renderGearBench, gearDetailHtml } from "./gear-ui.js";
import { paintDoll, paintGearIcon } from "./gear-sprites.js";
import { slotOf } from "./gear-data.js";
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

export { dailyLocked, renderSkillPage, menuLock, menuKey, thiefFrame, placeTitle };
// v0.22：行囊里的装备栏、场景里的状态小条、物品格子里的装备小图
export { renderGearPanel, gearUI, gearStatusHtml, paintDoll, paintGearIcon, slotOf, gearDetailHtml };
export { hungerDeathNote, itemLinks, buildCardExtras, settingsExtras, applyAccess, mapKey, keyLabel, keyCaptureActive, cancelKeyCapture, captureKey, helpRows, readPad };
export const stationExtras = (e, b) => seasonsStationExtras(e, b) + gardenStationExtras(e, b) + gearStationExtras(e, b);
export const campaignTitle = (ui) => gearTitle(ui, (u) => gardenTitle(u, winterTitle));
export const renderCampaignView = (e, ui) => renderGearView(e, ui, (e2, u2) => renderGardenView(e2, u2, renderWinterView));
export const renderCampaignJournal = (e, ui) => renderGardenJournal(e, ui);
export const renderMapPlus = (e, ui) => renderFarMap(e, ui);
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
// 顶栏：口粮、袭击横幅、季节标签、警报栏、手记上的“新”点。
export function campaignHud(e) {
  const base = outpostHud(e);
  if (!base) return null;
  return { ...base, season: winterHud(e), alerts: alertBar(e), fresh: !!seasonsHud(e)?.fresh, daily: dailyHud(e) };
}
// 动作：装备 → 菜地 → 妙手 → 每日 → 远方 → 四季 → 寒潮 → 前哨，谁认得谁处理。
export function handleCampaignAction(action, el, ctx) {
  return handleGearAction(action, el, ctx) || handleGardenAction(action, el, ctx) || handleWinterAction(action, el, ctx) || handleOutpostAction(action, el, ctx);
}
