// v0.35.0「长夜」的界面：顶栏的长夜横幅和提醒带上夜相、前一天顶上提醒“明晚长夜 · 雾夜”，任务手记长夜那几行写夜相和弱点提示，
// 长夜战报里写这一夜的夜相、没守住时守夜笔记记下的那一句，下面一段“夜相”（下一个长夜、八个夜相各守住几次、守夜笔记），
// 节庆日历的长夜标上夜相，成就册里“见过的夜相”“守住过的夜相”，大事卡片的小图。
import { ITEMS } from "./data.js";
import { ALERT_HOOKS } from "./winter-ui.js";
import { addMomentIcons } from "./zest-ui.js";
import { PHASES, PHASE_IDS, SEASON_NAMES } from "./nightfall-data.js";

const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const button = (a, id, label, extra = "") => `<button data-action="${a}" data-id="${esc(id)}"${extra ? " " + extra : ""}>${esc(label)}</button>`;
const phaseName = (ph) => PHASES[ph]?.name || "";

// ================= 顶栏 =================
// 长夜横幅：“⚠ 长夜 · 第 2/3 波 …” → “⚠ 长夜 · 雾夜 · 第 2/3 波 …”
export function nfHud(e, hud) {
  if (!hud || !e?.nf) return hud;
  const ph = e.ln?.night ? e.nfTonight?.() : null;
  if (!ph || typeof hud.raid !== "string" || !hud.raid.includes("长夜 · ")) return hud;
  return { ...hud, raid: hud.raid.replace("长夜 · ", "长夜 · " + phaseName(ph) + " · ") };
}
// 顶上的提醒：今晚的长夜、打着的长夜带上夜相
export function patchNfAlerts(e, html) {
  if (!e?.nf || typeof html !== "string") return html;
  const ph = e.nfTonight?.();
  if (!ph) return html;
  const n = phaseName(ph);
  return html.replace(">今晚 22:00 长夜<", ">今晚 22:00 长夜 · " + esc(n) + "<").replace(">长夜 · 第 ", ">长夜 · " + esc(n) + " · 第 ");
}
// 前一天：明晚是长夜（07:00 早间广播以后），点一下标出农场东边的围栏
ALERT_HOOKS.push((e, add) => {
  if (!e?.nf || !e.ln?.storyDay || e.ln.night || e.s.minute < 420) return;
  const ph = e.nfPhase?.(e.s.day + 1);
  if (!ph) return;
  add(2, "明晚长夜 · " + phaseName(ph), "warn", { region: "farm", x: 1300, y: 420, label: phaseName(ph) + " · " + PHASES[ph].short });
});

