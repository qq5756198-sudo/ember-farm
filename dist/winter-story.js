// v0.15.0「寒潮之后」：联盟前哨第七、八段的步骤与三行说明。只读引擎里的真实状态。
import { LETTERS, TERMINAL_SPOT, costLine, missingCost, letterText, TASK_CONTEXT } from "./alliance-data.js";
import { pick, mainDetail } from "./outpost-story.js";
import { BPOINT_BY_ID } from "./beyond-data.js";
import { WINTER_ACTS, WSPOTS, PRIORITIES, GE_COST, SUYAN_COST, WINTER, LADDER } from "./winter-data.js";

const has = (e, id) => e.r.claimed.includes(id);
const main = (e, id, label) => ({ id, label, task: id, done: has(e, id) });
const near = (e, spot, r = 120) =>
  e.s.region === (spot.region || "farm") && Math.hypot(e.s.player.x - spot.x, e.s.player.y - spot.y) <= r;
const preview = (cost, gain, effect) => ({ cost, gain, effect });
const pointTarget = (id, label) => {
  const p = BPOINT_BY_ID[id];
  return p ? { region: p.region, x: p.x, y: p.y, label: label || p.name } : null;
};

export function winterSteps(e) {
  const sc = e.sc,
    w = e.w;
  if (!sc || !w) return [];
  if (sc.act === 7) {
    const wi = w.winter;
    return [
      main(e, "filter", "净水过滤"),
      main(e, "annex", "检修间"),
      main(e, "radio", "电台"),
      { id: "forecast", label: "白霜站预报", done: w.forecast },
      { id: "warmth", label: "保温来源", done: e.hasHeatSource() || wi.phase !== "none" },
      { id: "priority", label: "先保哪样", done: !!wi.priority },
      { id: "ge", label: "葛队长一行", done: ["stayed", "escorted", "left"].includes(w.ge.phase), wait: w.ge.phase === "none" },
      { id: "cold", label: "熬过寒潮", done: wi.phase === "done", wait: wi.phase !== "done" },
    ];
  }
  if (sc.act === 8)
    return [
      main(e, "broadcast", "首次广播"),
      { id: "yeying", label: "夜莺主持", done: w.yeying.phase !== "none" },
      { id: "amo", label: "阿默的血样", done: w.amo.sample },
      { id: "air", label: "避难城通风", done: e.bflag("shelter_air", "service") },
      { id: "ferry", label: "档案岛航线", done: e.bflag("shipyard_ferry", "service") },
      { id: "suyan", label: "档案馆分馆", done: w.museum.built },
      { id: "evidence", label: "证据链", done: w.evidence },
      { id: "finale", label: "地区广播", done: w.assault.phase === "won" },
    ];
  return [];
}

