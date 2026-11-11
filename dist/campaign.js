// 当前主线的引擎入口。界面只从这里取引擎。
// v0.50 起最上面是章节这一层（chapter.js）：一条主线分五章，新存档只认带 format 的档，旧档不读。
export { Engine, freshState, newGameState, chapterDefaults } from "./chapter.js";
// 其余物品的小图、十凶的战利品和凶器的小图
import "./item-sprites.js";
import "./titan-icons.js";
// 旧界面的几个文件还引这两个名字；新界面不用。跟着旧界面一起删。
export { newGamePlusState, needsUpgrade as needsStoryMigration } from "./ahead.js";
