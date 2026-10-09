import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine, freshState, demoState} from '../dist/supply.js';
import {demoState as previousDemo} from '../dist/frontier.js';
import {freshState as originalFresh} from '../dist/engine.js';
import {ITEMS, CROPS, BUILDINGS, RECIPES, WEAPONS} from '../dist/data.js';
import {HERBS} from '../dist/frontier-data.js';
import {TASKS, PILLARS, OUTPOSTS, FIND_LOCATIONS, ANNEX} from '../dist/rebuild-data.js';
import {renderRebuild, renderObjective, handleRebuildAction} from '../dist/rebuild-ui.js';

const make = (state = demoState()) => {const e = new Engine(state);e.paused = false;return e;};
const fixture = (e, type, x = 900, y = 760) => {const b={id:'fixture-'+e.s.idCounter++,type,x,y,rotation:0,hp:BUILDINGS[type].hp};e.s.buildings.push(b);e.assignRegion();return b;};
const provision = e => {e.putStorage({wood:160,stone:100,scrap:160,parts:100,cloth:80,radish:80,potato:80,tomato:50,bean:60,herb:60,cotton:50,bread:80,bandage:40,jam:20,stew:20,medkit:10,ammo:160});};
function build(e,type){
  assert.ok(e.startBuild(type));
  for(let y=352;y<930;y+=80)for(let x=192;x<1420;x+=80){Object.assign(e.s.player,{x:x+85,y});if(!e.buildReason(type,x,y)){assert.ok(e.placeBuilding(x,y));e.buildMode=null;return;}}
  assert.fail('No build site for '+type);
}
function arrive(e,region,point){assert.ok(e.travel(region));e.paused=false;if(point)Object.assign(e.s.player,{x:point.x,y:point.y});}
function rescue(e,id){const o=e.objects.find(o=>o.type==='survivor'&&o.resident===id);assert.ok(o,'physical survivor');Object.assign(e.s.player,{x:o.x,y:o.y});e.interact();assert.ok(e.resident(id));}
function find(e,id){const d=FIND_LOCATIONS[id];Object.assign(e.s.player,{x:d.x,y:d.y});assert.ok(e.collectFind(id),'find '+id);}
function clearNest(e){const n=e.enemies.find(e=>e.nest&&!e.dead);assert.ok(n);e.hurtEnemy(n,300,0,{});assert.ok(e.f.territory[e.s.region]);}
function supplies(e,cost){for(const [id,n]of Object.entries(cost))if(!ITEMS[id].protected){const need=Math.max(0,n-e.qty(id));if(need){e.s.storage[id]-=Math.min(need,e.s.storage[id]||0);assert.ok(e.add({[id]:need}));}}}
function commission(e,id){Object.assign(e.s.player,OUTPOSTS[id]);supplies(e,OUTPOSTS[id].cost);assert.equal(e.commissionReason(id),'');assert.ok(e.commissionOutpost(id));}
function claim(e,id){arrive(e,'farm');assert.equal(e.currentRebuildTask().id,id);assert.ok(e.taskReady(id),JSON.stringify(e.taskRequirements(id)));assert.ok(e.claimRebuildTask(id));}
function produce(e,id){assert.ok(e.craft(id),'recipe '+id);const job=e.c.production.find(j=>j.recipe===id);assert.ok(job);e.advanceMinutes(RECIPES.find(r=>r.id===id).minutes+1);assert.ok(job.ready);assert.ok(e.collectProduction(job.id));}
function win(e,id){
  assert.ok(e.startSiege(id));assert.equal(e.s.horde.phase,'warning');assert.ok(e.beginHorde());const count=e.r.battle.count;
  for(let i=0;i<count;i++){e.updateHorde(3);const z=e.enemies.find(z=>z.horde&&!z.dead);assert.ok(z);e.hurtEnemy(z,500,0,{});}
  e.updateHorde(.05);assert.ok(e.r.siegesWon[id]);assert.equal(e.r.lastBattle.kills,count);assert.equal(e.r.lastBattle.won,true);
}