// ================= 任务手记 =================
export function patchNfJournal(e, html) {
  if (!e?.nf || typeof html !== "string") return html;
  const info = e.nfInfo?.();
  if (!info?.on) return html;
  let out = html;
  // 打着的时候：“第 N 个 · 第 2/3 波” → “第 N 个 · 雾夜 · 第 2/3 波”
  if (e.ln?.night && info.tonight) out = out.replace(/(<b>长夜<\/b>第 \d+ 个) · 第 /, "$1 · " + esc(phaseName(info.tonight)) + " · 第 ");
  // 今天是长夜：标题带夜相，下面一句写规则（没守住过的多一句提醒）
  else if (info.tonight) {
    out = out.replace(/(<b>今晚<\/b>22:00 长夜（第 \d+ 个)）/, "$1 · " + esc(phaseName(info.tonight)) + "）");
    const at = out.indexOf("<b>今晚</b>22:00 长夜"),
      sm = at >= 0 ? out.indexOf("<small>", at) : -1;
    if (sm > 0) out = out.slice(0, sm + 7) + esc(ruleLine(e, info.tonight, e.s.day)) + out.slice(sm + 7);
  }
  // 下一个长夜：带上夜相；明天就是的，写规则
  else if (info.next && info.nextPh) {
    const re = /(<b>长夜<\/b>下一个在第 \d+ 天（[^）]*）)· /;
    if (re.test(out)) {
      out = out.replace(re, "$1· " + esc(phaseName(info.nextPh)) + " · ");
      if (info.next === e.s.day + 1) {
        const at = out.indexOf("<b>长夜</b>下一个在第"),
          end = at >= 0 ? out.indexOf("</p>", at) : -1;
        if (end > 0) out = out.slice(0, end + 4) + `<small>${esc(ruleLine(e, info.nextPh, info.next))}</small>` + out.slice(end + 4);
      }
    }
  }
  // 守住几个那一行：见过几种夜相，按钮打开战报（下面有夜相和守夜笔记）
  const tail = `<div class="far-row muted nf-row"><p><b>夜相</b>见过 ${info.seen}/${PHASE_IDS.length} 种 · 守住过 ${info.heldKinds}/${PHASE_IDS.length} 种${info.notes.length ? " · 守夜笔记 " + info.notes.length + " 页" : ""}</p><small>每个长夜一种夜相，按时节轮换；前一天的早间广播会说。</small>${e.ln?.last ? "" : button("oView", "lnight", "夜相与守夜笔记")}</div>`;
  const strip = out.indexOf('<section class="far-strip ln-strip"');
  if (strip >= 0) {
    const end = out.indexOf("</section>", strip);
    if (end > 0) out = out.slice(0, end) + tail + out.slice(end);
  }
  return out;
}
function ruleLine(e, ph, day) {
  const P = PHASES[ph],
    hint = e.nfHintLine?.(ph) || "";
  return P.name + "：" + (e.nfRule?.(ph, day) || P.rule) + (hint ? " " + hint : "");
}

// ================= 长夜战报 =================
export function patchNfReport(e, html) {
  if (!e?.nf || typeof html !== "string") return html;
  const info = e.nfInfo?.();
  if (!info) return html;
  let out = html;
  const r = e.ln?.last,
    ph = r ? e.nfPhase?.(r.day) : null;
  if (r && ph) {
    out = out.replace(/<h3>第 (\d+) 个长夜 · /, "<h3>第 $1 个长夜 · " + esc(phaseName(ph)) + " · ");
    if (!r.held) {
      const line = `<p class="nf-note">守夜笔记记下了：${esc(PHASES[ph].hint)}</p>`,
        at = out.indexOf("</dl>");
      out = at > 0 ? out.slice(0, at + 5) + line + out.slice(at + 5) : out + line;
    }
  }
  return out + phaseSection(e, info);
}
function phaseSection(e, info) {
  const day = e.s.day,
    when = (d) => (d === day ? "今晚" : d === day + 1 ? "明晚" : "第 " + d + " 天");
  const next = info.tonight
    ? `<p><b>今晚：${esc(phaseName(info.tonight))}</b> · ${esc(e.nfRule(info.tonight, e.ln?.night?.day || day))}</p>`
    : info.next && info.nextPh
      ? `<p><b>下一个长夜（${esc(when(info.next))}）：${esc(phaseName(info.nextPh))}</b> · ${esc(info.nextRule)}</p>`
      : "";
  const rows = info.rows
    .map((x) => {
      const res = x.seen ? (x.held || x.lost ? "守住 " + x.held + " · 没守住 " + x.lost : "碰上过") : "还没碰上";
      return `<li class="${x.held ? "done" : ""}"><b>${esc(x.name)}</b><span class="nf-season">${esc(SEASON_NAMES[x.season] || "")}</span><span>${esc(res)}</span><small>${esc(x.short)}${x.keep ? " · 纪念物「" + esc(ITEMS[x.keep]?.name || "") + "」" : ""}${x.hint ? "<br>记下了：" + esc(x.hint) : ""}</small></li>`;
    })
    .join("");
  const notes = info.notes.length
    ? `<h4>守夜笔记</h4><ul class="ledger nf-notes">${info.notes
        .map((n) => `<li>第 ${n.n} 个长夜（第 ${n.day} 天）${n.phase ? " · " + esc(phaseName(n.phase)) : ""} · 打到第 ${n.wave}/3 波，打倒 ${n.kills} 只</li>`)
        .join("")}</ul>`
    : `<p class="muted">守夜笔记还是空的：没守住的晚上会记一页，第二天早上营地里有人跟你说说。</p>`;
  return `<section class="td-card nf-phases"><h3>夜相 · 见过 ${info.seen}/${PHASE_IDS.length} · 守住过 ${info.heldKinds}/${PHASE_IDS.length}</h3>${next}<p class="muted">按时节轮换：回暖是雾夜、春雷夜，酷暑是满月夜、闷热夜，秋收是迁徙夜、大风夜，寒潮是冰夜、雪夜（单数年第一样，双数年第二样）。每样改的是哪种布置吃香，不是一律更难。</p><ul class="collection nf-list">${rows}</ul>${notes}</section>`;
}

