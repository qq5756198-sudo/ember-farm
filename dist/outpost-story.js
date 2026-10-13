// v0.14.0「商路与火光」：联盟前哨第三至第六段的步骤与三行说明。
// 只读引擎里的真实状态；扣除与奖励都写在 outpost.js。
import { TASKS } from "./rebuild-data.js";
import { LETTERS, TASK_CONTEXT, bundleText, costLine, missingCost, taskGain, letterText } from "./alliance-data.js";
import {
  ACTS,
  SPOTS,
  HOSPITAL_CHOICE,
  LATHE_MODES,
  LATHE_COST,
  CARGO,
  CONVOY_MINUTES,
  TOLL_COST,
  RAID_PREP,
} from "./outpost-data.js";

const has = (e, id) => e.r.claimed.includes(id);
const main = (e, id, label) => ({ id, label, task: id, done: has(e, id) });
const near = (e, spot, r = 120) =>
  e.s.region === (spot.region || "farm") && Math.hypot(e.s.player.x - spot.x, e.s.player.y - spot.y) <= r;
const abs = (e) => e.s.day * 1440 + e.s.minute;
const clock = (m) => {
  const d = Math.floor(m / 1440),
    h = Math.floor((m % 1440) / 60),
    mm = Math.floor(m % 60);
  return "第" + d + "天 " + String(h).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
};

export function outpostSteps(e) {
  const sc = e.sc,
    o = e.o;
  if (!sc || !o) return [];
  if (sc.act === 3)
    return [
      main(e, "signal", "医院求救"),
      main(e, "medical", "医疗补给"),
      { id: "hospitalChoice", label: "先救谁", done: !!o.hospital },
      main(e, "hospital", "医院前哨"),
      main(e, "hospitalDefense", "医疗通道"),
    ];
  if (sc.act === 4)
    return [
      main(e, "water", "稳定供水"),
      main(e, "power", "陈工与动力"),
      { id: "youke", label: "接回尤可", done: !!o.youke },
      { id: "lathe", label: "修复机床", done: !!o.lathe },
      { id: "latheMode", label: "机床排产", done: !!o.lathe?.mode },
      main(e, "warehouse", "仓库前哨"),
    ];
  if (sc.act === 5)
    return [
      { id: "cargo", label: "装车", done: !!o.cargo },
      { id: "convoy", label: "车队上路", done: !!o.convoy?.done, wait: !!o.convoy && !o.convoy.done },
      main(e, "network", "前哨互供"),
    ];
  if (sc.act === 6) {
    const list = [
      { id: "toll", label: "过路费", done: !!o.toll },
      // 袭击打完后，备战与补给点不再卡住进度。
      { id: "prep", label: "备战", done: !!o.prep || o.raid.phase === "won" },
    ];
    if (o.prep === "supply") list.push({ id: "cache", label: "端掉补给点", done: !!o.cache || o.raid.phase === "won" });
    list.push(
      {
        id: "raid",
        label: "击退灰隼团",
        done: o.raid.phase === "won",
        wait: o.raid.phase === "scheduled" && !e.raidDue(),
      },
      { id: "yaozi", label: "处置俘虏", done: !!o.prisoner && o.prisoner !== "held" },
    );
    return list;
  }
  return [];
}

export function pick(e, steps) {
  const pending = steps.filter((s) => !s.done);
  if (!pending.length) return null;
  const first = pending[0];
  // 车队在路上、袭击还没到时，先做后面能做的事。
  if (first.wait) {
    const next = pending.find((s) => s !== first && !s.wait && s.id !== "yaozi");
    if (next) return { ...next, whileWaiting: first.id };
  }
  return first;
}

export function mainDetail(e, id) {
  const q = TASKS.find((t) => t.id === id),
    reqs = e.taskRequirements(id),
    miss = reqs.find((x) => !x.pass),
    ready = e.taskReady(id),
    paid = Object.keys(q.cost).length > 0;
  return {
    title: ready ? (paid ? "交付补给，确认成果" : "记录：" + q.title) : miss?.label || q.title,
    text: ready
      ? paid
        ? "回到农场确认交付：" + bundleText(q.cost) + "。"
        : e.s.region === "farm"
          ? "条件已经达成，农场会自动记录这项进展。"
          : "条件已经达成，回到农场就会记录。"
      : q.desc,
    gain: taskGain(q),
    target: e.taskDestination(id),
    kind: "main",
  };
}

const preview = (cost, gain, effect) => ({ cost, gain, effect });
const waitNote = (e, step) =>
  step.whileWaiting === "convoy"
    ? "车队还在路上，先"
    : step.whileWaiting === "raid"
      ? "离灰隼团来袭还有时间，先"
      : "";