test('four chapters form a complete campaign through physical rescues, production, projects, outposts and two defenses',()=>{
  const e=make();provision(e);
  e.advanceMinutes(60);assert.ok(e.harvest(e.s.plots[0]));assert.ok(e.harvest(e.s.plots[1]));claim(e,'harvest');
  produce(e,'trailBread');claim(e,'meal');
  arrive(e,'residential');rescue(e,'farmer');find(e,'seedArchive');claim(e,'farmer');
  build(e,'workbench');build(e,'bed');assert.ok(e.contributeProject('market'));claim(e,'table');assert.equal(e.chapter(),1);
  arrive(e,'hospital');rescue(e,'medic');const log=e.objects.find(o=>o.type==='clue');assert.ok(log);Object.assign(e.s.player,log);e.interact();assert.ok(e.f.clues.includes('hospital'));find(e,'pumpModule');claim(e,'signal');
  produce(e,'bandage');claim(e,'medical');assert.ok(e.contributeProject('clinic'));
  arrive(e,'hospital');clearNest(e);commission(e,'hospital');assert.ok(e.scoutSiege('hospital'));claim(e,'hospital');
  assert.ok(e.chooseStyle('scout'));win(e,'hospital');assert.equal(e.r.lastBattle.count,6);claim(e,'hospitalDefense');assert.equal(e.chapter(),2);assert.equal(e.s.plots.filter(p=>p.rebuildNew).length,6);
  assert.ok(e.contributeProject('water'));assert.ok(e.contributeProject('water'));
  arrive(e,'residential');clearNest(e);commission(e,'residential');claim(e,'water');
  assert.equal(e.qty('circuit',true),2,'guaranteed progression circuits');build(e,'bed');
  arrive(e,'warehouse');rescue(e,'mechanic');assert.equal(e.collectFind('driveModule'),false);const elite=e.enemies.find(z=>z.type==='elite'&&!z.annexGuardian);assert.ok(elite);e.hurtEnemy(elite,2000,0,{});find(e,'driveModule');arrive(e,'farm');assert.ok(e.researchRebuild('power'));claim(e,'power');
  assert.ok(e.contributeProject('bridge'));assert.ok(e.contributeProject('bridge'));arrive(e,'warehouse');clearNest(e);commission(e,'warehouse');claim(e,'warehouse');
  assert.ok(e.buildNetwork('bulk'));assert.ok(e.acceptContract('residential'));assert.ok(e.deliverContract());assert.ok(e.acceptContract('hospital'));assert.ok(e.deliverContract());claim(e,'network');assert.equal(e.chapter(),3);
  for(const id of ['residential','warehouse']){arrive(e,id);const clue=e.objects.find(o=>o.type==='clue');Object.assign(e.s.player,clue);e.interact();}
  for(const i of [0,1]){assert.ok(e.collectSample(i));assert.ok(e.identifyHerb(i,HERBS[i].id));}
  arrive(e,'farm');assert.ok(e.researchRebuild('filtration'));claim(e,'filter');
  arrive(e,'warehouse',ANNEX.door);assert.ok(e.openAnnex());assert.equal(e.collectFind('relayCore'),false);const guard=e.enemies.find(z=>z.annexGuardian);assert.ok(guard);e.hurtEnemy(guard,2000,0,{});find(e,'relayCore');claim(e,'annex');
  assert.ok(e.buildRadio());claim(e,'radio');win(e,'broadcast');claim(e,'broadcast');
  assert.equal(e.currentRebuildTask(),null);assert.equal(e.r.claimed.length,16);assert.ok(e.r.ended);assert.equal(e.c.residents.length,3);assert.ok(e.projectDone('water'));assert.ok(e.objects.some(o=>o.type==='radioStation'));assert.ok(e.objects.some(o=>o.type==='visitor'));assert.ok(e.acceptContract('warehouse'));
  for(const [label,bucket]of [['bag',e.s.inventory],['stock',e.s.storage],['outing',e.s.outing]])for(const [id,n]of Object.entries(bucket))assert.ok(ITEMS[id]&&Number.isInteger(n)&&n>=0,label+' '+id+' '+n);
  const restored=new Engine(Engine.parse(e.serialize()));assert.deepEqual(restored.r,e.r);assert.deepEqual(restored.s.plots,e.s.plots);assert.deepEqual(restored.c.projects,e.c.projects);
});

