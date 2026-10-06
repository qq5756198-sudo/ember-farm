import {PILLARS, CHAPTERS} from './rebuild-data.js';

const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain = html => html.replace(/<[^>]*>/g, '').trim();

// Keep existing action markup intact while exposing one section at a time.
// All input is our own static template output, never imported save HTML.
export function splitSections(html) {
  const roots = []; let depth = 0, start = 0;
  const tags = /<\/?([a-z][\w-]*)\b(?:"[^"]*"|'[^']*'|[^'">])*\/?>/gi;
  const voids = new Set(['input','br','hr','img','i-void','meta','link','source','wbr']);
  for (const m of html.matchAll(tags)) {
    const closing = m[0][1] === '/', self = voids.has(m[1].toLowerCase()) || m[0].endsWith('/>');
    if (!closing && depth === 0) start = m.index;
    if (!closing && !self) depth++;
    if (closing) depth--;
    if (depth === 0) roots.push(html.slice(start, m.index + m[0].length));
  }
  return roots.flatMap(raw => {
    const first = raw.match(/^<[^>]+>/)?.[0] || '';
    if (/class="[^"]*\brebuild-grid\b/.test(first)) return splitSections(raw.slice(first.length, raw.lastIndexOf('</')));
    const title = raw.match(/<h[234][^>]*>([\s\S]*?)<\/h[234]>/)?.[1] || raw.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1];
    const fallback = /rebuild-crops/.test(first) ? '作物与用途' : /rebuild-chapters/.test(first) ? '重建章节' : /rebuild-note/.test(first) ? '' : '操作与记录';
    return [{title: title ? plain(title) : fallback, html: raw}];
  });
}

