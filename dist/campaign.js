// 当前主线的引擎入口。game.js 只从这里取引擎；每一轮新加的层只需改这一行指向。
// 链：engine → … → alliance (v0.13) → outpost (v0.14) → winter (v0.15) → seasons (v0.16) → farlands (v0.17) → daily (v0.18) → thief (v0.19) → garden (v0.20)
export { Engine, freshState } from "./garden.js";
export { needsStoryMigration } from "./alliance.js";
