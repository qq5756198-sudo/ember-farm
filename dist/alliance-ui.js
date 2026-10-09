// 任务手记的统一入口：联盟故事与家园主线都用“发生了什么 / 现在做什么 / 完成后获得什么”三行说明。
import { renderJournal, goalCard, recipeCard } from "./guidance-ui.js";
import { guideGoal, mainAction, suggestions } from "./guidance-data.js";
import { firstHarvestStep } from "./player-journey.js";
import { REGIONS } from "./data.js";
import { PILLARS } from "./rebuild-data.js";
import { LETTERS, SUPPLY, TASK_CONTEXT, bundleText, letterText, letterTitle, taskGain } from "./alliance-data.js";

const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const button = (a, id, label, extra = "") =>
  `<button data-action="${a}" data-id="${esc(id)}"${extra ? " " + extra : ""}>${esc(label)}</button>`;
const STORY_TASKS = ["harvest", "meal", "farmer", "table"];
// 后果预览：花费 / 得到 / 影响，所有新动作统一使用。
export const consequence = (p) =>
  p
    ? `<dl class="consequence"><div><dt>花费</dt><dd>${esc(p.cost || "—")}</dd></div><div><dt>得到</dt><dd>${esc(p.gain || "—")}</dd></div><div><dt>影响</dt><dd>${esc(p.effect || "—")}</dd></div></dl>`
    : "";
// 小柒的终端头像：12×12 像素，随联络信出现，不占用场景。
const XIAOQI = `<svg class="xiaoqi" viewBox="0 0 12 12" aria-hidden="true" shape-rendering="crispEdges"><rect width="12" height="12" fill="#22352b"/><rect x="1" y="1" width="10" height="8" fill="#5f7f6e"/><rect x="2" y="2" width="8" height="6" fill="#9fd3b0"/><rect x="3" y="4" width="2" height="2" fill="#22352b"/><rect x="7" y="4" width="2" height="2" fill="#22352b"/><rect x="4" y="7" width="4" height="1" fill="#22352b"/><rect x="5" y="9" width="2" height="2" fill="#5f7f6e"/><rect x="2" y="10" width="8" height="1" fill="#a99a62"/><rect x="10" y="0" width="2" height="2" fill="#e9c05a"/></svg>`;

function mainLabel(action) {
  if (["field", "route"].includes(action.kind)) return "标记地点";
  if (action.kind === "recipe") return "准备物资";
  return action.label;
}
const lines = (happened, now, gain, avatar = "") =>
  `<dl class="story-lines"><div class="story-line"><dt>发生了什么</dt><dd>${avatar}<span>${happened}</span></dd></div><div class="story-line now"><dt>现在做什么</dt><dd>${now}</dd></div><div class="story-line"><dt>完成后获得什么</dt><dd>${gain}</dd></div></dl>`;