function detail(e, step) {
  const w = e.w;
  if (step.task) return mainDetail(e, step.task);
  if (step.id === "forecast") {
    const at = near(e, TERMINAL_SPOT, 130);
    return {
      title: "用电台联系白霜站",
      text: e.r.radio
        ? at
          ? "电台修好了。在联盟终端按 E，呼叫白霜气象站的霜降。"
          : "电台修好了。到联盟终端，呼叫白霜气象站。"
        : "先把电台修好，才能联系上白霜站。",
      gain: "霜降的三天天气预报和寒潮倒计时；车队捎来黑麦种子×6（耐寒，12 小时成熟）。",
      target: { region: "farm", ...TERMINAL_SPOT, label: "联盟终端 · 呼叫白霜站" },
      kind: at && e.r.radio ? "do" : "mark",
      doLabel: "呼叫白霜站",
    };
  }
  if (step.id === "warmth")
    return {
      title: "准备至少一处保温",
      text: "寒潮里只有暖区里的人和作物不受冻。建一座火炉（建造 B：木材 10、石材 6、废金属 4），或者温室、布置好的房间都算。",
      gain: "有了预报和保温，寒潮准备期就开始：两天后寒潮来，持续三天。",
      target: null,
      kind: "mark",
    };
  if (step.id === "priority")
    return {
      title: "寒潮里先保哪一样",
      text: "人手只够把一件事做到最好。选一项优先，另外两项按寒潮规则受影响。",
      gain: "选中的一项不受寒潮拖累。",
      kind: "choose",
      target: null,
      choices: Object.entries(PRIORITIES).map(([id, p]) => ({
        id,
        pick: p.pick,
        name: p.name,
        desc: p.desc,
        preview:
          id === "food"
            ? preview("不花材料", "暖区外作物照样长六成", "火炉照常烧柴；有人可能冻病")
            : id === "medicine"
              ? preview("不花材料", "寒潮里没人冻病，包扎多回 10", "暖区外作物只长三成半")
              : preview("不花材料", "火炉只烧一半柴，机床照常", "暖区外作物只长三成半；有人可能冻病"),
        lack: [],
      })),
    };
  if (step.id === "ge") {
    const g = w.ge,
      level = e.ladderLevel();
    return {
      title: g.phase === "warned" ? "葛队长要走了" : "安顿葛队长一行",
      text:
        g.phase === "none"
          ? "寒潮准备期开始时，会有一批从北线来的人投奔前哨。"
          : (e.tr
              ? "葛队长带着两个人来过冬，嫌伙食和住处。每个人吃上晚饭、最近三顿有三样菜、床够、寒潮里屋里暖，就能说服他留下；也可以送他们回城。现在：" +
                LADDER.slice(0, 3)
                  .map((l, i) => l.name + (i < level ? " ✓" : " ✗"))
                  .join("、") +
                "。"
              : "葛队长带着两个人来过冬，嫌伙食和住处。生活水准到“住得暖”（第三级）就能说服他留下；也可以送他们回城。现在生活水准第 " + level + " 级。") +
            (g.phase === "warned" ? "他说两天后就走（第" + (g.warnDay + 2) + "天晚饭）。" : ""),
      gain: "留下：三个人每天砍柴、加工快一成（也要多吃六份饭）。送回城：营地声望 +5。",
      kind: g.phase === "none" ? "wait" : "choose",
      target: g.phase === "none" ? null : { region: "farm", ...WSPOTS.ge, label: "葛队长" },
      choices:
        g.phase === "none"
          ? undefined
          : [
              {
                id: "persuade",
                pick: e.tr ? "说服他" : "拿出生活水准",
                name: "说服他们留下",
                desc: e.tr ? "要吃得饱、吃得好、住得暖：每个人吃上晚饭、最近三顿有三样菜、床位够、寒潮里农舍和营地在暖区里。" : "要生活水准第三级“住得暖”：床位够、有布置好的房间、农舍和营地在暖区里。",
                preview: preview("每天多 6 份口粮", "三个人砍柴、加工快一成", "以后不会再闹着走"),
                lack: level >= 3 ? [] : [(e.tr ? "还差：" : "生活水准还差：") + LADDER.slice(level, 3).map((l) => l.name).join("、")],
              },
              {
                id: "escort",
                pick: "体面送走",
                name: "护送他们回城",
                desc: "路上要带干粮。少几个人，但不结仇。",
                preview: preview(costLine(e, GE_COST), "营地声望 +5", "少三个人吃饭，也少三个帮手"),
                lack: missingCost(e, GE_COST),
              },
            ],
    };
  }
  if (step.id === "cold") {
    const wi = w.winter;
    const text =
      wi.phase === "none"
        ? "有了预报和保温来源后，寒潮准备期开始。"
        : wi.phase === "prep"
          ? "寒潮第" + wi.coldDay + "天清晨到。火炉准备期就开始烧柴（每座每天 2 份木材），囤好口粮，给自己做件保温衣。"
          : "寒潮第 " + Math.max(1, e.s.day - wi.coldDay + 1) + "/" + WINTER.coldDays + " 天。暖区外饿得快、作物长得慢、队员干活慢；第" + wi.endDay + "天清晨结束。";
    return {
      title: wi.phase === "cold" ? "熬过寒潮" : "等寒潮到来",
      text,
      gain: "寒潮结束：120 金币、声望 +10；霜降把白霜站交给前哨。",
      kind: "wait",
      target: null,
    };
  }
  if (step.id === "yeying") {
    const at = near(e, TERMINAL_SPOT, 130);
    return {
      title: "请夜莺主持电台",
      text: "广播一响，一个说话像念广告的女人找上门，想当前哨电台的主持。在联盟终端和她谈。",
      gain: "电台节目效果 ×1.5；之后她的往事会被人认出来。",
      target: { region: "farm", ...TERMINAL_SPOT, label: "联盟终端 · 夜莺" },
      kind: at ? "do" : "mark",
      doLabel: "请她主持",
    };
  }
  if (step.id === "amo") {
    const night = e.isNight(),
      at = near(e, WSPOTS.amo);
    return {
      title: "取得阿默的血样",
      text:
        "地底避难城里住着一个灰皮人阿默，大家当他是感染者。许医生怀疑他是康复者——他的血能补上证据链。他只在夜里（19:00–06:00）出来。" +
        (e.b?.unlocked?.shelter ? "" : "地底避难城还没开放：" + (e.beyondUnlockReason?.("shelter") || "先修通入口") + "。"),
      gain: "阿默的血样（关键物品）；之后可以在夜里找他买月影草。",
      target: { region: WSPOTS.amo.region, x: WSPOTS.amo.x, y: WSPOTS.amo.y, label: "阿默" },
      kind: at && night ? "do" : "mark",
      doLabel: "请阿默帮忙",
    };
  }
  if (step.id === "air")
    return {
      title: "让避难城重新通风",
      text: "在地底避难城的主风道修复主风机（零件 3、废金属 6，120 分钟）。",
      gain: "避难城的人能住回去；也是白霜站开放所需的服务之一。",
      target: pointTarget("shelter_air"),
      kind: "mark",
    };
  if (step.id === "ferry")
    return {
      title: "开通去档案岛的航线",
      text: "在沉湾船坞的自治会码头恢复固定航线。",
      gain: "档案员苏砚能坐船来农场；档案岛也就近了。",
      target: pointTarget("shipyard_ferry"),
      kind: "mark",
    };
  if (step.id === "suyan") {
    const at = near(e, WSPOTS.museum),
      lack = missingCost(e, SUYAN_COST);
    return {
      title: "给苏砚建档案馆分馆",
      text:
        "苏砚坐第一班船来了，想在农场东北角开一间档案馆分馆。需要 " +
        costLine(e, SUYAN_COST) +
        (lack.length ? "（" + lack.join("、") + "）" : "") +
        "。",
      gain: "档案馆：捐赠鱼、药草标本、日志、照片和遗物，每填满一个展柜得到永久加成。",
      target: { region: "farm", ...WSPOTS.museum, label: "档案馆分馆空地" },
      kind: at && !lack.length ? "do" : "mark",
      doLabel: "建起分馆",
      cost: SUYAN_COST,
    };
  }
  if (step.id === "evidence") {
    const at = near(e, WSPOTS.evidence),
      ready = e.qty("amoSample", true) > 0 && e.f.clues.length >= 3;
    return {
      title: "补齐污染证据链",
      text:
        "把阿默的血样和三地日志带到检疫科研园的证据拼合台。" +
        (e.qty("amoSample", true) > 0 ? "" : "（还没有阿默的血样）") +
        (e.f.clues.length >= 3 ? "" : "（日志 " + e.f.clues.length + "/3）") +
        (e.d?.unlocked?.quarantine ? "" : "检疫科研园还没开放。"),
      gain: "许医生的研究突破：药包多回 20 生命，营地病号用 1 条绷带就能治好。",
      target: { region: WSPOTS.evidence.region, x: WSPOTS.evidence.x, y: WSPOTS.evidence.y, label: "证据拼合台" },
      kind: at && ready ? "do" : "mark",
      doLabel: "拼合证据",
    };
  }
  if (step.id === "finale") {
    const a = w.assault,
      at = near(e, TERMINAL_SPOT, 130),
      live = ["warning", "active"].includes(a.phase);
    return {
      title: live ? "守住地区广播！" : a.phase === "scheduled" ? "灰隼团残部还会再来" : "做一次全地区广播",
      text: live
        ? "灰隼团残部从东边来了，人比上次多。守住终端，直到他们退走。"
        : a.phase === "scheduled"
          ? "上次没守住。他们第" + a.day + "天 19:00 再来，补足弹药和守卫。"
          : "所有准备都做完了。在联盟终端按下广播：全地区都会听见——包括灰隼团的残部。",
      gain: "地区广播成功：200 金币、声望 +15；联盟确认前哨能承担地区事务。",
      target: { region: "farm", ...TERMINAL_SPOT, label: "联盟终端 · 地区广播" },
      kind: at && a.phase === "none" ? "do" : "mark",
      doLabel: "开始地区广播",
    };
  }
  return null;
}

export function winterGoal(e) {
  const sc = e.sc;
  if (!sc || sc.act < 7 || sc.act > 8) return null;
  const steps = winterSteps(e),
    step = pick(e, steps);
  if (!step) return null;
  const d = detail(e, step);
  if (!d) return null;
  const letter = "act" + sc.act,
    act = WINTER_ACTS[sc.act];
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