test('old saves keep money, engineered plots, projects and working residents without replaying completed public works',()=>{
  const old=previousDemo();old.money=777;const plots=structuredClone(old.plots),projects=structuredClone(old.colony.projects),residents=structuredClone(old.colony.residents);
  const e=make(Engine.parse(JSON.stringify(old)));assert.equal(e.s.money,777);assert.deepEqual(e.s.plots,plots);assert.deepEqual(e.c.projects,projects);assert.deepEqual(e.c.residents,residents);assert.equal(e.r.metrics.food,1);assert.equal(e.r.metrics.medicine,1);assert.equal(e.taskRequirements('table')[0].pass,projects.market>=1);assert.equal(e.taskRequirements('table')[1].pass,e.hasBuilding('workbench'));assert.equal(e.taskRequirements('table')[2].pass,e.residentsCapacity()>=2);
  const original=originalFresh();original.money=456;original.stats.harvested=7;const s=Engine.parse(JSON.stringify(original));assert.equal(s.money,456);assert.equal(s.stats.harvested,7);assert.equal(s.rebuild.claimed.length,0);
});

test('chapter demo starts with usable supplies and near-mature crops, while future capabilities need to be earned',()=>{
  const s=demoState(),e=make(s);assert.equal(e.chapter(),0);assert.equal(e.r.claimed.length,0);assert.equal(e.r.focus,'harvest');assert.ok(e.qty('pistol'));assert.equal(e.r.radio,false);assert.equal(e.r.network,false);assert.equal(e.c.residents.length,0);assert.equal(e.c.technologies.drone,undefined);assert.ok(s.plots[0].growth<CROPS.radish.grow);assert.equal(e.claimRebuildTask('radio'),false);
  e.advanceMinutes(60);assert.ok(e.harvest(s.plots[0]));assert.ok(e.harvest(s.plots[1]));assert.ok(e.claimRebuildTask('harvest'));assert.equal(e.claimRebuildTask('harvest'),false);
});

test('old botanical tea rewards migrate to the usable item without losing quantities or plant identifications',()=>{
  const s=previousDemo();s.inventory.tea=2;s.inventory.herbTea=3;s.storage.tea=1;s.frontier.samples=[0];s.frontier.identified=[0];
  const e=make(Engine.parse(JSON.stringify(s)));assert.equal(e.qty('herbTea',true),6);assert.equal(e.s.inventory.tea,undefined);assert.deepEqual(e.f.identified,[0]);assert.ok(e.consume('herbTea'));assert.deepEqual(Engine.parse(e.serialize()).frontier.identified,[0]);
});

test('completed production advances supply goals only when its real output is collected',()=>{
  const e=make();e.s.inventory.radish=3;assert.ok(e.craft('trailBread'));const j=e.c.production[0];e.advanceMinutes(20);assert.ok(j.ready);assert.equal(e.r.metrics.food,0);assert.ok(e.collectProduction(j.id));assert.equal(e.r.metrics.food,2);assert.equal(e.collectProduction(j.id),false);assert.equal(e.r.metrics.food,2);
});

test('new plots need a water connection while legacy water-tower irrigation remains earned',()=>{
  const e=make(freshState());provision(e);e.addRebuildFields();const old=e.s.plots[0],added=e.s.plots.find(p=>p.rebuildNew);for(const p of [old,added])Object.assign(p,{crop:'bean',wateredDay:0,waterUnits:0});
  e.contributeProject('water');e.contributeProject('water');assert.equal(old.wateredDay,1);assert.equal(added.wateredDay,0);e.s.day=2;e.onNewDay();assert.equal(old.wateredDay,2);assert.equal(added.wateredDay,0);
  e.c.technologies.irrigation=true;fixture(e,'irrigation',990,750);assert.ok(e.irrigationConnected(e.s.buildings.at(-1)));e.workHour();assert.equal(added.wateredDay,2);
  const rate=e.cropGrowthRate(added);e.r.tech.filtration=true;assert.equal(e.cropGrowthRate(added),rate*1.15);assert.equal(e.s.plots.length,51);
});

test('seed archive waives the first new trait research only and failed attempts do not spend its benefit',()=>{
  const e=make();fixture(e,'breeder');e.r.tech.seedbank=true;e.s.inventory.parts=5;e.s.inventory.bean=0;
  assert.equal(e.breedTrait('bean','early'),false);assert.equal(e.r.seedbankUsed,false);e.s.inventory.bean=4;assert.ok(e.breedTrait('bean','early'));assert.equal(e.qty('parts'),5);assert.ok(e.r.seedbankUsed);assert.ok(e.breedTrait('bean','abundant'));assert.equal(e.qty('parts'),4);
});

