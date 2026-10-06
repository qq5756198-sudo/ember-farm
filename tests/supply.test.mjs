import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine,freshState,demoState} from '../dist/supply.js';
import {freshState as v5State,Engine as V5} from '../dist/rebuild.js';
import {freshState as v1State} from '../dist/engine.js';
import {BUILDINGS,ITEMS,RECIPES,CROPS} from '../dist/data.js';
import {TASKS,OUTPOSTS} from '../dist/rebuild-data.js';
import {COOP_COSTS,COOP_THRESHOLDS,PLAN_RECIPES} from '../dist/supply-data.js';
import {renderSupplyGoal,renderSupplyPlans,renderCooperation,handleSupplyAction} from '../dist/supply-ui.js';
import {renderRebuild} from '../dist/rebuild-ui.js';

const make=()=>{const e=new Engine(demoState());e.paused=false;return e;};
const building=(e,type,x=850,y=760)=>{e.s.buildings.push({id:'test-'+e.s.idCounter++,type,x,y,hp:BUILDINGS[type].hp,rotation:0});e.assignRegion();};
const unlock=e=>{e.c.projects.market=1;building(e,'workbench');};
const cooperation=e=>{e.r.claimed=TASKS.slice(0,8).map(q=>q.id);e.r.outposts={residential:3,hospital:3,warehouse:3};e.r.contractTotals={residential:2,hospital:2,warehouse:2};};
const provision=(e,b)=>{e.putStorage(b);};

test('v1 and v5 migration preserve all resources, buildings, jobs, demo identity and main progress',()=>{
  for(const makeState of [v1State,v5State,demoState]){
    const s=makeState();s.money=729;s.inventory.potato=17;s.storage.parts=11;
    const before=structuredClone(s);
    const migrated=Engine.parse(JSON.stringify(s));
    for(const key of ['inventory','storage','buildings','money'])assert.deepEqual(migrated[key],before[key]);
    for(let i=0;i<before.plots.length;i++)for(const [key,value]of Object.entries(before.plots[i]))assert.deepEqual(migrated.plots[i][key],value);
    assert.deepEqual(migrated.supply.plans,{});assert.equal(migrated.supply.pin,'auto');assert.equal(migrated.supplyVersion,6);
    assert.equal(migrated.frontier.demo,!!s.frontier?.demo);
  }
  const old=new V5(v5State());old.s.inventory.radish=3;assert.ok(old.craft('trailBread'));const e=new Engine(Engine.parse(old.serialize()));assert.equal(e.c.production.length,1);assert.equal(e.u.autoJobs.length,0);
});

test('main objective decomposes projects, beds, recipes, research and local construction with actual costs',()=>{
  const e=make();e.r.claimed=TASKS.slice(0,3).map(q=>q.id);
  assert.equal(e.supplyGoal().key,'project:market');assert.deepEqual(e.supplyGoal().cost,{wood:12,radish:9});
  e.c.projects.market=1;assert.equal(e.supplyGoal().key,'building:workbench');building(e,'workbench');assert.equal(e.supplyGoal().key,'building:bed');
  assert.ok(e.pinGoal('outpost:hospital'));assert.equal(e.supplyGoal().local,true);assert.ok(e.goalMaterials().some(r=>r.id==='pumpModule'&&r.missing===1));
  assert.ok(e.pinGoal('research:power'));assert.match(e.supplyGoal().use,/太阳能/);assert.match(e.sourceFor('circuit').text,/6废金属/);
  assert.ok(e.pinGoal('auto'));e.r.claimed=TASKS.slice(0,1).map(q=>q.id);assert.equal(e.supplyGoal().recipe,'trailBread');
});

