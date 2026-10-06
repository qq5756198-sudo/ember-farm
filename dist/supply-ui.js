import {ITEMS,CROPS,BUILDINGS,RECIPES} from './data.js';
import {OUTPOSTS} from './rebuild-data.js';
import {PLAN_RECIPES,RESERVE_ITEMS,COOP,COOP_COSTS,COOP_THRESHOLDS,COOP_LEVELS} from './supply-data.js';

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(action,label,id='',disabled=false)=>`<button data-action="${action}" data-id="${esc(id)}" ${disabled?'disabled':''}>${esc(label)}</button>`;
const bundle=b=>Object.entries(b).map(([id,n])=>ITEMS[id].name+'×'+n).join('、');

export function renderSupplyGoal(e){
  if(!e.u)return '';
  const g=e.supplyGoal(),rows=e.goalMaterials(),ingredients=e.goalIngredientNeeds(),options=e.goalOptions();
  if(!options.some(o=>o.id===e.u.pin))options.push({id:e.u.pin,name:'已钉住 · '+g.title});
  const ready=rows.length>0&&rows.every(r=>!r.missing),canCarry=g.local&&rows.some(r=>r.carried<r.need);
  return `<section class="rebuild-card supply-planner" aria-label="目标备料"><div class="supply-title"><h3>下一步 · ${esc(g.title)}</h3><span class="supply-tag">${e.u.pin==='auto'?'跟随主线':'自选目标'}</span></div><label class="supply-picker">这次先做什么<select id="supply-goal">${options.map(o=>`<option value="${esc(o.id)}" ${o.id===e.u.pin?'selected':''}>${esc(o.name)}</option>`).join('')}</select>${button('sPin','钉住目标')}</label><p class="rebuild-result"><b>完成的用途</b>${esc(g.use)}</p>${rows.length?`<div class="supply-materials">${rows.map(r=>`<article><div><strong>${ITEMS[r.id].name}</strong><span class="${r.missing?'missing':'supply-done'}">已有 ${r.have}/${r.need}${r.missing?' · 还缺 '+r.missing:' · 已备齐'}</span></div><p>${esc(r.source.text)}</p>${r.pending?`<small>加工队列另有 ${r.pending} 份（领取前不计库存）</small>`:''}${g.local?`<small>随身 ${r.carried}/${r.need} · 前哨施工必须带上</small>`:''}<div class="button-row">${button('rOpen',r.source.recipe?'查看加工配方':'查看获取方法',r.source.where)}${g.local&&r.carried<r.need?button('sPack','从仓库装至所需量',r.id,e.s.region!=='farm'||r.have<=r.carried):''}</div></article>`).join('')}</div>${Object.keys(ingredients).length?`<p class="supply-shortage"><b>若自行加工，还需收集：</b>${esc(bundle(ingredients))}。已先抵扣现有材料；不含设备建造费用。</p>`:''}<p class="supply-status">${g.done?'这一目标已完成，可以选择新的方向。':ready?canCarry?'农场总量已够；出发前按下方随身数量装包。':'材料已备齐；还需满足对应地点、证据或合作次数。':'先补齐缺少的材料，再完成这一小步。'}</p>`:`<p class="supply-status">这一阶段主要靠行动推进，查看目标条件后前往对应地点。</p>`}<div class="button-row">${button('rOpen','去完成这一步',g.where)}${button('rTab','查看主线条件','overview')}${e.u.pin!=='auto'?button('sFollow','重新跟随主线'):''}</div><p class="muted">菜单中时间暂停。主线确认后，这份清单会自动切换到下一步；自选目标由你切换。</p></section>`;
}

