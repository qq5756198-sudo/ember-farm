// 探查：新开一个档，照手记走完主线第一段，之后只种地、睡觉，看 9 天里引擎往外说了什么（提示、要开的页面、大事卡片）。
const D = new URL("../dist/", import.meta.url).href;
const C = await import(D + "campaign.js");
const PJ = await import(D + "player-journey.js");
const DAYS = Number(process.argv[2] || 9), DT = 0.05;
let s = 7;
Math.random = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
const log = [];
const e = new C.Engine(C.newGameState("farmer"), (t, tone) => log.push(hhmm() + " 提示" + (tone && tone !== "normal" ? "[" + tone + "]" : "") + " " + t));
function hhmm() { return "d" + e.s.day + " " + String(Math.floor(e.s.minute / 60)).padStart(2, "0") + ":" + String(Math.floor(e.s.minute % 60)).padStart(2, "0"); }
e.paused = false;
const drain = () => { for (const ev of e.events.splice(0)) { if (ev.type === "menu") log.push(hhmm() + " 页面 " + ev.menu + (ev.view ? ":" + ev.view : "") + (ev.tab ? ":" + ev.tab : "")); else if (ev.type === "moment") log.push(hhmm() + " 卡片 " + ev.kind + " " + ev.title); else if (ev.type === "ledger") log.push(hhmm() + " 账本 " + ev.title + " | " + (ev.lines || []).join(" / ")); } };
const tick = (input = { x: 0, y: 0 }) => { if (e.paused) e.paused = false; e.update(DT, input); drain(); if (e.dailyShouldShow?.()) { log.push(hhmm() + " 该出每日抉择：" + JSON.stringify(e.dy?.pending || e.dailyToday?.() || "").slice(0, 160)); if (e.dy) e.dy.pending = null; } };
const idle = (secs) => { for (let t = 0; t < secs; t += DT) tick(); };
const walkTo = (t, r = 40) => { if (!t) return; if (t.region && t.region !== e.s.region) e.travel(t.region); const p = e.s.player, d = Math.hypot(t.x - p.x, t.y - p.y); if (d > r) { const secs = (d - r) / 165, ux = (t.x - p.x) / d, uy = (t.y - p.y) / d; for (let q = 0; q < secs; q += DT) tick(); p.x = t.x - ux * r * 0.5; p.y = t.y - uy * r * 0.5 + 8; } };
let guard = 0, last = "";
while (e.s.day <= DAYS && guard++ < 60000) {
  const p = e.s.player;
  if (p.hunger < 35) for (const id of ["bread", "trailBread", "radish", "potato"]) if (e.qty(id) > 0 && e.consume(id)) break;
  const m = e.s.minute;
  if ((m >= 22 * 60 || m < 5 * 60) && e.s.region === "farm") { walkTo({ region: "farm", x: 830, y: 470 }, 60); if (!e.sleep()) idle(30); continue; }
  const g = e.storyGoal?.();
  const st = g?.step;
  const key = st ? st.id + ":" + st.title : "none";
  if (key !== last) { log.push(hhmm() + " 主线 " + key + (st ? " ｜" + (st.text || "").slice(0, 80) : "")); last = key; }
  if (!st) { idle(20); continue; }
  if (st.id === "harvest") { const f = PJ.firstHarvestStep(e); if (!f) { idle(5); continue; } const pl = f.plot; walkTo({ region: "farm", x: pl.x, y: pl.y }, 30); if (/清理|开垦/.test(f.title)) e.toolPlot(pl, "hoe"); else if (/种下/.test(f.title)) e.toolPlot(pl, e.qty("seedRadish") ? "seedRadish" : "seedPotato"); else if (/浇水/.test(f.title)) { if ((e.c.water || 0) < 1) { walkTo({ region: "farm", x: 880, y: 300 }, 40); e.interact(); walkTo({ region: "farm", x: pl.x, y: pl.y }, 30); } e.toolPlot(pl, "water"); } else if (/收下/.test(f.title)) e.handHarvest(pl); else idle(10); idle(1); continue; }
  if (st.id === "meal") { walkTo(st.target, 40); if (/做出第一份干粮/.test(st.title)) { if (!e.craft("trailBread")) idle(10); } else if (/收起来/.test(st.title)) { const j = e.c.production.find((x) => x.ready); if (j) e.collectProduction(j.id); idle(2); } else idle(10); idle(1); continue; }
  if (st.id === "well") { walkTo(st.target, 40); if (!e.repairWell()) idle(10); continue; }
  if (st.id === "camp") { walkTo(st.target, 40); if (!e.buildCamp()) idle(10); continue; }
  if (st.id === "reply") { walkTo(st.target, 40); if (!e.replyAlliance()) idle(10); continue; }
  if (st.id === "choice") { e.chooseSupply("ration"); idle(2); continue; }
  idle(20);
}
console.log(log.join("\n"));
console.log("---- 状态");
console.log("菜单格", e.easeMenus?.());
console.log("今天", (e.todayItems?.() || []).map((t) => t.text));
console.log("钱", e.s.money, "居民", e.c.residents.map((r) => r.id), "建筑", e.s.buildings.map((b) => b.type).join(","));
