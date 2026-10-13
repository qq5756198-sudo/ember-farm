import {renderJourney} from './player-journey.js';
import {renderManagement} from './clarity-ui.js';
import {renderUnifiedGoal,renderEventSummary,renderEvents,renderWorkReport,renderBattleReport,renderFarmOverlay,renderEchoHistory} from './echoes-ui.js';
import {renderSupplyGoal,renderSupplyPlans,renderCooperation} from './supply-ui.js';
import {ITEMS,CROPS,REGIONS} from './data.js';
import {RESIDENTS} from './expansion-data.js';
import {PILLARS,TASKS,CHAPTERS,OUTPOSTS,FIND_LOCATIONS,RESEARCH,STYLES,SIEGES,ARCS} from './rebuild-data.js';
import {renderCamp} from './camp-ui.js';
import {renderFrontier} from './frontier-ui.js';

export function renderObjective(e,h){
  const {esc}=h,q=e.currentRebuildTask();
  if(!q)return `<div class="quest-title">家园已经重新亮灯</div><p class="quest-copy">选择新的前哨合同，完成居民愿望，或试一条新的远征路线。</p><button class="claim-btn" data-action="rTab" data-id="expedition">选择下一次行动</button>`;
  const rows=e.taskRequirements(q.id),done=rows.filter(x=>x.pass).length,ready=e.taskReady(q.id),target=e.taskDestination(q.id);
  return `<div class="quest-title">${esc(q.title)}</div><p class="quest-copy">${esc(q.desc)}</p><div class="quest-track"><progress value="${done}" max="${rows.length}"></progress><span>${done}/${rows.length}</span></div><p class="quest-next">完成后：${esc(q.outcome)}</p><div class="button-row"><button class="claim-btn ${ready?'primary':''}" data-action="${ready?(e.s.region==='farm'?'rClaim':'rHome'):'rTrack'}" data-id="${q.id}">${ready?(e.s.region==='farm'?'确认重建成果':'回营地确认'):'追踪目标 · '+REGIONS[target.region].name}</button><button class="claim-btn" data-action="rTab" data-id="overview">查看下一步</button></div>${e.u?`<p class="quest-next">现在可做：${esc(e.supplyGoal().title)}${e.goalMaterials().some(x=>x.missing)?' · 查看缺料与来源':''}</p>`:''}`;
}