test('bill of materials allocates shared stock once and shows crop and recipe sources',()=>{
  const e=make();e.s.inventory={};e.s.storage={cloth:1};e.u.pin='outpost:hospital';
  // Need cloth2 + bandage2, requiring 3 cloth total. Available cloth1 yields one cotton3 batch.
  assert.deepEqual(e.goalIngredientNeeds(),{wood:8,cotton:3,pumpModule:1});
  // The surplus from a fabric batch is reusable for the bandage requirement.
  assert.match(e.sourceFor('cloth').text,/3/);assert.equal(e.sourceFor('cotton').crop,'cotton');
  e.s.storage={cloth:2,bandage:2,wood:8,pumpModule:1};assert.deepEqual(e.goalIngredientNeeds(),{});
  assert.ok(e.goalMaterials().every(r=>r.missing===0));assert.ok(e.goalMaterials().some(r=>r.carried<r.need));
});

test('quota production has an explicit unlock, three active plans and bounded targets',()=>{
  const e=make();assert.equal(e.setSupplyPlan('trailBread',6),false);unlock(e);
  for(const id of ['trailBread','cloth','bandage'])assert.ok(e.setSupplyPlan(id,6));
  assert.equal(e.setSupplyPlan('stew',6),false);assert.ok(e.toggleSupplyPlan('cloth'));assert.ok(e.setSupplyPlan('stew',6));
  for(const n of [-1,0,31,1.1,NaN,Infinity])assert.equal(e.setSupplyPlan('stew',n),false);
  assert.equal(e.setSupplyPlan('pistol',6),false);
});

test('automatic food uses only stored ordinary/hardy crops, respects reserves and stops at target',()=>{
  const e=make();unlock(e);e.s.storage={radish:5,hardy_radish:4,fine_radish:9};e.s.inventory.radish=15;
  e.setReserve('radish',3);assert.ok(e.setSupplyPlan('trailBread',6));e.processProduction(120);
  assert.equal(e.s.storage.bread,4);assert.equal(e.stockAmount('radish'),3);assert.equal(e.s.storage.fine_radish,9);assert.equal(e.s.inventory.radish,15);
  assert.match(e.planStatus('trailBread'),/等待仓库材料/);assert.equal(e.r.metrics.food,4);
  e.setReserve('radish',0);e.processProduction(20);assert.equal(e.s.storage.bread,6);assert.match(e.planStatus('trailBread'),/已达标/);
  const count=e.u.completed;e.processProduction(120);assert.equal(e.u.completed,count);
});

test('three-step cotton supply works outside the farm, then feeds a real hospital contract',()=>{
  const e=make();unlock(e);cooperation(e);e.s.storage={cotton:12,herb:10,wood:30,parts:20};
  assert.ok(e.setSupplyPlan('cloth',4));assert.ok(e.setSupplyPlan('bandage',6));
  e.s.region='residential';e.assignRegion();e.processProduction(180);
  assert.ok(e.s.storage.bandage>=6);assert.ok(e.s.storage.cloth>=2);assert.ok(e.r.metrics.medicine>=6);
  e.s.region='farm';e.assignRegion();assert.ok(e.acceptContract('hospital'));const c=structuredClone(e.r.contract);
  if(c.cost.medkit){e.putStorage({medkit:1,bread:3});}
  const total=e.r.contractTotals.hospital;assert.ok(e.deliverContract());assert.equal(e.r.contractTotals.hospital,total+1);assert.equal(e.r.contract,null);assert.equal(e.deliverContract(),false);
});

test('manual batches count toward quotas; automatic jobs do not consume every queue slot',()=>{
  const e=make();unlock(e);provision(e,{radish:50,cotton:20,potato:20});assert.ok(e.craftBatch('trailBread',3));
  e.setSupplyPlan('trailBread',6);e.processProduction(60);assert.equal(e.u.autoJobs.length,0);assert.equal(e.c.production.filter(j=>j.recipe==='trailBread').length,3);
  assert.ok(e.storeAllProduction());assert.equal(e.s.storage.bread,6);e.processProduction(30);assert.equal(e.c.production.length,0);
  e.s.storage.bread=0;e.setSupplyPlan('cloth',30);e.setSupplyPlan('stew',30);e.fillSupplyPlans();assert.equal(e.u.autoJobs.length,3);assert.equal(e.c.production.length,3);
});

