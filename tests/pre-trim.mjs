// v0.42「删繁」以前的引擎（v0.41 看得清那一层，dist/clear.js）。
// 删繁去掉的那些玩法（水网、照料分、杂草和虫、偷东西、动静、电台指令、设施改良、伤员、舒适度、每个人的心情、挂牌、夜里的抉择、贺满仓垫付……）
// 代码还在下面几层里，旧档转换前也靠它们读档；这几层自己的测试接着用这个引擎按原来的规矩测，删繁那一层的规矩在 trim.test.mjs 里测。
// 注意：同一个测试文件里先开了删繁的引擎（会改掉一些数和字），再用这个引擎就不准了——这几层的测试文件只用这一个。
export { Engine } from "../dist/clear.js";
export { freshState, newGameState, newGamePlusState, needsUpgrade as needsStoryMigration } from "../dist/simple.js";
import "../dist/item-sprites.js";
import "../dist/titan-icons.js";
