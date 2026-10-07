// 联盟前哨 · 第一轮故事数据：书信、援建队员与前两段任务。
// 文案与判定分开；判定只读取引擎里的真实状态。
import { ITEMS, CROPS } from "./data.js";
import { TASKS } from "./rebuild-data.js";
import { firstHarvestStep } from "./player-journey.js";

export const STORY_SCHEMA = 1;
export const WELL_SPOT = { x: 880, y: 300 };
export const TERMINAL_SPOT = { x: 754, y: 344 };
export const WELL_COST = { stone: 3, scrap: 2 };
export const CAMP_COST = { wood: 4, stone: 2 };
export const TROUGH_PLOTS = 9;
export const ACT2_REWARD = { money: 40, reputation: 5 };
export const NEIGHBOR_SPOT = { region: "residential", x: 900, y: 640 };
export const NEIGHBOR_COST = { bread: 1 };
export const NEIGHBOR_GIFT = { wood: 3, seedRadish: 2 };
export const STORY_IDS = ["act1", "supply", "act2"];
export const HELPER_TASKS = ["rest", "meal", "carry", "idle", "hungry"];

export const HELPERS = {
  tieqiao: {
    name: "铁锹",
    role: "carry",
    roleName: "搬运",
    arrive: "报到！援建队铁锹。搬东西我在行，做饭就算了。",
    lines: [
      "仓库我按“吃的、用的、修房子的”分了三堆，找起来快。",
      "杂物别扔，木头能烧，铁皮能敲平，石头垫路。",
      "我以前觉得种地最轻松，直到我自己挑了一天水。",
      "饭点到了记得叫我，我能闻着香味找过去。",
    ],
    hungry: "肚子在打鼓……仓库要是有一份干粮就好了。",
  },
};

export const SUPPLY = {
  ration: {
    name: "口粮种包",
    items: { seedRadish: 6, seedPotato: 4 },
    plan: "radish",
    pick: "先稳定口粮",
    desc: "萝卜和土豆长得快。公共餐桌要 9 个萝卜，干粮也靠它。",
  },
  cotton: {
    name: "棉花种包",
    items: { seedCotton: 6, cloth: 2 },
    plan: "cotton",
    pick: "留地种棉花",
    desc: "2 块布料马上能铺一张床；棉花长成后纺布，医疗补给要用。",
  },
};

export const LETTERS = {
  act1: {
    from: "楚光",
    title: "先让这片地长出口粮",
    veteranTitle: "联络站接通了旧终端",
    text: "听说你守着一片还能种东西的地。边境缺的不是勇气，是粮食。先让它长出两株作物，再做一份能带上路的干粮；顺手把水井和落脚的营地收拾好。做到这些，回我一封信。",
    veteran:
      "联络站接通了你的旧终端。你的收成记录我看过了，这里确实能产粮。派人之前，我想确认两件事：水井能不能用，援建队有没有落脚的地方。准备好了，回我一封信。",
  },
  act2: {
    from: "楚光",
    title: "今天吃饭的人",
    text: "收成我看到了。援建队的铁锹已经到营地，搬运交给他。住宅区有人用旧电台求援：农艺员阿禾守着一箱种子档案。把她接回来，给她一张床和一顿热饭，让饭桌上多几个人。",
  },
  act3: {
    from: "楚光",
    title: "医院的信号",
    text: "饭桌有人了，前哨才算真的开张。医院方向的信号又响了，许医生和伤员困在里面，缺棉花、缺药草。准备好就出发。",
    cotton: "你先留的那块棉花地，这回正好派上用场。",
  },
};
export const LETTER_IDS = Object.keys(LETTERS);

