# 余烬农场 v0.21.0「新颜」

单人中文 HTML/Canvas 末日经营游戏。十五张地图，农业供给、生产工程、远征收复、居民生活、防御战斗、调查复兴六种玩法共同推进家园重建。新画面全部是代码画的原创像素画（设置里可切回原画面），统一高难度，浏览器本地保存。

原在线地址（v0.12.0）：https://ember-farm.qq5756198.chatgpt.site 。本仓库没有该站点的部署权限，v0.13.0 至 v0.21.0 都没有覆盖原地址。

## 本轮

按《画面大改造方案》实施。玩家要求一次全部改完，方案原定的三轮（v0.21.0、v0.23.0、v0.24.0）在这一版做完；玩法和数值不变。

- **十五张地图**：都换成新画的像素底图，每个美术像素占地图 2×2；布局、碰撞、出入口、交互点不变，四个废墟区各画一张。
- **人物和感染者**：玩家和所有居民、队员、商人、灰隼团都是新画的像素人物，走路 4 帧，按活计换装；五种感染者各有画法。
- **建筑、物件、作物**：新画；物品图标、动物和鸡窝从原图转成像素。
- **光影和天气**：
  - 一天四段的环境色，夜里窗户、灯、霓虹、火光会亮；
  - 雨会积水洼，暴雨有闪电；
  - 雪原下雪，松林有雾，雨巷总是湿的，地底在室内；
  - 有烟、火星、萤火虫、落叶。
- **界面**：木头锈铁的样子，标题、数字、按钮用像素字（开源字体，许可在 `dist/fonts/`）；原来的绿色换成调色板颜色，状态颜色关系不变。
- **新旧画面开关**：设置 → 画面风格，标题页也能切；只换画面，不动存档。

详见 [docs/releases/v0.21.0.md](docs/releases/v0.21.0.md)。上一轮（种菜第一轮）见 [docs/releases/v0.20.0.md](docs/releases/v0.20.0.md)。

标题页提供继续游戏、开始新游戏、设置、制作人员。版本号显示在标题页角落与设置底部。

## 运行

无需构建。用 HTTP 服务打开（不要用 file:// 双击）：

    python3 -m http.server 8000 --directory dist

然后访问 http://localhost:8000 。

## 验证

- `npm test`：594 项游戏、存档、迁移、故事、前哨、寒潮、四季、远方、每日抉择、妙手、种菜与新画面检查（画面检查要 `@napi-rs/canvas`，没装时自动跳过）。
- `npm run test:ui`：实际 game.js 控制器 + DOM 替身 + 原生 Canvas（需先 `npm install --no-save @napi-rs/canvas@0.1.100`）。不等同浏览器 CSS 验收。
- 本轮另用无头 Chromium 检查了十五张地图的白天、夜里、暴雨（1366、1920 宽与 200% 缩放等效视口）和全部页面；真机与其他浏览器仍待验证。完整清单见 [docs/ITERATION-LEDGER.md](docs/ITERATION-LEDGER.md)。

## 操作

WASD/方向键移动，E 交互（几样东西挨在一起时先选，数字键快选；在田边按 E 依次是收获、拔草、捉虫、开垦、浇水、照看，空田是选种），V 蹲行（蹲着靠近人按 E 下手，小游戏里空格抽、Esc 收手），K 技能页，左键使用工具，Tab 背包，C 制作，B 建造，M 地图，J 任务手记，F 远征途中选下一站，L 消息记录，Z 防线视图，Esc 设置。按键可在设置里改（字母键），也支持手柄。触屏提供摇杆和使用/交互按钮，窄屏右上角“☰ 菜单”打开快捷页。菜单打开及页面关闭时，世界暂停。

## 保存

正式键 `ember-farm-save-v1`，备用键 `ember-farm-backup-v1`，设置键 `ember-farm-preferences-v1`。新游戏和导入分别保留 `ember-farm-before-new-v1`、`ember-farm-before-import-v1` 检查点；旧档第一次升级到 v0.13.0 及以后版本前保留 `ember-farm-before-alliance-v1`；v0.14.0–v0.21.0 没有新增存档键，只在存档里新增 `outpost`、`winter`、`seasons`、`far`、`daily`、`skills`、`theft`、`garden` 字段，偏好键里多存无障碍选项与改过的键位。新旧画面的选择单独存在 `ember-farm-visual-v1`（只有 on / off），不进存档。设置中可导出当前家园或历史与恢复文件，并通过导入选择恢复检查点。旧版独立试玩槽位保持原字节，不会覆盖正式家园。

