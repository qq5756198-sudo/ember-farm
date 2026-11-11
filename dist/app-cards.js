// v0.50 新界面：标题页、过场、小卡（农舍、田、设施、今天的事、援建物资、这一趟、倒下、早报、确认）。
// 每个函数只管把字排出来；按钮上写 data-act，真正改东西的在 cardAct 里调引擎。
import { ITEMS, CROPS, BUILDINGS, REGIONS } from "./data.js";
import { ORIGINS } from "./longnight-data.js";
import { SUPPLY, bundleText } from "./alliance-data.js";
import { BCARD } from "./simple-data.js";
import { EVENTS, CATS, optionModel, cheng } from "./daily-model.js";
import { INTRO, INTRO_ORIGIN, CH1_END, CH1_AFTER, GATE1 } from "./chapter-data.js";
import { personSprite, lookFor, PLAYER_LOOK } from "./pixel-sprites.js";
import { GAME_RELEASE } from "./version.js";
import { esc, svg, itemIcon, portrait, buildArt, costTags, itemName, fmt } from "./app-kit.js";

// ================= 标题页 =================
export function titleHtml(G) {
  const info = G.saveInfo;
  return `<div class="title">
    <div class="motto">末日之后 · 仍有新生</div>
    <div class="name">余烬农场</div>
    <p class="copy">城市已经沉寂，农舍前的土地却还活着。<br>种下口粮，接回失散的人，守住第一个夜晚。</p>
    <div class="menu">
      <button class="btn primary" data-act="continue" ${info ? "" : "disabled"}><span>继续</span><small>${info ? esc("第 " + info.day + " 天 · " + info.label) : "还没有存档"}</small></button>
      <button class="btn" data-act="newgame"><span>新开一局</span><small>${info ? "会盖掉现在的存档" : "从一间破农舍开始"}</small></button>
      <button class="btn" data-act="page" data-id="settings"><span>设置</span><small>声音、存档、按键</small></button>
      <button class="btn" data-act="credits"><span>制作人员</span><small></small></button>
    </div>
    ${G.saveIssue ? `<p class="why">${esc(G.saveIssue)}</p>` : ""}
    <div class="foot">${esc(GAME_RELEASE)} · 这一版能玩到第一章结尾 · 每 20 秒自动存档</div>
  </div>`;
}

// ================= 选出身 =================
export function originHtml(G) {
  const sel = G.ui.origin || "farmer";
  return `<div class="cut" style="width:1100px">
    <div><div class="small amber">新开一局</div><h1 class="h1" style="font-size:36px;line-height:44px">你是谁？</h1><p class="mut">选一个来路。带的东西不一样，擅长的也不一样；之后改不了。</p></div>
    <div class="origins">${Object.entries(ORIGINS)
      .map(
        ([id, o]) =>
          `<button class="origin${id === sel ? " on" : ""}" data-act="origin" data-id="${id}" aria-pressed="${id === sel}"><b>${esc(o.name)}</b><small>${esc(o.line)}</small><span class="small" style="margin-top:auto"><span class="mut">带着：</span>${esc(o.kit)}</span><span class="small good">${o.good === "无" ? "没有特别的长处" : esc(o.good)}</span><span class="small bad">${o.cost === "无" ? "没有特别的短处" : esc(o.cost)}</span></button>`,
      )
      .join("")}</div>
    <div class="nav"><button class="btn ghost" data-act="totitle">返回</button>${G.saveInfo ? `<span class="why">开始以后，现在的存档（第 ${G.saveInfo.day} 天）会被盖掉。先在设置里导出一份更稳妥。</span>` : "<span></span>"}<button class="btn primary" data-act="begin" style="width:220px">就这样，开始</button></div>
  </div>`;
}