export function renderSupplyPlans(e){
  if(!e.u)return '';
  const locked=e.planUnlockReason(),farm=e.s.region==='farm',configured=Object.keys(e.u.plans),ready=e.c.production.filter(j=>j.ready).length;
  const inputItems=[...new Set(configured.flatMap(id=>Object.keys(e.planRecipe(id).cost)))];
  return `<section class="rebuild-card supply-panel"><h3>供给计划 · 保持你需要的储备</h3><p>最多开启${e.planCapacity()}条计划，按优先顺序补货。只取仓库的普通和耐旱材料；优质收成、随身口粮由你安排。成品自动入仓，可接续下一道加工，也可用于居民工作餐、工程与合同。</p>${locked?`<p class="supply-status">尚未启用：${esc(locked)}。完成公共餐桌后即可使用。</p>`:''}<div class="supply-form"><label>加工配方<select id="supply-recipe">${PLAN_RECIPES.map(id=>{const r=e.planRecipe(id);return `<option value="${id}">${ITEMS[Object.keys(r.out)[0]].name} · ${BUILDINGS[r.station].name}</option>`;}).join('')}</select></label><label>仓库目标数量<input id="supply-target" type="number" min="1" max="30" step="1" value="6" inputmode="numeric"></label>${button('sPlan','保存并开启计划','',!farm||!!locked)}</div><p class="muted">达到目标便停止，低于目标才补货；每条同时一批，最多超出目标一批产量。现有手动批次也计入在制数量。不会离线生产。</p><div class="supply-plan-list">${configured.length?configured.map(id=>{const r=e.planRecipe(id),item=Object.keys(r.out)[0],p=e.u.plans[id],estimate=e.planEstimate?.(id);return `<article><div class="supply-title"><b>${ITEMS[item].name} · 仓库 ${e.stockAmount(item)}/${p.target}</b><span>${p.enabled?'运行':'暂停'}</span></div><p>每批 ${bundle(e.effectiveCost(r.cost))} → ${bundle(r.out)} · ${r.minutes}游戏分钟</p><p>在制 ${e.pendingAmount(item)}份${estimate?' · 当前排队估计约'+estimate.minutes+'游戏分钟 · '+estimate.lanes+'处设施 / '+estimate.speed.toFixed(1)+'倍加工速度（缺料、其他补单或换班会改变估算）':''}</p><p class="supply-status">${esc(e.planStatus(id))}</p><div class="button-row">${button('sToggle',p.enabled?'暂停补货':'恢复补货',id,!farm)}${button('sNeed','查看材料去向',id)}${e.v?button('sMoveUp','提高优先级',id,configured.indexOf(id)===0)+button('sMoveDown','降低优先级',id,configured.indexOf(id)===configured.length-1):''}</div></article>`;}).join(''):'<p>建议先设干粮6份，再按当前目标选择布料或绷带。设置后把原料存入仓库，关闭菜单，去照料农田或探索。</p>'}</div>${inputItems.length?`<h4>原料入仓</h4><div class="button-row">${inputItems.map(id=>button('sDeposit',ITEMS[id].name+'入仓 · 随身'+(e.qty(id)+(CROPS[id]?e.qty('hardy_'+id):0)),id,!farm||!(e.qty(id)+(CROPS[id]?e.qty('hardy_'+id):0)))).join('')}</div>`:''}<details><summary>给工程留材料 · 仅限制自动加工投料</summary><p>底线以内的原料留给你。手动加工、建设、人物制药与合同仍可使用。生产需要材料时，请同时检查这里。</p><div class="supply-form"><label>材料<select id="supply-reserve-item">${RESERVE_ITEMS.map(id=>`<option value="${id}">${ITEMS[id].name} · 当前保留${e.u.reserves[id]||0}</option>`).join('')}</select></label><label>保留数量<select id="supply-reserve-count">${[0,2,4,6,8,12,20,30].map(n=>`<option value="${n}">${n}</option>`).join('')}</select></label>${button('sReserve','设置底线','',!farm)}</div><p>${Object.entries(e.u.reserves).filter(([,n])=>n).map(([id,n])=>ITEMS[id].name+'保留'+n).join(' · ')||'尚未设置底线'}</p></details><div class="button-row">${button('sStoreAll','将已完成的手动批次入仓 · '+ready,'',!farm||!ready)}${button('rOpen','查看全部队列 / 取消批次','camp:production')}</div><p class="muted">自动完成并入仓 ${e.u.completed} 批。背包满时也能使用“入仓”。取消自动批次会返还实际材料并暂停对应计划。</p></section>`;
}

