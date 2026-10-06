import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine,freshState} from '../dist/expansion.js';
import {ITEMS,CROPS,BUILDINGS,REGIONS} from '../dist/data.js';
import {HORDE_DIRECTIONS,FEATURES,WEATHER} from '../dist/expansion-data.js';
import {renderCamp,CAMP_TABS} from '../dist/camp-ui.js';

function stocked(){const s=freshState();s.money=3000;s.xp.exploration=80;s.debris=[];Object.assign(s.inventory,{wood:150,stone:100,scrap:150,parts:100,circuit:30,cloth:50,radish:40,potato:40,tomato:40,bean:40,corn:40,herb:40,cotton:40,bread:40,stew:20,jam:20,bandage:30,ammo:150,fish:12,riverFish:12,nightFish:12,egg:12,milk:12});const e=new Engine(s);e.paused=false;return e;}
function facility(e,type,x=900,y=760){const b={id:'fixture-'+e.s.idCounter++,type,x,y,rotation:0,hp:BUILDINGS[type].hp};e.s.buildings.push(b);e.navRevision++;return b;}
const helpers={esc:v=>String(v).replaceAll('"','&quot;'),icon:i=>`<i>${i}</i>`,itemIcon:id=>`<i>${id}</i>`,itemName:id=>ITEMS[id]?.name||id,costs:b=>Object.entries(b).map(([id,n])=>id+n).join(' ')};

test('reputation unlocks tiered goods once per restock and new tiers can open during the day',()=>{
  const e=stocked();assert.equal(e.traderStock('mechanic').circuit,undefined);
  e.c.reputation=30;assert.equal(e.traderStock('food').seedCotton,4);
  e.c.reputation=60;let stock=e.traderStock('mechanic');assert.equal(stock.circuit,4);e.trade('mechanic','circuit',2,'buy');assert.equal(e.traderStock('mechanic').circuit,2);
  e.c.reputation=100;assert.equal(e.traderStock('mechanic').circuit,6);assert.equal(e.traderStock('food').seed_corn_abundant,2);
  e.sleep();assert.equal(e.traderStock('mechanic').circuit,8);
});

test('breeding has real water and price tradeoffs; seeds are retained after a successful harvest',()=>{
  const e=stocked();facility(e,'breeder');e.breedTrait('radish','abundant');const p=e.s.plots[10];p.tilled=true;e.toolPlot(p,'seed_radish_abundant');e.c.water=1;
  const before=e.serialize();assert.equal(e.toolPlot(p,'water'),false);assert.equal(e.serialize(),before);e.grow(20);assert.equal(p.growth,0);
  e.c.water=3;assert.ok(e.toolPlot(p,'water'));assert.equal(e.c.water,1);e.grow(142);assert.ok(e.harvest(p));assert.equal(e.qty('seed_radish_abundant'),2);
  const parts=e.qty('parts');assert.ok(e.breedTrait('radish','abundant'));assert.equal(e.qty('parts'),parts);
  e.breedTrait('radish','hardy');const q=e.s.plots[11];q.tilled=true;e.toolPlot(q,'seed_radish_hardy');assert.equal(e.plotWatered(q),false);e.c.water=1;e.toolPlot(q,'water');q.growth=120;e.harvest(q);
  assert.equal(e.qty('hardy_radish'),3);assert.ok(ITEMS.hardy_radish.sell<ITEMS.radish.sell);assert.equal(e.qty('seed_radish_hardy'),2);
  e.c.water=0;e.s.player.x=880;e.s.player.y=300;e.interact();assert.equal(e.c.water,24);
});

test('crop alternatives pay atomically and cancellations return actual varieties; stalls do not relabel them',()=>{
  const e=stocked();delete e.s.inventory.potato;e.s.inventory.hardy_potato=1;e.s.storage.fine_potato=1;
  assert.equal(e.quantityForCost('potato'),2);assert.ok(e.craft('stew'));const job=e.c.production[0];assert.deepEqual(job.cost,{hardy_potato:1,fine_potato:1});
  assert.ok(e.cancelProduction(job.id));assert.equal(e.qty('hardy_potato'),1);assert.equal(e.qty('fine_potato'),1);
  const before=e.serialize();assert.equal(e.spend({potato:3}),false);assert.equal(e.serialize(),before);
  facility(e,'stall');assert.equal(e.listStall('potato',1,'premium'),false);assert.ok(e.listStall('hardy_potato',1,'premium'));
});