test('resident wishes unlock real planting, daily medicine and a faster production queue using real stock',()=>{
  const e=make(freshState());provision(e);fixture(e,'bed');fixture(e,'bed');e.recruit('farmer');e.recruit('medic');e.recruit('mechanic');e.r.tech.seedbank=true;e.r.tech.power=true;e.c.projects.clinic=1;e.f.identified=[0];
  for(const id of ['farmer','medic','mechanic']){assert.ok(e.advanceArc(id));assert.ok(e.advanceArc(id));}
  e.s.inventory.seedBean=3;assert.ok(e.setFarmPlan('bean'));const p=e.s.plots[1];p.tilled=true;const seeds=e.qty('seedBean',true);e.workHour();assert.equal(e.qty('seedBean',true),seeds-1);assert.equal(p.crop,'bean');
  assert.equal(e.s.storage.medkit,11);e.workHour();assert.equal(e.s.storage.medkit,11,'one automatic medicine batch each day');
  e.craft('trailBread');const job=e.c.production.at(-1);e.processProduction(10);assert.equal(job.remaining,8);e.r.network=true;e.processProduction(5);assert.equal(job.remaining,1.5);
  e.r.outposts.hospital=2;assert.ok(e.advanceArc('medic'));arrive(e,'hospital',OUTPOSTS.hospital);e.s.player.hp=30;assert.ok(e.outpostHeal('hospital'));assert.equal(e.s.player.hp,85);assert.equal(e.outpostHeal('hospital'),false);
});

test('key finds require local access, combat gates persist and no component can be collected twice',()=>{
  const e=make();assert.equal(e.collectFind('seedArchive'),false);arrive(e,'residential');assert.equal(e.collectFind('seedArchive'),false);find(e,'seedArchive');assert.equal(e.collectFind('seedArchive'),false);
  arrive(e,'warehouse',FIND_LOCATIONS.driveModule);assert.equal(e.collectFind('driveModule'),false);const z=e.enemies.find(z=>z.type==='elite');e.hurtEnemy(z,2000,0,{});find(e,'driveModule');
  arrive(e,'farm');e.r.claimed=TASKS.slice(0,12).map(q=>q.id);e.r.tech.filtration=true;arrive(e,'warehouse',ANNEX.door);assert.ok(e.openAnnex());arrive(e,'farm');e.s.day=4;e.onNewDay();arrive(e,'warehouse',ANNEX.inside);assert.ok(e.enemies.some(z=>z.annexGuardian&&!z.dead));assert.equal(e.collectFind('relayCore'),false);
  e.hurtEnemy(e.enemies.find(z=>z.annexGuardian),2000,0,{});assert.ok(e.r.annexDefeated);find(e,'relayCore');arrive(e,'farm');e.s.day=6;e.onNewDay();arrive(e,'warehouse');assert.equal(e.enemies.some(z=>z.annexGuardian&&!z.dead),false);
});

test('all new world objectives have a navigable interaction point across the three existing ruin variants',()=>{
  const e=make();
  for(const region of Object.keys(OUTPOSTS))for(let v=0;v<3;v++){
    arrive(e,region);e.c.visits[region]=v;e.assignRegion();
    for(const d of [OUTPOSTS[region],...Object.values(FIND_LOCATIONS).filter(d=>d.region===region&&!d.annex)]){
      const positions=Array.from({length:24},(_,i)=>({x:d.x+Math.cos(i*Math.PI/12)*48,y:d.y+Math.sin(i*Math.PI/12)*48}));
      assert.ok(positions.some(p=>!e.blocked(p.x,p.y)&&e.pathTo({x:170,y:520},p).length>0),region+' variant '+v+' '+d.name);
    }
    arrive(e,'farm');
  }
  arrive(e,'warehouse');e.r.annexOpen=true;e.assignRegion();assert.ok(e.pathTo({x:170,y:520},ANNEX.inside).length>0);assert.equal(e.blocked(1420,835),false);assert.equal(e.blocked(1330,815),true);
});

