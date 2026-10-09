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
  // v0.20.0：营地手册（左侧导航、项目列表、操作清单）已经去掉，每次只放这一处的内容
  const place = PILLARS.find(p => p.id === tab);
  if (ui.tool) return `<div class="place-page"><div class="detail-scroll">${toolBody}</div></div>`;
  if (tab === 'events') return `<div class="place-page"><div class="manual place-events ${ui.mobileDetail ? 'show-detail' : ''}">${body}</div></div>`;
  return `<div class="place-page">${place ? `<p class="manual-purpose">${esc(place.purpose)}</p>` : ''}<div class="detail-scroll">${body.replace(/^<details\b/, '<details open')}</div></div>`;
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