test('bulk production is atomic and extra facilities provide independent parallel lanes',()=>{
  const e=stocked();facility(e,'cook',890,700);const n=e.qty('potato');assert.ok(e.craftBatch('stew',5));assert.equal(e.qty('potato'),n-10);
  e.advanceMinutes(30);assert.equal(e.c.production.filter(j=>j.ready).length,2);e.advanceMinutes(30);assert.equal(e.c.production.filter(j=>j.ready).length,4);
  e.advanceMinutes(30);assert.ok(e.collectAllProduction());assert.equal(e.c.production.length,0);
  e.s.inventory.potato=5;const before=e.serialize();assert.equal(e.craftBatch('stew',3),false);assert.equal(e.serialize(),before);
  e.c.specializations.manufacturing='economy';assert.deepEqual(e.effectiveCost({potato:2,parts:1,scrap:6}),{potato:1,parts:1,scrap:4});assert.ok(e.craftBatch('stew',3));
});

test('all reconstruction stages create visible scene objects and restore service only on completion',()=>{
  const e=stocked();for(const id of ['market','clinic','water','bridge']){assert.ok(e.contributeProject(id));assert.ok(e.objects.some(o=>o.type==='project'&&o.project===id));assert.equal(e.projectDone(id),false);assert.ok(e.contributeProject(id));assert.equal(e.projectDone(id),true);}
  assert.equal(e.price('food','seedRadish','buy'),15);assert.equal(e.c.toolLevel,2);
});

test('resident priorities fall back to available work; housing, food, schedules and movement remain real',()=>{
  const e=stocked();e.recruit('farmer');e.feedResidents();const r=e.c.residents[0];e.setPriority(r.id,'mechanic',2);const b=facility(e,'fence',720,600);b.hp=70;
  e.workHour();assert.equal(r.workRole,'mechanic');assert.equal(b.hp,90);assert.deepEqual(r.target,{x:720,y:655});
  const before={x:r.x,y:r.y};for(let i=0;i<100;i++)e.updateResidents(.05);assert.ok(Math.hypot(r.x-before.x,r.y-before.y)>20);
  e.s.minute=1380;e.workHour();assert.equal(r.workRole,'rest');assert.ok(r.status.includes('睡觉'));assert.equal(b.hp,90);
  e.c.autoMeals=true;e.s.minute=480;e.sleep();assert.ok(r.fed);e.c.autoMeals=false;e.sleep();assert.equal(r.fed,false);
});

test('hourly work uses chronological daylight when skipping time instead of generating power throughout the night',()=>{
  const e=stocked();facility(e,'solar');e.s.minute=1080;e.c.energy=0;e.c.workClock=0;e.advanceMinutes(600);assert.equal(e.s.minute,240);assert.equal(e.c.energy,0);
  e.advanceMinutes(180);assert.equal(e.c.energy,6);
});

test('irrigation can relay through pipes and disconnected or damaged sources stop watering',()=>{
  const e=stocked();const source=facility(e,'rain',800,760),a=facility(e,'irrigation',600,760),b=facility(e,'irrigation',400,760),p=e.s.plots[10];Object.assign(p,{crop:'corn',growth:0,wateredDay:0,waterUnits:0,trait:'abundant'});
  assert.ok(e.irrigationConnected(a));assert.ok(e.irrigationConnected(b));e.workHour();assert.ok(e.plotWatered(p));assert.equal(e.irrigationLinks().length,2);
  source.hp=0;p.wateredDay=0;p.waterUnits=0;e.workHour();assert.equal(e.plotWatered(p),false);assert.equal(e.irrigationConnected(b),false);
});

test('drone maintenance cannot harvest without power, parts or seeds and retains seeded varieties',()=>{
  const e=stocked(),d=facility(e,'drone',500,730),p=e.s.plots[10];Object.assign(p,{crop:'radish',trait:'hardy',growth:120,wateredDay:e.s.day,waterUnits:1});d.wear=10;e.c.energy=2;delete e.s.inventory.parts;
  e.workHour();assert.equal(p.growth,120);assert.equal(e.c.energy,2);assert.equal(e.serviceAutomation(d.id),false);
  e.s.inventory.parts=1;e.workHour();assert.equal(e.c.energy,0);assert.equal(p.trait,'hardy');assert.equal(p.growth,0);assert.equal(d.wear,1);assert.equal(e.qty('parts'),0);assert.ok(e.s.storage.hardy_radish);
});

test('four announced horde directions match actual reachable spawn lanes',()=>{
  for(let round=0;round<4;round++){const e=stocked();e.s.stats.hordes=round;e.c.hordeTheme=round%3;e.s.horde={phase:'warning',timer:90,remaining:8,spawnTimer:0,direction:round};const intel=e.hordeIntel();assert.equal(intel.direction,HORDE_DIRECTIONS[round]);assert.ok(e.beginHorde());e.updateHorde(.1);const z=e.enemies.find(z=>z.horde);assert.ok(intel.direction.spawns.some(([x,y])=>z.x===x&&z.y===y));assert.ok(e.pathTo(z,{x:830,y:480}).length>0);}
});