function detail(e, step) {
  const o = e.o;
  if (step.task) return mainDetail(e, step.task);
  if (step.id === "hospitalChoice")
    return {
      title: "先救谁：伤员还是水泵",
      text: "许医生只顾得上一头：把两名伤员接回农场养伤，或者用零件修好医院的水泵。只能选一个。",
      gain: "伤员养好两天，邹家会有一人留下当援建队员；修好水泵，医院此后每天送 1 份药草进仓库。",
      kind: "choose",
      target: null,
      choices: Object.entries(HOSPITAL_CHOICE).map(([id, c]) => ({
        id,
        pick: c.pick,
        name: c.name,
        desc: c.desc,
        preview:
          id === "patients"
            ? preview("不花材料；两天里每天多 2 份口粮", "邹叔留下当援建队员（搬运 · 大胃王）", "口粮压力上升：少吃一天，伤员就提前走了")
            : preview(costLine(e, c.cost), "每天清晨仓库 +1 药草", "不增加吃饭的人"),
        lack: missingCost(e, c.cost),
      })),
    };
  if (step.id === "youke") {
    const spot = SPOTS.youke,
      at = near(e, spot);
    return {
      title: "去仓库接回尤可",
      text: at
        ? "尤可就在工具架后面，按 E 和她说话，带她回农场。"
        : "工业仓库设备区的工具架后面，一直有人在敲东西。陈工说那是尤可，她知道旧机床怎么修。",
      gain: "尤可住进农场（工程 · 夜猫子），能修复旧机床，之后还会做小发明。",
      target: { region: spot.region, x: spot.x, y: spot.y, label: "尤可" },
      kind: at ? "do" : "mark",
      doLabel: "带尤可回家",
    };
  }
  if (step.id === "lathe") {
    const at = near(e, SPOTS.lathe),
      lack = missingCost(e, LATHE_COST);
    return {
      title: "修复旧机床",
      text:
        "尤可说，农场东边那台锈住的机床还能转。到机床旁按 E。需要 " +
        costLine(e, LATHE_COST) +
        (lack.length ? "（" + lack.join("、") + "）" : "") +
        "。",
      gain: "机床每天 18:00 自动做一批东西：零件、布料或弹药（之后可改）。有太阳能板时一天做两批。",
      target: { region: "farm", x: SPOTS.lathe.x, y: SPOTS.lathe.y, label: "旧机床" },
      kind: at && !lack.length ? "do" : "mark",
      doLabel: "就地修复机床",
      cost: LATHE_COST,
    };
  }
  if (step.id === "latheMode")
    return {
      title: "给机床排产",
      text: "机床每天只够做一种东西。先定下优先做什么，之后在机床旁可以随时改。",
      gain: "每天 18:00 自动加工一批，材料从仓库扣。",
      kind: "choose",
      target: null,
      choices: Object.entries(LATHE_MODES)
        .filter(([, m]) => !m.retired)
        .map(([id, m]) => ({
        id,
        pick: m.pick,
        name: m.name,
        desc: m.desc,
        preview: preview(bundleText(m.input) + " / 天", bundleText(m.output) + " / 天", "缺料的那天不开工"),
        lack: [],
      })),
    };
  if (step.id === "cargo") {
    const wage = e.quantityForCost("radish", true) < 1 ? ["萝卜还差1（红薯的工钱）"] : [];
    return {
      title: "给第一支车队装车",
      text: "运输骡红薯会拉车，但每趟要 1 个萝卜当工钱。挑一种货装车，车队 4 小时后到对应的前哨。",
      gain: "货送到后，对应前哨开始长期回报；唐九的流动商队也会开始来农场。",
      kind: "choose",
      target: null,
      choices: Object.entries(CARGO).map(([id, c]) => ({
        id,
        pick: c.pick,
        name: c.name,
        desc: c.desc,
        preview: preview(costLine(e, c.cost) + "、萝卜 1（工钱）", "到达后 60 金币与长期回报", "可去集市护送；不护送会丢掉三分之一的货"),
        lack: [...missingCost(e, c.cost), ...wage],
      })),
    };
  }
  if (step.id === "convoy") {
    const c = o.convoy,
      left = c ? Math.max(0, Math.ceil(c.arrives - abs(e))) : CONVOY_MINUTES;
    return {
      title: c?.escorted ? "车队安全，等它到站" : "护送车队穿过旧街口",
      text: c?.escorted
        ? "旧街口的感染者清干净了，车队还有约 " + left + " 游戏分钟到站。"
        : "车队还有约 " +
          left +
          " 游戏分钟到站。去集市旧街口击退 4 名感染者，货就不会丢；不去也能到，只是丢三分之一。",
      gain: "车队到站：金币与" + (CARGO[o.cargo]?.name || "货物") + "的长期回报，唐九的商队开始来农场。",
      target: c?.escorted
        ? null
        : { region: SPOTS.escort.region, x: SPOTS.escort.x, y: SPOTS.escort.y, label: "旧街口 · 护送车队" },
      kind: c?.escorted ? "wait" : "mark",
    };
  }
  if (step.id === "toll")
    return {
      title: "灰隼团要过路费",
      text: "灰隼团在旧桥设了卡，开口就要 " + bundleText(TOLL_COST) + "。交了能拖三天；不交，他们明晚就来。",
      gain: "无论交不交，这一仗都躲不掉。赢下来，商路就是你们的，买东西便宜一成。",
      kind: "choose",
      target: null,
      choices: [
        {
          id: "pay",
          pick: "先交钱拖时间",
          name: "交过路费",
          desc: "交出 " + bundleText(TOLL_COST) + "，三天后他们会带人来要更多。",
          preview: preview(costLine(e, TOLL_COST), "多两天备战时间", "击退灰隼团之前，买东西都贵一成"),
          lack: missingCost(e, TOLL_COST),
        },
        {
          id: "refuse",
          pick: "一粒米都不给",
          name: "拒绝",
          desc: "灰隼团明天 19:00 来袭。",
          preview: preview("不花材料", "保住口粮和弹药", "明晚就打；击退之前买东西贵一成"),
          lack: [],
        },
      ],
    };
  if (step.id === "prep")
    return {
      title: "选一种备战方式",
      text:
        "离来袭还有 " +
        e.raidCountdownText() +
        "。只够做一件大事：加固射击位、端掉他们的补给点，或者用诱饵分散他们。",
      gain: "选中的准备会削弱这次袭击；Z 键可以查看防线与来袭方向。",
      kind: "choose",
      target: null,
      choices: Object.entries(RAID_PREP).map(([id, c]) => ({
        id,
        pick: c.pick,
        name: c.name,
        desc: c.desc,
        preview: preview(
          Object.keys(c.cost).length ? costLine(e, c.cost) : id === "supply" ? "跑一趟工业仓库" : "不花材料",
          id === "towers" ? "射击伤害 +40%，少来 2 人" : id === "supply" ? "少来 4 人，缴获弹药×12" : "一半枪手晚到一分钟",
          "选定后不能更改",
        ),
        lack: missingCost(e, c.cost),
      })),
    };
  if (step.id === "cache") {
    const at = near(e, SPOTS.cache);
    return {
      title: "端掉灰隼团的补给点",
      text:
        waitNote(e, step) +
        (at ? "补给点就在面前，按 E 拆掉它。" : "灰隼团把补给藏在工业仓库南边的货堆里。去那里按 E 拆掉。"),
      gain: "这次袭击少来 4 名枪手；缴获弹药×12。",
      target: { region: SPOTS.cache.region, x: SPOTS.cache.x, y: SPOTS.cache.y, label: "灰隼团补给点" },
      kind: at ? "do" : "mark",
      doLabel: "拆掉补给点",
    };
  }
  if (step.id === "raid") {
    const r = o.raid;
    const live = ["warning", "active"].includes(r.phase);
    return {
      title: live ? "守住农场！" : "准备迎战灰隼团",
      text: live
        ? "灰隼团从东边围栏来了。他们会瞄准（红线）再开枪——看到红线就挪位置；打残的会撤退。"
        : "灰隼团" +
          clock(r.day * 1440 + 1140) +
          "从东边来（还有 " +
          e.raidCountdownText() +
          "）。修好围栏、补足弹药、让居民守瞭望塔；人不在农场时，守卫会替你迎战，但更容易输。",
      gain: "击退后：缴获、俘虏一名灰隼团成员，商路不再交钱，买东西便宜一成。",
      target: { region: "farm", x: 1300, y: 420, label: "东侧围栏 · 迎战点" },
      kind: "mark",
    };
  }
  if (step.id === "yaozi")
    return {
      title: "处置俘虏鹞子",
      text: "战后在围栏边抓到一个灰隼团的人，叫鹞子。他说自己早就想走了。审问、放走，还是留下他？",
      gain: "审问能问出他们藏的弹药；放走能换来名声；留下他会多一名侦察队员（要多吃一份饭）。",
      kind: "choose",
      target: null,
      choices: [
        {
          id: "interrogate",
          pick: "问出底细",
          name: "审问",
          desc: "他交代旧桥下藏着一批弹药和铁皮。",
          preview: preview("不花材料", "弹药×12、废金属×6 入仓", "鹞子会离开"),
          lack: [],
        },
        {
          id: "release",
          pick: "给条活路",
          name: "放走",
          desc: "附近的营地会听说这件事。",
          preview: preview("不花材料", "营地声望 +3", "鹞子会离开"),
          lack: [],
        },
        {
          id: "stay",
          pick: "给他一份活",
          name: "留下",
          desc: "他认得路，可以当侦察队员。",
          preview: preview("每天 2 份口粮", "侦察队员：每天带回材料，袭击预警更早", "占一个援建名额"),
          lack: e.crewFull() ? ["援建营地满员（3/3）"] : [],
        },
      ],
    };
  return null;
}

export function outpostGoal(e) {
  const sc = e.sc;
  if (!sc || sc.act < 3 || sc.act > 6) return null;
  const steps = outpostSteps(e),
    step = pick(e, steps);
  if (!step) return null;
  const d = detail(e, step);
  if (!d) return null;
  const letter = "act" + sc.act,
    act = ACTS[sc.act];
  return {
    act: sc.act,
    actLabel: act.label,
    actName: act.name,
    letter,
    from: LETTERS[letter].from,
    happened: letterText(sc, letter),
    steps,
    step: { ...step, ...d },
    index: steps.filter((s) => s.done).length + 1,
    total: steps.length,
    context: step.task ? TASK_CONTEXT[step.task] : "",
  };
}
