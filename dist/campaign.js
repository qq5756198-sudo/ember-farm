// 当前主线的引擎入口。game.js 只从这里取引擎；每一轮新加的层只需改这一行指向。
// 链：engine → … → alliance (v0.13) → outpost (v0.14) → winter (v0.15)
export { Engine, freshState } from "./winter.js";
export { needsStoryMigration } from "./alliance.js";
