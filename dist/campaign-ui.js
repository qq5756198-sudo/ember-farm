// 当前主线的界面入口。game.js 只从这里取前哨相关的界面；每一轮新加的层在这里串起来。
// 链：outpost (v0.14) → winter (v0.15) → seasons (v0.16) → farlands (v0.17) → daily (v0.18) → thief (v0.19)
import { outpostHud, hungerDeathNote } from "./outpost-ui.js";
import { winterHud, alertBar, winterTitle, renderWinterView, handleWinterAction } from "./winter-ui.js";
import { handleOutpostAction } from "./outpost-ui.js";
import { renderManualSeasons, stationExtras, itemLinks, seasonsHud } from "./seasons-ui.js";
import { dailyHud, dailyLocked } from "./daily-ui.js";
import { renderThiefJournal, thiefTitle, renderThiefView, handleThiefAction, renderSkillPage, menuLock, menuKey, thiefFrame } from "./thief-ui.js";
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

export { dailyLocked, renderSkillPage, menuLock, menuKey, thiefFrame };
export { stationExtras, hungerDeathNote, itemLinks, buildCardExtras, settingsExtras, applyAccess, mapKey, keyLabel, keyCaptureActive, cancelKeyCapture, captureKey, helpRows, readPad };
export const campaignTitle = (ui) => thiefTitle(ui, winterTitle);
export const renderCampaignView = (e, ui) => renderThiefView(e, ui, renderWinterView);
export const renderCampaignJournal = (e, ui) => renderThiefJournal(e, ui);
export const renderMapPlus = (e, ui) => renderFarMap(e, ui);
export const renderManualPlus = (e, tab, h, ui, fui) => renderManualSeasons(e, tab, h, ui, fui);
// 顶栏：口粮、袭击横幅、季节标签、警报栏、手记上的“新”点。
export function campaignHud(e) {
  const base = outpostHud(e);
  if (!base) return null;
  return { ...base, season: winterHud(e), alerts: alertBar(e), fresh: !!seasonsHud(e)?.fresh, daily: dailyHud(e) };
}
// 动作：妙手 → 每日 → 远方 → 四季 → 寒潮 → 前哨，谁认得谁处理。
export function handleCampaignAction(action, el, ctx) {
  return handleThiefAction(action, el, ctx) || handleWinterAction(action, el, ctx) || handleOutpostAction(action, el, ctx);
}