// ================= 过场 =================
function sceneSlides(G, id) {
  if (id === "intro") {
    const origin = G.e.ln?.origin || G.e.s.longnight?.origin || "farmer";
    return INTRO.map((s) => (s.art === "origin" ? { ...s, text: INTRO_ORIGIN[origin] || INTRO_ORIGIN.farmer } : s));
  }
  if (id === "ch1end") {
    const st = G.e.chEndStats(),
      fill = (t) => t.replace("{days}", st.days).replace("{harvest}", st.harvest).replace("{kills}", st.kills);
    return [...CH1_END.map((s) => ({ ...s, text: fill(s.text), art: s.who ? "who:" + s.who : "farm" })), { who: "", art: "farm", text: CH1_AFTER }];
  }
  return [];
}
export function cutHtml(G) {
  const slides = sceneSlides(G, G.ui.scene),
    i = Math.min(G.ui.slide || 0, slides.length - 1),
    s = slides[i] || { text: "" },
    last = i >= slides.length - 1,
    head = G.ui.scene === "intro" ? "第一章 · 落脚" : "第一章 · 落脚 · 完";
  return `<div class="cut">
    <div class="between"><span class="small amber">${head}</span><button class="btn ghost small" data-act="cutskip">跳过</button></div>
    <div class="art"><canvas id="cut-art" width="190" height="65" data-art="${esc(s.art || "farm")}"></canvas></div>
    <p class="say">${esc(s.text)}</p>
    <div class="nav"><div class="dots" aria-label="${i + 1}/${slides.length}">${slides.map((_, k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</div><button class="btn primary" data-act="cutnext" style="width:200px">${last ? (G.ui.scene === "intro" ? "开始" : "回到农场") : "继续"}<kbd style="margin-left:6px;border-color:#1b1407;color:#1b1407">空格</kbd></button></div>
  </div>`;
}
export const cutCount = (G) => sceneSlides(G, G.ui.scene).length;
// 过场的小图：190×65 的像素画，放大四倍。城里、公路、你、终端各一张；农场那张直接取画面。
export function drawCutArt(el, G) {
  if (!el) return;
  const c = el.getContext("2d"),
    W = el.width,
    H = el.height,
    art = el.dataset.art || "farm";
  c.imageSmoothingEnabled = false;
  const px = (x, y, w, h, col) => {
    c.fillStyle = col;
    c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const sky = (top, bot) => {
    for (let y = 0; y < H; y++) {
      const t = y / H;
      px(0, y, W, 1, `rgb(${Math.round(top[0] + (bot[0] - top[0]) * t)},${Math.round(top[1] + (bot[1] - top[1]) * t)},${Math.round(top[2] + (bot[2] - top[2]) * t)})`);
    }
  };
  if (art === "city") {
    sky([14, 20, 30], [38, 44, 52]);
    px(150, 8, 7, 7, "#c9c5b4");
    px(152, 8, 5, 2, "#aaa694");
    for (let x = 0; x < W; ) {
      const w = 8 + Math.floor(rnd() * 14),
        h = 14 + Math.floor(rnd() * 34);
      px(x, H - 8 - h, w, h, rnd() > 0.5 ? "#161b21" : "#1b2128");
      for (let wy = H - 8 - h + 3; wy < H - 12; wy += 5) for (let wx = x + 2; wx < x + w - 2; wx += 4) if (rnd() > 0.82) px(wx, wy, 2, 2, "#2c343c");
      x += w + 1;
    }
    px(0, H - 8, W, 8, "#101418");
    for (let x = 6; x < W; x += 22) px(x, H - 5, 9, 1, "#3a424a");
  } else if (art === "road") {
    sky([58, 74, 70], [150, 140, 104]);
    px(0, 40, W, 25, "#39502f");
    c.fillStyle = "#4a443a";
    c.beginPath();
    c.moveTo(70, 65);
    c.lineTo(120, 65);
    c.lineTo(99, 40);
    c.lineTo(91, 40);
    c.fill();
    for (let i = 0; i < 26; i++) {
      const side = i % 2,
        x = side ? 104 + rnd() * 84 : rnd() * 86,
        y = 30 + rnd() * 22,
        h = 10 + rnd() * 14;
      px(x, y - h, 1, h, "#2a2118");
      for (let k = 0; k < 4; k++) px(x - (4 - k), y - h + k * 3 - 2, (4 - k) * 2 + 1, 3, k % 2 ? "#1f3a2a" : "#27482f");
    }
    const sp = personSprite(PLAYER_LOOK, "player", "up", 0, "stand");
    c.drawImage(sp, 84, 30);
  } else if (art === "origin" || art.startsWith("who:")) {
    sky([24, 30, 34], [44, 52, 48]);
    px(0, 52, W, 13, "#2c3a2a");
    const who = art.startsWith("who:") ? art.slice(4) : "player";
    let sp;
    if (who === "player") sp = personSprite(PLAYER_LOOK, "player", "down", 0, "stand");
    else if (who === "tieqiao") sp = personSprite(lookFor("tieqiao", "helper"), "helper:tieqiao", "down", 0, "stand");
    else {
      const r = G.e.resident?.(who);
      sp = personSprite(lookFor(who, r?.workRole || r?.role || null), who, "down", 0, "stand");
    }
    px(70, 50, 50, 4, "rgba(0,0,0,0.3)");
    c.drawImage(sp, 0, 0, sp.width, sp.height, 95 - sp.width, 56 - sp.height * 2 + 4, sp.width * 2, sp.height * 2);
    // 身后一堆营火
    px(134, 46, 10, 4, "#3a3029");
    px(136, 40, 6, 6, "#f2a93b");
    px(137, 37, 3, 4, "#ffd27a");
  } else if (art === "terminal") {
    px(0, 0, W, H, "#0e1114");
    px(60, 12, 70, 40, "#1c2228");
    px(64, 16, 62, 30, "#0d1a14");
    for (let i = 0; i < 4; i++) px(68, 20 + i * 6, [40, 52, 30, 46][i], 2, i === 3 ? "#f2a93b" : "#3f8f66");
    px(112, 38, 3, 4, "#f2a93b");
    px(84, 52, 22, 4, "#262d34");
    px(40, 58, 110, 7, "#1a1410");
    c.fillStyle = "rgba(63,143,102,0.08)";
    c.fillRect(30, 4, 130, 56);
  } else {
    const src = G.renderer?.canvas;
    if (src && src.width) {
      const sw = src.width,
        sh = src.height,
        k = Math.min(sw / W, sh / H);
      c.imageSmoothingEnabled = true;
      c.drawImage(src, (sw - W * k) / 2, (sh - H * k) / 2, W * k, H * k, 0, 0, W, H);
    } else px(0, 0, W, H, "#1b2a24");
  }
}

// ================= 小卡 =================
const cardHead = (title, sub = "", right = "") => `<div class="between"><div><h2 class="h1">${esc(title)}</h2>${sub ? `<p class="small mut">${esc(sub)}</p>` : ""}</div>${right || `<button class="esc" data-act="close"><kbd>Esc</kbd>返回</button>`}</div>`;

function homeCard(G) {
  const e = G.e,
    s = e.s,
    busy = s.horde.phase === "active",
    gate = e.chGateTonight?.(),
    night = e.isNight?.(),
    dry = s.plots.filter((p) => p.crop && !e.chRipe(p) && !e.plotWatered(p)).length,
    days = e.foodDays?.() ?? 0;
  const notes = [];
  if (busy) notes.push(["bad", "尸潮正在进攻，守完再睡"]);
  else if (gate) notes.push(["bad", "今晚有尸潮，守完再睡"]);
  if (dry) notes.push(["amber", dry + " 块田今天还没浇水"]);
  if (days < 1 && (e.eaters?.() || []).length) notes.push(["bad", "口粮不够明天吃：有人会饿着干活"]);
  if (s.player.hunger < 35) notes.push(["amber", "你饿了：睡前吃点东西，不然会饿醒"]);
  return `${cardHead("农舍", "睡一觉回满体力，回一部分生命；睡着的时候钟照走")}
    <div class="row" style="flex-wrap:wrap">${notes.map(([t, x]) => `<span class="tag ${t}">${esc(x)}</span>`).join("") || `<span class="tag good">可以睡了</span>`}</div>
    <div class="btn-row"><button class="btn primary grow" data-act="sleep" ${busy || gate ? "disabled" : ""}>睡到明早</button><button class="btn" data-act="nap" ${night || busy || s.horde.phase === "warning" ? "disabled" : ""}>歇到天黑（19:00）</button></div>`;
}

function plotCard(G) {
  const e = G.e,
    p = e.plotById?.(G.ui.id);
  if (!p) return cardHead("这块田") + `<p class="mut">这块田不在这里。</p>`;
  if (!p.crop) {
    const why = e.pickReason?.(p),
      opts = why ? [] : e.seedOptions(p);
    return `${cardHead("种点什么？", "今天" + (e.s.weather || "") + " · 点一种种子，或者按数字键")}
      ${why ? `<p class="why">${esc(why)}</p>` : ""}
      <div class="opts">${
        opts
          .map((o, i) => {
            const hours = e.growHours(p, o.crop, null),
              c = CROPS[o.crop],
              season = e.seasonKind?.(o.crop);
            return `<button class="opt" data-act="plant" data-id="${esc(p.id + "|" + o.id)}" data-key="${i + 1}"><span class="no">${i + 1}</span>${itemIcon(o.id, 40)}<span class="grow"><b>${esc(ITEMS[o.id].name)}</b><span class="kv" style="display:block">身上 <i>${o.bag}</i>${o.box ? " · 仓库 <i>" + o.box + "</i>" : ""} · 约 <i>${hours}</i> 游戏小时熟 · 一块收 <i>${c?.yield ?? 1}</i> 份</span></span>${season === "good" ? `<span class="tag good">当季</span>` : season === "bad" ? `<span class="tag bad">不当季</span>` : ""}</button>`;
          })
          .join("") || (why ? "" : `<div class="empty">身上和仓库里都没有种子。集市的林姨卖种子，居民区的柜子里也翻得到。</div>`)
      }</div>
      <p class="small mut">种下以后天天浇上水，收的时候有机会多出一份优质；漏浇一天，这一茬就不出优质了。</p>`;
  }
  const c = CROPS[p.crop],
    ripe = e.chRipe(p),
    watered = e.plotWatered(p),
    hours = e.hoursLeft?.(p) ?? 0,
    pct = Math.round(Math.min(1, p.growth / c.grow) * 100);
  return `${cardHead(c.name, ripe ? "熟了，可以收" : "还要约 " + hours + " 游戏小时")}
    <span class="bar"><i style="width:${pct}%"></i></span>
    <div class="row" style="flex-wrap:wrap"><span class="tag ${watered ? "good" : "bad"}">${watered ? "今天浇过水了" : "今天还没浇水"}</span><span class="tag">长了 ${pct}%</span></div>
    <div class="btn-row">${ripe ? `<button class="btn primary grow" data-act="harvest" data-id="${p.id}">收下</button>` : `<button class="btn primary grow" data-act="water" data-id="${p.id}" ${watered ? "disabled" : ""}>${watered ? "浇过了" : "浇水"}</button>`}</div>`;
}

function buildingCard(G) {
  const e = G.e,
    b = e.s.buildings.find((x) => x.id === G.ui.id);
  if (!b) return cardHead("设施") + `<p class="mut">这样设施已经不在了。</p>`;
  const d = BUILDINGS[b.type],
    c = BCARD[b.type] || [d.desc, ""],
    hurt = b.hp < d.hp,
    station = ["cook", "workbench", "weaponbench", "breeder"].includes(b.type);
  return `${cardHead(d.name, c[0])}
    <div class="row"><div class="card" style="padding:6px;background:#223026">${buildArt(b.type, 120, 72)}</div><div class="col grow">${c[1] ? `<p class="small">${esc(c[1])}</p>` : ""}<div class="between small"><span class="mut">耐久</span><span class="${hurt ? "bad" : ""}">${Math.ceil(b.hp)} / ${d.hp}</span></div><span class="bar"><i style="width:${Math.round((b.hp / d.hp) * 100)}%;background:${hurt ? "var(--bad)" : "var(--good)"}"></i></span></div></div>
    ${G.ui.confirm ? `<p class="why">拆掉退一半材料。真的拆？</p><div class="btn-row"><button class="btn danger grow" data-act="dismantle" data-id="${esc(b.id)}">拆掉它</button><button class="btn grow" data-act="nodismantle">不拆了</button></div>` : `<div class="btn-row">${station ? `<button class="btn primary grow" data-act="tostation" data-id="${esc(b.type)}">在这儿做东西</button>` : ""}${b.type === "chest" ? `<button class="btn primary grow" data-act="page" data-id="store">打开仓库</button>` : ""}<button class="btn" data-act="repair" data-id="${esc(b.id)}" ${hurt ? "" : "disabled"}>${hurt ? "修好" : "没坏"}</button><button class="btn danger" data-act="askdismantle">拆掉</button></div>`}`;
}

const cleanGain = (t) =>
  String(t || "")
    .split("；")
    .filter((x) => !/肥力|疲劳|手气|动静/.test(x))
    .join("；") || "没有别的";
function eventCard(G) {
  const e = G.e,
    r = G.ui.result;
  if (r) {
    const ev = EVENTS[r.event],
      o = ev.opts[r.choice];
    return `${cardHead(ev.name, "你选了：" + o.label, "<span></span>")}
      <div class="col">${(r.lines || []).map((l) => `<p>${esc(cleanGain(l))}</p>`).join("") || "<p>没发生别的。</p>"}</div>
      ${r.win === null || r.win === undefined ? "" : `<span class="tag ${r.win ? "good" : "bad"}" style="align-self:flex-start">${r.win ? "成了" : "落空了"}</span>`}
      <button class="btn primary" data-act="close">知道了</button>`;
  }
  const p = e.dailyCard?.();
  if (!p) return `${cardHead("今天的事")}<p class="mut">今天的事已经定了。明天清晨还会有新的一件。</p>`;
  const ev = EVENTS[p.id],
    later = e.dailyLaterReason?.() ?? "x";
  return `${cardHead(ev.name, "今天的事 · 第 " + e.s.day + " 天 · " + (CATS[ev.cat]?.name || ""), later === "" ? `<button class="btn small" data-act="later">先放着（中午前选）</button>` : "<span></span>")}
    <p style="font-size:16px">${esc(ev.text)}</p>
    <div class="opts">${ev.opts
      .map((o, i) => {
        const m = optionModel(e, p, i),
          won = m.risk ? Math.round(m.risk.chance * 10) : 0;
        return `<button class="opt" data-act="choose" data-id="${i}" data-key="${i + 1}" ${m.reason ? "disabled" : ""}><span class="no">${i + 1}</span><span class="grow"><b>${esc(m.label)}</b><span class="kv" style="display:block">花费 <i>${esc(m.costText || "不花")}</i></span><span class="kv" style="display:block">${m.risk ? esc(cheng(m.risk.chance)) + "机会" + `<span class="chance" aria-hidden="true">${"<i class='w'></i>".repeat(won)}${"<i></i>".repeat(10 - won)}</span> ` : "得到 "}<i>${esc(cleanGain(m.gain))}</i></span>${m.risk ? `<span class="kv" style="display:block">落空 <i>${esc(cleanGain(m.risk.lose))}</i></span>` : ""}${m.follow ? `<span class="kv" style="display:block">${esc(m.follow)}</span>` : ""}${m.reason ? `<span class="why" style="display:block">${esc(m.reason)}</span>` : ""}</span></button>`;
      })
      .join("")}</div>`;
}

function supplyCard(G) {
  const e = G.e;
  return `${cardHead("第一批援建物资", "联络站顺路捎一包，只能选一种")}
    <div class="opts">${Object.entries(SUPPLY)
      .map(([id, s], i) => `<button class="opt" data-act="supply" data-id="${id}" data-key="${i + 1}"><span class="no">${i + 1}</span><span class="grow"><b>${esc(s.name)}</b><span class="kv" style="display:block">里面有 <i>${esc(bundleText(s.items))}</i></span><span class="kv" style="display:block">${esc(s.desc)}</span></span></button>`)
      .join("")}</div>`;
}

function boonCard(G) {
  const list = G.e.chTripOffer();
  return `${cardHead("这一趟", "翻到头一样东西，心里有了底。挑一样，只管这一趟", "<span></span>")}
    <div class="opts">${list.map((b, i) => `<button class="opt" data-act="boon" data-id="${b.id}" data-key="${i + 1}"><span class="no">${i + 1}</span><span class="grow"><b>${esc(b.name)}</b><span class="kv" style="display:block"><i>${esc(b.text)}</i></span></span></button>`).join("")}</div>`;
}

function deathCard(G) {
  const e = G.e,
    hunger = e.lastDeath === "hunger";
  return `${cardHead(hunger ? "你饿晕了" : "有人把你送回了家", "", "<span></span>")}
    <p>${hunger ? "你在农舍里醒来，金币少了一些。先把肚子填饱：吃一份干粮，或者把萝卜做成干粮。" : "你在农舍里醒来。工具和种子都还在；这一趟翻到的普通材料掉在了原地，地图上标着，可以回去捡。金币少了 5%。"}</p>
    <div class="row" style="flex-wrap:wrap"><span class="tag">生命回到 ${Math.ceil(e.s.player.hp)}</span>${e.gr ? `<span class="tag amber">身上的装备各磨损了四分之一</span>` : ""}</div>
    <button class="btn primary" data-act="close">起来</button>`;
}

function reportCard(G) {
  const e = G.e,
    r = e.o?.report,
    sign = (n) => (n > 0 ? "+" + n : String(n));
  if (!r) return `${cardHead("早报")}<p class="mut">睡过一觉才有早报。</p>`;
  const lines = (e.o.log || []).filter((l) => l.day === r.day || l.day === e.s.day).slice(0, 6);
  return `${cardHead("早报", "第 " + r.day + " 天过去了")}
    <div class="row" style="flex-wrap:wrap"><span class="tag ${r.money < 0 ? "bad" : "good"}">金 ${sign(r.money)}</span><span class="tag">收了 ${r.harvested} 株</span><span class="tag">打退 ${r.kills} 只</span><span class="tag ${r.foodEnd < r.foodStart ? "amber" : "good"}">口粮 ${r.foodStart} → ${r.foodEnd} 份</span></div>
    <div class="log scroll" style="max-height:220px">${lines.map((l) => `<p class="${l.tone || ""}"><span>${esc(e.chSay(l.text) ?? "")}</span></p>`).join("")}</div>
    <button class="btn primary" data-act="close">开始这一天</button>`;
}

function confirmCard(G) {
  const k = G.ui.kind;
  if (k === "totitle") return `${cardHead("回到标题页", "现在的进度会先存好")}<div class="btn-row"><button class="btn primary grow" data-act="dototitle">存好，回标题页</button><button class="btn grow" data-act="close">接着玩</button></div>`;
  if (k === "import") return `${cardHead("读进这份存档？", "第 " + G.ui.state.day + " 天 · " + (REGIONS[G.ui.state.region]?.name || ""))}<p class="why">现在的存档会被盖掉。</p><div class="btn-row"><button class="btn primary grow" data-act="doimport">读进来</button><button class="btn grow" data-act="close">算了</button></div>`;
  if (k === "credits") return `${cardHead("制作人员")}<div class="col"><p>项目创作与方向 · Link</p><p>程序、系统与界面协作 · OpenAI Codex、Claude</p><p>像素字体 · Fusion Pixel（TakWolf，SIL OFL 1.1）</p><p class="mut">感谢每一位在这片土地上播种、探索与守望的人。</p><p class="small mut">${esc(GAME_RELEASE)}</p></div>`;
  if (k === "savefail") return `${cardHead("存不进去了")}<p class="why">浏览器这一次没存上。先导出一份存档放在电脑里。</p><div class="btn-row"><button class="btn primary grow" data-act="export">导出存档</button><button class="btn grow" data-act="close">知道了</button></div>`;
  return cardHead("");
}

function momentCard(G) {
  const m = G.ui.moment || {};
  return `${cardHead(m.title || "", "", "<span></span>")}<div class="col">${(m.lines || []).map((l) => `<p>${esc(l)}</p>`).join("")}</div><button class="btn primary" data-act="close">好</button>`;
}

function pickCard(G) {
  const list = G.e._pickList || [];
  return `${cardHead("这儿有几样东西", "要动哪一样？")}<div class="opts">${list.map((o, i) => `<button class="opt" data-act="pick" data-id="${i}" data-key="${i + 1}"><span class="no">${i + 1}</span><span class="grow"><b>${esc(o.name || "这一样")}</b></span></button>`).join("")}</div>`;
}

const CARDS = { pick: pickCard, home: homeCard, plot: plotCard, building: buildingCard, event: eventCard, supply: supplyCard, boon: boonCard, death: deathCard, report: reportCard, confirm: confirmCard, moment: momentCard };
export const cardHtml = (G, name) => (CARDS[name] ? CARDS[name](G) : "");
// 这几张卡不能用 Esc 关掉：得选一样
export const cardLocked = (G, name) => (name === "boon" && G.e.chTripOffer().length > 0) || (name === "event" && !G.ui.result && !!G.e.dailyCard?.() && G.e.s.minute >= 360 && !G.e.dailyDeferred?.());

// ================= 按了以后 =================
export function cardAct(G, act, id, el) {
  const e = G.e;
  switch (act) {
    case "sleep":
      if (e.sleep()) {
        G.close();
        G.save();
      } else G.refresh();
      return true;
    case "nap":
      if (e.waitUntilNight?.()) {
        G.close();
        G.save();
      } else G.refresh();
      return true;
    case "plant": {
      const [pid, seed] = id.split("|");
      if (e.plantSeed(pid, seed)) {
        G.close();
        G.save();
      } else G.refresh();
      return true;
    }
    case "harvest": {
      const p = e.plotById(id);
      if (p && (e.fromMenu ? e.fromMenu(() => e.handHarvest(p)) : e.handHarvest(p))) G.close();
      else G.refresh();
      return true;
    }
    case "water": {
      const p = e.plotById(id);
      if (p) e.waterFromCard ? e.waterFromCard(p) : e.toolPlot(p, "water");
      G.refresh();
      return true;
    }
    case "repair":
      e.repair(id);
      G.refresh();
      G.save();
      return true;
    case "askdismantle":
      G.ui.confirm = true;
      G.refresh();
      return true;
    case "nodismantle":
      G.ui.confirm = false;
      G.refresh();
      return true;
    case "dismantle":
      e.dismantle(id);
      G.close();
      G.save();
      return true;
    case "tostation":
      G.open("page", "store", { tab: "make", station: id });
      return true;
    case "choose": {
      const r = e.chooseDaily(Number(id));
      if (r) G.ui.result = r;
      G.refresh();
      G.save();
      return true;
    }
    case "later":
      if (e.dailyLater?.()) G.close();
      else G.refresh();
      return true;
    case "supply":
      if (e.chooseSupply(id)) {
        G.close();
        G.save();
      } else G.refresh();
      return true;
    case "pick":
      G.close();
      e.pick?.(Number(id));
      return true;
    case "boon":
      if (e.chPickBoon(id)) {
        G.close();
        G.save();
      } else G.refresh();
      return true;
  }
  return false;
}