// “发生了什么”：每个主线节点的处境，一句话说明为什么现在要做。
export const TASK_CONTEXT = {
  harvest: "联盟要先看到这片地能长出口粮。荒地里还埋着杂物，种子在你的背包里。",
  meal: "光有收成还不够，出门的人需要能带上路的干粮。篝火灶还能用。",
  farmer: "住宅区的旧电台反复求援：农艺员阿禾守着一箱种子档案，已经撑不了几天。",
  table: "人回来了，就得有吃饭和睡觉的地方。公共餐桌还没修好，床也不够。",
  signal: "医院的信号又响了。许医生和几名伤员困在里面，药柜早就空了。",
  medical: "许医生列了一张清单：绷带和药草，越快越好。",
  hospital: "医院入口还被感染巢堵着。清掉它，前哨才能接收伤员。",
  hospitalDefense: "医疗通道一开，动静也传了出去。感染者正在往通道聚集。",
  water: "粮田越扩越大，靠水桶已经浇不过来。水塔和住宅前哨要一起修。",
  power: "仓库里传来敲击声：机械师陈工被困在设备区，动力组件也在那里。",
  warehouse: "材料越来越多，路却断在旧桥。仓库的物流前哨需要重新运转。",
  network: "三个前哨各管各的，粮和药总在路上耽搁。是时候让它们互相供给了。",
  filter: "新田里的作物又出现病斑。污染从哪里来？三地日志里有答案。",
  annex: "线索指向仓库东南角被封住的检修间，里面有通信核心和事故记录。",
  radio: "通信核心到手了。让沉默的电台再响一次，告诉别的营地这里还有人。",
  broadcast: "广播一开，所有人都会听见，包括不该听见的东西。守住这盏灯。",
};

// 营地候选空地：避开农舍、田地、公共工程预留地和出口；旧档按实际建筑自动挑选。
export const CAMP_CANDIDATES = [
  { x: 560, y: 735 },
  { x: 440, y: 745 },
  { x: 690, y: 770 },
  { x: 250, y: 440 },
  { x: 250, y: 600 },
  { x: 1180, y: 455 },
  { x: 330, y: 840 },
  { x: 820, y: 900 },
];
export const TABLE_SEATS = [
  { x: 806, y: 384 },
  { x: 836, y: 388 },
  { x: 866, y: 384 },
  { x: 896, y: 362 },
];

const itemName = (id) => ITEMS[id]?.name || id;
export const bundleText = (b) =>
  Object.entries(b || {})
    .map(([id, n]) => itemName(id) + "×" + n)
    .join("、");
export function costLine(e, cost) {
  return Object.entries(cost)
    .map(([id, n]) => itemName(id) + " " + Math.min(n, e.quantityForCost(id, true)) + "/" + n)
    .join("、");
}
export function missingCost(e, cost) {
  return Object.entries(cost)
    .filter(([id, n]) => e.quantityForCost(id, true) < n)
    .map(([id, n]) => itemName(id) + "还差" + (n - e.quantityForCost(id, true)));
}
export function taskGain(q) {
  const parts = [bundleText(q.reward)];
  if (q.money) parts.push(q.money + "金币");
  return q.outcome + "回报：" + parts.filter(Boolean).join("、") + "。";
}
export const letterTitle = (sc, id) =>
  id === "act1" && sc.veteran ? LETTERS.act1.veteranTitle : LETTERS[id]?.title || "";
export const letterText = (sc, id) => {
  const l = LETTERS[id];
  if (!l) return "";
  if (id === "act1" && sc.veteran) return l.veteran;
  if (id === "act3" && sc.choice === "cotton") return l.text + l.cotton;
  return l.text;
};

const plotReady = (p) => p.crop && CROPS[p.crop] && p.growth >= CROPS[p.crop].grow;
export function cropsGrowing(e) {
  if (e.r.claimed.includes("harvest") || e.s.stats.harvested >= 2) return false;
  const plots = e.s.plots;
  return (
    !plots.some(plotReady) &&
    !plots.some((p) => p.crop && !e.plotWatered(p)) &&
    plots.some((p) => p.crop)
  );
}
const foodJob = (e) =>
  e.c.production.find((j) => Object.keys(j.out || {}).some((id) => ["bread", "stew"].includes(id)));
export function mealWaiting(e) {
  const j = foodJob(e);
  return !!j && !j.ready && !e.r.claimed.includes("meal");
}

export function actSteps(e) {
  const sc = e.sc,
    r = e.r;
  if (sc.act === 1)
    return [
      { id: "harvest", label: "收成", done: r.claimed.includes("harvest") },
      { id: "meal", label: "干粮", done: r.claimed.includes("meal") },
      { id: "well", label: "水井", done: !!sc.flags.well },
      { id: "camp", label: "营地", done: !!sc.flags.camp },
      { id: "reply", label: "回信", done: sc.claimed.includes("act1") },
    ];
  if (sc.act === 2)
    return [
      { id: "choice", label: "援建物资", done: !!sc.choice },
      { id: "farmer", label: "接回阿禾", done: r.claimed.includes("farmer") },
      { id: "farmerMeal", label: "工作餐", done: !!sc.flags.farmerFed },
      { id: "table", label: "公共餐桌", done: r.claimed.includes("table") },
    ];
  return [];
}