test('destroyed facilities halt production without losing prepaid materials and repairs resume',()=>{
  const e=make();unlock(e);provision(e,{cotton:6});e.setSupplyPlan('cloth',4);e.processProduction(10);
  const j=e.c.production[0],remaining=j.remaining,b=e.s.buildings.find(b=>b.type==='workbench');b.hp=0;
  e.processProduction(60);assert.equal(j.remaining,remaining);assert.match(e.planStatus('cloth'),/先建好制作台/);b.hp=BUILDINGS.workbench.hp;
  e.processProduction(80);assert.equal(e.s.storage.cloth,4);
});

test('cancel returns exact prepaid variants to storage, pauses the plan and is idempotent',()=>{
  const e=make();unlock(e);e.s.storage={hardy_radish:3};e.setSupplyPlan('trailBread',6);e.processProduction(1);const j=e.c.production[0];assert.deepEqual(j.cost,{hardy_radish:3});
  assert.ok(e.cancelProduction(j.id));assert.equal(e.s.storage.hardy_radish,3);assert.equal(e.u.plans.trailBread.enabled,false);assert.equal(e.cancelProduction(j.id),false);assert.equal(e.s.storage.hardy_radish,3);e.processProduction(40);assert.equal(e.s.storage.bread,undefined);
});

test('full backpack never blocks warehouse collection and duplicate collection has no effect',()=>{
  const e=make();unlock(e);e.s.inventory.radish=3;assert.ok(e.craft('trailBread'));e.processProduction(20);const j=e.c.production[0];
  e.s.inventory=Object.fromEntries(Object.keys(ITEMS).filter(id=>id!=='bread').slice(0,40).map(id=>[id,1]));assert.equal(e.collectProduction(j.id),false);
  assert.ok(e.storeAllProduction());assert.equal(e.s.storage.bread,2);assert.equal(e.storeAllProduction(),false);assert.equal(e.r.metrics.food,2);
});

test('food reserve feeds a rescued worker; worker harvest returns raw material to supply',()=>{
  const e=make();unlock(e);e.c.autoMeals=false;e.recruit('farmer');e.resident('farmer').fed=false;e.s.inventory.bread=0;e.s.storage={radish:6};
  e.setSupplyPlan('trailBread',4);e.processProduction(40);assert.equal(e.s.storage.bread,4);assert.ok(e.feedResidents());assert.equal(e.s.storage.bread,3);
  const p=e.s.plots[0];Object.assign(p,{crop:'radish',growth:CROPS.radish.grow,qualityRoll:2});e.workHour();assert.equal(p.crop,null);assert.ok(e.s.storage.radish>=3);
  e.processProduction(20);assert.equal(e.s.storage.bread,5,'one output batch may cross target by one');assert.equal(e.resident('farmer').fed,true);
});

test('all region support choices and construction tiers produce exact real rewards only on future deliveries',()=>{
  for(const region of Object.keys(OUTPOSTS))for(const mode of ['supply','field']){
    const e=make();unlock(e);cooperation(e);e.putStorage({wood:100,cloth:100,parts:100,circuit:100,bread:100,bean:100,stew:100,medkit:100,bandage:100,herb:100,parcel:100,scrap:100});
    if(mode==='field')assert.ok(e.chooseCooperation(region,mode));
    for(let level=0;level<3;level++){
      e.r.contractTotals[region]=COOP_THRESHOLDS[level];assert.ok(e.upgradeCooperation(region));assert.equal(e.u.cooperation[region].level,level+1);
      e.s.day++;assert.ok(e.acceptContract(region));const c=structuredClone(e.r.contract),before=Object.fromEntries(Object.keys(ITEMS).map(key=>[key,e.qty(key,true)])),bonus=e.cooperationReward(region);
      assert.ok(e.deliverContract());for(const [key,n]of Object.entries(bonus))assert.equal(e.qty(key,true),(before[key]||0)+(c.reward[key]||0)+n-(c.cost[key]||0));
      assert.equal(e.u.lastShipment.region,region);assert.equal(e.deliverContract(),false);
      const saved=Engine.parse(e.serialize());assert.equal(saved.supply.cooperation[region].level,level+1);
    }
    assert.equal(e.upgradeCooperation(region),false);const before=JSON.stringify(e.s.storage);assert.ok(e.chooseCooperation(region,mode==='field'?'supply':'field'));assert.equal(JSON.stringify(e.s.storage),before);
    e.s.region=region;e.assignRegion();assert.equal(e.objects.find(o=>o.type==='outpost').coopLevel,3);
  }
});