export function renderCooperation(e){
  if(!e.u)return '';
  return `<section class="supply-cooperation"><h3>地区建设 · 让长期合同留下变化</h3><p>每处完成2 / 5 / 9份合同后，可投入材料建设协作站、地区工坊和复兴枢纽。每份后续合同带回所选支援，分别为下方基础物资的1 / 2 / 3倍；前哨也会出现对应规模的补给设施。</p><div class="rebuild-grid">${Object.keys(COOP).map(id=>{const p=e.u.cooperation[id],reason=e.cooperationReason(id),next=COOP_COSTS[p.level],count=e.r.contractTotals[id];return `<article class="rebuild-card"><h4>${OUTPOSTS[id].name}</h4><p class="supply-tag">${COOP_LEVELS[p.level]} · 已交付 ${count} 份</p>${next?`<p>下一阶段：${COOP_LEVELS[p.level+1]} · 合同 ${count}/${COOP_THRESHOLDS[p.level]}</p><p>施工需要 ${bundle(next)}</p><p class="supply-status">${esc(reason||'已可建设，升级会实际扣除材料。')}</p><div class="button-row">${button('sCoopUpgrade','建设下一阶段',id,!!reason)}${button('sPinDirect','钉住施工材料','cooperation:'+id)}</div>`:'<p>这片地区已建成复兴枢纽。继续按下一次出门或农场需求安排支援。</p>'}<div class="supply-choice">${Object.entries(COOP[id]).map(([mode,d])=>`<div class="${p.mode===mode?'chosen':''}"><b>${d.name}${p.mode===mode?' · 当前选择':''}</b><p>每级每单：${bundle(d.bundle)}</p><p>${d.use}</p>${button('sCoopMode','选择这一方向',id+':'+mode,e.s.region!=='farm'||p.mode===mode)}</div>`).join('')}</div><p class="muted">随时免费切换，仅影响以后交付的合同；当前每单额外：${p.level?bundle(e.cooperationReward(id)):'建成协作站后开始获得'}。</p></article>`;}).join('')}</div>${e.u.lastShipment?`<p class="supply-status">最近回程 · 第${e.u.lastShipment.day}天 · ${OUTPOSTS[e.u.lastShipment.region].name}：${bundle(e.u.lastShipment.reward)}，已存入仓库。</p>`:''}</section>`;
}

export function handleSupplyAction(action,buttonEl,ctx){
  if(!['sPin','sPinDirect','sFollow','sPlan','sToggle','sReserve','sDeposit','sStoreAll','sPack','sNeed','sCoopUpgrade','sCoopMode','sMoveUp','sMoveDown'].includes(action))return false;
  const {engine:e,root,showMenu,renderMenu,save,toast}=ctx,id=buttonEl.dataset.id;
  const value=id=>root.querySelector('#'+id)?.value;let ok=false;
  if(action==='sMoveUp'||action==='sMoveDown')ok=e.moveSupplyPlan(id,action==='sMoveUp'?-1:1);
  if(action==='sPin')ok=e.pinGoal(value('supply-goal'));
  if(action==='sPinDirect')ok=e.pinGoal(id);
  if(action==='sFollow')ok=e.pinGoal('auto');
  if(action==='sPlan')ok=e.setSupplyPlan(value('supply-recipe'),Number(value('supply-target')));
  if(action==='sToggle')ok=e.toggleSupplyPlan(id);
  if(action==='sReserve')ok=e.setReserve(value('supply-reserve-item'),Number(value('supply-reserve-count')));
  if(action==='sDeposit')ok=e.depositIngredient(id);
  if(action==='sStoreAll')ok=e.storeAllProduction();
  if(action==='sPack'){
    const row=e.goalMaterials().find(r=>r.id===id);if(row&&e.s.region==='farm'){
      const keys=CROPS[id]?[id,'hardy_'+id,'fine_'+id]:[id];let left=Math.max(0,row.need-row.carried);
      for(const key of keys)while(left>0&&e.s.storage[key]>0){if(!e.transfer(key,false,false))break;left--;ok=true;}
    }
  }
  if(action==='sNeed'){const r=e.planRecipe(id);toast(Object.entries(r.cost).map(([key,n])=>ITEMS[key].name+'×'+n+'：'+e.sourceFor(key).text).join('；'));showMenu('rebuild',{tab:'farm'});return true;}
  if(action==='sCoopUpgrade')ok=e.upgradeCooperation(id);
  if(action==='sCoopMode'){const [region,mode]=id.split(':');ok=e.chooseCooperation(region,mode);}
  if(!ok)toast(action==='sPack'?'背包空间不足、仓库数量不足，或已装够所需物资。':'操作未完成，请查看条件、地点或材料提示。','warn');
  renderMenu();save();return true;
}