export function renderManagement(e, tab, body, toolBody, h, ui) {
  if(ui.guided){const p=PILLARS.find(p=>p.id===tab);return `<section class="guided-work"><header><div><small>当前任务用到的工作</small><h3>${p?.name||'营地工作'}</h3></div><button data-action="gJournal">返回任务</button></header><p>${p?.purpose||'处理眼前这一步，完成后回任务查看家园的变化。'}</p>${ui.tool?toolBody:body}<button data-action="gJournal">回到任务手记</button></section>`;}
  const pillar = PILLARS.find(p => p.id === tab), tools = pillar?.tools || [];
  const sections = splitSections(body), notes = sections.filter(s => !s.title), panels = sections.filter(s => s.title);
  ui.sections ??= {};
  const chosen = ui.tool ? 'tool:' + ui.tool.menu + ':' + ui.tool.tab : ui.sections[tab] || 'section:0';
  const index = Math.max(0, Math.min(panels.length - 1, Number(chosen.split(':')[1]) || 0));
  const active = ui.tool ? tools.find(t => t[0] === ui.tool.menu && t[1] === ui.tool.tab)?.[2] || '相关操作' : panels[index]?.title || '当前目标';
  const nav = [['overview','当前目标'], ...PILLARS.map(p => [p.id,p.name]), ['events','营地事件']];
  const side = `<nav class="manual-nav" aria-label="营地手册导航"><span class="manual-label">营地手册</span>${nav.map(([id,name],i) => `<button data-action="rTab" data-id="${id}" class="${tab === id ? 'active' : ''}" aria-current="${tab === id ? 'page' : 'false'}"><span class="nav-index">${i === 0 ? '◎' : i === 7 ? '✉' : '◇'}</span>${name}${id === 'events' ? `<small>${(e.activeEvents?.()||[]).length}</small>` : ''}</button>`).join('')}<div class="manual-nav-bottom"><button data-action="bOpen">边境手册</button><button data-menu="inventory">背包 · Tab</button><button data-menu="map">世界地图 · M</button><button data-action="dOpen">地区事务</button><button data-menu="pause">设置与存档</button></div></nav>`;
  const listButton = (key, title, sub) => `<button class="manual-row ${chosen === key || (!ui.tool && key === 'section:' + index) ? 'selected' : ''}" data-action="clSelect" data-id="${esc(key)}" aria-pressed="${chosen === key || (!ui.tool && key === 'section:' + index)}"><b>${esc(title)}</b><small>${sub}</small><span aria-hidden="true">›</span></button>`;
  const column = `<section class="manual-list" aria-label="${esc(pillar?.name || '目标')}项目"><div class="list-heading"><small>${e.r.ended ? '家园继续成长' : '第' + (e.chapter()+1) + '章 · ' + CHAPTERS[e.chapter()].name}</small><h3>${pillar?.name || '当前目标'}</h3><p>${pillar?.question || '这一步完成后，家园会改变什么？'}</p></div>${panels.map((p,i) => listButton('section:' + i,p.title,'进度 · 条件 · 下一步')).join('')}${tools.length ? '<div class="manual-label">经营操作</div>' : ''}${tools.map(([menu,sub,label]) => listButton('tool:' + menu + ':' + sub,label,'打开操作面板')).join('')}</section>`;
  const detail = `<section class="manual-detail" aria-label="当前项目详情" tabindex="-1"><header class="detail-heading"><button class="mobile-back" data-action="clBack">‹ 返回列表</button><small>${pillar?.name || '重建计划'} / ${esc(active)}</small><h3>${esc(active)}</h3></header><div class="detail-scroll">${pillar ? `<p class="manual-purpose">${esc(pillar.purpose)}</p>` : ''}${notes.map(n => n.html).join('')}${ui.tool ? `<section class="rebuild-tool-panel">${toolBody}</section>` : panels[index]?.html.replace(/^<details\b/,'<details open') || '<p>选择左侧项目开始。</p>'}${tab === 'overview' && !ui.tool ? '<details class="rebuild-help"><summary>操作与营地委托</summary><p>WASD移动，E交互，左键使用工具。菜单中世界暂停。</p><button data-action="rOpen" data-id="legacyQuests:">营地委托</button></details>' : ''}</div></section>`;
  return `<div class="rebuild-page manual ${ui.mobileDetail || ui.tool ? 'show-detail' : ''}">${side}${tab === 'events' ? body : column + detail}<nav class="manual-shortcuts" aria-label="常用操作"><button data-menu="inventory">背包</button><button data-action="gJournal">任务</button><button data-menu="map">地图</button><button data-action="dOpen">地区</button><button data-action="bOpen">边境</button><button data-menu="pause">设置</button></nav></div>`;
}

export function canvasPoint(clientX, clientY, rect, width = rect.width, height = rect.height) {
  return {x: (clientX - rect.left) * width / Math.max(1, rect.width), y: (clientY - rect.top) * height / Math.max(1, rect.height)};
}

export function worldNotice(e) {
  const g = e.supplyGoal(), q = e.currentRebuildTask(), rows = e.goalMaterials();
  const missing = rows.filter(r => r.missing).length;
  return `${g.title} · ${e.u.pin === 'auto' && q && e.taskReady(q.id) ? '可以确认成果' : missing ? '尚缺' + missing + '种材料' : '查看行动条件'}`;
}

export class NoticeQueue {
  constructor() { this.active = []; this.deferred = []; this.serial = 0; }
  push(text, tone = 'normal', now = Date.now(), combat = false) {
    const list = combat && tone !== 'warn' ? this.deferred : this.active;
    const same = list.find(n => n.text === text && now - n.time < 4000);
    if (same) { same.count++; same.time = now; }
    else list.push({id: ++this.serial, text, tone, count: 1, time: now});
    while (list.length > (list === this.active ? 2 : 20)) list.shift();
  }
  visible(now = Date.now(), combat = false) {
    this.active = this.active.filter(n => now - n.time < 7000);
    if (!combat && this.deferred.length) {
      const count = this.deferred.reduce((a,n) => a+n.count,0), latest = this.deferred.at(-1);
      this.deferred = [];
      this.push(`战斗期间${count}条营地消息 · ${latest.text}`, 'normal', now);
    }
    return this.active.slice(-2);
  }
}