function pickStep(e, steps) {
  const pending = steps.filter((s) => !s.done);
  if (!pending.length) return null;
  let step = pending[0];
  if (e.sc.act === 1) {
    const waiting =
      (step.id === "harvest" && cropsGrowing(e)) || (step.id === "meal" && mealWaiting(e));
    const side = pending.find((s) => ["well", "camp"].includes(s.id));
    if (waiting && side) return { ...side, whileWaiting: step.id };
  }
  if (e.sc.act === 2 && step.id === "farmerMeal" && !e.resident("farmer")) {
    const next = pending.find((s) => s.id !== "farmerMeal");
    if (next) step = next;
  }
  return step;
}

const near = (e, spot, r = 120) =>
  e.s.region === "farm" && Math.hypot(e.s.player.x - spot.x, e.s.player.y - spot.y) <= r;

function stepDetail(e, step) {
  const sc = e.sc,
    task = TASKS.find((q) => q.id === step.id);
  if (step.id === "harvest") {
    const first = firstHarvestStep(e);
    if (first)
      return {
        title: first.title,
        text: first.text,
        gain: "第一份收成记入联盟报告。" + taskGain(task),
        target: first.plot
          ? { region: "farm", x: first.plot.x, y: first.plot.y, label: first.title }
          : null,
        kind: "main",
      };
    return {
      title: "记录第一份收成",
      text:
        e.s.region === "farm"
          ? "两株作物已经收好，农场会自动记入报告。"
          : "两株作物已经收好。回到农场，收成会自动记入报告。",
      gain: taskGain(task),
      target: { region: "farm", x: 830, y: 480, label: "余烬农场" },
      kind: "main",
    };
  }
  if (step.id === "meal") {
    const job = foodJob(e),
      cook = e.s.buildings.find((b) => b.type === "cook" && b.hp > 0) || { x: 1010, y: 480 };
    const target = { region: "farm", x: cook.x, y: cook.y + 20, label: "篝火灶" };
    if (e.r.metrics.food >= 1)
      return {
        title: "记录第一份干粮",
        text: "干粮已经做好收起，回到农场会自动记入报告。",
        gain: taskGain(task),
        target,
        kind: "main",
      };
    if (job?.ready)
      return {
        title: "把做好的干粮收起来",
        text: "篝火灶上的成品已经出锅：在下方点“收好成品”，背包满了也可以先存进仓库。",
        gain: "第一份干粮记入报告。" + taskGain(task),
        target,
        kind: "main",
      };
    if (job)
      return {
        title: "等干粮出锅",
        text: "篝火灶正在加工，约" + Math.ceil(job.remaining || 0) + "游戏分钟后做好。",
        gain: taskGain(task),
        target,
        kind: "main",
      };
    return {
      title: "用萝卜做出第一份干粮",
      text: "在篝火灶把 3 个萝卜加工成 2 份干粮，需要 20 游戏分钟。萝卜就是刚收下的口粮。",
      gain: "第一份干粮记入报告。" + taskGain(task),
      target,
      kind: "main",
    };
  }
  if (step.id === "well") {
    const lack = missingCost(e, WELL_COST),
      ready = !lack.length && near(e, WELL_SPOT);
    return {
      title: "修好水井的辘轳和水槽",
      text:
        (step.whileWaiting === "harvest"
          ? "趁作物生长，"
          : step.whileWaiting === "meal"
            ? "趁干粮在灶上，"
            : "") +
        "到农舍东边的旧水井按 E。需要 " +
        costLine(e, WELL_COST) +
        (lack.length ? "（" + lack.join("、") + "：清理田里的杂物或去集市换）" : "") +
        "。",
      gain: "修好当天立刻放水一次；此后每天清晨，水槽自动浇灌第一排田。",
      target: { region: "farm", ...WELL_SPOT, label: "旧水井" },
      kind: ready ? "do" : "mark",
      doLabel: "就地修好水井",
      cost: WELL_COST,
    };
  }
  if (step.id === "camp") {
    const site = e.campSite(),
      lack = missingCost(e, CAMP_COST),
      ready = site && !lack.length && near(e, site);
    return {
      title: "搭起援建营地",
      text: site
        ? (step.whileWaiting === "harvest"
            ? "趁作物生长，"
            : step.whileWaiting === "meal"
              ? "趁干粮在灶上，"
              : "") +
          "到田地南边的营地空地按 E，搭帐篷和火盆。需要 " +
          costLine(e, CAMP_COST) +
          (lack.length ? "（" + lack.join("、") + "）" : "") +
          "。"
        : e.s.region !== "farm"
          ? "回到农场，到田地南边的空地按 E 搭帐篷和火盆。需要 " + costLine(e, CAMP_COST) + "。"
          : "农场暂时没有能搭帐篷的空地。回收一处闲置设施，空出一块地方。",
      gain: "援建队员有了落脚处；开饭时，大家会围着火盆坐下。",
      target: site
        ? { region: "farm", x: site.x, y: site.y, label: "援建营地空地" }
        : e.s.region !== "farm"
          ? { region: "farm", x: 830, y: 480, label: "余烬农场" }
          : null,
      kind: ready ? "do" : "mark",
      doLabel: "就地搭起营地",
      cost: CAMP_COST,
    };
  }
  if (step.id === "reply") {
    const at = near(e, TERMINAL_SPOT, 130);
    return {
      title: "到联盟终端回信",
      text: "收成、干粮、水井和营地都准备好了。到家园留言板旁的联盟终端按 E，把报告发出去。",
      gain: "援建队员铁锹带着 2 份干粮抵达，此后替你把成品、散落物资和田里的杂物搬进仓库；终端会标出住宅区的求援。",
      target: { region: "farm", ...TERMINAL_SPOT, label: "联盟终端" },
      kind: at ? "reply" : "mark",
    };
  }
  if (step.id === "choice")
    return {
      title: "选定第一批援建物资",
      text: "联络站能顺路捎一包，只能选一种：口粮种包（萝卜种子×6、土豆种子×4），或棉花种包（棉花种子×6、布料×2）。",
      gain: "物资直接送进农场仓库，种子放进背包；阿禾回来后，按你选的方向补种。",
      target: null,
      kind: "choose",
    };
  if (step.id === "farmer") {
    const req = e.taskRequirements("farmer").find((x) => !x.pass);
    return {
      title: req ? req.label : "记录阿禾回家",
      text: req
        ? "前往住宅区，找到阿禾和后院的种子档案箱。路上有感染者，带上干粮和绷带。"
        : "阿禾和种子档案都带回来了，回到农场会自动记入报告。",
      gain: taskGain(task),
      target: e.taskDestination("farmer"),
      kind: "main",
    };
  }
  if (step.id === "farmerMeal") {
    const bread = e.quantityForCost("bread", true);
    return {
      title: "让阿禾吃上工作餐",
      text: bread
        ? "白天自动供餐会给她送一份干粮；在农场也可以现在就供餐。"
        : "仓库和背包里都没有干粮。用萝卜做一批干粮，白天就会自动给她送饭。",
      gain: "阿禾开始照料农田：浇水、收获，并把收成存进仓库。",
      target: { region: "farm", x: 830, y: 480, label: "余烬农场" },
      kind: e.s.region === "farm" && bread ? "feed" : "main",
    };
  }
  if (step.id === "table") {
    const req = e.taskRequirements("table").find((x) => !x.pass);
    return {
      title: req
        ? {
            集市第一阶段完成: "为公共餐桌备料",
            制作台已建好: "建一张制作台",
            床位容量至少2人: "再添一张床位",
          }[req.label] || req.label
        : "记录公共餐桌开张",
      text: req
        ? "公共餐桌要三样：集市第一阶段（木材×12、萝卜×9）、一张制作台、再添一张床。"
        : "餐桌、制作台和床位都有了，回到农场会自动记入报告。",
      gain: "今天的饭桌坐满人；联盟记下前哨供粮合格（40 金币、营地声望 +5），住宅区开放邻里互助点。" + taskGain(task),
      target: null,
      kind: "main",
    };
  }
  return null;
}

// 当前故事目标；第二段完成或没有故事状态时返回 null，任务手记回到主线卡。
export function storyGoal(e) {
  const sc = e.sc;
  if (!sc || sc.act > 2) return null;
  const steps = actSteps(e),
    step = pickStep(e, steps);
  if (!step) return null;
  const detail = stepDetail(e, step);
  if (!detail) return null;
  const letter = sc.act === 1 ? "act1" : "act2";
  return {
    act: sc.act,
    actLabel: sc.act === 1 ? "第一段" : "第二段",
    actName: sc.act === 1 ? "收到回信" : "今天吃饭的人",
    letter,
    from: LETTERS[letter].from,
    happened: letterText(sc, letter),
    steps,
    step: { ...step, ...detail },
    index: steps.filter((s) => s.done).length + 1,
    total: steps.length,
  };
}
