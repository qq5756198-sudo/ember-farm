import {CROPS,REGIONS} from './data.js';
import {DISTRICTS,POINTS} from './district-data.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function firstHarvestStep(e){
 if(e.r.claimed.includes('harvest')||e.s.stats.harvested>=2)return null;
 const plots=e.s.plots,ready=plots.find(p=>p.crop&&p.growth>=CROPS[p.crop].grow),dry=plots.find(p=>p.crop&&!e.plotWatered(p)),growing=plots.find(p=>p.crop),empty=plots.find(p=>p.tilled&&!p.crop&&!e.plotDebris(p));
 if(ready)return {title:'收下成熟的口粮',text:'靠近闪光的作物按 E 收获。收够两株后，在任务手记交付第一份成果。',plot:ready};
 if(dry)return {title:'给新苗浇水',text:'选浇水壶后点击作物，或靠近按 E。水用完了，到农舍旁的水井补满。',plot:dry};
 if(growing)return {title:'让口粮慢慢长成',text:'苗已浇好水。趁它生长，清理附近杂物，检查农场东侧的篝火灶与仓库。',plot:growing};
 if(empty){const available=Object.values(CROPS).some(c=>e.qty(c.seed)>0);return {title:available?'种下第一批口粮':'准备播种的种子',text:available?'靠近耕地按 E，按 E 打开选种，挑一种种下；按数字键也行。':'检查农场仓库中的种子，或到集市向粮食商购买萝卜种子。',plot:empty};}
 const plot=plots.find(p=>!p.crop);return {title:'清理一块农田',text:'走到农舍前的荒地，靠近杂物按 E。清理后就能播种；没有杂物的荒地先按 E 开垦。',plot};
}
const outlook={valley:'分水闸与药圃能为餐桌和诊所持续供货。',stationMarket:'把富余的收成加工成餐食，带到商街换回维修资金。',courtyard:'修好街巷、照顾邻居，换来捷径与互助班组。',quarantine:'带来药草、布料与样本，让病房和试验室重新运作。',railDepot:'修好机床与货轨，把各地仓库连接起来。'};
export function districtOpportunities(e){if(!e.d||!e.districtUnlockReason)return [];return Object.entries(DISTRICTS).map(([id,d])=>({id,...d,open:!!e.d.unlocked[id],reason:e.districtUnlockReason(id),active:e.d.jobs.some(j=>j.region===id),outlook:outlook[id]})).filter(d=>d.open||!d.reason);}
export function renderJourney(e,{includeStep=true,includeDistrict=true}={}){
 const step=firstHarvestStep(e),opts=districtOpportunities(e),chosen=opts.find(d=>!d.open)||opts.find(d=>!e.s.visited[d.id])||opts.find(d=>d.active)||opts.find(d=>d.id===e.d.focus)||opts[0];
 let html=includeStep&&step?`<section class="rebuild-card journey-card"><h3>眼前的一步 · ${step.title}</h3><p>${step.text}</p><button data-action="pFirstHarvest" class="primary">标记这块田</button><p class="muted">第一批收成会带来豆类和棉花种子，分别用于工作餐与绷带。</p></section>`:'';
 if(includeDistrict&&chosen)html+=`<section class="rebuild-card journey-card"><h3>${chosen.open?'家园之外':'一条可以修复的路'} · ${chosen.name}</h3><p>${chosen.outlook}</p><p>${chosen.open?'通路已开放；可以带上补给，按自己的计划前往。':'通路位于'+REGIONS[chosen.parent].name+'，带上材料修复后即可通行。'}</p><button data-action="${chosen.open?'dDestination':'dEntrance'}" data-id="${chosen.id}">${chosen.open?'准备前往':'查看修路材料'}</button></section>`;
 return html;
}
export function renderRegionOpportunity(e,id){const d=DISTRICTS[id],open=e.d.unlocked[id],reason=e.districtUnlockReason(id);return `<p>${esc(outlook[id])}</p><p>${open?'通路畅通。':reason?esc(reason)+'后可修复通路。':'可从'+REGIONS[d.parent].name+'修复通路。'}</p>`;}