// ================= 节庆日历 =================
export function patchNfCalendar(e, html) {
  if (!e?.nf || !e.ln?.storyDay || typeof html !== "string") return html;
  let out = html;
  for (let d = e.s.day; d < e.s.day + 14; d++) {
    const ph = e.nfPhase?.(d);
    if (!ph) continue;
    const mark = "<b>第" + d + "天</b>",
      at = out.indexOf(mark);
    if (at < 0) continue;
    const tag = '<span class="tag danger">长夜</span>',
      t = out.indexOf(tag, at);
    if (t > 0 && t - at < mark.length + 200) out = out.slice(0, t) + '<span class="tag danger">长夜 · ' + esc(phaseName(ph)) + "</span>" + out.slice(t + tag.length);
  }
  return out;
}

// ================= 成就册 =================
export function patchNfCollection(e, html) {
  if (!e?.nf || !e.ln?.storyDay || typeof html !== "string") return html;
  const info = e.nfInfo?.();
  if (!info) return html;
  const n = PHASE_IDS.length,
    seenNames = info.rows.filter((x) => x.seen).map((x) => x.name),
    heldNames = info.rows.filter((x) => x.held).map((x) => x.name);
  const li = (label, have, small, done) => `<li class="${done ? "done" : ""}"><b>${esc(label)}</b><span class="bar"><i style="width:${Math.round((have / n) * 100)}%"></i></span><span>${have}/${n}</span><small>${small}</small></li>`;
  const rows =
    li("见过的夜相", info.seen, esc(seenNames.length ? seenNames.join("、") : "主线打完以后，每个长夜一种夜相；两年见全八种"), info.seen >= n) +
    li("守住过的夜相", info.heldKinds, esc(heldNames.length ? "✓ " + heldNames.join("、") : "每种夜相都守住一次"), info.heldKinds >= n);
  const start = html.indexOf('<ul class="collection">'),
    at = start >= 0 ? html.indexOf("</ul>", start) : -1;
  return at > 0 ? html.slice(0, at) + rows + html.slice(at) : html + `<ul class="collection">${rows}</ul>`;
}

// ================= 大事卡片的小图 =================
addMomentIcons(
  {
    // 夜相：一弯月亮挂在云上；守夜笔记：一本翻开的本子
    nfPhase: ["......aaa...", ".....abba...", "....abb.....", "....ab......", "....abb.....", ".....abba...", "..cc..aaa...", ".cccc.......", "cccccccc....", ".cccccccccc.", "..cccccccc..", "............"],
    nfLost: ["............", ".aaaa..aaaa.", "abbbbaabbbba", "abccbaabccba", "abbbbaabbbba", "abccbaabccba", "abbbbaabbbba", "abccbaabccba", "abbbbaabbbba", ".aaaaaaaaaa.", ".....aa.....", "............"],
  },
  {
    nfPhase: ["#1f2a46", "#cdd9d8", "#566a96"],
    nfLost: ["#3a2a1a", "#e9dcc0", "#8d6340"],
  },
);
