import {residentExtras} from './people-hooks.js';
import {ITEMS,CROPS,BUILDINGS,TRADERS} from './data.js';
import {TRAITS,TECH,PROJECTS,RESIDENTS,ROLES,SPECS,WEATHER_HELP,EVENTS,STORIES,BUFF_NAMES,VARIANTS,REP_TIERS,ENCOUNTERS,FEATURES} from './expansion-data.js';

export const CAMP_TABS=[['overview','总览'],['orders','订单'],['production','加工'],['projects','重建'],['residents','居民'],['research','研究'],['genes','育种'],['explore','探索'],['life','生活'],['messages','消息'],['features','营地事务']];
const categoryName=id=>({food:'料理与食物',crop:'农作物',resource:'建材与零件'})[id]||id;

export function renderCamp(e,tab,{esc,icon,itemIcon,costs,itemName,compact=false}) {
  const s=e.s,c=e.c,farm=s.region==='farm';
  const action=(name,id,label,disabled=false,extra='')=>`<button data-action="${name}" data-id="${esc(id)}" ${disabled?'disabled':''} ${extra}>${label}</button>`;
  const article=(title,body,art='')=>`<article class="camp-card">${art}<div><h3>${title}</h3>${body}</div></article>`;
  const atlas=index=>`<canvas class="item-icon" data-atlas="${index}"></canvas>`;
  const intel=e.hordeIntel(),night=e.nightInfo(),demand=e.marketDemand();
  const siege=`${s.horde.phase==='warning'?'正在预警':s.horde.phase==='active'?'正在来袭':'第'+intel.day+'天'} · ${intel.direction.name} · ${intel.theme} · ${intel.count}名`;
  let body='';
  if(tab==='overview') {
    const meals=Object.keys(s.inventory).filter(id=>ITEMS[id]?.buff&&s.inventory[id]>0);
    body=`<div class="camp-summary"><span>声望 <b>${c.reputation}</b></span><span>居民 <b>${c.residents.length}/${e.residentsCapacity()}</b></span><span>电力 <b>${Math.floor(c.energy)}/100</b></span><span>水量 <b>${c.water}/${c.waterCapacity}</b></span></div>
      <div class="forecast">${e.forecast().map(d=>`<div><b>${d.day===s.day?'今天':'第'+d.day+'天'}</b><strong>${d.weather}</strong><small>${WEATHER_HELP[d.weather]}</small></div>`).join('')}</div>
      <div class="note">${s.horde.phase==='locked'?'完成造枪主线后开启首次守家。':`<b>尸潮情报：${siege}</b><p>${intel.direction.tip}</p><small>${intel.reward}。菜单中倒计时暂停。</small>`}${s.day<=c.recoveryUntil?'<p class="ready">尸潮后的休整日：今天安心修复与经营。</p>':''}</div>
      <div class="camp-grid">${article('今天的经营计划',`<p>${e.bt?'出货箱旁边的订单板每天早上补满三张单子，按单子安排播种。':'每天接两份订单，按需求安排播种。'}加工、居民和出货箱的挂牌会在你外出时继续运转。</p><div class="button-row">${e.bt?action('bView','bOrders','看订单板'):action('campTab','orders','接订单')}${action('campTab','production','加工与领取')}${action('campTab','features','查看营地事务')}</div>`)}
      ${article('出门前选择料理',`<p>最多同时保留2种效果，持续4游戏小时。先加工料理，再在这里直接使用。</p><div class="buff-list">${c.buffs.map(b=>`<span>${BUFF_NAMES[b.id]} · ${Math.ceil(b.remaining)}分钟 ${action('removeBuff',b.id,'解除')}</span>`).join('')||'<span>尚无料理效果</span>'}</div><div class="button-row">${meals.map(id=>action('useMeal',id,itemName(id)+' ×'+e.qty(id),!e.buff(ITEMS[id].buff)&&c.buffs.length>=2)).join('')||action('openCraft','','制作功能料理')}</div>`)}
      ${article('家园成长',`<p>${s.plots.filter(p=>p.crop).length}株作物 · ${c.production.filter(j=>j.ready).length}份成品 · ${c.residents.filter(r=>e.residentActive(r)).length}名居民工作中 · ${s.stats.hordes}次守家胜利</p><div class="button-row">${action('campTab','projects','公共重建')}${action('campTab','residents','安排工作')}${action('skills','','选择技能专精')}</div>`)}
      ${article('今天的变化',`<p>${c.event&&!c.event.done?EVENTS[c.event.type].title:'营地暂时平静，可以联络两名商人。'}</p><p>出货箱挂牌：${e.td?e.td.listing.length:0}/3 格</p><div class="button-row">${action('campTab','messages','营地消息')}${action('campTab','stall','出货箱挂牌')}${action('campTab','explore','探索准备')}</div>`)}</div>
      <p class="muted">N营地 · K专精 · J主线。菜单中时间暂停，关闭网页后世界暂停，所有经营按游戏时间推进。</p>`;
  } else if(tab==='orders') {
    body=e.bt?`<div class="note"><p>每日订单并进了出货箱旁边的订单板：每天早上补满三张单子，交单给材料或神秘种子包。以前接了还没交的，下面照样能交。</p><div class="button-row">${action('bView','bOrders','打开订单板')}</div></div>${c.orders.length?`<div class="camp-grid">${c.orders.map(o=>article(o.title,`${costs(o.cost)}<p>${o.money}金币 · 声望+${o.rep} · 商人信任+5</p>${o.done?'<span class="ready">已交付</span>':action('deliverOrder',o.id,'交付',!e.afford(o.cost))}`)).join('')}</div>`:''}
      <h3>声望供应路线</h3><div class="camp-grid">${REP_TIERS.map(t=>article(t.at+'声望 · '+t.name,`<p>${t.desc}</p><span class="${c.reputation>=t.at?'ready':'muted'}">${c.reputation>=t.at?'已解锁 · 集市每天补货':'还差'+(t.at-c.reputation)+'声望'}</span>`)).join('')}</div>`:`<p>每天刷新3单，最多接2单，当天交付。声望每跨越30点获得1张蓝图凭证。优质与耐旱收成可替代普通作物；优先消耗普通收成。</p>
      <div class="camp-grid">${c.orders.map(o=>article(o.title,`${costs(o.cost)}<p>${o.money}金币 · 声望+${o.rep} · 商人信任+5</p>${o.done?'<span class="ready">已交付</span>':!o.accepted?action('acceptOrder',o.id,'接取',c.orders.filter(x=>x.accepted).length>=2):action('deliverOrder',o.id,'交付',!e.afford(o.cost))}`)).join('')}</div>
      <h3>声望供应路线</h3><div class="camp-grid">${REP_TIERS.map(t=>article(t.at+'声望 · '+t.name,`<p>${t.desc}</p><span class="${c.reputation>=t.at?'ready':'muted'}">${c.reputation>=t.at?'已解锁 · 集市每天补货':'还差'+(t.at-c.reputation)+'声望'}</span>`)).join('')}</div>`;
  } else if(tab==='production') {
    body=`<div class="note">番茄→罐头→配送箱；棉花→布料→绷带；鱼、鸡蛋、羊奶→功能料理。每座完好的设施提供1条产线，同类型多建也能并行加工。队列上限12批，成品领取前一直保留。</div>
      <div class="button-row">${action('openCraft','','添加1 / 3 / 5批加工')}${action('collectAllProduction','','领取全部成品',!farm||!c.production.some(j=>j.ready))}</div>
      <div class="camp-grid">${c.production.map((j,i)=>article(itemName(Object.keys(j.out)[0])+` · 第${i+1}批`,`<p>${j.ready?'成品就绪':'本批还需'+Math.ceil(j.remaining)+'游戏分钟'} · ${BUILDINGS[j.station].name}</p><p>${Object.entries(j.out).map(([id,n])=>itemName(id)+' ×'+n).join('、')}</p><p class="muted">${s.buildings.filter(b=>b.type===j.station&&b.hp>0).length}条可用产线${!e.hasBuilding(j.station)?' · 设施损坏，已暂停':''}</p>${j.ready?action('collectProduction',j.id,'领取',!farm):action('cancelProduction',j.id,'取消并退回实际材料',!farm)}`,itemIcon(Object.keys(j.out)[0]))).join('')||'<p class="muted">暂无加工任务。按C选择配方，可以一次加入多批。</p>'}</div>`;
  } else if(tab==='projects') {
    body=`<p>每个项目分两阶段：先恢复外观，再开放服务。提交可同时使用背包与仓库材料，每阶段奖励15声望和1张蓝图凭证。</p><div class="camp-grid">${Object.entries(PROJECTS).map(([id,p])=>{
      const stage=e.projectStage(id),done=e.projectDone(id);
      return article(p.name+` · ${stage}/2`,done?`<p class="ready">${p.reward}</p>`:`<p>${p.stages[stage].desc}</p>${costs(p.stages[stage].cost)}<p>完成服务：${p.reward}</p>${action('contributeProject',id,'提交本阶段',!farm||!e.afford(p.stages[stage].cost))}`,p.atlas!=null?atlas(p.atlas):icon(p.icon));
    }).join('')}</div>`;
  } else if(tab==='residents') {
    body=`<div class="note">农舍1个床位，每张床再加1人。每天1干粮工作餐，诊所提供首份免费餐。06:00–22:00工作，守卫在尸潮期间值夜班。优先级1最高，0不做；第一项无事可做时自动转做下一项。</div>
      <div class="button-row">${action('feedResidents','','提供工作餐',!farm||!c.residents.length)}${action('toggleAutoMeals','',c.autoMeals?'自动供餐：开':'自动供餐：关')}${action('openBuild','','建床位 / 塔楼')}</div>
      <div class="camp-grid">${Object.entries(RESIDENTS).map(([id,r])=>{
        const resident=c.residents.find(x=>x.id===id),bonus={farmer:'种植经验：每小时可浇5株。',mechanic:'维修经验：每份木材修35耐久。',medic:'医疗经验：每小时恢复12生命。',cartographer:'制图经验：驻站获得研究凭证，随队缩短旅行。'}[id];
        return article(r.name,`<p>${r.story}</p><small>${bonus}</small>${resident?`<p class="ready">${esc(resident.status)} · ${resident.fed?'已用餐':'未用餐'} · ${c.residents.indexOf(resident)<e.residentsCapacity()?'有床位':'缺少床位'}</p>${residentExtras(e,resident)}<label>主要工作 <select data-resident="${id}">${Object.entries(ROLES).map(([role,name])=>`<option value="${role}" ${resident.role===role?'selected':''}>${name}</option>`).join('')}</select></label><div class="priority-grid">${['farmer','mechanic','medic','guard'].map(role=>`<label>${ROLES[role].split('：')[0]} <select data-priority-resident="${id}" data-role="${role}" aria-label="${r.name}的${ROLES[role]}优先级">${[0,1,2,3].map(n=>`<option value="${n}" ${resident.priorities[role]===n?'selected':''}>${n===0?'0 · 不做':n+' · '+(n===1?'优先':n===2?'其次':'最后')}</option>`).join('')}</select></label>`).join('')}</div>`:id==='cartographer'?`<p>地底避难城有人需要帮助。到公共居住舱找到柏岚，再为他安排恢复餐和床位。</p><button data-action="bView" data-id="events">查看边境来信</button>`:`<p>去${id==='medic'?'旧医院':id==='farmer'?'居民区':'工业仓库'}救援，按E带回营地。</p>`}`,icon(r.icon));
      }).join('')}</div><p class="muted">塔楼每次射击消耗1发仓库或背包弹药，可越过围栏，建筑和地形会遮挡。噪声信标要你拉响才引怪（走到信标前按 E）；维修点只在打仗时每8秒用1木材修附近设施。</p>`;
  } else if(tab==='research') {
    body=`<div class="note">持有${c.researchCredits}张蓝图凭证。每次抽取最多3张，选择1张后生成下一组；退出或读档会保留当前候选。未选项目可花80金币与材料研究。</div>
      <div class="camp-grid">${c.researchOffers.map(id=>article(TECH[id].name,`<p>${TECH[id].desc}</p>${action('chooseTech',id,'使用1张凭证',c.researchCredits<1)}`)).join('')||'<p class="ready">全部蓝图已掌握。</p>'}</div>
      <h3>完整研究路线</h3><div class="camp-grid">${Object.entries(TECH).map(([id,t])=>article(t.name,`<p>${t.desc}</p>${c.technologies[id]?'<span class="ready">已掌握 · B选择建造</span>':costs(t.cost)+'<p>另需80金币</p>'+action('researchTech',id,'独立研究',!farm||s.money<80||!e.afford(t.cost))}`)).join('')}</div>
      <h3>设备与维护</h3><p>雨桶→250范围内灌溉站→相邻灌溉站→300范围内农田。修好的水塔可连接600范围内管网。太阳能→电力→无人机；同类特性种子也能自动补种。</p>
      <div class="camp-grid">${s.buildings.filter(b=>['irrigation','solar','drone'].includes(b.type)).map(b=>article(BUILDINGS[b.type].name,`<p>${e.automationStatus(b)}</p>${b.type==='drone'?action('serviceAutomation',b.id,'用1零件维护',!farm||!b.wear||!e.quantityForCost('parts',true)):''}${b.hp<BUILDINGS[b.type].hp?action('repair',b.id,'维修设施',!farm):''}`,atlas(BUILDINGS[b.type].atlas))).join('')||'<p class="muted">还没有自动化设备，先选择蓝图并建造。</p>'}</div>`;
  } else if(tab==='genes') {
    body=`<div class="note">育种箱用2份作物培育2颗种子；首次研究一种特性需1零件，掌握后免零件。特性作物成熟时额外留下1颗原品种种子。浇水壶${c.water}/${c.waterCapacity}格，到水井或雨桶补水。</div>
      <div class="camp-grid">${Object.entries(CROPS).filter(([,crop])=>!crop.hybrid).map(([id,crop])=>article(crop.name,`<p>已掌握：${(c.geneLibrary[id]||[]).map(t=>TRAITS[t].name).join('、')||'尚无特性'} · 优质收成售价+60%</p>${Object.entries(TRAITS).map(([trait,t])=>`<div class="story"><b>${t.name}</b><p>${t.desc}</p>${costs(e.geneCost(id,trait))}${action('breedTrait',id,(c.geneLibrary[id]?.includes(trait)?'稳定留种':'研究')+' · '+t.name,!farm||!e.hasBuilding('breeder')||!e.afford(e.geneCost(id,trait)),`data-trait="${trait}"`)}</div>`).join('')}`,itemIcon(id))).join('')}</div>`;
  } else if(tab==='stall') {
    body=`<div class="note"><b>摊位并进了出货箱。</b><p>到出货箱挂牌：三格，白天 06:00–22:00 每 90 分钟卖出一件，按卖价的 1.25 倍。</p></div><div class="button-row"><button data-action="oView" data-id="shipping">打开出货箱</button></div>`;
  } else if(tab==='explore') {
    const room=e.encounter(),def=room&&ENCOUNTERS[room.variant];
    body=`<div class="note"><b>${night.night?'夜间探索':'白天探索'} · ${night.risk}</b><p>${night.night?'距离06:00黎明还有'+night.minutes+'分钟':'距离18:30入夜还有'+night.minutes+'分钟'} · ${night.torch?'已携带手电，视野扩大并增加夜间物资':'未携带手电，C可制作'} · 当前料理${c.buffs.length}/2</p>夜间奖励可自愿探索，白天可取得所有主线资源。随时按M撤退，菜单中时间暂停。</div>
      <div class="button-row">${action('retreat','','立即返回农场',farm)}${action('openMap','','地图与路线')}${action('openCraft','','制作手电 / 料理')}${action('waitUntilNight','','休息至19:00',!farm||night.night||['warning','active'].includes(s.horde.phase))}</div>
      ${def?`<h3>${def.name}</h3><p>${def.text}</p><div class="camp-grid">${def.options.map((o,i)=>article(o.label,`${o.cost?costs(o.cost):''}${o.reward?'<p>可获：'+Object.entries(o.reward).map(([id,n])=>itemName(id)+' ×'+n).join('、')+'</p>':''}<p>${o.enemies?'危险：门后'+o.enemies+'名感染者':o.noise?'风险：噪声引来附近敌人':o.skip?'安全离开，保持房门关闭':'风险较低'}</p>${action('chooseEncounter',String(i),e.encounterReason(room,i)||'选择',!!e.encounterReason(room,i))}`)).join('')}</div>`:
      `<h3>本次路线</h3><p>${farm||s.region==='market'?'前往居民区、医院或仓库，找到带“侧室”标记的交互点，按E调查。':VARIANTS[(c.visits[s.region]||0)%3]+'：主线物资位置保留，侧室、路障和额外补给会变化。'}</p><div class="camp-grid">${e.objects.filter(o=>o.type==='encounter').map(o=>article(o.name,`<p>位置（${o.x}，${o.y}） · ${c.encounters[o.id]?'今天已处理':'靠近后按E，三种处理选择'}</p><p>侧室奖励不影响主线资源与撤退。</p>`)).join('')}</div>`}`;
  } else if(tab==='life') {
    const pond=e.objects.find(o=>o.type==='pond'),near=farm&&pond&&Math.hypot(s.player.x-pond.x,s.player.y-pond.y)<95,a=c.animals;
    body=`<div class="camp-grid">${article('浇水与补水',`<p>水量${c.water}/${c.waterCapacity}格。普通/耐旱作物1格，丰产作物2格。耐旱品种两天浇一次。自然雨水、雨桶、灌溉、居民工作不消耗随身水。</p>${action('refillWater','','补满水壶',!e.canRefillWater())}<p class="muted">靠近旧水井或雨桶；水塔修好后农场可随时补水。</p>`,icon(33))}
      ${article('池塘钓鱼',`<p>东南池塘抛竿，看到“咬钩”按E。银鳞鱼→防护炖汤；雨天/鱼饵蓝背鱼→移速便当；夜间金尾鱼→回血药膳。鱼也有轮换订单。</p><div class="button-row">${action('startFishing','','直接抛竿',!near)}${action('startFishingBait','','用1豆类或菜青虫作饵',!near||(!e.qty('bean')&&!e.qty('grub')))}</div><p>已钓${c.metrics.fish}条。</p>`,itemIcon('fish'))}
      ${article('鸡舍与养殖',`<p>${a.chicken?'已有获救的鸡':'去居民区救鸡'} · ${a.goat?'已有山羊':'40声望后可购入山羊'}</p><p>每日玉米：${a.goat?3:1}份 · ${a.feedDay===s.day?'今天已喂食':'今天未喂食'}${a.remaining>0?' · '+Math.ceil(a.remaining)+'分钟后产出':''}</p><p>待领取：${Object.entries(a.ready).map(([id,n])=>itemName(id)+' ×'+n).join('、')||'无'}</p><p>鸡蛋→早餐，羊奶+玉米→奶粥，也会进入每日订单。</p><div class="button-row">${action('feedAnimals','','喂食',!farm||!e.hasBuilding('coop')||!a.chicken||a.feedDay===s.day)}${action('collectAnimals','','领取产出',!farm||!Object.keys(a.ready).length)}${action('buyGoat','','购入山羊 · 150金币',!farm||a.goat||!e.hasBuilding('coop')||c.reputation<40||s.money<150)}</div>`,atlas(0))}
      ${article('回收撬棍 Lv.'+c.toolLevel,`<p>1级货架→木材；2级汽车→金属、零件、电路；3级电器→更多电路。每处每天拆一次，噪声吸引敌人。</p><p>升级需${c.toolLevel===1?'金属6、零件2':'金属10、零件4'}及${c.relationships.mechanic.trust>=20?40:60}金币。</p>${action('upgradeCrowbar','','升级撬棍',!farm||!e.qty('crowbar')||c.toolLevel>=3)}<p>${e.qty('crowbar')?'已携带':'按C随身制作'}</p>`,itemIcon('crowbar'))}
      ${article('诊所服务',`<p>诊所每天免费治疗一次，并提供1份居民工作餐。</p>${action('clinicHeal','','免费治疗',!farm||!e.projectDone('clinic')||c.clinicDay===s.day)}`,icon(39))}</div>`;
  } else if(tab==='messages') {
    const def=c.event&&!c.event.done?EVENTS[c.event.type]:null;
    body=`${def?`<div class="note"><h3>${def.title}</h3><p>${def.desc}</p><div class="button-row">${def.options.map((o,i)=>action('chooseEvent',String(i),o.label,!!(o.cost&&!e.afford(o.cost)||o.money>s.money))).join('')}</div></div>`:`<p class="muted">暂无待处理事件。间隔2–3天，尸潮后留出休整日。下次消息最早第${Math.max(c.nextEventDay,c.recoveryUntil+1)}天。</p>`}
      <div class="camp-grid">${Object.entries(STORIES).map(([id,stories])=>{
        const rel=c.relationships[id],dialogue=e.dialogue(id);
        return article(TRADERS[id].name,`<p>信任${Math.floor(rel.trust)} · ${rel.trust>=50?'珍藏伙伴':rel.trust>=20?'熟悉朋友':'初识'} · 20解锁供应/维修优惠，50解锁珍藏礼物。</p><div class="story"><p>${dialogue.text}</p><div class="button-row">${dialogue.options.map((o,i)=>action('reply',id,o.label+(o.cost?'':' · 信任+'+o.trust),rel.talkDay===s.day||!!(o.cost&&!e.afford(o.cost)),`data-index="${i}"`)).join('')}</div>${rel.lastReply?'<p class="ready">上次回应：'+esc(rel.lastReply)+'</p>':''}</div>${action('gift',id,id==='food'?'送1炖汤 · 信任+8':'送1零件 · 信任+8',rel.giftDay===s.day||!e.afford(id==='food'?{stew:1}:{parts:1}))}${stories.map((story,i)=>`<div class="story"><b>${story.title} · 信任${story.at}</b><p>${rel.trust>=story.at?story.text:'继续交单、选择回应与赠礼，了解这段故事。'}</p>${rel.trust>=story.at&&!rel.claimed.includes(i)?action('claimStory',id,story.reward?'领取纪念礼物':'记录故事',false,`data-index="${i}"`):rel.claimed.includes(i)?'<small class="ready">已记录</small>':''}</div>`).join('')}`,icon(TRADERS[id].icon));
      }).join('')}</div><h3>营地记事</h3>${c.eventLog.map(x=>`<p>第${x.day}天 · ${esc(x.title)} · ${esc(x.result)}</p>`).join('')||'<p class="muted">选择会记录在这里。</p>'}`;
  } else if(tab==='features') {
    body=`<div class="note">用收成供应居民，用探索带回的设备建设家园。这里可以查看各项事务的条件和进度。</div><div class="camp-grid feature-grid">${FEATURES.map(([title,target,desc],i)=>article(title,`<p>${desc}</p>${i===4?action('skills','','查看技能专精'):action('campTab',target,'查看条件与进度')}`)).join('')}</div>`;
  }
  return `${compact?'':`<div class="camp-tabs">${CAMP_TABS.map(([id,label])=>action('campTab',id,label,false,`class="${tab===id?'active':''}"`)).join('')}</div>`}${!farm?'<div class="note">建设、研究、产出领取等操作需要返回农场。</div>':''}<div class="camp-body">${body}</div>`;
}

export function renderSpecializations(e,{icon,esc}) {
  return `<div class="camp-grid">${Object.entries(SPECS).map(([skill,options])=>`<article class="camp-card"><div><h3>${({agriculture:'农业',manufacturing:'制造',exploration:'探索',combat:'战斗'})[skill]} Lv.${e.level(skill)}</h3><p>经验${e.s.xp[skill]} · 3级后选一个分支。</p>${options.map(o=>`<div class="story"><b>${o.name}</b><p>${o.desc}</p><button data-action="chooseSpec" data-id="${skill}" data-spec="${o.id}" ${e.level(skill)<3||e.c.specializations[skill]?'disabled':''}>${e.c.specializations[skill]===o.id?'当前专精':'选择专精'}</button></div>`).join('')}${e.c.specializations[skill]?`<button data-action="resetSpec" data-id="${skill}" ${e.s.money<60?'disabled':''}>重选 · 60金币</button>`:''}</div></article>`).join('')}</div>`;
}
