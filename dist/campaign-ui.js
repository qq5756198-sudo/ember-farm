// 当前主线的界面入口。game.js 只从这里取前哨相关的界面；每一轮新加的层在这里串起来。
import { stationExtras, outpostHud, hungerDeathNote, handleOutpostAction } from "./outpost-ui.js";
import {
  winterHud,
  alertBar,
  renderWinterJournal,
  renderAtlasPlus,
  renderRebuildPlus,
  winterTitle,
  renderWinterView,
  handleWinterAction,
} from "./winter-ui.js";

export { stationExtras, hungerDeathNote };
export const campaignTitle = (ui) => winterTitle(ui);
export const renderCampaignView = (e, ui) => renderWinterView(e, ui);
export const renderCampaignJournal = (e, ui) => renderWinterJournal(e, ui);
export const renderMapPlus = (e, ui) => renderAtlasPlus(e, ui);
export const renderManualPlus = (e, tab, h, ui, fui) => renderRebuildPlus(e, tab, h, ui, fui);
// 顶栏：口粮、袭击横幅、季节标签、警报栏。
export function campaignHud(e) {
  const base = outpostHud(e);
  if (!base) return null;
  return { ...base, season: winterHud(e), alerts: alertBar(e) };
}
export function handleCampaignAction(action, el, ctx) {
  return handleWinterAction(action, el, ctx) || handleOutpostAction(action, el, ctx);
}