export function renderRebuild(e,tab='overview',h,ui={},frontierUI={}){
  const {esc,icon,costs,itemIcon,itemName}=h,s=e.s,r=e.r,farm=s.region==='farm',q=e.currentRebuildTask(),chapter=e.chapter();
  const button=(action,label,id='',disabled=false,extra='')=>`<button data-action="${action}" data-id="${esc(id)}" ${disabled?'disabled':''} ${extra}>${label}</button>`;
  const open=(menu,sub,label)=>button('rOpen',label,menu+':'+(sub||''));
  const card=(title,body,extra='')=>`<article class="rebuild-card ${extra}"><h3>${title}</h3>${body}</article>`;
  const note=text=>`<p class="rebuild-note">${text}</p>`;
  const costBlock=(cost,local=false)=>`<div class="cost">${Object.entries(cost).map(([id,n])=>`<span class="${e.quantityForCost(id,!local)<n?'missing':''}">${itemName(id)} ${e.quantityForCost(id,!local)}/${n}</span>`).join('')}</div>`;
  const contractCard=()=>{const c=r.contract;return c?card('当前长期合同 · '+esc(c.name),`<p>交付给${OUTPOSTS[c.region].name}。回农场整理物资后发货；合同不会因离线或跨天而取消。</p>${costBlock(c.cost)}<p>成果：前哨合作进度+1，${c.money}金币，${Object.entries(c.reward).map(([id,n])=>itemName(id)+'×'+n).join('、')}。</p><div class="button-row">${button('rDeliverContract','交付合同','',!farm||!e.costPlan(c.cost,true),'class="primary"')}${button('rCancelContract','取消未交付合同')}</div>`):card('选择一个长期供给目标',`<p>医疗通道守住后，可以选择已恢复前哨的合同。每个前哨每天最多交付一单，两单建立长期合作并获得蓝图凭证；下方地区建设在2、5、9单解锁新阶段。</p>${Object.keys(OUTPOSTS).map(id=>{const o=e.contractOffer(id);return `<div class="rebuild-contract"><b>${OUTPOSTS[id].name} · 合作${r.contractTotals[id]}/2</b><p>${o.name}</p>${costBlock(o.cost)}${button('rAcceptContract','接下合同',id,r.outposts[id]<2||!r.claimed.includes('hospitalDefense')||r.contractDays[id]===s.day)}</div>`;}).join('')}`);};
  let body='';
  if(tab==='overview'){
    const target=q&&e.taskDestination(q.id),requirements=q?e.taskRequirements(q.id):[];
    body=card(q?'当前目标 · '+esc(q.title):'通信恢复 · 家园继续成长',q?`<p>${esc(q.desc)}</p><p class="rebuild-result"><b>做完有什么用</b>${esc(q.outcome)}</p><ul class="rebuild-checklist">${requirements.map(x=>`<li class="${x.pass?'done':''}"><span>${x.pass?'✓':'○'} ${esc(x.label)}</span>${!x.pass?open(x.menu,x.tab,'查看做法'):''}</li>`).join('')}</ul><div class="button-row">${button('rClaim','确认成果并推进',q.id,!farm||!e.taskReady(q.id),'class="primary"')}${button('rTrack','追踪 '+target.label,q.id)}${!farm?button('rHome','返回农场'):''}</div><p class="muted">材料奖励会放入仓库，种子自动移到随身行囊；已完成的建设会计入成果。</p>`:`<p>地区广播收到回应：还有人愿意在这里重新生活。</p><p>你的农场、研究、前哨与居民全部保留。继续做长期合同、居民愿望、精品育种和自选远征挑战。</p><div class="button-row">${button('rTab','选择前哨合同','expedition')}${button('rTab','继续居民故事','residents')}</div>`,'rebuild-primary');
    body+=`<div class="rebuild-chapters">${CHAPTERS.map((c,i)=>`<div class="${i===chapter&&!r.ended?'current':''} ${r.claimed.length>=(i+1)*4?'complete':''}"><small>第${i+1}章 · ${Math.max(0,Math.min(4,r.claimed.length-i*4))}/4</small><b>${c.name}</b><span>${c.subtitle}</span></div>`).join('')}</div>`;
    const person=Object.keys(ARCS).find(id=>e.resident(id)&&r.arcs[id]<3),nextOutpost=Object.keys(OUTPOSTS).find(id=>r.outposts[id]===1);
    body+=`<div class="rebuild-grid">${card('可选行动 · 帮营地减轻一件事',person?`<p>${RESIDENTS[person].name}的下一段故事：${ARCS[person][r.arcs[person]].title}。完成后她会有新的工作本领。</p>${button('rTab','查看人物愿望','residents')}`:`<p>接回住宅区的阿禾。她会照料收成，之后还能按你的计划补种。</p>${button('rTrack','追踪阿禾','farmer')}`)}${card('可选行动 · 给下一次出门做准备',nextOutpost?`<p>${OUTPOSTS[nextOutpost].name}已经侦察，下一步可以处理感染源和恢复设施。</p>${button('rTab','查看收复进度','expedition')}`:`<p>选择一道功能料理，检查背包里的口粮、弹药与药品。也可以先接一份订单。</p>${open('camp','production','加工补给')}${open('camp','orders','查看订单')}`)}</div>`;
    body+=card('最近发生的变化',r.logs.length?`<ol class="rebuild-log">${r.logs.slice(0,5).map(x=>`<li><small>第${x.day}天</small>${esc(x.text)}</li>`).join('')}</ol>`:'<p>完成第一份收成后，你的重建记录会从这里开始。</p>');
  }
  if(tab==='farm'){
    const demand=q?.cost||{},newFields=s.plots.filter(p=>p.rebuildNew),dry=newFields.filter(p=>p.crop&&!e.plotWatered(p));
    body=note('先确定今天想完成的目标，再决定种什么。种子、收成和料理都显示下一步用途。');
    body+=`<div class="rebuild-grid">${card('当前需要的农场产物',`<p>${q?esc(q.title)+'：'+esc(q.desc):'为前哨合同与居民愿望准备收成。'}</p>${Object.keys(demand).length?costBlock(demand):'<p>当前章节中，干粮供应居民，棉花纺织绷带，药草用于医院和研究。</p>'}${r.contract?costBlock(r.contract.cost):''}${button('rTab','查看完整目标','overview')}`)}${card('供水与新土地',`<p>农舍前的田地：${e.projectDone('water')?'水塔每天自动浇灌':'先浇水，之后修复水塔'}。<br>扩建田地：${newFields.length}块，当前${dry.length}株缺水。</p><p>扩建田地接雨桶、灌溉站或连通水渠。净水过滤研究会让新田成长加快15%。</p>${open('camp','projects','水塔工程')}${open('frontier','water','水渠布局')}${open('camp','research','灌溉蓝图')}`)}</div>`;
    body+=`<div class="rebuild-crops">${Object.entries(CROPS).filter(([,c])=>!c.hybrid).map(([id,c])=>`<article>${itemIcon(id)}<div><b>${c.name}</b><p>${e.itemPurpose(id)}</p><small>背包与仓库 ${e.quantityForCost(id,true)}份 · 种子${e.qty(c.seed,true)}颗</small></div>${button('rSeed','选择种植',c.seed,!e.qty(c.seed))}</article>`).join('')}</div>`;
  }
  if(tab==='production'){
    const ready=e.c.production.filter(j=>j.ready).length;
    body=note('手动加工可领取到背包或直接入仓，自动计划的成品会自行入仓。材料可以来自随身行囊与农场仓库；前哨施工材料需要带在身上。');
    body+=`<div class="rebuild-grid">${card('让生产服务当前目标',`<p>${q?esc(q.desc):'继续补给合同和营地生产。'}</p><p>${ready}批成品可以领取。队列在你外出时继续运转。</p>${button('collectAllProduction','领取全部成品','',!farm||!ready,'class="primary"')}${open('craft','','选择配方')}${open('camp','production','查看加工队列')}`)}${card('运输网络',`<p>已恢复${Object.values(r.outposts).filter(v=>v>=2).length}/3处前哨。${r.network?'网络已经运作，加工速度提高'+(r.arcs.mechanic>=3?'20%':'10%')+'。':'可以交付罐头与布料，或使用一份配送箱建设网络。'}</p>${!r.network?`<p>基础路线：</p>${costBlock(e.networkCost('bulk'))}${button('rNetwork','用罐头与布料建设','bulk',!farm,'class="primary"')}<p>配送箱路线：</p>${costBlock(e.networkCost('parcel'))}${button('rNetwork','用配送箱建设','parcel',!farm)}`:''}`)}</div>`;
    if(r.finds.includes('relayCore')||r.radio)body+=card('恢复无线电站',`<p>通信核心让预警可以传给其他营地，建成后农场出现通信站。</p>${costBlock({relayCore:1,circuit:2,parts:6,cloth:2})}${button('rRadio',r.radio?'通信站已建成':'建设无线电站','',r.radio||!farm||!r.network,'class="primary"')}`);
    body+=contractCard();
  }
  if(tab==='expedition'){
    body=note('出发前选一个明确目的：找设备、救人，或恢复前哨。关键组件首次获得后会受保护。');
    body+=`<div class="rebuild-grid">${Object.entries(OUTPOSTS).map(([id,d])=>{const stage=r.outposts[id],reason=e.commissionReason(id),local=s.region===id&&Math.hypot(s.player.x-d.x,s.player.y-d.y)<=110;const component=r.finds.includes(d.component),siege=Object.keys(SIEGES).find(k=>SIEGES[k].region===id);return card(d.name,`<div class="rebuild-status">${['尚未侦察','已侦察 · 待恢复','设施运作中','长期合作'][stage]}</div><ul class="rebuild-checklist"><li>${e.resident(d.resident)?'✓':'○'} 救回${RESIDENTS[d.resident].name}</li><li>${component?'✓':'○'} 取得${ITEMS[d.component].name}</li><li>${e.f.territory[id]?'✓':'○'} 处理感染巢</li><li>${stage>=2?'✓':'○'} 恢复前哨设施</li></ul><p><b>完成用途：</b>${d.service}</p>${stage<2?`${costBlock(d.cost,true)}<p class="muted">${esc(reason||'材料齐全即可施工')}。施工材料从随身背包扣除。</p>${button('rCommission','在前哨施工',id,!!reason||!e.costPlan(d.cost,false),'class="primary"')}`:`<div class="button-row">${id==='hospital'?button('rOutpostHeal','本次到访免费治疗',id,!local)+button('rService','用药草和布料制药',id,!local):button('rService',id==='warehouse'?'6废金属换2电路':'2豆类换种子',id,!local||r.serviceDays[id]===s.day)}${siege?button('rScout','侦察下一次章节袭击',siege,!local||r.scouted[siege]||r.siegesWon[siege]):''}</div>${id==='residential'?`<label>交换的种子<select id="r-exchange-seed">${Object.entries(CROPS).map(([crop,c])=>`<option value="${crop}" ${crop===(ui.seedChoice||'bean')?'selected':''}>${c.name}种子</option>`).join('')}</select></label>`:''}` }<div class="button-row">${button('rTravel','前往'+REGIONS[id].name,id,s.region===id)}${button('rTrackOutpost',e.f.territory[id]?'标记前哨':'标记感染巢',id)}</div>`);}).join('')}${card('这次需要带回什么',`<p>${q?esc(q.title)+'：'+esc(q.desc):'选择合同、人物愿望或自选挑战。'}</p>${Object.entries(FIND_LOCATIONS).map(([id,d])=>`<div class="rebuild-find"><span>${r.finds.includes(id)?'✓':'○'} ${ITEMS[id].name}</span><small>${REGIONS[d.region].name} · ${d.name}</small><p>${e.itemPurpose(id)}</p></div>`).join('')}${open('frontier','expedition','整理远征行囊')}`)}</div>`;
    body+=contractCard();
  }
  if(tab==='residents'){
    body=note('三个人各有三段愿望。安排床位与自动工作餐后，他们的能力会持续参与经营。人物故事可以按自己的节奏推进。');
    body+=`<div class="rebuild-grid">${Object.entries(ARCS).map(([id,arcs])=>{const person=e.resident(id),stage=r.arcs[id],arc=arcs[stage],reason=e.arcReason(id);return card(RESIDENTS[id].name+' · '+stage+'/3',person?`<p>${esc(person.status)} · ${person.fed?'已有工作餐':'等待工作餐'}<br>疲劳${Math.round(person.fatigue)} · 士气${Math.round(person.morale)}</p>${arc?`<h4>${arc.title}</h4><p>${arc.text}</p><p class="rebuild-result"><b>完成后的能力</b>${arc.effect}</p>${costBlock(arc.cost)}<p class="muted">${esc(reason||'条件已满足，准备物资即可完成。')}</p>${button('rArc','完成这段愿望',id,!farm||!!reason||!e.costPlan(arc.cost,true),'class="primary"')}`:'<p>愿望已完成，人物能力持续生效。</p>'}${id==='farmer'&&stage>=2?`<label>阿禾的自动补种计划<select id="r-farm-plan">${Object.entries(CROPS).map(([crop,c])=>`<option value="${crop}" ${crop===r.farmPlan?'selected':''}>${c.name} · 种子${e.qty(c.seed,true)}颗</option>`).join('')}</select></label>`:''}`:`<p>${RESIDENTS[id].story}</p><p>${esc(reason)}</p>${button('rTravel','前往救援',{farmer:'residential',medic:'hospital',mechanic:'warehouse'}[id])}`);}).join('')}${card('床位、工作餐与休息',`<p>床位容量${e.residentsCapacity()} · 已入住${e.c.residents.length}人<br>自动工作餐${e.c.autoMeals?'已开启':'未开启'}，会消耗真实干粮。</p><div class="button-row">${button('feedResidents','供应工作餐','',!farm)}${button('toggleAutoMeals',e.c.autoMeals?'改为手动工作餐':'开启自动工作餐')}${open('camp','residents','安排岗位与优先级')}${open('frontier','rooms','布置休息房间')}</div>` )}</div>`;
  }
  if(tab==='defense'){
    const b=r.lastBattle,intel=e.hordeIntel();
    body=note('每次袭击都提前公布方向与特点。章节防守由你准备好后发起，普通尸潮继续按游戏日循环。');
    body+=`<div class="rebuild-grid">${Object.entries(STYLES).map(([id,d])=>card(d.name,`<p>${d.desc}</p>${button('rStyle',r.style===id?'当前路线':r.style?'重选路线 · 30金币':'选择路线 · 首次免费',id,!farm||['warning','active'].includes(s.horde.phase),`class="${r.style===id?'active':'primary'}"`)}<p class="muted">${id==='engineer'?'先布陷阱，安排有工作餐的居民驻守瞭望塔。':id==='mobile'?'准备炖汤、豆香便当和弹药，边移动边清理敌群。':'先到已恢复的对应前哨侦察，再回来发起章节防守。'}</p>`)).join('')}${card('来袭情报',`<p>${s.horde.phase==='locked'?'章节前可以安心经营。':`${intel.direction.name} · ${intel.theme} · ${intel.count}名敌人`}</p><p>${intel.direction.tip}</p><p>奖励用途：${intel.reward}</p>${s.horde.phase==='warning'?button('beginHorde','准备好了，开始防守','',false,'class="primary"'):''}${open('build','','布置防线')}${open('craft','','制作弹药与料理')}`)}</div>`;
    body+=`<div class="rebuild-grid">${Object.entries(SIEGES).map(([id,d])=>{const available=id==='hospital'?r.outposts.hospital>=2:r.radio;return card(d.name,`<p>${d.reward}</p><p>预计${e.siegeCount(id)}名 · ${r.scouted[id]?'已侦察，规模降低':'可先到'+OUTPOSTS[d.region].name+'侦察'}。</p><div class="button-row">${button('rSiege',r.siegesWon[id]?'已经守住':'发起90秒准备预警',id,!farm||!available||r.siegesWon[id]||['warning','active'].includes(s.horde.phase),'class="primary"')}${button('rTravel','去前哨侦察',d.region,r.outposts[d.region]<2)}</div><p class="muted">${available?'失败后工程与研究保留，可以补给后重试。':id==='hospital'?'先恢复医院前哨。':'先恢复营地无线电站。'}</p>`);}).join('')}</div>`;
    if(b&&!e.v)body+=card((b.won?'守家成功':'重新准备')+' · '+SIEGES[b.id].name,`<div class="rebuild-report"><span>击败敌人<b>${b.kills}</b></span><span>陷阱击败<b>${b.trapKills}</b></span><span>塔楼击败<b>${b.towerKills}</b></span><span>料理抵消伤害<b>${Math.round(b.foodSaved)}</b></span><span>维修恢复耐久<b>${Math.round(b.repairs)}</b></span></div><p>${b.won?SIEGES[b.id].reward:'这次留下的经验可以用于调整布局。前哨与研究没有丢失。'}</p>${button('rTab','查看章节成果','overview')}`);
  }
  if(tab==='research'){
    body=note('旧供水设施藏着污染扩散的线索。到各区控制盒旁寻找日志，采集附近的植物作对照。');
    body+=`<div class="rebuild-grid">${card('当前的问题',`<p>${r.finds.includes('relayCore')?'检修记录确认：损坏的过滤与回流设备让污染进入旧供水网。下一步恢复广播，向其他营地发出预警。':r.finds.includes('pumpModule')?'净水泵的回流阀损坏。为什么某些植物能在受污染的土地上继续生长？比对医院日志与植物样本。':'医院和仓库曾共享供水设施。找到日志、设备和植物样本，查清感染为何沿旧设施扩散。'}</p><p>日志 ${e.f.clues.length}/3 · 植物鉴定 ${e.f.identified.length}/6 · 关键设备 ${r.finds.length}/4</p>${open('frontier','investigation','整理日志与鉴定植物')}`)}${Object.entries(RESEARCH).map(([id,d])=>{const reason=e.researchReason(id);return card(d.name,`<p>${d.desc}</p>${costBlock(d.cost)}<p class="muted">${esc(reason||'证据已具备，交付材料即可研究。')}</p>${button('rResearch',r.tech[id]?'已经完成':'完成研究',id,!!reason||!e.costPlan(d.cost,true),'class="primary"')}`);}).join('')}${card('仓库封闭检修间',`<p>位于仓库东南角。第四章与净水过滤完成后，靠近门按E开启。守卫看守着通信核心。</p><p>当前：${r.finds.includes('relayCore')?'通信核心已带回':r.annexOpen?'房间开放，仍需带回核心':'等待开启'}。</p>${button('rTrack','追踪检修间','annex')}${button('rTravel','前往仓库','warehouse')}`)}</div>`;
  }
  if(e.u&&tab==='production')body=renderSupplyPlans(e)+body;
  if(e.u&&!e.v&&['overview','farm','production'].includes(tab))body=renderSupplyGoal(e)+body;
  if(e.u&&tab==='expedition')body+=renderCooperation(e);
  if(e.v){if(tab==='overview')body=renderUnifiedGoal(e)+renderEventSummary(e)+renderEchoHistory(e);if(tab==='events')body=renderEvents(e,ui);if(tab==='residents')body=renderWorkReport(e)+body;if(tab==='defense')body=renderBattleReport(e)+body;if(tab==='farm')body=renderFarmOverlay(e)+body;}
  if(tab==='overview')body=renderJourney(e,{includeDistrict:false})+body+renderJourney(e,{includeStep:false});
  const pillar=PILLARS.find(p=>p.id===tab),tools=pillar?.tools||[];
  let toolBody='';if(ui.tool){const helper={...h,compact:true};toolBody=ui.tool.menu==='camp'?renderCamp(e,ui.tool.tab,helper):renderFrontier(e,ui.tool.tab,helper,frontierUI);}
  return renderManagement(e,tab,body,toolBody,h,ui);
}

