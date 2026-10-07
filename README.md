# 余烬农场 v0.14.0「商路与火光」

单人中文 HTML/Canvas 末日经营游戏。十五张地图，农业供给、生产工程、远征收复、居民生活、防御战斗、调查复兴六种玩法共同推进家园重建。沿用像素素材和统一高难度，浏览器本地保存。

原在线地址（v0.12.0）：https://ember-farm.qq5756198.chatgpt.site 。本仓库没有该站点的部署权限，v0.13.0 与 v0.14.0 都没有覆盖原地址。

## 本轮

按《联盟前哨》方案实施第三至第六段（药柜空了、机器重新转动、第一支满载的车队、这条路不再交买路钱），并加入扩展方案的 v0.14 内容：出货箱、抢工与事故、援建清单、流动商队与真假货、入营审查、特质；唐九、胡二、红薯、蔡眼镜、鹞子、尤可；像素立绘对话、日终总结、产出气泡、消息记录、后果预览、防线覆盖图与战报。第一种会开枪的敌人“灰隼团枪手”会瞄准、找掩体、撤退。

自身消耗提高：玩家饥饿约为最初的 2.8 倍，饿到底会饿晕；营地每人每天两餐，顶栏显示口粮还能撑几天。详见 [docs/releases/v0.14.0.md](docs/releases/v0.14.0.md)。

标题页提供继续游戏、开始新游戏、设置、制作人员。版本号显示在标题页角落与设置底部。

## 运行

无需构建。用 HTTP 服务打开（不要用 file:// 双击）：

    python3 -m http.server 8000 --directory dist

然后访问 http://localhost:8000 。

## 验证

- `npm test`：409 项游戏、存档、迁移、故事与前哨检查。
- `npm run test:ui`：实际 game.js 控制器 + DOM 替身 + 原生 Canvas（需先 `npm install --no-save @napi-rs/canvas@0.1.100`）。不等同浏览器 CSS 验收。
- 本轮另用无头 Chromium 检查了桌面、触摸模拟与 200% 缩放等效视口；真机与其他浏览器仍待验证。完整清单见 [docs/ITERATION-LEDGER.md](docs/ITERATION-LEDGER.md)。

## 操作

WASD/方向键移动，E 交互，左键使用工具，Tab 背包，C 制作，B 建造，M 地图，J/N/F 任务手记，L 消息记录，Z 防线视图，Esc 设置。触屏提供摇杆和使用/交互按钮。菜单打开及页面关闭时，世界暂停。

## 保存

正式键 `ember-farm-save-v1`，备用键 `ember-farm-backup-v1`，设置键 `ember-farm-preferences-v1`。新游戏和导入分别保留 `ember-farm-before-new-v1`、`ember-farm-before-import-v1` 检查点；旧档第一次升级到 v0.13.0 及以后版本前保留 `ember-farm-before-alliance-v1`；v0.14.0 没有新增存档键，只在存档里新增 `outpost` 字段。设置中可导出当前家园或历史与恢复文件，并通过导入选择恢复检查点。旧版独立试玩槽位保持原字节，不会覆盖正式家园。

## 文件

- `dist/`：可直接编辑的 ES modules、样式、页面与像素素材。v0.14.0 新增 `outpost-data.js`（数值、人物与文案）、`outpost-story.js`（第三至第六段步骤）、`outpost.js`（生存消耗、玩法、人物与灰隼团的引擎层）、`outpost-ui.js`（对话、出货箱、商队、审查、总结、战报等菜单）、`outpost-renderer.js`（场景、枪手、气泡、防线视图）、`outpost.css`。v0.13.0 新增 `alliance-data.js`（来信、步骤与文案）、`alliance.js`（故事与援建队员引擎层）、`alliance-ui.js`（任务手记三行卡与故事按钮）、`alliance-renderer.js`（场景表现）、`alliance.css`。
- `tests/`、`scripts/`：自动化测试与控制器检查。
- `docs/`：发行记录、持续完善清单与历史资料；`handoff/`：已批准的改造方案。

## 素材

继续使用本项目现有 farm、ruins、sprites、expansion、frontier 像素素材；援建队员与灰隼团枪手由现有人物精灵重新着色并加画头饰；营地、终端、水槽、餐桌、出货箱、篷车、机床、运输骡与人物立绘为程序绘制像素图形。没有引入参考作品的原版素材。