## 文件

- `dist/`：可直接编辑的 ES modules、样式、页面与像素素材。game.js 通过 `campaign.js`、`campaign-ui.js`、`campaign-renderer.js` 取当前主线的引擎、界面和画面。v0.21.0 新增新画面一组文件：`visual-renderer.js`（接在画面继承链最上层，新旧画面开关 `VIS`/`setVisual`）、`pixel-kit.js`（调色板、像素画布、噪声）、`pixel-build.js`（地面、房子、院子、栅栏等场景积木）、`pixel-things.js`（车、树坑、路灯等物件）、`pixel-farm.js`（农场底图）、`pixel-city.js`（四个废墟区）、`pixel-lands.js`（五个地区和五张边境地图）、`pixel-maps.js`（按地图取底图与天气习惯）、`pixel-sprites.js`（人物、感染者、作物、图标）、`pixel-props.js`（建筑与物件）、`pixel-sheets.js`（把原图集转成像素版，排布不变）、`pixel-light.js`（环境色、灯光、天气、粒子）、`visual.css`（手写换皮）、`visual-auto.css`（由 `scripts/build-visual-css.py` 生成的颜色层，改了别的样式表后要重新生成）、`fonts/`（融合像素体与许可）。v0.18.0 新增 `daily-data.js`（一百个事件、连贯事件、长期加成与增益）、`daily.js`（出卡、结算、延后送达与各处加成的引擎层）、`daily-ui.js`（事件卡、结果页、手记条、抉择记录、顶栏标签）、`daily-renderer.js`（补给点与标记点）、`daily.css`。v0.17.0 新增 `farlands-*` 一组文件（夜里的抉择、险地、麦穗、彭姐、贺满仓、无障碍与键位）。v0.16.0 新增 `seasons-data.js`（节庆、相邻加成、食堂、人物数值）、`seasons.js`（节庆、食堂、夜谈、学徒、借宿、六位人物与选择条的引擎层）、`seasons-ui.js`（广场、日历、人物关系、对话、物品链接、“新”标记）、`seasons-renderer.js`（广场、装饰、客人、壁画与新人物）、`seasons.css`。v0.15.0 新增 `winter-data.js`（法令、寒潮、展柜与人物数值）、`winter-story.js`（第七、八段步骤）、`winter.js`（寒潮、法令、生活水准、电台、档案馆与地区广播的引擎层）、`winter-ui.js`（法令簿、电台、档案馆、成就册、警报栏、地图活化）、`winter-renderer.js`（火炉、暖区、雪景、需求气泡与新人物）、`winter.css`。v0.14.0 新增 `outpost-data.js`（数值、人物与文案）、`outpost-story.js`（第三至第六段步骤）、`outpost.js`（生存消耗、玩法、人物与灰隼团的引擎层）、`outpost-ui.js`（对话、出货箱、商队、审查、总结、战报等菜单）、`outpost-renderer.js`（场景、枪手、气泡、防线视图）、`outpost.css`。v0.13.0 新增 `alliance-data.js`（来信、步骤与文案）、`alliance.js`（故事与援建队员引擎层）、`alliance-ui.js`（任务手记三行卡与故事按钮）、`alliance-renderer.js`（场景表现）、`alliance.css`。
- `tests/`、`scripts/`：自动化测试与控制器检查。
- `docs/`：发行记录、持续完善清单与历史资料；`handoff/`：已批准的改造方案。

## 素材

新画面的地图、人物、感染者、建筑、物件、作物和光影都是代码画的原创像素画；物品图标、动物和鸡窝由原图按调色板转成像素。标题、数字、按钮用的融合像素体是开源字体（SIL OFL 1.1，许可随包附在 `dist/fonts/OFL-fusion-pixel.txt`）。原画面继续使用本项目现有 farm、ruins、sprites、expansion、frontier 像素素材；援建队员与灰隼团枪手由现有人物精灵重新着色并加画头饰；营地、终端、水槽、餐桌、出货箱、篷车、机床、运输骡与人物立绘为程序绘制像素图形。没有引入参考作品的原版素材。
