// v0.50：每日抉择的选项怎么读（花费、得到、几成机会、有没有下文）。从旧界面里拆出来的，只算数、不排版。
import { ITEMS } from "./data.js";
import { costLine } from "./alliance-data.js";
import { EVENTS, CHAINS, PERKS, BUFFS, CATS, BASIC_SEEDS } from "./daily-data.js";
import { itemsText, cheng } from "./daily.js";

const signed = (n) => (n >= 0 ? "+" : "−") + Math.abs(n);
const DAY_WORDS = ["今天", "明天", "两天后", "三天后", "四天后", "五天后", "六天后", "七天后"];
const after = (n) => DAY_WORDS[n] || n + " 天后";
const REGION = { residential: "废弃居民区", hospital: "旧医院", warehouse: "工业仓库", market: "幸存者集市", railDepot: "北线货运站", courtyard: "雨巷住区", ruin: "某片废墟" };

// ---------- 选项文字（与 daily.js 的 applyOp 用同一组数字） ----------
function preview(e, op, tier) {
  const [kind, a, b, c] = op,
    sc = (n) => e.scaleN(n, tier),
    sb = (x) => e.scaleB(x, tier);
  switch (kind) {
    case "give":
      return itemsText(sb(a));
    case "money":
      return "金币 " + signed(sc(a));
    case "rep":
      return "营地声望 " + signed(a);
    case "mood":
      return "居民士气 " + signed(a);
    case "fatigue":
      return a <= -100 ? "居民疲劳清零" : "居民疲劳 " + signed(a);
    case "hp":
      return "生命 " + signed(a);
    case "stamina":
      return a >= 100 ? "体力恢复满" : "体力 " + signed(a);
    case "research":
      return "研究点 +" + a;
    case "xp":
      return ({ combat: "战斗", exploration: "探索", agriculture: "农业" }[a] || "") + "经验 +" + b;
    case "trust": {
      const ids = e.trustTargets(a);
      return ids.length ? ids.map((id) => e.personName(id)).join("、") + "的信任 " + signed(b) : "";
    }
    case "cheer":
      return "心情最差的那位居民：士气 +10，信任 +2";
    case "buff":
      return (b <= 1 ? "今天" : b + " 天内") + BUFFS[a](c);
    case "later": {
      const items = b ? sb(b) : null,
        money = c ? sc(c) : 0;
      return after(a) + "：" + [items ? itemsText(items) : "", money ? "金币 +" + money : ""].filter(Boolean).join("、");
    }
    case "debt":
      return after(a) + "要交出 " + itemsText(sb(b), "");
    case "night":
      return "今晚可能丢 " + itemsText(sb(a), "");
    case "drain":
      return a + " 天里每天少一份收成";
    case "spawn":
      return "农场边来 " + a + " 只感染者" + (b ? "，打完得 " + itemsText(sb(b), "") : "");
    case "ambush":
      return "下次进废墟撞见 " + a + " 只感染者";
    case "cache":
      return "今天" + REGION[b] + "多一个补给点（" + itemsText(sb(a), "") + "）";
    case "crew":
      return a.name + "加入援建队（住满了就留下 " + itemsText(sb(b || {}), "") + "）";
    case "perk":
      return "长期：" + PERKS[a].text;
    case "peng":
      return "彭姐的关系 " + signed(a);
    case "dog":
      return "麦穗默契 " + signed(a);
    case "lose":
      return a === "topItem" ? "最多的一样物资少" + cheng(b) : a === "topSeed" ? (b >= 1 ? "那袋种子全没了" : "那袋种子少" + cheng(b)) : (ITEMS[a]?.name || a) + "少" + cheng(b);
    case "water":
      return "今天的田都算浇过";
    case "fertility":
      return "农田肥力 +" + a;
    case "growthBack":
      return "作物生长退回 " + Math.round(a * 100) + "%";
    case "harvestRipe":
      return "收下所有熟了的作物";
    case "sick":
      return "营地有病号 " + a + " 天";
    case "heal":
      return "病号都好了";
    case "visitor":
      return "明天上午营门来一位访客";
    case "clearRuin":
      return "一片废墟的感染者被清掉";
    case "repair":
      return a === "fences" ? "围栏、大门、瞭望塔修满" : "受损设施全部修满";
    case "rush":
      return "一批加工马上就好";
    case "killJob":
      return "那批成品没了";
    case "stationHit":
      return "那座加工站耐久掉一半";
    case "visitBlock":
      return a + " 天内营门不放人进来";
    case "hordeShift":
      return "尸潮推迟 " + a + " 天";
    case "hordeTomorrow":
      return "尸潮提前到明天";
    case "raidDelay":
      return "灰隼团推迟 " + a + " 天";
    case "raidLess":
      return "下次袭击少 " + a + " 人（最少还会来 3 人）";
    case "raidWarn":
      return "下次袭击预警多 " + a + " 秒";
    case "seeds":
      return "随机种子 " + sc(a) + " 颗";
    case "seedsAll": {
      const n = e.seedsAllN(a, tier, EVENTS[e.dy.pending?.id]?.chain || null);
      return "八种种子各 +" + n + (n < sc(a) ? "（坏了一半）" : "");
    }
    case "seedsOwned":
      return "已有的种子各 +" + sc(a);
    case "rareSeeds":
      return "丰产种子 +" + sc(a);
    case "mod":
      return "一件枪械配件";
    case "random":
      return "随机一样：" + a.map((x) => itemsText(sb(x), "")).join(" / ");
    case "time":
      return "花掉 " + Math.round(a / 60) + " 小时";
    case "caravanDisc":
      return "下次唐九的商队打" + Math.round(a * 10) + "折";
    case "caravanOrder":
      return "下次唐九带来一件枪械配件";
    case "festNext":
      return "下一次节庆多一颗星";
    case "talkUsed":
      return "用掉今晚的营火夜谈";
    case "sellTop": {
      const t = e.topItem(1);
      return t ? "卖掉 " + ITEMS[t.id].name + " " + Math.min(a, t.n) + " 份：金币 +" + Math.max(1, Math.round((sc(b) * Math.min(a, t.n)) / a)) : "没什么可卖的";
    }
    case "payGoods":
      return "";
    case "tell":
      return "知道明天的天气";
    case "next":
      return "";
    case "mark":
      return "";
  }
  for (const hook of PREVIEW_HOOKS) {
    const text = hook(e, op, tier);
    if (text) return text;
  }
  return "";
}
// 后面的层（v0.19 妙手）在这里补上新动作的说明
export const PREVIEW_HOOKS = [];
const joinFx = (e, fx, tier) =>
  (fx || [])
    .map((op) => preview(e, op, tier))
    .filter(Boolean)
    .join("；");
