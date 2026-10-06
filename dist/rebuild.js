import {Engine as FrontierEngine,freshState as frontierFresh,migrateState as migrateFrontier} from './frontier.js';
import {ITEMS,CROPS,BUILDINGS,RECIPES,REGIONS,WEAPONS} from './data.js';
import {RESIDENTS,PROJECTS} from './expansion-data.js';
import {CANAL} from './frontier-data.js';
import {TASKS,CHAPTERS,OUTPOSTS,FIND_LOCATIONS,RESEARCH,STYLES,SIEGES,CONTRACTS,ARCS,ANNEX} from './rebuild-data.js';

const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const regions=Object.keys(OUTPOSTS),copy=v=>JSON.parse(JSON.stringify(v));
function defaults(){return {revision:1,claimed:[],focus:null,finds:[],tech:{},outposts:{residential:0,hospital:0,warehouse:0},arcs:{farmer:0,medic:0,mechanic:0},farmPlan:'bean',style:null,scouted:{hospital:false,broadcast:false},siegesWon:{hospital:false,broadcast:false},battle:null,lastBattle:null,annexOpen:false,annexGuardian:false,annexDefeated:false,seedbankUsed:false,radio:false,network:false,fields:false,ended:false,serviceDays:{},medicineDay:0,contract:null,contractSerial:0,contractTotals:{residential:0,hospital:0,warehouse:0},contractDays:{},metrics:{food:0,medicine:0,expeditions:0,produced:{}},logs:[]};}

export function migrateState(state){
  migrateFrontier(state);const d=defaults(),old=!state.rebuild;
  state.rebuild={...d,...state.rebuild};const r=state.rebuild;
  for(const key of ['tech','outposts','arcs','scouted','siegesWon','serviceDays','contractTotals','contractDays','metrics'])r[key]={...d[key],...r[key]};
  r.metrics.produced={...r.metrics.produced};
  // Old public works count toward the new story; resources and earned watering stay intact.
  if(old){if(state.colony.projects.market||state.stats.gunsCrafted)r.metrics.food=1;if(state.colony.projects.clinic)r.metrics.medicine=1;}
  state.rebuildVersion=5;return state;
}
export function freshState(difficulty='casual'){const s=migrateState(frontierFresh(difficulty));s.colony.autoMeals=true;return s;}
export function demoState(){
  const s=freshState();s.frontier.demo=true;s.money=180;s.player.x=535;s.player.y=490;
  Object.assign(s.inventory,{seedPotato:6,seedCotton:6,seedBean:6,seedHerb:4,wood:20,stone:12,scrap:12,pistol:1,ammo:30});s.magazines.pistol=8;
  for(const [i,crop]of [[0,'radish'],[1,'radish'],[2,'potato'],[3,'potato']])Object.assign(s.plots[i],{tilled:true,crop,growth:crop==='radish'?100:300,wateredDay:1,waterUnits:1,care:1,qualityRoll:2,soilCharged:true,fertility:65});
  s.debris=s.debris.filter(d=>!s.plots.slice(0,4).some(p=>dist(d,p)<18));s.frontier.kit=[{id:'pistol',x:0,y:0,rotation:0},{id:'ammo',x:2,y:0,rotation:0},{id:'bread',x:2,y:1,rotation:0},{id:'bandage',x:3,y:1,rotation:0}];
  s.rebuild.focus='harvest';return s;
}