test('outpost transactions preflight expedition cargo and never consume materials when delivery cannot fit',()=>{
  const e=make();e.r.outposts.hospital=2;e.s.inventory.herb=6;e.s.inventory.cloth=3;assert.ok(e.startRoute('hospital'));Object.assign(e.s.player,OUTPOSTS.hospital);
  const slots=16-e.kitOccupancy().size;assert.ok(e.add({wood:slots*10},true));e.f.route.supplies.herb=6;e.f.route.supplies.cloth=3;
  const herb=e.qty('herb'),cloth=e.qty('cloth');assert.equal(e.serviceOutpost('hospital'),false);assert.equal(e.qty('herb'),herb);assert.equal(e.qty('cloth'),cloth);assert.equal(e.r.metrics.medicine,0);
  e.dropCargo('wood');assert.ok(e.serviceOutpost('hospital'));assert.equal(e.qty('herb'),herb-2);assert.equal(e.f.route.cargo.medkit,1);assert.equal(e.r.metrics.medicine,1);
});

test('restored outposts are usable refuges with a real protected radius, and danger resumes beyond it',()=>{
  const e=make();arrive(e,'hospital',OUTPOSTS.hospital);e.r.outposts.hospital=2;const z=e.enemy('runner',OUTPOSTS.hospital.x+25,OUTPOSTS.hospital.y);z.windup=.01;e.enemies=[z];e.s.enemies.hospital=e.enemies;
  const hp=e.s.player.hp;for(let i=0;i<20;i++)e.updateEnemy(z,.05);assert.equal(e.s.player.hp,hp);assert.equal(e.enemySenses(z,.05),null);assert.ok(z.x>OUTPOSTS.hospital.x+25);Object.assign(e.s.player,{x:1050,y:440});Object.assign(z,{x:1070,y:440,facing:Math.PI,windup:.01});e.updateEnemy(z,.05);assert.ok(e.s.player.hp<hp);
});

test('network supplies move actual stored bread and contracts persist without time penalties or duplicate rewards',()=>{
  const e=make();provision(e);for(const id of Object.keys(OUTPOSTS))e.r.outposts[id]=2;e.r.claimed=TASKS.slice(0,8).map(q=>q.id);assert.ok(e.buildNetwork());
  const n=e.s.storage.bread,bag=e.qty('bread');arrive(e,'residential',OUTPOSTS.residential);e.interact();assert.equal(e.s.storage.bread,n-1);assert.equal(e.qty('bread'),bag+1);e.interact();assert.equal(e.s.storage.bread,n-1);
  arrive(e,'farm');assert.ok(e.acceptContract('hospital'));const cost=structuredClone(e.r.contract.cost);e.advanceMinutes(1440*2);assert.deepEqual(e.r.contract.cost,cost);assert.ok(e.deliverContract());const money=e.s.money;assert.equal(e.deliverContract(),false);assert.equal(e.s.money,money);assert.equal(e.acceptContract('hospital'),false);
  e.s.day++;assert.ok(e.acceptContract('hospital'));assert.ok(e.deliverContract());assert.equal(e.r.outposts.hospital,3);
});

test('a successful three-stop expedition grants its circuits once and retreat never advances that objective',()=>{
  const e=make();assert.ok(e.startRoute('residential'));
  const secure=()=>{for(const z of e.enemies){if(!z.nest){z.x=1450;z.y=950;z.alert=0;z.state='patrol';}}const o=e.objects.find(o=>o.type==='routeCache');Object.assign(e.s.player,{x:o.x,y:o.y+15});e.paused=false;e.interact();assert.ok(e.f.route.secured);};
  secure();assert.ok(e.nextRoute('rest'));assert.ok(e.nextRoute('warehouse'));secure();assert.ok(e.finishRoute());assert.equal(e.r.metrics.expeditions,1);assert.equal(e.s.storage.circuit,2);assert.ok(e.startRoute('residential'));assert.ok(e.finishRoute(true));assert.equal(e.r.metrics.expeditions,1);assert.equal(e.s.storage.circuit,2);
});

