// v0.32.0「手感」的数据：提示分三档、大事登场、教几次就不再教、按住连做、手机上的说法。
// 依据：《爽点与耐玩体检方案》第 1、5、8、10 条和“做减法”一表（体检时每天 91–124 条提示、金色 37–59 条，金色里大事只占约 5%）。

export const ZEST_SCHEMA = 1;

// 操作说明前几次照常出，之后只留声音和头顶的一个字
export const TEACH_TIMES = 3;

// 按住交互连做：按住 0.32 秒以后，每 0.22 秒在身边找一块要做的田做一下（只找 72 步以内的）
export const HOLD = { after: 0.32, every: 0.22, idle: 0.1, reach: 72 };

// “这一遍田”的账：停手 3.5 秒（或游戏里过了 6 分钟）记一行；只做了一下的不记
export const TALLY = { idleSec: 3.5, idleMin: 6, min: 2 };

// 头顶的飘字：同一处 0.6 秒内再来一条就往上挪一行，最多三行
export const FLOAT = { t: 1.25, rise: 20, rows: 3, gap: 0.6, y: 64, color: "#f3e6c4" };

// 大事：画面上方一张卡片，至少停 2.5 秒（点一下收起），一件一件来
export const MOMENT = { show: 3.4, min: 2.5, queue: 4 };
export const MOMENT_KINDS = {
  level: { label: "升级", color: "#ffd76a" },
  wall: { label: "重光", color: "#ffcf6a" },
  core: { label: "余烬核", color: "#ff9a5c" },
  boss: { label: "头目", color: "#f1a28a" },
  precious: { label: "珍贵", color: "#ffcf6a" },
  fish: { label: "新鱼", color: "#8fd0ff" },
  harvest: { label: "第一份收成", color: "#cfe7a6" },
};

// 送礼：对方头上冒的那一下
export const GIFT_EMOTE = {
  fav: { text: "♥♥", color: "#ff9fb2" },
  like: { text: "♥", color: "#ffc4cf" },
  meh: { text: "…", color: "#d9d2bf" },
  hate: { text: "✗", color: "#f1a28a" },
};

// 教学提示：键 → 认法
export const TEACH = {
  cast: /^鱼线(已抛出|抛进了)/,
  bite: /^咬钩了！/,
  bug: /^清晨菜叶上爬来了/,
  weed: /^夜里地里冒出/,
  mush: /^捡到 野蘑菇/,
  loach: /^是一条雨鳅！/,
};
// 教过了以后，头顶飘什么（没写的就什么都不飘）
export const TAUGHT_FLOAT = { bite: "咬钩了！", mush: "野蘑菇（拿给许医生认）", loach: "雨鳅" };

// 日常小事：只在头顶飘一下，不进提示栏。tally 记进“这一遍田”；drop 是在背后发生的事，连飘字也不要。
// float 里的 $1、$2 换成匹配到的字。
export const ROUTINE = [
  { id: "tend", re: /^照看了(.+?) · 照料分 \d+/, tally: "tend" },
  { id: "plant", re: /^种下(.+?)(?: · |$)/, tally: "plant", float: "种下$1" },
  { id: "harvest", re: /^(.+?)收获 · /, tally: "harvestText" },
  { id: "harvestOld", re: /^(.+?) \+(\d+) · 第一份希望$/, tally: "harvestText" },
  { id: "weed", re: /^拔掉了杂草/, tally: "weed" },
  { id: "bugs", re: /^捉掉了 (\d+) 只菜青虫/, tally: "bugs" },
  { id: "clear", re: /^清理完成 · (.+)$/, tally: "hoe", float: "$1" },
  { id: "refill", re: /^浇水壶已补满/, float: "水壶满了" },
  { id: "eggs", re: /^鸡蛋与羊奶已领取/, float: "鸡蛋、羊奶 +1" },
  { id: "forage", re: /^捡到 (.+?)。$/, float: "捡到 $1" },
  { id: "pet", re: /^(摸了摸鸡群|给山羊梳了梳毛)[^亲]*$/, float: "$1" },
  { id: "feed", re: /^动物已喂食/, float: "喂好了" },
  { id: "arrive", re: /^到达 (.+)$/, float: "$1" },
  { id: "floor", re: /^第 (\d+) 层 · ([^。]+)$/, float: "第 $1 层 · $2" },
  { id: "crucian", re: /^细看是一条鲫鱼/, float: "是鲫鱼" },
  { id: "luckFish", re: /^手气旺：咬钩的是一条(.+?)！$/, float: "手气旺：$1" },
  { id: "jar", re: /^从(腌缸|土酒坛)里取出 (.+?)。?$/, float: "$2" },
  // 放下一座建筑：本来就有粒子和一声响，字只在头顶飘（放一排围栏不再刷一排金色）
  { id: "built", re: /^(.+) 已建成$/, float: "$1 建好了" },
  // 在重建站交一格：那一页上数字变了、盖了章、那一格闪了，提示栏里不再一格一行（page: drop 是页面开着时连字也不要）
  { id: "slot", re: /^交了(.+?)（「.+?」(\d+\/\d+)）。$/, float: "交了$1（$2）", page: "drop" },
  { id: "safe", re: /^已收复区域 · /, drop: true },
  { id: "wake", re: /^第 \d+ 天 · .+ · 恢复体力/, drop: true },
  { id: "lathe", re: /^机床今天做了/, drop: true },
  { id: "supper", re: /^晚饭开饭：/, drop: true },
];

