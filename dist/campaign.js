// 当前主线的引擎入口。game.js 只从这里取引擎；每一轮新加的层只需改这一行指向。
// 链：engine → … → alliance (v0.13) → outpost (v0.14) → winter (v0.15) → seasons (v0.16) → farlands (v0.17) → daily (v0.18) → thief (v0.19) → garden (v0.20) → gear (v0.22) → feel (v0.23) → undertow (v0.24) → longnight (v0.25) → tidy (v0.26)
export { Engine, freshState, newGameState } from "./tidy.js";
// v0.26：v0.25 及更早的存档（没有整顿字段）读进来之前，原样留一份
export { needsUpgrade as needsStoryMigration } from "./tidy.js";
// v0.25：其余物品的小图重画（接在装备小图后面）
import "./item-sprites.js";