function followUp(e, ev, o) {
  if (!ev.chain) return "";
  const all = [...(o.fx || []), ...(o.win || [])];
  const next = all.find((op) => op[0] === "next"),
    mark = all.find((op) => op[0] === "mark");
  const onlyWin = o.p && !(o.lose || []).some((op) => op[0] === "next" || op[0] === "mark");
  if (mark) return e.chainFlag(ev.chain, "clue") ? "已经摸清了方向，明天有下文" : "去" + (REGION[mark[2]] || e.regionLabel(mark[2])) + "的标记点，第二天有下文";
  if (next) return after(next[2]) + "有下文" + (onlyWin ? "（成了才有）" : "");
  return ev.step === CHAINS[ev.chain].steps ? "结局" : "这条线到此为止";
}
export function optionModel(e, p, i) {
  const ev = EVENTS[p.id],
    o = ev.opts[i],
    cost = e.optionCost(o, p.tier),
    pay = e.optionPay(o, p.tier),
    reason = e.optionReason(i, p),
    chance = o.p ? e.optionChance(i, p) : null;
  const goods = (o.fx || []).find((op) => op[0] === "payGoods");
  const costText = [cost ? costLine(e, cost) : "", pay ? "金币 " + pay + "（有 " + e.s.money + "）" : "", goods ? "背包里的货，按出货价抵 " + e.scaleN(goods[1], p.tier) + " 金币（现有约 " + Math.floor(e.goodsValue()) + "）" : ""].filter(Boolean).join("、") || "不花";
  let gain, risk;
  const follow = followUp(e, ev, o),
    goesOn = !!follow && !/到此为止/.test(follow);
  if (o.p) {
    gain = [joinFx(e, o.win, p.tier), o.note].filter(Boolean).join("；") || (goesOn ? "这条线往下走" : "平安无事");
    risk = { chance, lose: [o.loseNote, joinFx(e, o.lose, p.tier)].filter(Boolean).join("：") || "什么也没有" };
  } else gain = [joinFx(e, o.fx, p.tier), o.note].filter(Boolean).join("；") || (goesOn ? "这条线往下走" : "什么也不发生");
  return { label: o.label, costText, gain, risk, reason, follow, free: !cost && !pay && !o.req && !goods };
}

export { EVENTS, CATS, cheng };
