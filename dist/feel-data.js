// v0.23.0「回响」的数：翻滚、命中停顿、挨打动作、尸体血迹、开局那一拨、生涯记录、少打断。
// 声音的数放在 audio-data.js。

// 翻滚：空格 / 手柄 B / 触屏按钮。前 0.25 秒不受伤（抓人、扑人、冲撞都穿过去）。
export const ROLL = {
  dist: 110,
  time: 0.35,
  inv: 0.25,
  cost: 15,
  cd: 0.8,
  noise: 60,
  // 穿得越重滚得越近、越费体力（按三档重量）
  tier: { light: { dist: 1, cost: 0 }, medium: { dist: 0.9, cost: 5 }, heavy: { dist: 0.8, cost: 10 } },
};

// 命中停顿（秒）：你和被打的一起顿住。越重顿得越久，打死的那一下再加一点，有上限。
// 弹弓、弩、枪、投掷、陷阱、流血和火烧打中不顿。
export const HITSTOP = {
  blade: 0.04,
  pole: 0.04,
  blunt: 0.06,
  stomp: 0.06,
  heavy: 0.09,
  kill: 0.03,
  max: 0.12,
  // 0.25 秒内只顿一次，群战时不会一卡一卡
  gap: 0.25,
};
// 顿得最久的两把：大锤、消防斧
export const HEAVY_WEAPONS = ["sledge", "axe"];

// 挨打动作：0.2 秒往后仰；重击（击退 30 以上，和现在能打断出手的一样）0.4 秒踉跄。只是画面，不改数值。
export const REACT = { light: 0.2, heavy: 0.4, heavyKnock: 30 };

// 尸体和血迹：不进存档，换图就清掉
export const REMAINS = {
  fall: 0.4,
  corpseLife: 60,
  corpseFade: 3,
  corpseMax: 40,
  bloodLife: 120,
  bloodMax: 80,
};

// 打中的震屏（“减少闪烁与震屏”开着时不震）
export const SHAKE = { heavy: 3, sledge: 5 };

// 新档开局那一拨：13:00 左右（开局后现实约 3 分钟），从东边林间小路走来 3 只游荡者和 1 只奔跑者。
export const OPENING = {
  at: 780,
  road: { x: 1400, y: 395 },
  exit: { x: 1440, y: 392 },
  pack: [
    ["slow", 1405, 380],
    ["slow", 1430, 420],
    ["runner", 1450, 360],
    ["slow", 1455, 440],
  ],
  // 打不死人：血到 30 以下时，剩下的转身走掉；这一拨打不到 25 以下
  flee: 30,
  floor: 25,
  // 堵路口的围栏放在这附近就算
  fence: { x: 1330, y: 400, r: 260 },
  reward: { ragHood: 1 },
};

// 开局提示：一次只说一件事，做到了就消失
export const COACH = {
  arm: "路那头来了感染者！按 4 拿起木棍",
  hit: "左键打它们：看见它抬手就是要出手了",
  shove: "两只贴上来了：按 {shove} 推开",
  roll: "奔跑者蹲下了，马上要扑：按空格翻滚躲开",
  stomp: "它摔成了爬行者：走过去按 {interact} 踩它",
  fence: "路口没东西挡：按 {build} 选“围栏”，摆在东边路口",
};

// 生涯记录：每趟出门记一行，只留最近 200 趟
export const CAREER = { max: 200, fightGap: 6, chaseRange: 400 };
export const CAREER_RESULTS = { done: "搜完回来", fled: "半路逃回", down: "倒下" };

// 每日抉择“稍后再选”：12:00 前没选，按不花钱的那一项算
export const LATER = { deadline: 720 };

// 声音提示：给听不到声音的玩家，屏幕边上出一行带方向的字
export const CUES = {
  hiss: "奔跑者在嘶叫",
  stomp: "重甲在跺脚",
  inhale: "尖叫者在吸气",
  scream: "尖叫声",
  grabCue: "要抓人的闷吼",
  reach: "爬行者在伸手",
  spot: "有感染者发现了你",
  raiderShot: "灰隼团在开枪",
  // 警报：尸潮、灰隼团各说各的，别的（抢工出事、寒潮、营地求援）只说“警报”
  horde: "尸潮来了",
  raid: "灰隼团来了",
  alarm: "警报声",
};
export const CUE_TIME = 2.2;

// 手记最上面“今天”最多列几件
export const TODAY_MAX = 3;

// 按键：先教这些（其余放在“更多按键”里，照样能用、能改）
export const TEACH_KEYS = ["move", "run", "use", "roll", "interact", "shove", "crouch", "bag", "slots", "mapJournal", "esc"];