test('tower guards use ammo only for unobstructed targets and two residents occupy separate towers',()=>{
  const e=stocked();e.recruit('farmer');e.recruit('mechanic');facility(e,'bed');e.feedResidents();e.setRole('farmer','guard');e.setRole('mechanic','guard');
  const a=facility(e,'tower',800,700),b=facility(e,'tower',700,700),wall=facility(e,'workbench',900,700);e.workHour();const [r1,r2]=e.c.residents;assert.notDeepEqual(r1.target,r2.target);
  const z=e.enemy('slow',1000,700);e.enemies.push(z);const ammo=e.qty('ammo');e.updateDefense(.1);assert.equal(z.hp,65);assert.equal(e.qty('ammo'),ammo);
  wall.hp=0;e.updateDefense(.1);assert.ok(z.hp<65);assert.ok(e.qty('ammo')<ammo);e.s.minute=1400;e.s.horde.phase='active';assert.ok(e.residentActive(r1));
  const post=facility(e,'repairpost',a.x,a.y+100);a.hp=100;const wood=e.qty('wood');e.updateDefense(8);assert.ok(a.hp>100);assert.ok(e.qty('wood')<wood);assert.ok(post.hp>0);
});

test('NPC replies spend chosen gifts, apply different trust and change demand only once per day',()=>{
  const e=stocked(),rel=e.c.relationships.food,n=e.qty('stew');assert.ok(e.reply('food',0));assert.equal(e.qty('stew'),n-1);assert.equal(rel.trust,8);assert.ok(e.demanded('stew'));const before=e.serialize();assert.equal(e.reply('food',1),false);assert.equal(e.serialize(),before);
  e.sleep();assert.ok(e.reply('food',1));assert.equal(rel.trust,12);assert.ok(rel.lastReply.includes('育种'));
});

test('stall clients browse all slots, accepted orders and events create demand, prices can change in place',()=>{
  const e=stocked();facility(e,'stall');e.listStall('wood',3,'fair');e.listStall('stew',3,'fair');e.listStall('radish',3,'fair');e.processStall(270);assert.deepEqual(e.c.stall.map(s=>s.qty),[2,2,2]);
  const meal=e.c.stall.find(s=>s.item==='stew');e.setStallPrice(meal.id,'premium');assert.equal(e.demanded('stew'),false);e.acceptOrder(e.c.orders.find(o=>o.cost.stew).id);assert.equal(e.demanded('stew'),true);
  e.c.event={type:'stranger',day:e.s.day,done:false};e.chooseEvent(0);assert.equal(e.demanded('wood'),true);const saved=e.serialize();assert.equal(new Engine(Engine.parse(saved)).serialize(),saved);
});

test('side-room alternatives remain optional and preserve paths to every main reward across layouts',()=>{
  for(const region of ['residential','hospital','warehouse'])for(let v=0;v<3;v++){const e=stocked();e.travel(region);e.c.visits[region]=v;e.assignRegion();const room=e.objects.find(o=>o.type==='encounter');assert.equal(room.variant,v);
    for(const o of e.objects.filter(o=>o.type==='crate'))assert.ok(e.pathTo(REGIONS[region].spawn,o).length>0,region+' variant '+v+' '+o.id);
    e.s.player.x=room.x;e.s.player.y=room.y;e.c.pendingEncounter=room.id;const before=e.serialize();assert.equal(e.chooseEncounter(99),false);assert.equal(e.serialize(),before);
    const choice=v===2?0:2;assert.ok(e.chooseEncounter(choice));assert.equal(e.c.encounters[room.id].opened,v===2);assert.equal(e.chooseEncounter(choice),false);assert.ok(e.pathTo(room,REGIONS[region].exit).length>0);
  }
});

test('opening a dangerous room spawns the announced enemies; tool and inventory failures keep the choice pending',()=>{
  const e=stocked();e.travel('residential');e.c.visits.residential=1;e.assignRegion();const room=e.objects.find(o=>o.type==='encounter');e.s.player.x=room.x;e.s.player.y=room.y;e.c.pendingEncounter=room.id;const n=e.enemies.length;assert.ok(e.chooseEncounter(0));assert.equal(e.enemies.length,n+2);
  e.travel('farm');e.travel('hospital');const other=e.objects.find(o=>o.type==='encounter');e.s.player.x=other.x;e.s.player.y=other.y;e.c.pendingEncounter=other.id;assert.equal(e.chooseEncounter(0),false);assert.equal(e.c.pendingEncounter,other.id);e.s.inventory.crowbar=1;e.c.toolLevel=2;assert.ok(e.chooseEncounter(0));
});