function storyButtons(e, g, action) {
  const st = g.step,
    map = button("aOpen", "", "查看地图");
  if (st.kind === "main")
    return (
      button("gMainAction", "", mainLabel(action)) +
      (st.target && !["field", "route"].includes(action.kind) ? button("aStoryMark", "", "标记地点") : "") +
      map
    );
  if (st.kind === "do") return button("aStoryDo", st.id, st.doLabel) + button("aStoryMark", "", "标记地点");
  if (st.kind === "reply") return button("aStoryReply", "", "现在回信") + map;
  if (st.kind === "feed") return button("aStoryFeed", "", "现在供餐") + map;
  if (st.kind === "choose" || st.kind === "wait") return map;
  return button("aStoryMark", "", "标记地点") + map;
}
function storyCard(e, g, action) {
  const st = g.step;
  const pills = g.steps
    .map(
      (s) =>
        `<li class="${s.done ? "done" : s.id === st.id ? "current" : ""}"><span>${s.done ? "✓" : s.id === st.id ? "●" : "○"}</span>${esc(s.label)}</li>`,
    )
    .join("");
  const choice =
    st.kind === "choose" && st.choices
      ? `<div class="story-choice">${st.choices
          .map(
            (c) =>
              `<article><small>${esc(c.pick)}</small><h3>${esc(c.name)}</h3><p>${esc(c.desc)}</p>${consequence(c.preview)}${c.lack?.length ? `<p class="story-lack">${esc(c.lack.join("、"))}</p>` : ""}${button("aStoryChoose", c.id, "就这么办", c.lack?.length ? "disabled" : "")}</article>`,
          )
          .join("")}</div>`
      : st.kind === "choose"
      ? `<div class="story-choice">${Object.entries(SUPPLY)
          .map(
            ([id, p]) =>
              `<article><small>${esc(p.pick)}</small><h3>${esc(p.name)}</h3><p class="story-pack">${esc(bundleText(p.items))}</p><p>${esc(p.desc)}</p>${button("aStoryChoose", id, "要这一包")}</article>`,
          )
          .join("")}</div>`
      : "";
  return `<article class="journal-main story-card"><span class="journal-eyebrow">联盟前哨 · ${g.actLabel}「${esc(g.actName)}」 · ${g.index}/${g.total}</span><h2>${esc(st.title)}</h2><ol class="story-progress" aria-label="本段进度">${pills}</ol>${lines(
    `<b>${esc(g.from)}来信 · 小柒转达：</b>${esc(g.happened)}`,
    esc(st.text),
    esc(st.gain),
    XIAOQI,
  )}${choice}<div class="journal-actions">${storyButtons(e, g, action)}</div></article>`;
}
function taskCard(e, action) {
  const q = e.currentRebuildTask();
  if (!q) return goalCard(e, guideGoal(e));
  const first = firstHarvestStep(e),
    reqs = e.taskRequirements(q.id),
    miss = reqs.find((x) => !x.pass),
    ready = e.taskReady(q.id),
    paid = Object.keys(q.cost).length > 0;
  const nowTitle = first?.title || (ready ? (paid ? "交付补给，确认成果" : "成果已经达成") : miss?.label || q.title);
  const nowText =
    first?.text ||
    (ready
      ? paid
        ? "回到农场确认交付：" + bundleText(q.cost) + "。"
        : e.s.region === "farm"
          ? "农场会自动记录这项进展。"
          : "回到农场就会记录这项进展。"
      : q.desc);
  const letter = e.sc?.act >= 3 && q.id === "signal" ? letterText(e.sc, "act3") : "";
  const happened = letter
    ? `<b>${LETTERS.act3.from}来信 · 小柒转达：</b>${esc(letter)}`
    : esc(TASK_CONTEXT[q.id] || q.desc);
  const index = (e.r.claimed.length % 4) + 1;
  const pills = reqs
    .map(
      (x) =>
        `<li class="${x.pass ? "done" : x === miss ? "current" : ""}"><span>${x.pass ? "✓" : x === miss ? "●" : "○"}</span>${esc(x.label)}</li>`,
    )
    .join("");
  const dest = e.taskDestination(q.id);
  return `<article class="journal-main story-card task-card"><span class="journal-eyebrow">家园计划 · 第${q.chapter + 1}章 · ${index}/4</span><h2>${esc(q.title)}</h2><ol class="story-progress" aria-label="完成条件">${pills}</ol>${lines(
    happened,
    `<b>${esc(nowTitle)}</b> · ${esc(nowText)}`,
    esc(taskGain(q)),
    letter ? XIAOQI : "",
  )}<div class="journal-actions">${button("gMainAction", "", mainLabel(action))}${dest && !["field", "route"].includes(action.kind) ? button("aTaskMark", "", "标记地点") : ""}${button("aOpen", "", "查看地图")}</div></article>`;
}
function optionCards(e, story, ui) {
  const out = [],
    q = e.currentRebuildTask();
  if (story && q && !(story.act <= 2 ? STORY_TASKS.includes(q.id) : story.steps.some((s) => s.id === q.id)) && ui.view !== "task")
    out.push(
      `<article><small>家园主线仍在进行</small><h3>${esc(q.title)}</h3><p>${esc(TASK_CONTEXT[q.id] || q.desc)}</p>${button("aShowTask", "", "查看主线任务")}</article>`,
    );
  if (story && ui.view === "task")
    out.push(
      `<article><small>联盟前哨 · ${story.actLabel}</small><h3>${esc(story.step.title)}</h3><p>${esc(story.step.gain)}</p>${button("aShowStory", "", "回到联盟来信")}</article>`,
    );
  for (const l of suggestions(e)) {
    if (out.length >= 2) break;
    out.push(
      `<article><small>也可以先帮一件小事</small><h3>${esc(l.title)}</h3><p>${esc(l.result)}</p>${button("gFocus", l.id, "看看怎么做")}</article>`,
    );
  }
  return out.join("");
}
function letterArchive(e) {
  const sc = e.sc;
  if (!sc?.letters?.length) return "";
  const letters = [...sc.letters]
    .reverse()
    .map(
      (id) =>
        `<article class="story-letter"><b>${esc(LETTERS[id].from)} · ${esc(letterTitle(sc, id))}</b><p>${esc(letterText(sc, id))}</p></article>`,
    )
    .join("");
  const log = sc.log.length
    ? `<ul class="story-log">${sc.log.map((l) => `<li>第${l.day}天 · ${esc(l.text)}</li>`).join("")}</ul>`
    : "";
  const helpers = sc.helpers
    .map(
      (h) =>
        `<p class="story-helper"><b>援建队员 · ${esc(e.helperName(h.id))}</b>：${esc(h.status)} · 已搬运 ${h.moved} 趟${h.fedDay === e.s.day ? " · 今日已吃工作餐" : ""}</p>`,
    )
    .join("");
  return `<details class="journal-extra story-letters"><summary>联盟来信与前哨记录 · ${sc.letters.length}封</summary>${helpers}${letters}${log}</details>`;
}
export function renderStoryJournal(e, ui = {}) {
  if (ui.catalog || !e.sc) return renderJournal(e, ui);
  const focus = e.guidance?.focus,
    story = focus ? null : e.storyGoal(),
    action = mainAction(e),
    showTask = story && ui.view === "task";
  const main = focus
    ? goalCard(e, guideGoal(e))
    : story && !showTask
      ? storyCard(e, story, action)
      : taskCard(e, action);
  const recipe =
    !focus && action.kind === "recipe" && (!story || showTask || story.step.kind === "main" || story.step.whileWaiting)
      ? recipeCard(e, action.id)
      : "";
  const messages =
    e.bactive().length || e.activeEvents().length
      ? `<details class="journal-extra"><summary>收到的消息 · ${e.bactive().length + e.activeEvents().length}件</summary>${e
          .bactive()
          .map((d) => `<p>${esc(d.name)} ${button("gMessage", "b:" + d.id, "继续这件事")}</p>`)
          .join("")}${e
          .activeEvents()
          .map((d) => `<p>${esc(d.name)} ${button("gMessage", "e:" + d.id, "继续这件事")}</p>`)
          .join("")}</details>`
      : "";
  return `<div class="journal-page"><header class="journal-top"><span>第${e.s.day}天 · ${REGIONS[e.s.region].name}</span>${button("gCatalog", "", "选择其他委托")}</header>${main}${recipe}<div class="journal-options">${optionCards(e, story, ui)}</div>${messages}${letterArchive(e)}<details class="journal-extra"><summary>别的地方</summary><p>营地里的事，走到那个地方按 E 处理；地区和边境有自己的事务页。</p><div class="journal-tools">${button("gDistrict", "", "地区事务")}${button("gBeyond", "", "边境事务")}</div></details></div>`;
}