export function handleRebuildAction(action,button,ctx){
  const {engine:e,ui,showMenu,closeMenu,renderMenu,save,toast}=ctx,id=button.dataset.id;
  if(!action.startsWith('r')||['reply','retreat','resetSpec','refillWater','researchTech','restart','repair','returnMain'].includes(action))return false;
  if(action==='rTab'){ui.mobileDetail=false;ui.tool=null;showMenu('rebuild',{tab:id});return true;}
  if(action==='rTool'){const [menu,tab]=id.split(':');ui.tool={menu,tab};ui.mobileDetail=true;renderMenu();ctx.root?.querySelector('.rebuild-tool-panel')?.scrollIntoView?.({block:'start'});return true;}
  if(action==='rOpen'){const [menu,tab]=id.split(':');showMenu(menu,{tab});return true;}
  if(action==='rTrack'){ui.target=null;const d=e.guide(id);if(d.region!==e.s.region)showMenu('map');else closeMenu();save();return true;}
  if(action==='rTrackOutpost'){const d=e.outpostDestination(id);ui.target=d;closeMenu();toast('已标记：'+d.label+' · '+REGIONS[d.region].name);return true;}
  if(action==='rTravel'||action==='rHome'){if(e.travel(action==='rHome'?'farm':id)){closeMenu();save();}return true;}
  if(action==='rSeed'){if(e.qty(id)){e.s.seed=id;e.s.slot=2;closeMenu();toast('已选择'+ITEMS[id].name+'：'+e.itemPurpose(id));}return true;}
  let result;
  switch(action){
    case 'rClaim':result=e.claimRebuildTask(id);if(result)ui.target=null;break;
    case 'rArc':result=e.advanceArc(id);break;
    case 'rResearch':result=e.researchRebuild(id);break;
    case 'rCommission':result=e.commissionOutpost(id);break;
    case 'rService':result=e.serviceOutpost(id,ui.seedChoice||'bean');break;
    case 'rOutpostHeal':result=e.outpostHeal(id);break;
    case 'rAcceptContract':result=e.acceptContract(id);break;
    case 'rDeliverContract':result=e.deliverContract();break;
    case 'rCancelContract':result=e.cancelContract();break;
    case 'rNetwork':result=e.buildNetwork(id);break;
    case 'rRadio':result=e.buildRadio();break;
    case 'rStyle':result=e.chooseStyle(id);break;
    case 'rScout':result=e.scoutSiege(id);break;
    case 'rSiege':result=e.startSiege(id);if(result){closeMenu();save();return true;}break;
    default:return false;
  }
  if(result===false)toast('条件尚未满足，请按目标提示准备位置、证据或物资。','warn');renderMenu();save();return true;
}