test('all three fish and animal products have recipes and appear in rotating life orders',()=>{
  const e=stocked();for(const recipe of ['fishStew','riverMeal','nightMeal','eggMeal','milkMeal'])assert.ok(e.craft(recipe));e.advanceMinutes(240);e.collectAllProduction();for(const id of ['fishStew','riverMeal','nightMeal','eggMeal','milkMeal'])assert.ok(e.qty(id));
  e.c.metrics.fish=1;e.c.animals.chicken=true;e.c.animals.goat=true;const requested=new Set();for(let i=0;i<7;i++){e.sleep();for(const o of e.c.orders)for(const id of Object.keys(o.cost))requested.add(id);}
  for(const id of ['fish','riverMeal','nightMeal','egg','milk','milkMeal'])assert.ok(requested.has(id),id);
});

test('storm forecast is accurate, rain supplies water and a greenhouse protects growth',()=>{
  const e=stocked();e.s.day=5;assert.equal(e.forecast()[2].weather,'暴雨');e.s.day=7;e.onNewDay();assert.equal(e.s.weather,'暴雨');const p=e.s.plots[10];Object.assign(p,{crop:'corn',growth:0,wateredDay:0,waterUnits:0,trait:'abundant'});e.onNewDay();assert.equal(p.waterUnits,2);e.grow(10);assert.equal(p.growth,10*.85*.65);
  facility(e,'greenhouse',p.x+40,p.y);const previous=p.growth;e.grow(10);assert.ok(Math.abs(p.growth-previous-9.35)<1e-8);assert.ok(WEATHER.includes('暴雨'));
});

test('seeded choices survive save restoration and scheduled events respect post-horde recovery days',()=>{
  const e=stocked();e.sleep();assert.ok(e.c.event);const next=e.c.nextEventDay;assert.ok(next===4||next===5);e.c.event.done=true;const copy=new Engine(Engine.parse(e.serialize()));
  e.advanceMinutes(1440*3);copy.advanceMinutes(1440*3);assert.deepEqual(e.c.event,copy.c.event);assert.deepEqual(e.c.researchOffers,copy.c.researchOffers);
  e.c.event=null;e.c.recoveryUntil=e.s.day+1;e.c.nextEventDay=e.s.day;e.s.day++;e.onNewDay();assert.equal(e.c.event,null);e.s.day++;e.onNewDay();assert.ok(e.c.event);
  const siege=stocked();siege.s.stats.hordes=1;siege.s.horde.phase='won';siege.c.nextHordeDay=2;siege.c.nextEventDay=2;siege.sleep();assert.equal(siege.s.horde.phase,'warning');assert.equal(siege.c.event,null);
});

test('v0.2 saves migrate new scheduling fields and malformed new data is rejected before gameplay',()=>{
  const e=stocked();e.recruit('medic');const legacy=JSON.parse(e.serialize());legacy.expansionVersion=2;for(const key of ['rng','water','waterCapacity','marketBoosts','geneLibrary','encounters','pendingEncounter','autoMeals','stallCursor','recoveryUntil'])delete legacy.colony[key];for(const r of legacy.colony.residents)for(const key of ['priorities','x','y','target'])delete r[key];const restored=new Engine(Engine.parse(JSON.stringify(legacy)));assert.equal(restored.s.expansionVersion,3);assert.equal(restored.c.water,24);assert.equal(restored.c.residents[0].priorities.medic,1);
  for(const mutate of [s=>s.colony.water=25,s=>s.colony.rng=0,s=>s.colony.residents[0].priorities.guard=7,s=>s.horde.direction=9,s=>s.colony.workClock=60]){const bad=JSON.parse(restored.serialize());mutate(bad);assert.throws(()=>Engine.parse(JSON.stringify(bad)));}
  assert.equal(new Engine(Engine.parse(restored.serialize())).serialize(),restored.serialize());
});

test('twenty feature entries and all camp panels render populated state, night preparation and side-room choices',()=>{
  const e=stocked();e.recruit('farmer');e.feedResidents();facility(e,'drone');facility(e,'stall');e.listStall('wood',3,'premium');e.craftBatch('stew',3);e.sleep();assert.equal(FEATURES.length,20);
  for(const [tab]of CAMP_TABS){const html=renderCamp(e,tab,helpers);assert.ok(html.length>150,tab);assert.equal(/undefined|NaN/.test(html),false,tab);}
  const handbook=renderCamp(e,'features',helpers);assert.equal((handbook.match(/class="camp-card"/g)||[]).length,20);assert.doesNotMatch(handbook,/feature-number|均已加入当前版本/);
  e.waitUntilNight();e.travel('hospital');const room=e.objects.find(o=>o.type==='encounter');e.c.pendingEncounter=room.id;const html=renderCamp(e,'explore',helpers);assert.ok(html.includes('chooseEncounter'));assert.ok(html.includes('黎明'));assert.ok(html.includes('视野缩小'));
});