export class Engine extends FrontierEngine {
  constructor(state=freshState(),notify=()=>{}){super(migrateState(state),notify);this.assignRegion();}
  get r(){return this.s.rebuild;}
  currentRebuildTask(){return TASKS.find(q=>!this.r.claimed.includes(q.id))||null;}
  chapter(){return this.currentRebuildTask()?.chapter??3;}
  log(text){this.r.logs.unshift({day:this.s.day,text});this.r.logs=this.r.logs.slice(0,12);}
  resident(id){return this.c.residents.find(r=>r.id===id);}
  taskRequirements(id){
    const q=TASKS.find(q=>q.id===id);if(!q)return [];
    const req=(label,pass,menu='rebuild',tab=q.pillar)=>({label,pass:!!pass,menu,tab});
    const found=id=>this.r.finds.includes(id),produced=this.r.metrics.produced;
    let list=[];
    switch(id){
      case 'harvest':list=[req('收获两株作物 '+Math.min(2,this.s.stats.harvested)+'/2',this.s.stats.harvested>=2,'rebuild','farm')];break;
      case 'meal':list=[req('领取一次加工好的干粮或料理',this.r.metrics.food>=1,'camp','production')];break;
      case 'farmer':list=[req('在住宅区救回阿禾',this.resident('farmer'),'map'),req('搜索后院种子档案箱',found('seedArchive'),'map')];break;
      case 'table':list=[req('集市第一阶段完成',this.projectStage('market')>=1,'camp','projects'),req('制作台已建好',this.hasBuilding('workbench'),'build'),req('床位容量至少2人',this.residentsCapacity()>=2,'build')];break;
      case 'signal':list=[req('在医院救回许医生',this.resident('medic'),'map'),req('拾取医院日志',this.f.clues.includes('hospital'),'rebuild','research'),req('取得净水泵组件',found('pumpModule'),'map')];break;
      case 'medical':list=[req('领取一次加工好的绷带或药包',this.r.metrics.medicine>=1,'camp','production')];break;
      case 'hospital':list=[req('清除医院感染巢',this.f.territory.hospital,'map'),req('诊所第一阶段完成',this.projectStage('clinic')>=1,'camp','projects'),req('医院前哨恢复',this.r.outposts.hospital>=2,'rebuild','expedition')];break;
      case 'hospitalDefense':list=[req('医疗通道防守胜利',this.r.siegesWon.hospital,'rebuild','defense')];break;
      case 'water':list=[req('水塔修复完成',this.projectDone('water'),'camp','projects'),req('住宅前哨恢复',this.r.outposts.residential>=2,'rebuild','expedition')];break;
      case 'power':list=[req('在仓库救回陈工',this.resident('mechanic'),'map'),req('取得动力组件',found('driveModule'),'map'),req('完成动力恢复研究',this.r.tech.power,'rebuild','research')];break;
      case 'warehouse':list=[req('旧桥修复完成',this.projectDone('bridge'),'camp','projects'),req('仓库前哨恢复',this.r.outposts.warehouse>=2,'rebuild','expedition')];break;
      case 'network':list=[req('运输网络已建设',this.r.network,'rebuild','production'),req('完成三站远征或两份长期合同',this.r.metrics.expeditions>0||this.f.records.some(x=>x.success)||Object.values(this.r.contractTotals).reduce((a,b)=>a+b,0)>=2,'rebuild','expedition')];break;
      case 'filter':list=[req('收齐三地日志 '+this.f.clues.length+'/3',this.f.clues.length>=3,'frontier','investigation'),req('鉴定两种植物 '+this.f.identified.length+'/2',this.f.identified.length>=2,'frontier','investigation'),req('净水过滤研究完成',this.r.tech.filtration,'rebuild','research')];break;
      case 'annex':list=[req('开启仓库东南检修间',this.r.annexOpen,'map'),req('带回通信核心',found('relayCore'),'map')];break;
      case 'radio':list=[req('营地无线电站恢复',this.r.radio,'rebuild','production')];break;
      case 'broadcast':list=[req('通信站防守胜利',this.r.siegesWon.broadcast,'rebuild','defense')];break;
    }
    for(const [item,n]of Object.entries(q.cost))list.push(req('交付'+ITEMS[item].name+' '+Math.min(n,this.quantityForCost(item,true))+'/'+n,this.quantityForCost(item,true)>=n,'craft'));
    return list;
  }
  taskReady(id){return this.taskRequirements(id).length>0&&this.taskRequirements(id).every(x=>x.pass);}
  claimRebuildTask(id){
    const q=this.currentRebuildTask();if(!q||q.id!==id||this.s.region!=='farm'||!this.taskReady(id)){this.toast('先完成目标并返回农场，再确认重建成果。','warn');return false;}
    if(!this.takeFarm(q.cost))return false;this.r.claimed.push(id);this.r.focus=null;this.putStorage(q.reward);this.s.money+=q.money;
    // Seeds remain easy to equip rather than being hidden in storage.
    for(const key of Object.keys(q.reward))if(ITEMS[key].type==='seed')this.transfer(key,false,true);
    if(id==='farmer')this.r.tech.seedbank=true;
    if(id==='table'){this.c.autoMeals=true;this.c.technologies.tower=true;this.grantResearch(1);}
    if(id==='hospitalDefense'){this.c.technologies.canner=true;this.c.technologies.irrigation=true;this.addRebuildFields();this.grantResearch(1);}
    if(id==='broadcast'){this.r.ended=true;this.c.nextHordeDay=this.s.day+4;}
    this.log(q.title+'：'+q.outcome);this.toast(q.outcome,'gold');if((TASKS.indexOf(q)+1)%4===0)this.toast('第'+(q.chapter+1)+'章完成 · '+CHAPTERS[q.chapter].change,'gold');
    this.assignRegion();this.emit('quest');return true;
  }
  taskDestination(id=this.currentRebuildTask()?.id){
    const found=x=>this.r.finds.includes(x);
    if(id==='farmer')return {region:'residential',...(this.resident('farmer')?FIND_LOCATIONS.seedArchive:{x:720,y:720}),label:this.resident('farmer')?'种子档案箱':'阿禾'};
    if(id==='signal'){if(!this.resident('medic'))return {region:'hospital',x:1340,y:550,label:'许医生'};if(!this.f.clues.includes('hospital'))return {region:'hospital',x:895,y:473,label:'医院日志'};return {...FIND_LOCATIONS.pumpModule,label:'净水泵组件'};}
    if(id==='hospital')return this.outpostDestination('hospital');
    if(id==='water'&&this.r.outposts.residential<2)return this.outpostDestination('residential');
    if(id==='power'&&!this.resident('mechanic'))return {region:'warehouse',x:1340,y:550,label:'陈工'};
    if(id==='power'&&!found('driveModule'))return {...FIND_LOCATIONS.driveModule,label:'动力组件箱'};
    if(id==='warehouse')return this.outpostDestination('warehouse');
    if(id==='filter'&&this.f.clues.length<3){const region=regions.find(x=>!this.f.clues.includes(x));const p={residential:{x:595,y:483},hospital:{x:895,y:473},warehouse:{x:810,y:858}}[region];return {region,...p,label:'未取得的日志'};}
    if(id==='annex')return {region:'warehouse',...(this.r.annexOpen?ANNEX.inside:ANNEX.door),label:this.r.annexOpen?'通信核心':'封闭检修间'};
    if(id==='harvest'){const p=this.s.plots.filter(p=>p.crop).sort((a,b)=>Number(b.growth>=CROPS[b.crop].grow)-Number(a.growth>=CROPS[a.crop].grow)||dist(this.s.player,a)-dist(this.s.player,b))[0]||this.s.plots[0];return {region:'farm',x:p.x,y:p.y,label:p.crop&&p.growth>=CROPS[p.crop].grow?'可收获作物':'农田 · 先浇水再成长'};}
    return {region:'farm',x:735,y:570,label:'重建计划板'};
  }
  outpostDestination(id){return !this.f.territory[id]?{region:id,x:({residential:1280,hospital:1390,warehouse:815}[id]),y:({residential:870,hospital:425,warehouse:805}[id]),label:'感染巢'}:{region:id,x:OUTPOSTS[id].x,y:OUTPOSTS[id].y,label:OUTPOSTS[id].name};}
  guide(id){const target=this.taskDestination(id);this.r.focus=id||this.currentRebuildTask()?.id||null;this.toast('已追踪：'+target.label+' · '+REGIONS[target.region].name);this.emit('quest');return target;}
  itemPurpose(id){
    const base=id.replace(/^(fine_|hardy_)/,'');
    const known={radish:'3份可加工2份干粮，供应居民与远征。',potato:'2份可煮防御炖汤，帮助守家。',bean:'工作餐、移速料理、住宅种子交换；收获还能养地。',cotton:'3份纺织2布料，再加工绷带和药包。',herb:'医院前哨、药包与净水过滤研究。',tomato:'罐头与配送箱，供应运输合同。',corn:'喂鸡获得鸡蛋，也用于料理。',pumpkin:'高价值料理、订单和收获展。',cloth:'居民床位、绷带、诊所和运输网络。',bread:'居民每日工作餐、远征口粮与前哨施工。',parts:'设备研究、公共工程与自动化维护。',scrap:'弹药、防御设施、仓库电路交换。',stew:'防御料理，也能交付粮食合同。',bandage:'补血、诊所与医院长期合同。',medkit:'外出救治和医生的个人愿望。',jam:'继续包装为配送箱，或建设运输网络。',parcel:'运输网络、仓库合同与高价值交易。',circuit:'动力恢复、太阳能、无人机和无线电站。',seedArchive:'完成接回阿禾目标后，首次特性育种免零件。',pumpModule:'恢复医院前哨的关键组件。',driveModule:'动力恢复研究的关键组件。',relayCore:'恢复无线电站的关键组件。'};
    if(ITEMS[id]?.type==='seed')return this.itemPurpose(ITEMS[id].crop);
    return known[base]||ITEMS[id]?.desc||'用于营地经营、探索或收藏。';
  }
  recordProduced(bundle){for(const [id,n]of Object.entries(bundle)){this.r.metrics.produced[id]=(this.r.metrics.produced[id]||0)+n;if(['bread','stew','beanMeal','chefMeal','fineMeal','fishStew','eggMeal','milkMeal','riverMeal','nightMeal'].includes(id))this.r.metrics.food+=n;if(['bandage','medkit'].includes(id))this.r.metrics.medicine+=n;}}
  collectProduction(id){const bundle=this.c.production.find(j=>j.id===id)?.out;const ok=super.collectProduction(id);if(ok&&bundle)this.recordProduced(bundle);return ok;}
  updateCooking(dt){const result=super.updateCooking(dt);if(result&&this.f.lastMeal)this.recordProduced({[this.f.lastMeal.fine?'fineMeal':'chefMeal']:1});return result;}
  geneCost(crop,trait){const cost=super.geneCost(crop,trait);if(this.r.tech.seedbank&&!this.r.seedbankUsed)delete cost.parts;return cost;}
  breedTrait(crop,trait){const discount=this.r.tech.seedbank&&!this.r.seedbankUsed&&!!super.geneCost(crop,trait).parts,ok=super.breedTrait(crop,trait);if(ok&&discount)this.r.seedbankUsed=true;return ok;}
  processProduction(n){const mechanic=this.resident('mechanic'),assist=this.r.arcs.mechanic>=2&&mechanic&&mechanic.priorities.mechanic>0&&this.residentActive(mechanic);const network=this.r.network?(this.r.arcs.mechanic>=3?.2:.1):0;return super.processProduction(n*(1+(assist?.2:0)+network));}
  cropGrowthRate(p){return super.cropGrowthRate(p)*(p.rebuildNew&&this.r.tech.filtration?1.15:1);}
  addRebuildFields(){
    if(this.r.fields)return;this.r.fields=true;let added=0;
    for(const y of [650,690,730])for(const x of [940,980,1020]){if(added>=6||this.blocked(x,y)||this.s.plots.some(p=>dist(p,{x,y})<35))continue;this.s.plots.push({id:this.s.idCounter++,x,y,tilled:true,crop:null,growth:0,wateredDay:0,waterUnits:0,care:0,fertility:75,lastCrop:null,soilCharged:false,rebuildNew:true});added++;}
    this.log('新土地开放：新增'+added+'块农田。通过水渠、雨桶或灌溉站连接水源。');
  }
  placeBuilding(x,y){const before=new Set(this.s.plots.map(p=>p.id));const ok=super.placeBuilding(x,y);if(ok)for(const p of this.s.plots)if(!before.has(p.id))Object.assign(p,{rebuildNew:true,care:0,fertility:65,lastCrop:null,soilCharged:false});return ok;}
  ecologyChange(i,type){const before=new Set(this.s.plots.map(p=>p.id));const ok=super.ecologyChange(i,type);if(ok)for(const p of this.s.plots)if(!before.has(p.id))Object.assign(p,{rebuildNew:true,care:p.care||0});return ok;}
  newFieldWatered(p){return ['小雨','暴雨'].includes(this.s.weather)||this.s.buildings.some(b=>b.hp>0&&(b.type==='rain'&&dist(b,p)<220||b.type==='irrigation'&&dist(b,p)<300&&this.irrigationConnected(b)))||this.canalFlow().includes(CANAL.goal)&&this.f.canals.mode==='hold'&&this.f.canals.level>0&&dist(p,{x:CANAL.x+50,y:CANAL.y+40})<190;}
  contributeProject(id){const prior=this.s.plots.filter(p=>p.rebuildNew).map(p=>({p,wateredDay:p.wateredDay,waterUnits:p.waterUnits,care:p.care})),ok=super.contributeProject(id);if(ok&&id==='water')for(const {p,...water}of prior)if(!this.newFieldWatered(p))Object.assign(p,water);return ok;}
  onNewDay(){
    const old=new Map(this.s.plots.filter(p=>p.rebuildNew).map(p=>[p.id,{wateredDay:p.wateredDay,waterUnits:p.waterUnits,care:p.care}]));super.onNewDay();
    for(const p of this.s.plots)if(p.rebuildNew&&p.crop&&!this.newFieldWatered(p)&&old.has(p.id))Object.assign(p,old.get(p.id));
  }
  workHour(){
    super.workHour();const farmer=this.resident('farmer'),doctor=this.resident('medic');
    if(this.r.arcs.farmer>=2&&farmer&&farmer.priorities.farmer>0&&this.residentActive(farmer)&&['farmer','rest'].includes(farmer.workRole)){
      const p=this.s.plots.find(p=>p.tilled&&!p.crop&&!this.plotDebris(p));const crop=this.r.farmPlan,seed=CROPS[crop].seed;
      const snapshot=this.workSnapshot?.();if(p&&this.takeFarm({[seed]:1})){Object.assign(p,{crop,trait:null,growth:0,soilCharged:false,qualityRoll:this.s.stats.planted++%5,care:0});this.chargeSoil(p);this.waterPlot(p);farmer.status='按计划补种'+CROPS[crop].name+' · 种子-1';this.recordResidentWork?.(farmer,snapshot,this.workSnapshot?.(),false);}
    }
    const snapshot=this.workSnapshot?.();if(this.r.arcs.medic>=2&&doctor&&doctor.priorities.medic>0&&this.residentActive(doctor)&&this.r.medicineDay!==this.s.day&&this.takeFarm({herb:2,cloth:1})){
      this.r.medicineDay=this.s.day;this.putStorage({medkit:1});this.recordProduced({medkit:1});doctor.status='今日制药完成 · 消耗2药草和1布料';this.recordResidentWork?.(doctor,snapshot,this.workSnapshot?.(),false);
    }
  }
  arcReason(id){
    const stage=this.r.arcs[id],person=this.resident(id);if(!person)return '先从'+REGIONS[{farmer:'residential',medic:'hospital',mechanic:'warehouse'}[id]].name+'救回这名居民';
    if(stage>=3)return '个人故事已完成';if(this.c.residents.indexOf(person)>=this.residentsCapacity())return '先增加床位';if(!person.fed)return '先供应工作餐';
    if(stage===1&&id==='farmer'&&!this.r.tech.seedbank)return '先完成种子档案重建目标';
    if(stage===1&&id==='medic'&&(!this.projectStage('clinic')||!this.f.identified.length))return '诊所第一阶段与至少一种植物鉴定';
    if(stage===1&&id==='mechanic'&&!this.r.tech.power)return '先研究动力恢复';
    if(stage===2&&this.r.outposts[{farmer:'residential',medic:'hospital',mechanic:'warehouse'}[id]]<2)return '先恢复对应前哨';
    if(stage===2&&id==='mechanic'&&!this.r.network)return '先建设运输网络';
    return '';
  }
  advanceArc(id){const arc=ARCS[id]?.[this.r.arcs[id]],reason=this.arcReason(id);if(!arc||reason||this.s.region!=='farm'){this.toast(reason||'返回农场再推进个人故事。','warn');return false;}if(!this.takeFarm(arc.cost)){this.toast('人物愿望所需物资不足。','warn');return false;}this.r.arcs[id]++;this.c.autoMeals=true;this.resident(id).morale=clamp(this.resident(id).morale+10,0,100);this.log(RESIDENTS[id].name+' · '+arc.title+'：'+arc.text);this.toast(arc.effect,'gold');this.assignRegion();this.emit('quest');return true;}
  setFarmPlan(crop){if(!CROPS[crop]||this.s.region!=='farm')return false;this.r.farmPlan=crop;this.toast('阿禾补种计划：'+CROPS[crop].name+'，会消耗真实种子。');return true;}
  recruit(id){const ok=super.recruit(id);if(ok){const person=this.resident(id);person.fatigue??=0;person.morale??=60;this.feedResidents(true);this.log(RESIDENTS[id].name+'获救。现在可以为他安排床位与个人愿望。');}return ok;}
  researchReason(id){
    if(!RESEARCH[id])return '未知研究';if(this.r.tech[id])return '研究已完成';if(this.s.region!=='farm')return '返回农场研究';
    if(id==='filtration'&&(!this.f.clues.includes('hospital')||!this.f.identified.length))return '需要医院日志与至少一种已鉴定植物';
    if(id==='power'&&(!this.resident('mechanic')||!this.r.finds.includes('driveModule')))return '需要陈工与仓库动力组件';
    return '';
  }
  researchRebuild(id){const d=RESEARCH[id],reason=this.researchReason(id);if(reason){this.toast(reason,'warn');return false;}if(!this.takeFarm(d.cost)){this.toast('研究材料不足。','warn');return false;}this.r.tech[id]=true;if(id==='power'){this.c.technologies.solar=true;this.c.technologies.drone=true;}this.log(d.name+'完成：'+d.desc);this.toast(d.desc,'gold');this.assignRegion();this.emit('quest');return true;}
  collectFind(id){
    const d=FIND_LOCATIONS[id];if(!d||this.r.finds.includes(id)||this.s.region!==d.region||dist(this.s.player,d)>85)return false;
    if(d.elite&&this.enemies.some(e=>e.type==='elite'&&!e.dead&&!e.annexGuardian)||d.annex&&(!this.r.annexOpen||!this.r.annexDefeated)){this.toast('组件仍被守卫看守，先处理守卫。','warn');return false;}
    if(!this.add({[id]:1},true))return false;this.r.finds.push(id);this.log('取得'+ITEMS[id].name+'：'+this.itemPurpose(id));this.toast(ITEMS[id].name+'已取得 · '+this.itemPurpose(id),'gold');this.assignRegion();this.emit('quest');return true;
  }
  commissionReason(id){
    const d=OUTPOSTS[id];if(!d)return '未知前哨';if(this.r.outposts[id]>=2)return '前哨已恢复';if(this.s.region!==id||dist(this.s.player,d)>110)return '到该地区入口前哨施工';
    if(!this.f.territory[id])return '先摧毁该地区感染巢';if(!this.resident(d.resident))return '先救回'+RESIDENTS[d.resident].name;if(!this.r.finds.includes(d.component))return '先取得'+ITEMS[d.component].name;
    if(id==='hospital'&&!this.projectStage('clinic'))return '先完成营地诊所第一阶段';if(id==='warehouse'&&!this.projectDone('bridge'))return '先修复旧桥';return '';
  }
  commissionOutpost(id){
    const d=OUTPOSTS[id],reason=this.commissionReason(id);if(reason){this.toast(reason,'warn');return false;}if(!this.pay(d.cost,false)){this.toast('施工材料要带在随身背包内。','warn');return false;}
    this.r.outposts[id]=2;this.log(d.name+'恢复：'+d.service);this.toast(d.name+'恢复 · '+d.service,'gold');this.assignRegion();this.emit('quest');return true;
  }
  serviceOutpost(id,choice='bean'){
    const d=OUTPOSTS[id];if(!d||this.r.outposts[id]<2||this.s.region!==id||dist(this.s.player,d)>110)return false;
    const bundle=id==='hospital'?{medkit:1}:id==='warehouse'?{circuit:2}:{[CROPS[choice]?.seed||'seedBean']:2+(this.r.arcs.farmer>=3?1:0)},cost=id==='hospital'?{herb:2,cloth:1}:id==='warehouse'?{scrap:6}:{bean:2};
    if(id!=='hospital'&&this.r.serviceDays[id]===this.s.day)return false;
    if(!this.canReceive(bundle,true)){this.toast('远征行囊没有空位，先整理或卸下一组物资。','warn');return false;}
    if(!this.pay(cost,false))return false;this.add(bundle,true);
    if(id==='hospital')this.recordProduced(bundle);else this.r.serviceDays[id]=this.s.day;
    this.toast(d.name+'补给完成','gold');this.emit('loot');return true;
  }
  canReceive(bundle,outing=false){return this.canAdd(bundle)&&(!outing||!this.f.route||!!this.cargoPlan(bundle));}
  outpostHeal(id){const d=OUTPOSTS[id];if(!d||id!=='hospital'||this.r.outposts[id]<2||this.s.region!==id||dist(this.s.player,d)>110||this._outpostHealed)return false;this._outpostHealed=true;this.s.player.hp=Math.min(100,this.s.player.hp+(this.r.arcs.medic>=3?55:35));this.toast('医疗前哨治疗完成，本次到访仅一次。','gold');return true;}
  contractOffer(id){const pool=CONTRACTS[id];return pool?.[(this.r.contractSerial+this.s.day+regions.indexOf(id))%pool.length];}
  acceptContract(id){
    if(!OUTPOSTS[id]||this.r.outposts[id]<2||!this.r.claimed.includes('hospitalDefense')||this.r.contract||this.r.contractDays[id]===this.s.day)return false;
    this.r.contract={...copy(this.contractOffer(id)),region:id,id:'supply-'+(++this.r.contractSerial),acceptedDay:this.s.day};this.log('接下长期合同：'+this.r.contract.name+'。准备好再交付，没有离线到期惩罚。');this.emit('quest');return true;
  }
  deliverContract(){
    const o=this.r.contract;if(!o||this.s.region!=='farm'||!this.takeFarm(o.cost))return false;
    this.putStorage(o.reward);this.s.money+=o.money;this.r.contractTotals[o.region]++;this.r.contractDays[o.region]=this.s.day;this.addReputation(8);
    if(this.r.contractTotals[o.region]===2){this.r.outposts[o.region]=3;this.grantResearch(1);this.log(OUTPOSTS[o.region].name+'建立长期合作，前哨升至合作级。');}
    this.r.contract=null;this.log('合同完成：'+o.name+'，供给网有了真实往来。');this.toast('合同交付 · '+o.money+'金币 · 前哨合作进度+'+1,'gold');this.emit('quest');return true;
  }
  cancelContract(){if(!this.r.contract)return false;this.r.contract=null;this.toast('已取消合同，未扣除物资。');return true;}
  networkCost(mode='bulk'){return mode==='parcel'?{parcel:1,wood:8,bread:4}:{jam:2,cloth:2,wood:8,bread:4};}
  buildNetwork(mode='bulk'){if(this.r.network||this.s.region!=='farm'||!regions.every(id=>this.r.outposts[id]>=2)){this.toast('先恢复三处前哨，再返回农场建设运输网络。','warn');return false;}if(!this.takeFarm(this.networkCost(mode)))return false;this.r.network=true;this.toast('运输网络运作 · 加工提速10%，到访前哨可从农场仓库领取1份干粮。','gold');this.log('三处前哨连成运输网络。下一步可以完成三站远征或两份合同。');this.emit('quest');return true;}
  buildRadio(){if(this.r.radio||this.s.region!=='farm'||!this.r.network||!this.r.finds.includes('relayCore')||!this.takeFarm({relayCore:1,circuit:2,parts:6,cloth:2}))return false;this.r.radio=true;this.log('通信站恢复。现在可以发起通信站防守，保护首次广播。');this.toast('通信站出现 · 发送预警前，需要守住一次地区袭击。','gold');this.assignRegion();this.emit('quest');return true;}
  openAnnex(){if(this.s.region!=='warehouse'||dist(this.s.player,ANNEX.door)>90||this.r.annexOpen)return false;if(!this.r.tech.filtration||this.chapter()<3){this.toast('先建立运输网络、推进至第四章，并研究净水过滤。','warn');return false;}this.r.annexOpen=true;this.navRevision++;this.assignRegion();this.toast('封闭检修间已开启 · 守卫看守着通信核心。','warn');return true;}
  chooseStyle(id){if(!STYLES[id]||this.s.region!=='farm'||['warning','active'].includes(this.s.horde.phase))return false;if(this.r.style===id)return true;if(this.r.style&&this.s.money<30)return false;if(this.r.style)this.s.money-=30;this.r.style=id;this.toast(STYLES[id].name+' · '+STYLES[id].desc,'gold');return true;}
  scoutSiege(id){const d=SIEGES[id],p=d&&OUTPOSTS[d.region];if(!d||this.r.scouted[id]||this.r.siegesWon[id]||this.r.outposts[d.region]<2||this.s.region!==d.region||dist(this.s.player,p)>110)return false;this.r.scouted[id]=true;this.log('侦察'+d.name+'：找到来袭路线，敌群减少2名。');this.toast('侦察完成 · 本次章节防守少2名敌人；侦察路线再少2名。','gold');return true;}
  siegeCount(id){const d=SIEGES[id];return Math.max(6,d.count-(this.r.scouted[id]?2+(this.r.style==='scout'?2:0):0));}
  startSiege(id){
    const d=SIEGES[id];if(!d||this.r.siegesWon[id]||this.s.region!=='farm'||['active','warning'].includes(this.s.horde.phase)||this.r.battle)return false;
    if(id==='hospital'&&this.r.outposts.hospital<2||id==='broadcast'&&!this.r.radio)return false;
    this.r.battle={id,count:this.siegeCount(id),kills:0,trapKills:0,towerKills:0,damage:0,repairs:0,foodSaved:0};this.s.horde={phase:'warning',timer:90,remaining:this.r.battle.count,spawnTimer:0,direction:d.direction};this.c.hordeTheme=d.theme;
    this.toast(d.name+' · 90秒准备时间 · '+d.reward,'warn');this.emit('quest');return true;
  }
  hordeIntel(){const intel=super.hordeIntel(),b=this.r?.battle;if(b){const d=SIEGES[b.id];return {...intel,count:b.count,theme:d.name+' · '+intel.theme,reward:d.reward};}return intel;}
  beginHorde(){const ok=super.beginHorde();if(ok&&this.r.battle)this.s.horde.remaining=this.r.battle.count;return ok;}
  updateHorde(dt){
    const b=this.r.battle,phase=this.s.horde.phase;super.updateHorde(dt);
    if(b&&phase==='active'&&this.s.horde.phase==='won'){this.r.siegesWon[b.id]=true;this.r.lastBattle={...b,day:this.s.day,won:true};this.r.battle=null;this.log(SIEGES[b.id].name+'胜利：陷阱击败'+b.trapKills+'名、瞭望塔击败'+b.towerKills+'名，防御料理抵消'+Math.round(b.foodSaved)+'点伤害。');this.toast(SIEGES[b.id].reward,'gold');this.emit('menu',{menu:'rebuild',tab:'defense'});}
  }
  weaponStats(id){const w=super.weaponStats(id);if(!w)return w;const n={...w};if(this.r?.style==='scout')n.noise*=.65;if(this.r?.style==='mobile'){if(n.mag)n.reload*=.85;else n.damage*=1.15;}return n;}
  hurtEnemy(e,n,a,meta={}){const live=!e.dead,source=this._damageSource||'weapon';if(this.r?.style==='engineer'&&['trap','tower'].includes(source))n*=1.25;super.hurtEnemy(e,n,a,meta);if(live&&e.dead&&e.annexGuardian){this.r.annexDefeated=true;this.log('检修间守卫已处理，通信核心现在可以安全取回。');}const b=this.r?.battle;if(b&&live&&e.dead&&e.horde){b.kills++;if(source==='trap')b.trapKills++;if(source==='tower')b.towerKills++;}}
  enemySenses(e,dt){const d=OUTPOSTS[this.s.region];if(d&&this.r.outposts[this.s.region]>=2&&dist(this.s.player,d)<115)return null;return super.enemySenses(e,dt);}
  updateEnemy(e,dt){
    const d=OUTPOSTS[this.s.region];
    if(d&&this.r.outposts[this.s.region]>=2&&!e.dead&&!e.nest&&dist(e,d)<155){e.windup=0;e.alert=0;e.awareness=0;e.state='patrol';const target={x:d.x+(e.x>=d.x?220:-220),y:d.y};const next=this.lineClear(e,target)?target:this.pathTo(e,target)[0];if(next){const angle=Math.atan2(next.y-e.y,next.x-e.x);this.moveEntity(e,Math.cos(angle)*this.enemySpeed(e)*dt,Math.sin(angle)*this.enemySpeed(e)*dt,true);}return;}
    const old=this._damageSource;this._damageSource='trap';try{return super.updateEnemy(e,dt);}finally{this._damageSource=old;}
  }
  updateDefense(dt){const hp=this.s.buildings.reduce((a,b)=>a+b.hp,0),old=this._damageSource;this._damageSource='tower';try{super.updateDefense(dt);}finally{this._damageSource=old;}if(this.r.battle)this.r.battle.repairs+=Math.max(0,this.s.buildings.reduce((a,b)=>a+b.hp,0)-hp);}
  damagePlayer(n){const b=this.r.battle;if(b&&this.invulnerable<=0){const scale=this.s.difficulty==='casual'?.65:1,defense=this.buff('defense');b.damage+=Math.min(this.s.player.hp,n*scale*(defense?.8:1));if(defense)b.foodSaved+=n*.2*scale;}return super.damagePlayer(n);}
  die(){if(this.r.battle){this.r.lastBattle={...this.r.battle,day:this.s.day,won:false};this.r.battle=null;this.s.horde={phase:this.s.stats.hordes?'won':'locked',timer:0,remaining:0,spawnTimer:0};for(const e of this.s.enemies.farm||[])if(e.horde)e.dead=true;this.c.nextHordeDay=this.s.day+3;this.log('章节防守暂时失守。工程、研究和前哨保留，补给后可重试。');}return super.die();}
  finishRoute(retreat=false){const route=this.f.route,success=route&&!retreat&&!route.failed&&route.stage>=2&&route.secured;const ok=super.finishRoute(retreat);if(ok&&success){this.r.metrics.expeditions++;if(this.r.metrics.expeditions===1){this.putStorage({circuit:2,parts:3});this.grantResearch(1);this.toast('首次三站远征：动力研究电路与零件已入库，运输目标已推进。','gold');}}return ok;}
  travel(id){const before=this.s.region,ok=super.travel(id);if(ok&&before!==this.s.region){this._outpostHealed=false;this._networkMeal=false;if(OUTPOSTS[this.s.region])this.r.outposts[this.s.region]=Math.max(1,this.r.outposts[this.s.region]);}return ok;}
  colliders(enemy=false){const list=super.colliders(enemy);if(this.s.region==='warehouse'&&this.r){list.push({x:1300,y:810,w:80,h:10},{x:1460,y:810,w:30,h:10},{x:1300,y:810,w:10,h:130},{x:1480,y:810,w:10,h:130},{x:1300,y:930,w:190,h:10});if(!this.r.annexOpen)list.push({x:1380,y:810,w:80,h:10,annexDoor:true});}return list;}
  assignRegion(){
    super.assignRegion();const r=this.s.rebuild;if(!r)return;const id=this.s.region;
    if(id==='farm'){
      const board=this.objects.find(o=>o.type==='frontierBoard');if(board)board.name='营地手册 · 家园事务';
      if(r.network)this.objects.push({type:'network',name:'营地运输网络',x:905,y:320,icon:40});
      if(r.radio)this.objects.push({type:'radioStation',name:r.ended?'正在广播的通信站':'恢复的通信站',x:1220,y:390,icon:55});
      if(r.arcs.farmer>=3)this.objects.push({type:'seedDisplay',name:'阿禾的种子展示',x:875,y:570,icon:34});
      if(r.arcs.medic>=3)this.objects.push({type:'visitor',name:'来诊所的访客',x:650,y:360,icon:56});
      if(r.arcs.mechanic>=3||r.ended)this.objects.push({type:'visitor',name:'运输队的幸存者',x:930,y:320,icon:56});
    }
    if(OUTPOSTS[id]){
      const d=OUTPOSTS[id];this.objects.push({type:'outpost',outpost:id,name:d.name+(r.outposts[id]>=2?' · 已恢复':' · 待施工'),x:d.x,y:d.y,icon:r.outposts[id]>=2?43:40});
      if(r.outposts[id]>=2)this.objects.push({type:'outpostResident',name:RESIDENTS[d.resident].name+'的协作点',x:d.x+70,y:d.y+30,icon:RESIDENTS[d.resident].icon});
    }
    for(const [key,d]of Object.entries(FIND_LOCATIONS))if(id===d.region&&!r.finds.includes(key)&&(!d.annex||r.annexOpen))this.objects.push({...d,type:'rebuildFind',find:key});
    if(id==='warehouse'){
      this.objects.push({type:'annexDoor',name:r.annexOpen?'检修间已开放':'封闭检修间 · 需过滤技术',...ANNEX.door,icon:63});
      if(r.annexOpen&&!r.annexDefeated&&!this.enemies.some(e=>e.annexGuardian&&!e.dead)){const e=this.enemy('elite',1420,870);Object.assign(e,{annexGuardian:true,hp:340,maxHp:340,parts:{armor:80,legs:80,pack:60}});this.enemies.push(e);r.annexGuardian=true;}
    }
  }
  context(o){if(o?.type==='rebuildFind')return '取得'+ITEMS[o.find].name+' · '+this.itemPurpose(o.find);if(o?.type==='outpost')return '前哨施工 / 补给 / 侦察';if(o?.type==='annexDoor')return this.r.annexOpen?'进入检修间，寻找通信核心':'开启检修间 · 第四章与净水过滤';if(['network','radioStation','seedDisplay','visitor','outpostResident'].includes(o?.type))return '查看重建成果与后续目标';if(o?.type==='frontierBoard'||o?.type==='sign')return '营地手册 · 目标与家园';return super.context(o);}
  interact(){if(this.paused)return;const o=this.nearestObject();if(o?.type==='rebuildFind')return this.collectFind(o.find);if(o?.type==='annexDoor'){if(!this.r.annexOpen)return this.openAnnex();this.toast('检修间已开放，通信核心在房间内。');return;}if(o?.type==='outpost'){if(this.r.network&&!this._networkMeal&&this.r.outposts[o.outpost]>=2&&this.s.storage.bread>0&&this.canReceive({bread:1},true)){if(this.add({bread:1},true)){this.s.storage.bread--;this._networkMeal=true;this.toast('运输网络从农场仓库送来1份干粮，本次到访一次。');}}this.emit('menu',{menu:'rebuild',tab:'expedition',outpost:o.outpost});return;}if(['sign','frontierBoard','network','radioStation','seedDisplay','visitor','outpostResident'].includes(o?.type)){this.emit('menu',{menu:'rebuild',tab:o.type==='radioStation'?'research':'overview'});return;}return super.interact();}
  update(dt,input={}){if(this.paused)return;const p=this.s.player,before={x:p.x,y:p.y};super.update(dt,input);if(!this.paused&&this.r.style==='mobile'&&(input.x||input.y))this.moveEntity(p,(p.x-before.x)*.1,(p.y-before.y)*.1);}
  static parse(text){
    const raw=JSON.parse(text);
    // v0.4 botany awarded an obsolete item key; repair only this known alias before validation.
    for(const bucket of [raw.inventory,raw.storage,raw.outing,raw.frontier?.route?.cargo,raw.frontier?.route?.supplies,...(raw.drops||[]).map(d=>d.items),...Object.values(raw.opened||{}).map(o=>o.stock)])if(bucket&&Object.hasOwn(bucket,'tea')){if(!Number.isInteger(bucket.tea)||bucket.tea<0||bucket.tea>999999||bucket.herbTea!=null&&(!Number.isInteger(bucket.herbTea)||bucket.herbTea<0))throw Error('存档物品损坏。');bucket.herbTea=(bucket.herbTea||0)+bucket.tea;delete bucket.tea;}
    for(const cell of raw.frontier?.route?.cells||[])if(cell.id==='tea')cell.id='herbTea';
    const s=FrontierEngine.parse(JSON.stringify(raw)),r=raw.rebuild;if(r){
      const object=v=>v&&typeof v==='object'&&!Array.isArray(v),int=(v,max=1e7)=>Number.isInteger(v)&&v>=0&&v<=max,boolMap=(v,ids)=>object(v)&&Object.entries(v).every(([id,b])=>ids.includes(id)&&typeof b==='boolean'),numberMap=(v,ids,max)=>object(v)&&Object.entries(v).every(([id,n])=>ids.includes(id)&&int(n,max)),ids=(v,allowed)=>Array.isArray(v)&&new Set(v).size===v.length&&v.every(id=>allowed.includes(id));
      const bad=()=>{throw Error('重建之路存档损坏。');};
      if(!object(r)||r.revision!==1||!ids(r.claimed,TASKS.map(q=>q.id))||r.claimed.some((id,i)=>TASKS[i]?.id!==id)||!ids(r.finds,Object.keys(FIND_LOCATIONS))||r.focus!=null&&!TASKS.some(q=>q.id===r.focus)||!boolMap(r.tech,['seedbank','filtration','power'])||!numberMap(r.outposts,regions,3)||!numberMap(r.arcs,Object.keys(ARCS),3)||!boolMap(r.scouted,Object.keys(SIEGES))||!boolMap(r.siegesWon,Object.keys(SIEGES))||!CROPS[r.farmPlan]||r.style!=null&&!STYLES[r.style])bad();
      for(const key of ['annexOpen','annexGuardian','annexDefeated','seedbankUsed','radio','network','fields','ended'])if(typeof r[key]!=='boolean')bad();
      if(!object(r.metrics)||!int(r.metrics.food)||!int(r.metrics.medicine)||!int(r.metrics.expeditions)||!numberMap(r.metrics.produced,Object.keys(ITEMS),999999)||!int(r.medicineDay,99999)||!int(r.contractSerial)||!numberMap(r.contractTotals,regions,999999)||!numberMap(r.contractDays,regions,99999)||!numberMap(r.serviceDays,regions,99999)||!Array.isArray(r.logs)||r.logs.length>12||r.logs.some(x=>!int(x.day,99999)||typeof x.text!=='string'||x.text.length>500))bad();
      const battle=b=>object(b)&&SIEGES[b.id]&&['count','kills','trapKills','towerKills','damage','repairs','foodSaved'].every(key=>typeof b[key]==='number'&&Number.isFinite(b[key])&&b[key]>=0&&b[key]<=100000)&&int(b.count,24);
      if(r.battle&&!battle(r.battle)||r.lastBattle&&(!battle(r.lastBattle)||typeof r.lastBattle.won!=='boolean'||!int(r.lastBattle.day,99999)))bad();
      if(r.contract){const c=r.contract;if(!OUTPOSTS[c.region]||typeof c.id!=='string'||!int(c.acceptedDay,99999)||!CONTRACTS[c.region].some(t=>t.name===c.name&&JSON.stringify(t.cost)===JSON.stringify(c.cost)&&JSON.stringify(t.reward)===JSON.stringify(c.reward)&&t.money===c.money))bad();}
      for(const p of s.plots)if(p.rebuildNew!=null&&typeof p.rebuildNew!=='boolean')bad();
    }
    return migrateState(s);
  }
}
