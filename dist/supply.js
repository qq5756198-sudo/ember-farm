import {Engine as RebuildEngine,freshState as rebuildFresh,demoState as rebuildDemo,migrateState as migrateRebuild} from './rebuild.js';
import {ITEMS,CROPS,BUILDINGS,RECIPES,REGIONS} from './data.js';
import {PROJECTS,RESIDENTS} from './expansion-data.js';
import {TASKS,OUTPOSTS,RESEARCH,ARCS} from './rebuild-data.js';
import {PLAN_RECIPES,RESERVE_ITEMS,COOP,COOP_COSTS,COOP_THRESHOLDS,COOP_LEVELS} from './supply-data.js';

const copy=v=>JSON.parse(JSON.stringify(v));
const defaults=()=>({revision:1,pin:'auto',plans:{},reserves:{},autoJobs:[],cooperation:Object.fromEntries(Object.keys(COOP).map(id=>[id,{level:0,mode:'supply'}])),completed:0,lastShipment:null,visitHealed:false,visitMeal:false,fieldAwarded:0});
export function migrateState(s){
  migrateRebuild(s);const fresh=!s.supply,d=defaults();
  s.supply={...d,...s.supply};
  for(const k of ['plans','reserves','cooperation'])s.supply[k]={...d[k],...s.supply[k]};
  if(fresh&&s.rebuild.fields)s.supply.fieldAwarded=Math.min(6,s.plots.filter(p=>p.rebuildNew).length);
  s.supplyVersion=6;return s;
}
export const freshState=(difficulty='casual')=>migrateState(rebuildFresh(difficulty));
export const demoState=()=>migrateState(rebuildDemo());