test('regional project failure does not charge and postgame keeps the same farm',()=>{
  const e=make();cooperation(e);e.s.inventory={};e.s.storage={};const before=JSON.stringify(e.s.storage);
  assert.equal(e.upgradeCooperation('warehouse'),false);assert.equal(JSON.stringify(e.s.storage),before);assert.equal(e.u.cooperation.warehouse.level,0);
  e.r.claimed=TASKS.map(q=>q.id);e.r.ended=true;assert.equal(e.supplyGoal().key,'endgame');assert.ok(e.pinGoal('cooperation:warehouse'));assert.match(e.supplyGoal().use,/2份/);
});

test('visit healing and network handout cannot be refreshed by reloading the same visit',()=>{
  let e=make();e.r.outposts.hospital=2;e.s.region='hospital';e.assignRegion();Object.assign(e.s.player,OUTPOSTS.hospital);e.s.player.hp=100;
  assert.equal(e.outpostHeal('hospital'),false);assert.equal(e.u.visitHealed,false);
  e.s.player.hp=20;assert.ok(e.outpostHeal('hospital'));assert.equal(e.s.player.hp,55);
  e=new Engine(Engine.parse(e.serialize()));e.paused=false;assert.equal(e.outpostHeal('hospital'),false);
  e.r.network=true;e.s.storage.bread=2;Object.assign(e.s.player,OUTPOSTS.hospital);e.interact();assert.equal(e.s.storage.bread,1);assert.ok(e.u.visitMeal);
  e=new Engine(Engine.parse(e.serialize()));e.paused=false;e.interact();assert.equal(e.s.storage.bread,1);
  assert.ok(e.travel('farm'));assert.ok(e.travel('hospital'));Object.assign(e.s.player,OUTPOSTS.hospital);assert.ok(e.outpostHeal('hospital'));
});

test('missing promised fields use free fallback locations without duplicating old expansions',()=>{
  const e=make();for(const y of [650,690,730])for(const x of [940,980,1020])building(e,'workbench',x,y);
  const before=e.s.plots.length;e.addRebuildFields();assert.equal(e.u.fieldAwarded,6);assert.equal(e.s.plots.length,before+6);e.addRebuildFields();assert.equal(e.s.plots.length,before+6);
  const old=v5State();old.rebuild.fields=true;old.rebuild.claimed=TASKS.slice(0,8).map(q=>q.id);const recovered=new Engine(Engine.parse(JSON.stringify(old)));assert.equal(recovered.s.plots.filter(p=>p.rebuildNew).length,6);
  const again=new Engine(Engine.parse(recovered.serialize()));assert.equal(again.s.plots.length,recovered.s.plots.length);
});

test('resident specialties honor assigned jobs; fatal hits are included in the failed report',()=>{
  const e=make();e.recruit('farmer');e.r.arcs.farmer=2;e.resident('farmer').fed=true;e.setRole('farmer','guard');e.s.plots.forEach(p=>{p.crop=null;p.tilled=true;});const seeds=e.qty('seedBean',true);e.workHour();assert.equal(e.qty('seedBean',true),seeds);
  e.recruit('medic');building(e,'bed');e.resident('medic').fed=true;e.r.arcs.medic=2;e.setRole('medic','farmer');provision(e,{herb:2,cloth:1});e.workHour();assert.equal(e.r.medicineDay,0);
  e.r.outposts.hospital=2;assert.ok(e.startSiege('hospital'));e.s.player.hp=10;e.damagePlayer(1000);assert.equal(e.r.lastBattle.damage,10);assert.equal(e.r.lastBattle.won,false);assert.ok(e.startSiege('hospital'));
});