test('defense specializations change actual damage, speed and reload; battle reports attribute tower and trap kills',()=>{
  const e=make();assert.ok(e.chooseStyle('mobile'));assert.equal(e.weaponStats('pistol').reload,WEAPONS.pistol.reload*.85);assert.equal(e.weaponStats('club').damage,WEAPONS.club.damage*1.15);const x=e.s.player.x;e.update(.05,{x:1});assert.ok(e.s.player.x>x);
  e.r.outposts.hospital=2;arrive(e,'hospital',OUTPOSTS.hospital);assert.ok(e.scoutSiege('hospital'));arrive(e,'farm');assert.ok(e.chooseStyle('engineer'));assert.ok(e.startSiege('hospital'));assert.ok(e.beginHorde());
  const trap=e.enemy('slow',800,600,true),tower=e.enemy('slow',850,600,true);e.enemies.push(trap,tower);e._damageSource='trap';e.hurtEnemy(trap,100,0);e._damageSource='tower';e.hurtEnemy(tower,100,0);e._damageSource=null;assert.equal(e.r.battle.trapKills,1);assert.equal(e.r.battle.towerKills,1);
  const z=e.enemy('elite',900,600,true);e._damageSource='tower';e.hurtEnemy(z,80,0,{aimPart:'armor'});e._damageSource=null;assert.equal(z.parts.armor,50,'80 damage becomes 100 before armor resolution');
  e.s.inventory.stew=1;e.consume('stew');e.invulnerable=0;e.damagePlayer(10);assert.ok(e.r.battle.foodSaved>0);
});

test('lost chapter defenses retain the farm and allow retry with a truthful failed report',()=>{
  const e=make();e.r.outposts.hospital=2;fixture(e,'fence');const farm=structuredClone(e.s.buildings);assert.ok(e.startSiege('hospital'));assert.ok(e.beginHorde());e.s.player.hp=1;e.damagePlayer(500);
  assert.equal(e.r.siegesWon.hospital,false);assert.equal(e.r.lastBattle.won,false);assert.equal(e.r.battle,null);assert.deepEqual(e.s.buildings,farm);assert.equal(e.s.region,'farm');assert.ok(e.startSiege('hospital'));assert.equal(e.r.battle.kills,0);
});

test('new nested state, contracts and active chapter battles round-trip; invalid progress and injected fields are rejected',()=>{
  const e=make();e.r.outposts.hospital=2;assert.ok(e.startSiege('hospital'));assert.deepEqual(Engine.parse(e.serialize()).rebuild,e.r);
  for(const mutate of [s=>s.rebuild.claimed=['radio'],s=>s.rebuild.arcs.farmer=4,s=>s.rebuild.battle.damage=-1,s=>s.rebuild.tech.power='true',s=>s.rebuild.annexDefeated=null,s=>s.rebuild.farmPlan='unknown',s=>s.rebuild.metrics.produced.unknown=1,s=>s.plots[0].rebuildNew='true']){const s=JSON.parse(e.serialize());mutate(s);assert.throws(()=>Engine.parse(JSON.stringify(s)));}
});

test('six purpose pages, the old tools as single pages and the current objective keep actionable controls',()=>{
  const h={esc:s=>String(s),icon:()=>'',costs:()=>'',itemIcon:()=>'',itemName:id=>ITEMS[id]?.name||id};
  for(const e of [make(),make(previousDemo())])for(const tab of ['overview',...PILLARS.map(p=>p.id)]){const html=renderRebuild(e,tab,h);assert.ok(html.includes('place-page'));assert.equal(html.includes('营地手册导航'),false);assert.equal(html.includes('manual-detail'),false);assert.equal(html.includes('undefined'),false);assert.ok((html.match(/data-action=/g)||[]).length>0,tab);}
  const e=make(),html=renderRebuild(e,'production',h,{tool:{menu:'camp',tab:'production'}});assert.ok(html.includes('place-page'));assert.equal(html.includes('camp-tabs'),false);assert.ok(html.includes('data-action='));assert.ok(renderObjective(e,h).includes('rTrack'));
  let saved=0,closed=0;const ui={target:{region:'hospital'}};const ctx={engine:e,ui,showMenu:()=>{},closeMenu:()=>closed++,renderMenu:()=>{},save:()=>saved++,toast:()=>{}};assert.ok(handleRebuildAction('rTrack',{dataset:{id:'harvest'}},ctx));assert.equal(ui.target,null);assert.equal(e.r.focus,'harvest');assert.equal(closed,1);assert.equal(saved,1);assert.equal(handleRebuildAction('fullscreen',{dataset:{}},ctx),false);
});