// 照常进提示栏、但不用金色的（金色只留给稀有、交满一份清单、送到心坎上的礼、防守打赢这些中事）
export const PLAIN = [
  /^送给.+信任没变/,
  /^许医生挑出/,
  /在营门口(敲门|等着)/,
  /^大家(聊起|说起|说了说)/,
  /^收获展 · /,
  /^今天这里有动静/,
  /^这一波打完了/,
  /^实际搜集：/,
  /已收复 · 威胁/,
  /^明天是「/,
];

// 同一句话（数字不算）在这么多秒里又来一遍：只在头顶飘一下，不再占提示栏（金色的照常）
export const REPEAT = { sec: 45, keep: 24 };

// 头目、等级、墙的名字（大事卡片的标题用）
export const SKILL_NAMES = ["农业", "制造", "探索", "战斗", "妙手"];

// 手机上把键盘的说法换成按钮上的字（只换玩家看得见的文字）
export const TOUCH_WORDS = [
  [/按住\s?E（手机按住「交互」）/g, "按住「交互」"],
  [/（手机按住「交互」）/g, ""],
  [/（空格，触屏上是“翻滚”按钮）/g, "（「翻滚」按钮）"],
  [/按\s?[A-Z]\s?推开/g, "点「推开」"],
  [/连按\s?E\b\s?/g, "连点「交互」"],
  [/按住\s?E\b\s?/g, "按住「交互」"],
  [/按\s?E\b\s?/g, "点「交互」"],
  [/打开任务手记（J）/g, "点左下「任务手记」"],
  [/任务手记（J）/g, "任务手记"],
  [/（J）/g, ""],
  [/按空格/g, "点「翻滚」"],
  [/按\s?V\b\s?/g, "点「蹲行」"],
  [/（V）/g, ""],
  [/按交互键（E）/g, "点「交互」"],
  [/（[A-Z]）/g, ""],
  [/按\s?H\s?拍照/g, "在右上角「☰ 菜单」里点「拍照」"],
  [/（按\s?T\s?用枪打装甲照旧）/g, "（用枪打装甲照旧）"],
  [/按\s?B\b\s?/g, "点「建造」"],
  [/按\s?C\b\s?/g, "点「制作」"],
  [/按\s?M\b\s?/g, "打开地图"],
];

// 老存档第一次读进来：说一声这一版的变化
export const INTRO_LINES = [
  "日常的小事（收菜、照看、捡东西）只在头顶飘一下，一遍田做完记一行；",
  "交满一面墙、余烬核、升级、头目、珍贵、第一次钓到的鱼，画面上方停一张卡片；",
  "按住交互（E）沿着田走，收、拔、捉、浇、照看、种上次的种子一路做下去。",
];
