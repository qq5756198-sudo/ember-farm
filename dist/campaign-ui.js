// 当前主线的界面入口。game.js 只从这里取前哨相关的界面；每一轮新加的层在这里串起来。
// 链：outpost (v0.14) → winter (v0.15) → seasons (v0.16)
import { outpostHud, hungerDeathNote, handleOutpostAction } from "./outpost-ui.js";
import { winterHud, alertBar, renderAtlasPlus, winterTitle, renderWinterView, handleWinterAction } from "./winter-ui.js";
import {
  renderSeasonsJournal,
  renderManualSeasons,
  stationExtras,
  itemLinks,
  seasonsHud,
  seasonsTitle,
  renderSeasonsView,
  handleSeasonsAction,
} from "./seasons-ui.js";

export { stationExtras, hungerDeathNote, itemLinks };
export const campaignTitle = (ui) => seasonsTitle(ui, winterTitle);
export const renderCampaignView = (e, ui) => renderSeasonsView(e, ui, renderWinterView);
export const renderCampaignJournal = (e, ui) => renderSeasonsJournal(e, ui);
export const renderMapPlus = (e, ui) => renderAtlasPlus(e, ui);
export const renderManualPlus = (e, tab, h, ui, fui) => renderManualSeasons(e, tab, h, ui, fui);
// 顶栏：口粮、袭击横幅、季节标签、警报栏、手记上的“新”点。
export function campaignHud(e) {
  const base = outpostHud(e);
  if (!base) return null;
  return { ...base, season: winterHud(e), alerts: alertBar(e), fresh: !!seasonsHud(e)?.fresh };
}
export function handleCampaignAction(action, el, ctx) {
  return handleSeasonsAction(action, el, ctx) || handleWinterAction(action, el, ctx) || handleOutpostAction(action, el, ctx);
}