export class Engine extends RebuildEngine {
  constructor(state=freshState(),notify=()=>{}){
    super(migrateState(state),notify);
    this._outpostHealed=this.u.visitHealed;this._networkMeal=this.u.visitMeal;
    if(this.s.region==='farm'&&this.r.claimed.includes('hospitalDefense')&&this.u.fieldAwarded<6)this.addRebuildFields();
    this.assignRegion();
  }
  get u(){return this.s.supply;}
  planCapacity(){return 3;}
  planUnlockReason(){return this.projectStage('market')<1?'先完成集市第一阶段，建立供给调度':!this.hasBuilding('workbench')?'先建好制作台':'';}
  planRecipe(id){return PLAN_RECIPES.includes(id)?RECIPES.find(r=>r.id===id):null;}
  recipeFacilityReason(r){
    if(!r)return '配方不存在';
    if(r.unlock==='blueprint'&&!this.s.blueprint)return '先取得精密蓝图';
    if(r.unlock&&r.unlock!=='blueprint'&&!this.s.visited[r.unlock])return '先探索'+REGIONS[r.unlock].name;
    if(r.id==='parcel'&&!this.c.technologies.canner)return '先取得罐装工艺蓝图';
    if(!this.hasBuilding(r.station==='weaponbench2'?'weaponbench':r.station)||r.station==='weaponbench2'&&this.s.benchLevel<2)return '先建好'+(r.station==='weaponbench2'?'二级武器工作台':BUILDINGS[r.station]?.name||'对应设施');
    return '';
  }
  pendingAmount(id){return this.c.production.reduce((n,j)=>n+(j.out[id]||0),0);}
  stockAmount(id){return (this.s.storage[id]||0)+(CROPS[id]?(this.s.storage['hardy_'+id]||0):0);}
  autoCostPlan(cost){
    const used={};
    for(const [id,n]of Object.entries(cost)){
      if(this.stockAmount(id)-(this.u.reserves[id]||0)<n)return null;
      let left=n;for(const key of CROPS[id]?[id,'hardy_'+id]:[id]){
        const take=Math.min(left,Math.max(0,(this.s.storage[key]||0)-(used[key]||0)));
        if(take){used[key]=(used[key]||0)+take;left-=take;}
      }
      if(left)return null;
    }
    return used;
  }
  planStatus(id){
    const r=this.planRecipe(id),p=this.u.plans[id];if(!r||!p)return '尚未设置';
    if(!p.enabled)return '已暂停；在制批次仍会完成';
    const unlock=this.planUnlockReason();if(unlock)return unlock;
    const facility=this.recipeFacilityReason(r);if(facility)return facility;
    const item=Object.keys(r.out)[0],stock=this.stockAmount(item),pending=this.pendingAmount(item);
    if(stock>=p.target)return '储备已达标，暂停投料';
    if(stock+pending>=p.target)return '在制品已覆盖缺口，等待完成';
    if(this.u.autoJobs.some(key=>this.c.production.some(j=>j.id===key&&j.recipe===id)))return '正在加工；每条计划同时一批';
    const missing=Object.entries(this.effectiveCost(r.cost)).filter(([key,n])=>this.stockAmount(key)-(this.u.reserves[key]||0)<n);
    if(missing.length)return '等待仓库材料：'+missing.map(([key,n])=>ITEMS[key].name+'可用'+Math.max(0,this.stockAmount(key)-(this.u.reserves[key]||0))+'/'+n).join('、');
    if(this.c.production.length>=12||this.u.autoJobs.length>=this.planCapacity())return '队列繁忙，等待空位';
    return '准备投料；关闭菜单后运转';
  }
  setSupplyPlan(id,target,enabled=true){
    if(this.s.region!=='farm'||!this.planRecipe(id)||!Number.isInteger(target)||target<1||target>30||typeof enabled!=='boolean')return false;
    if(enabled&&this.planUnlockReason()){this.toast(this.planUnlockReason(),'warn');return false;}
    if(enabled&&!this.u.plans[id]?.enabled&&Object.values(this.u.plans).filter(p=>p.enabled).length>=this.planCapacity()){this.toast('最多同时维持'+this.planCapacity()+'条供给计划，先暂停一条。','warn');return false;}
    this.u.plans[id]={target,enabled};this.toast('供给计划已保存 · '+ITEMS[Object.keys(this.planRecipe(id).out)[0]].name+'目标'+target);return true;
  }
  toggleSupplyPlan(id){const p=this.u.plans[id];return !!p&&this.setSupplyPlan(id,p.target,!p.enabled);}
  setReserve(id,n){if(this.s.region!=='farm'||!RESERVE_ITEMS.includes(id)||!Number.isInteger(n)||n<0||n>30)return false;this.u.reserves[id]=n;return true;}
  fillSupplyPlans(){
    if(this.planUnlockReason())return;
    for(const [id,p]of Object.entries(this.u.plans)){
      if(!p.enabled||this.c.production.length>=12||this.u.autoJobs.length>=this.planCapacity())continue;
      const r=this.planRecipe(id),item=Object.keys(r.out)[0];
      if(this.recipeFacilityReason(r)||this.stockAmount(item)+this.pendingAmount(item)>=p.target||this.u.autoJobs.some(key=>this.c.production.some(j=>j.id===key&&j.recipe===id)))continue;
      const cost=this.autoCostPlan(this.effectiveCost(r.cost));if(!cost)continue;
      for(const [key,n]of Object.entries(cost))this.s.storage[key]-=n;
      const job={id:'job-'+this.s.idCounter++,recipe:id,out:copy(r.out),cost,station:r.station,remaining:r.minutes,ready:false};
      this.c.production.push(job);this.u.autoJobs.push(job.id);
    }
  }
  storeProduction(id,automatic=false){
    const job=this.c.production.find(j=>j.id===id);if(!job?.ready||!automatic&&this.s.region!=='farm')return false;
    this.putStorage(job.out);this.recordProduced(job.out);this.xp('manufacturing',5);
    this.c.production=this.c.production.filter(j=>j!==job);this.u.autoJobs=this.u.autoJobs.filter(key=>key!==id);
    this.u.completed++;this.c.lastNotice='加工成品已入仓，可用于工程、餐食与合同';return true;
  }
  storeAllProduction(){if(this.s.region!=='farm')return false;let n=0;for(const j of [...this.c.production])if(this.storeProduction(j.id))n++;if(n)this.toast(n+'批成品已入仓，背包空间不影响领取。','gold');return n>0;}
  processProduction(n){
    if(!Number.isFinite(n)||n<=0)return;
    let left=n;while(left>0){
      for(const id of [...this.u.autoJobs])this.storeProduction(id,true);
      this.fillSupplyPlans();const step=Math.min(left,5);super.processProduction(step);left-=step;
      for(const id of [...this.u.autoJobs])this.storeProduction(id,true);
    }
  }
  collectProduction(id){const ok=super.collectProduction(id);if(ok)this.u.autoJobs=this.u.autoJobs.filter(key=>key!==id);return ok;}
  cancelProduction(id){
    if(!this.u.autoJobs.includes(id))return super.cancelProduction(id);
    const job=this.c.production.find(j=>j.id===id);if(this.s.region!=='farm'||!job||job.ready)return false;
    this.putStorage(job.cost);this.c.production=this.c.production.filter(j=>j!==job);this.u.autoJobs=this.u.autoJobs.filter(key=>key!==id);
    if(this.u.plans[job.recipe])this.u.plans[job.recipe].enabled=false;
    this.toast('自动批次已取消，实际材料退回仓库，该计划已暂停。');return true;
  }
  depositIngredient(id){
    if(this.s.region!=='farm'||!ITEMS[id]||ITEMS[id].protected)return false;
    let n=0;for(const key of CROPS[id]?[id,'hardy_'+id]:[id]){const amount=this.qty(key);if(amount){this.s.inventory[key]-=amount;this.putStorage({[key]:amount});n+=amount;}}
    if(n)this.toast(ITEMS[id].name+'入仓'+n+'份；优质作物仍留给你安排。');return n>0;
  }
  cooperationReward(id,level=this.u.cooperation[id]?.level,mode=this.u.cooperation[id]?.mode){
    const d=COOP[id]?.[mode];return d&&level?Object.fromEntries(Object.entries(d.bundle).map(([key,n])=>[key,n*level])):{};
  }
  cooperationReason(id){
    const p=this.u.cooperation[id];if(!p)return '无效地区';if(p.level>=3)return '地区复兴已完成';
    if(this.s.region!=='farm')return '返回农场组织地区施工';
    if(this.r.outposts[id]<2)return '先恢复前哨';
    if(this.r.contractTotals[id]<COOP_THRESHOLDS[p.level])return '先完成该地区'+COOP_THRESHOLDS[p.level]+'份长期合同（当前'+this.r.contractTotals[id]+'份）';
    if(!this.costPlan(COOP_COSTS[p.level],true))return '地区施工材料不足';return '';
  }
  upgradeCooperation(id){
    const reason=this.cooperationReason(id);if(reason){this.toast(reason,'warn');return false;}
    const p=this.u.cooperation[id];if(!this.takeFarm(COOP_COSTS[p.level]))return false;p.level++;
    this.log(OUTPOSTS[id].name+'建成'+COOP_LEVELS[p.level]+'。以后每份合同额外获得所选支援物资×'+p.level+'。');
    this.toast('地区建设完成 · '+COOP_LEVELS[p.level],'gold');this.assignRegion();return true;
  }
  chooseCooperation(id,mode){
    const p=this.u.cooperation[id];if(this.s.region!=='farm'||!p||!COOP[id]?.[mode]||p.mode===mode)return false;
    p.mode=mode;this.toast('下份合同回程物资：'+COOP[id][mode].name+'。已有奖励不会重发。');return true;
  }
  deliverContract(){
    const id=this.r.contract?.region,ok=super.deliverContract();if(!ok)return false;
    const reward=this.cooperationReward(id);if(Object.keys(reward).length){this.putStorage(reward);this.u.lastShipment={region:id,day:this.s.day,reward};this.log(OUTPOSTS[id].name+'回程支援已入库：'+Object.entries(reward).map(([key,n])=>ITEMS[key].name+'×'+n).join('、'));}
    this.assignRegion();return true;
  }
  goalOptions(){
    return [{id:'auto',name:'跟随当前主线'},...(this.r.contract?[{id:'contract',name:'合同 · '+this.r.contract.name}]:[]),
      ...Object.keys(PROJECTS).filter(id=>!this.projectDone(id)).map(id=>({id:'project:'+id,name:'公共工程 · '+PROJECTS[id].name})),
      ...['workbench','bed','breeder','canner','irrigation','solar','drone','tower'].filter(id=>!BUILDINGS[id].retired).map(id=>({id:'building:'+id,name:'设施 · '+BUILDINGS[id].name})),
      ...Object.keys(ARCS).filter(id=>this.resident(id)&&this.r.arcs[id]<3).map(id=>({id:'arc:'+id,name:'愿望 · '+RESIDENTS[id].name})),
      ...Object.keys(RESEARCH).filter(id=>!this.r.tech[id]).map(id=>({id:'research:'+id,name:'调查 · '+RESEARCH[id].name})),
      ...Object.keys(OUTPOSTS).map(id=>({id:(this.r.outposts[id]>=2?'cooperation:':'outpost:')+id,name:'地区 · '+OUTPOSTS[id].name}))];
  }
  pinGoal(id){if(!this.goalOptions().some(g=>g.id===id))return false;this.u.pin=id;return true;}
  mainGoalKey(){
    const id=this.currentRebuildTask()?.id;
    if(id==='table')return this.projectStage('market')<1?'project:market':!this.hasBuilding('workbench')?'building:workbench':this.residentsCapacity()<2?'building:bed':'task:table';
    if(id==='meal'&&this.r.metrics.food<1)return 'recipe:trailBread';
    if(id==='medical'&&this.r.metrics.medicine<1)return !this.hasBuilding('workbench')?'building:workbench':'recipe:bandage';
    if(id==='hospital')return this.projectStage('clinic')<1?'project:clinic':this.r.outposts.hospital<2?'outpost:hospital':'task:hospital';
    if(id==='water')return !this.projectDone('water')?'project:water':this.r.outposts.residential<2?'outpost:residential':'task:water';
    if(id==='power'&&this.resident('mechanic')&&this.r.finds.includes('driveModule')&&!this.r.tech.power)return 'research:power';
    if(id==='warehouse')return !this.projectDone('bridge')?'project:bridge':this.r.outposts.warehouse<2?'outpost:warehouse':'task:warehouse';
    if(id==='network'&&!this.r.network)return 'network';
    if(id==='network'&&this.r.contract)return 'contract';
    if(id==='filter'&&!this.r.tech.filtration)return 'research:filtration';
    if(id==='radio'&&!this.r.radio)return 'radio';
    return id?'task:'+id:this.r.contract?'contract':'endgame';
  }
  supplyGoal(){
    const key=this.u.pin==='auto'?this.mainGoalKey():this.u.pin,[type,id]=key.split(':'),q=this.currentRebuildTask();
    const g={key,title:'选择下一次地区建设',cost:{},where:'rebuild:expedition',use:'主线结束后继续建设前哨，选择支援方向并维持农场。',local:false};
    if(type==='project'){const d=PROJECTS[id],stage=this.projectStage(id);return {...g,title:d.name+' · 阶段'+Math.min(2,stage+1),cost:d.stages[stage]?.cost||{},where:'camp:projects',use:d.reward,done:stage>=2};}
    if(type==='building'){const d=BUILDINGS[id];return {...g,title:'建设'+d.name,cost:d.cost,where:'build:',use:d.desc};}
    if(type==='arc'){const a=ARCS[id][this.r.arcs[id]];return {...g,title:RESIDENTS[id].name+' · '+(a?.title||'愿望完成'),cost:a?.cost||{},where:'rebuild:residents',use:a?.effect||'人物能力持续生效。',done:!a};}
    if(type==='research'){const d=RESEARCH[id];return {...g,title:d.name,cost:this.r.tech[id]?{}:d.cost,where:'rebuild:research',use:d.desc,done:!!this.r.tech[id]};}
    if(type==='outpost'){const d=OUTPOSTS[id];return {...g,title:d.name+'施工',cost:this.r.outposts[id]>=2?{}:d.cost,where:'rebuild:expedition',use:d.service,local:true,region:id,done:this.r.outposts[id]>=2};}
    if(type==='cooperation'){const p=this.u.cooperation[id];return {...g,title:OUTPOSTS[id].name+' · '+(COOP_LEVELS[p.level+1]||'复兴完成'),cost:COOP_COSTS[p.level]||{},where:'rebuild:expedition',use:p.level<3?'累计'+COOP_THRESHOLDS[p.level]+'份该地区合同后升级，合同回程支援增至'+(p.level+1)+'倍。':'可随时切换支援方向，继续通过合同取得物资。',done:p.level>=3};}
    if(key==='contract'){const c=this.r.contract;return {...g,title:c?'合同 · '+c.name:'合同已完成或取消',cost:c?.cost||{},where:'rebuild:expedition',use:c?'取得金币、实物奖励并推进'+OUTPOSTS[c.region].name+'的地区建设。':'选择下一份长期合同。',done:!c};}
    if(key==='network')return {...g,title:'建设运输网络 · 散装路线',cost:this.networkCost('bulk'),where:'rebuild:production',use:'三处前哨恢复后建设，加工提速并向前哨运送干粮；也可在工程页改用配送箱。'};
    if(key==='radio')return {...g,title:'恢复无线电站',cost:{relayCore:1,circuit:2,parts:6,cloth:2},where:'rebuild:production',use:'农场出现通信站，开启最后一次章节防守。'};
    if(type==='recipe'){const r=RECIPES.find(r=>r.id===id);return {...g,title:'加工'+ITEMS[Object.keys(r.out)[0]].name,cost:this.effectiveCost(r.cost),where:'craft:',use:'投入材料后等待'+r.minutes+'游戏分钟，领取或入仓才计入主线；'+this.itemPurpose(Object.keys(r.out)[0]),recipe:id};}
    if(type==='task')return {...g,title:q?.title||'主线完成',cost:q?.cost||{},where:'rebuild:'+(q?.pillar||'overview'),use:q?.outcome||g.use,task:id};
    return g;
  }
  sourceFor(id){
    const base=id.replace(/^(fine_|hardy_)/,'');
    if(CROPS[base])return {text:(id.startsWith('fine_')?'精细照料或育种获取优质':'种植')+CROPS[base].name+'；种子可在集市购买或育种留种',where:'rebuild:farm',crop:base};
    const recipe=RECIPES.find(r=>r.out[id]&&!r.id.startsWith('breed_')&&r.minutes);
    if(recipe)return {text:BUILDINGS[recipe.station].name+' · '+Object.entries(this.effectiveCost(recipe.cost)).map(([key,n])=>ITEMS[key].name+'×'+n).join('＋')+' → '+recipe.out[id]+'份 · '+recipe.minutes+'分钟',where:'craft:',recipe:recipe.id};
    const text={wood:'农场清理杂物，或去废墟拆解货架',stone:'农场清理石堆，或从补给商购买',scrap:'废墟拆解旧设备，或从机械商购买',parts:'机械商购买、拆解设备、前哨合同奖励',circuit:'恢复仓库前哨后，6废金属换2电路',seedArchive:'住宅区后院档案箱首次必得',pumpModule:'医院东侧急救区设备首次必得',driveModule:'击败仓库设备箱守卫后取得',relayCore:'完成过滤研究，进入仓库检修间击败守卫'}[id]||this.itemPurpose(id);
    return {text,where:['wood','stone','parts'].includes(id)?'map:':'rebuild:expedition'};
  }
  goalMaterials(){
    const g=this.supplyGoal();return Object.entries(g.cost).map(([id,need])=>({id,need,have:this.quantityForCost(id,true),carried:this.quantityForCost(id,false),pending:this.pendingAmount(id),missing:Math.max(0,need-this.quantityForCost(id,true)),source:this.sourceFor(id)}));
  }
  goalIngredientNeeds(){
    // Allocate stock once across direct costs and recursive recipe ingredients.
    // This avoids promising the same cloth to both construction and bandages.
    const available={};for(const id of Object.keys(ITEMS))available[id]=this.qty(id,true);
    const take=(id,n)=>{let left=n;for(const key of CROPS[id]?[id,'hardy_'+id,'fine_'+id]:[id]){const used=Math.min(left,available[key]||0);available[key]=(available[key]||0)-used;left-=used;}return left;};
    const shortage={};for(const [id,n]of Object.entries(this.supplyGoal().cost)){const left=take(id,n);if(left)shortage[id]=left;}
    const leaves={},walk=(id,n,path=[])=>{const recipe=RECIPES.find(r=>r.minutes&&r.out[id]);if(!recipe||path.includes(id)){leaves[id]=(leaves[id]||0)+n;return;}const batches=Math.ceil(n/recipe.out[id]);available[id]=(available[id]||0)+batches*recipe.out[id]-n;for(const [key,cost]of Object.entries(this.effectiveCost(recipe.cost))){const left=take(key,cost*batches);if(left)walk(key,left,[...path,id]);}};
    for(const [id,n]of Object.entries(shortage))walk(id,n);
    return leaves;
  }
  outpostHeal(id){if(this.s.player.hp>=this.maxHp()){this.toast('生命已满，本次免费治疗保留。');return false;}const ok=super.outpostHeal(id);if(ok)this.u.visitHealed=true;return ok;}
  travel(id){const before=this.s.region,ok=super.travel(id);if(ok&&this.s.region!==before){this.u.visitHealed=false;this.u.visitMeal=false;if(this.s.region==='farm'&&this.r.claimed.includes('hospitalDefense')&&this.u.fieldAwarded<6)this.addRebuildFields();}return ok;}
  interact(){const result=super.interact();this.u.visitMeal=!!this._networkMeal;return result;}
  addRebuildFields(){
    if(!this.u)return super.addRebuildFields();if(this.u.fieldAwarded>=6)return;
    const candidates=[];for(const y of [650,690,730])for(const x of [940,980,1020])candidates.push({x,y});
    for(let y=410;y<=890;y+=40)for(let x=240;x<=1000;x+=40)candidates.push({x,y});
    let added=0;for(const p of candidates){if(this.u.fieldAwarded>=6)break;if(this.blocked(p.x,p.y)||this.s.plots.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<35)||this.plotDebris(p))continue;
      this.s.plots.push({id:this.s.idCounter++,...p,tilled:true,crop:null,growth:0,wateredDay:0,waterUnits:0,care:0,fertility:75,lastCrop:null,soilCharged:false,rebuildNew:true});this.u.fieldAwarded++;added++;
    }
    this.r.fields=this.u.fieldAwarded>=6;if(added)this.log('新土地实际增加'+added+'块（已交付'+this.u.fieldAwarded+'/6）；原定位置被占用时使用空地。');
    if(!this.r.fields)this.toast('新田仍有'+(6-this.u.fieldAwarded)+'块待安排，清出农场空地后返回即可补齐。','warn');
  }
  assignRegion(){super.assignRegion();if(!this.s.supply)return;const p=this.u.cooperation[this.s.region];if(p?.level){const o=this.objects.find(o=>o.type==='outpost');if(o){o.name+=' · '+COOP_LEVELS[p.level];o.coopLevel=p.level;o.coopMode=p.mode;}}}
  static parse(text){
    const raw=JSON.parse(text),s=RebuildEngine.parse(text),u=raw.supply;
    if(u!=null){
      const object=v=>v&&typeof v==='object'&&!Array.isArray(v),int=(v,max)=>Number.isInteger(v)&&v>=0&&v<=max;
      const bad=()=>{throw Error('供给与远行存档损坏。');};const cap=raw.echoes?.benefits?.loadtest==='dispatch'?4:3;
      if(!object(u)||Object.keys(u).some(k=>!Object.hasOwn(defaults(),k))||u.revision!==1||typeof u.pin!=='string'||u.pin.length>80||!object(u.plans)||!object(u.reserves)||!object(u.cooperation)||!Array.isArray(u.autoJobs)||u.autoJobs.length>cap||new Set(u.autoJobs).size!==u.autoJobs.length||!int(u.completed,1e7)||!int(u.fieldAwarded,6)||typeof u.visitHealed!=='boolean'||typeof u.visitMeal!=='boolean')bad();
      if(Object.entries(u.plans).some(([id,p])=>!PLAN_RECIPES.includes(id)||!object(p)||Object.keys(p).some(k=>!['target','enabled'].includes(k))||!int(p.target,30)||p.target<1||typeof p.enabled!=='boolean')||Object.values(u.plans).filter(p=>p.enabled).length>cap)bad();
      if(Object.entries(u.reserves).some(([id,n])=>!RESERVE_ITEMS.includes(id)||!int(n,30)))bad();
      if(Object.keys(u.cooperation).length!==3||Object.entries(u.cooperation).some(([id,p])=>!COOP[id]||!object(p)||Object.keys(p).some(k=>!['level','mode'].includes(k))||!int(p.level,3)||!COOP[id][p.mode]||p.level>0&&(s.rebuild.outposts[id]<2||s.rebuild.contractTotals[id]<COOP_THRESHOLDS[p.level-1])))bad();
      for(const key of u.autoJobs){
        const j=s.colony.production.find(j=>j.id===key),r=j&&RECIPES.find(r=>r.id===j.recipe);
        if(!j||s.colony.production.filter(j=>j.id===key).length!==1||!PLAN_RECIPES.includes(j.recipe)||j.station!==r.station||JSON.stringify(j.out)!==JSON.stringify(r.out)||!object(j.cost)||typeof j.ready!=='boolean'||j.remaining>r.minutes||j.ready!==(j.remaining===0))bad();
        const paid={};for(const [item,n]of Object.entries(j.cost)){const base=item.replace(/^hardy_/,'');if(!Object.hasOwn(r.cost,base)||item.startsWith('fine_')||!int(n,100)||!n)bad();paid[base]=(paid[base]||0)+n;}
        // Specializations may change after a batch is prepaid. Accept either legal cost,
        // but never trust an edited refund amount from an imported save.
        if(![false,true].some(economy=>Object.entries(r.cost).every(([id,n])=>paid[id]===(economy?Math.max(1,Math.floor(n*.8)):n))))bad();
      }
      if(u.lastShipment&&(!COOP[u.lastShipment.region]||!int(u.lastShipment.day,99999)||!object(u.lastShipment.reward)||Object.entries(u.lastShipment.reward).some(([id,n])=>!Object.hasOwn(ITEMS,id)||!int(n,100))))bad();
      const validPins=['auto','contract',...Object.keys(PROJECTS).map(id=>'project:'+id),...Object.keys(BUILDINGS).map(id=>'building:'+id),...Object.keys(ARCS).map(id=>'arc:'+id),...Object.keys(RESEARCH).map(id=>'research:'+id),...Object.keys(COOP).flatMap(id=>['cooperation:'+id,'outpost:'+id])];if(!validPins.includes(u.pin))bad();
      s.supply=copy(u);
    }
    return migrateState(s);
  }
}
