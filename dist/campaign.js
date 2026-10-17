// 当前主线的引擎入口。game.js 只从这里取引擎；每一轮新加的层只需改这一行指向。
// 链：engine → … → alliance (v0.13) → outpost (v0.14) → winter (v0.15) → seasons (v0.16) → farlands (v0.17) → daily (v0.18) → thief (v0.19) → garden (v0.20) → gear (v0.22) → feel (v0.23) → undertow (v0.24) → longnight (v0.25) → tidy (v0.26) → bounty (v0.27) → bustle (v0.28) → almanac (v0.29) → kin (v0.30) → relight (v0.31) → zest (v0.32)
export { Engine, freshState, newGameState } from "./zest.js";
// v0.32：v0.31 及更早的存档（没有整顿、菜地、热闹、四时、人情、重光或手感的记录）读进来之前，原样留一份
export { needsUpgrade as needsStoryMigration } from "./zest.js";
// 设置里“开始新游戏”“带着记忆重新开始”也从最上面这一层开局（不然新开的档会把各版的“旧档提示”说一遍）
export { newGamePlusState } from "./zest.js";
// v0.25：其余物品的小图重画（接在装备小图后面）
import "./item-sprites.js";