const ACTIONS = [
  "aStoryMark",
  "aStoryDo",
  "aStoryReply",
  "aStoryChoose",
  "aStoryFeed",
  "aTaskMark",
  "aShowTask",
  "aShowStory",
];
export function handleAllianceAction(action, el, ctx) {
  if (!ACTIONS.includes(action)) return false;
  const { engine: e, ui, showMenu, closeMenu, save, toast } = ctx,
    id = el.dataset.id || "";
  if (!e.sc) return true;
  const journal = () => showMenu("journey");
  const route = (target) => {
    if (!target) {
      toast("这一步不需要去别处，在任务手记里就能完成。");
      return;
    }
    e.guidance.focus = null;
    e.guidance.target = { region: target.region, x: target.x, y: target.y, label: target.label || target.name };
    e.d.track = null;
    e.b.track = null;
    ctx.rebuildUI.target = e.guidance.target;
    if (e.s.region === target.region) {
      closeMenu();
      toast("金色路标：" + e.guidance.target.label + "。走近后按 E。");
    } else showMenu("map", { selected: target.region });
  };
  const g = e.storyGoal();
  if (action === "aStoryMark") {
    route(g?.step.target);
    save();
  } else if (action === "aTaskMark") {
    const q = e.currentRebuildTask();
    route(q ? e.taskDestination(q.id) : null);
    save();
  } else if (action === "aStoryDo") {
    const ok = id === "well" ? e.repairWell() : id === "camp" ? e.buildCamp() : e.doStory ? e.doStory(id) : false;
    if (ok) e.checkStory();
    journal();
    save();
  } else if (action === "aStoryReply") {
    e.replyAlliance();
    journal();
    save();
  } else if (action === "aStoryChoose") {
    if (g?.step.choices && e.chooseStory) e.chooseStory(g.step.id, id);
    else e.chooseSupply(id);
    journal();
    save();
  } else if (action === "aStoryFeed") {
    e.feedFarmer();
    journal();
    save();
  } else if (action === "aShowTask") {
    ui.view = "task";
    journal();
  } else if (action === "aShowStory") {
    ui.view = null;
    journal();
  }
  return true;
}

export function storyHud(e) {
  if (!e.sc || e.guidance?.focus) return null;
  const g = e.storyGoal();
  return g ? { number: g.actLabel + " · " + g.index + "/" + g.total, body: g.step.title } : null;
}
export function storyOpening(e) {
  const g = e.sc ? e.storyGoal() : null;
  if (g && e.sc.unread) return "联盟终端收到来信：" + letterTitle(e.sc, g.letter) + "。打开任务手记（J）查看。";
  if (g) return g.step.title + "：" + g.step.text;
  return firstHarvestStep(e)?.text || "";
}
export function markLettersRead(e) {
  if (e?.sc) e.sc.unread = false;
}