test('active supply and pinned goal survive save without rescheduling or duplicated collection',()=>{
  let e=make();unlock(e);e.putStorage({radish:12});e.setSupplyPlan('trailBread',6);e.pinGoal('project:clinic');e.setReserve('radish',3);e.processProduction(9);
  const before=e.serialize(),job=e.c.production[0];e=new Engine(Engine.parse(before));assert.equal(e.c.production[0].remaining,job.remaining);assert.equal(e.u.autoJobs.length,1);assert.equal(e.u.pin,'project:clinic');
  e.processProduction(60);assert.equal(e.s.storage.bread,6);const finished=e.serialize();e=new Engine(Engine.parse(finished));e.processProduction(60);assert.equal(e.s.storage.bread,6);assert.equal(e.u.completed,3);
});

test('new save data rejects bad quantities, unknown plans, duplicate jobs and injected progression',()=>{
  const e=make();unlock(e);e.putStorage({radish:9});e.setSupplyPlan('trailBread',6);e.processProduction(1);
  const mutations=[s=>s.supply.plans.trailBread.target=-1,s=>s.supply.plans.trailBread.target=100,s=>s.supply.plans.trailBread.enabled='yes',s=>s.supply.plans.pistol={target:2,enabled:true},s=>s.supply.reserves.cloth=-2,s=>s.supply.autoJobs.push(s.supply.autoJobs[0]),s=>s.supply.autoJobs=['missing'],s=>s.supply.cooperation.warehouse.level=3,s=>s.supply.pin='<script>',s=>s.supply.fieldAwarded=10,s=>s.supply.injected=true,s=>s.colony.production[0].out={bread:999},s=>s.colony.production[0].station='workbench',s=>s.colony.production[0].cost={radish:999},s=>s.colony.production[0].remaining=999,s=>s.colony.production[0].ready=true];
  for(const mutate of mutations){const s=JSON.parse(e.serialize());mutate(s);assert.throws(()=>Engine.parse(JSON.stringify(s)));}
});

test('every new control is handled and every main stage renders truthful material identifiers',()=>{
  const e=make();unlock(e);const fields={'supply-goal':'project:market','supply-recipe':'trailBread','supply-target':'6','supply-reserve-item':'radish','supply-reserve-count':'3'};
  const ctx={engine:e,root:{querySelector:s=>({value:fields[s.slice(1)]})},showMenu(){},renderMenu(){},save(){},toast(){}};
  for(const action of ['sPin','sPlan','sReserve'])assert.ok(handleSupplyAction(action,{dataset:{action,id:''}},ctx));
  assert.equal(e.u.pin,'project:market');assert.equal(e.u.plans.trailBread.target,6);assert.equal(e.u.reserves.radish,3);
  const h={esc:s=>s,icon:i=>String(i),itemIcon:id=>id,itemName:id=>ITEMS[id].name,costs:c=>JSON.stringify(c)};
  for(let i=0;i<16;i++){e.r.claimed=TASKS.slice(0,i).map(q=>q.id);e.u.pin='auto';for(const tab of ['overview','farm','production','expedition','residents','defense','research'])assert.doesNotThrow(()=>renderRebuild(e,tab,h,{},{}));assert.ok(e.goalMaterials().every(r=>ITEMS[r.id]));}
  const html=renderSupplyGoal(e)+renderSupplyPlans(e)+renderCooperation(e);
  const controls=[...html.matchAll(/data-action="(s[^"]+)"/g)].map(m=>m[1]);
  for(const action of new Set(controls))assert.ok(['sPin','sPlan','sReserve','sToggle','sNeed','sDeposit','sStoreAll','sCoopUpgrade','sPinDirect','sCoopMode','sPack','sFollow'].includes(action));
  assert.equal(handleSupplyAction('notMine',{dataset:{}},ctx),false);
});
