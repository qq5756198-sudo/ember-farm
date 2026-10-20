import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine,freshState} from '../dist/expansion.js';
import {freshState as oldFresh} from '../dist/engine.js';
import {ITEMS,CROPS,BUILDINGS} from '../dist/data.js';
import {TECH,PROJECTS} from '../dist/expansion-data.js';
import {CAMP_TABS,renderCamp,renderSpecializations} from '../dist/camp-ui.js';

const ticks=(e,seconds)=>{for(let i=0;i<seconds*20;i++)e.update(.05);};
function stocked(){const s=freshState();s.money=3000;Object.assign(s.inventory,{wood:200,stone:100,scrap:200,parts:100,cloth:60,radish:60,potato:60,tomato:60,bean:60,corn:60,herb:60,cotton:60,bread:60,stew:20,jam:20,bandage:30,ammo:100});const e=new Engine(s);e.paused=false;return e;}
function facility(e,type,x=900,y=760){const b={id:'fixture-'+type+'-'+e.s.idCounter++,type,x,y,rotation:0,hp:BUILDINGS[type].hp};e.s.buildings.push(b);return b;}

test('legacy saves migrate, retain progress, and new save round-trips without losing colony state',()=>{
  const old=oldFresh();old.stats.rescued=1;old.stats.hordes=1;old.horde.phase='won';old.day=6;const e=new Engine(Engine.parse(JSON.stringify(old)));
  assert.equal(e.c.residents[0].id,'medic');assert.equal(e.c.nextHordeDay,9);assert.equal(e.qty('seedRadish'),10);
  const saved=e.serialize();assert.equal(new Engine(Engine.parse(saved)).serialize(),saved);
  const invalid=JSON.parse(saved);invalid.colony.energy=101;assert.throws(()=>Engine.parse(JSON.stringify(invalid)));
});
test('active siege and populated production, escrow, genes and residents survive save restoration',()=>{
  const e=stocked();facility(e,'stall');facility(e,'breeder');e.listStall('radish',3,'premium');e.craft('stew');e.breedTrait('radish','hardy');e.recruit('medic');e.s.stats.hordes=1;e.s.horde.phase='warning';e.beginHorde();
  const text=e.serialize();assert.equal(new Engine(Engine.parse(text)).serialize(),text);
  const damaged=JSON.parse(text);damaged.colony.relationships.food.claimed=null;assert.throws(()=>Engine.parse(JSON.stringify(damaged)));
});
test('full bags keep finished production and stall escrow available for later collection',()=>{
  const e=stocked();facility(e,'stall');e.listStall('tomato',3,'fair');e.craft('beanMeal');e.advanceMinutes(35);
  e.s.inventory=Object.fromEntries(Object.keys(ITEMS).filter(id=>id!=='beanMeal'&&id!=='tomato').slice(0,32).map(id=>[id,1]));
  assert.equal(e.collectProduction(e.c.production[0].id),false);assert.equal(e.c.production.length,1);assert.equal(e.withdrawStall(e.c.stall[0].id),false);assert.equal(e.c.stall[0].qty,3);
  e.depositAll();assert.ok(e.collectProduction(e.c.production[0].id));assert.ok(e.withdrawStall(e.c.stall[0].id));
});
test('daily order limit, delivery, reputation and refresh are atomic',()=>{
  const e=stocked(),[a,b,c]=e.c.orders;assert.ok(e.acceptOrder(a.id));assert.ok(e.acceptOrder(b.id));assert.equal(e.acceptOrder(c.id),false);
  const before=e.s.money;assert.ok(e.deliverOrder(a.id));assert.equal(e.s.money,before+a.money);assert.equal(e.deliverOrder(a.id),false);assert.equal(e.c.reputation,10);
  const id=a.id;e.sleep();assert.equal(e.s.day,2);assert.equal(e.c.orders.length,3);assert.notEqual(e.c.orders[0].id,id);assert.equal(e.deliverOrder(id),false);
});
test('processing advances in game time, parallel stations work, pause freezes and refunds use original cost',()=>{
  const e=stocked();facility(e,'workbench');assert.ok(e.craft('stew'));assert.ok(e.craft('jam'));assert.ok(e.craft('cloth'));
  const before=e.serialize();e.paused=true;ticks(e,80);assert.equal(e.serialize(),before);e.paused=false;
  e.advanceMinutes(35);assert.ok(e.c.production.find(j=>j.recipe==='stew').ready);assert.ok(e.c.production.find(j=>j.recipe==='cloth').ready);assert.equal(e.c.production.find(j=>j.recipe==='jam').remaining,35);
  e.collectAllProduction();assert.equal(e.c.production.length,1);const tomato=e.qty('tomato');e.c.specializations.manufacturing='economy';assert.ok(e.cancelProduction(e.c.production[0].id));assert.equal(e.qty('tomato'),tomato+2);assert.equal(e.c.production.length,0);
  e.c.technologies.canner=true;facility(e,'canner');assert.ok(e.craft('parcel'));e.advanceMinutes(50);assert.ok(e.collectAllProduction());assert.equal(e.qty('parcel'),1);
});
test('trait seeds change crop growth and yield; greenhouse protects severe-weather growth',()=>{
  const e=stocked();facility(e,'breeder');assert.ok(e.breedTrait('radish','early'));const p=e.s.plots[10];p.tilled=true;assert.ok(e.toolPlot(p,'seed_radish_early'));assert.ok(e.toolPlot(p,'water'));e.grow(60);assert.equal(p.growth,84);e.grow(30);assert.ok(e.harvest(p));
  const dry=e.s.plots[11];dry.tilled=true;e.s.inventory.seed_radish_hardy=1;e.toolPlot(dry,'seed_radish_hardy');e.toolPlot(dry,'water');e.sleep();e.s.weather='酸雨';e.grow(60);assert.ok(dry.growth>0);
  const q=e.s.plots[12];Object.assign(q,{crop:'radish',growth:0,wateredDay:e.s.day});e.grow(10);assert.equal(q.growth,3);facility(e,'greenhouse',q.x+90,q.y);e.grow(10);assert.equal(q.growth,14);
});
test('functional meals can be used at full health, have two slots, expire and reduce damage',()=>{
  const e=stocked();e.s.difficulty='standard';e.s.inventory.beanMeal=2;e.s.inventory.herbTea=1;
  assert.ok(e.consume('stew'));assert.ok(e.consume('beanMeal'));assert.equal(e.consume('herbTea'),false);assert.equal(e.qty('herbTea'),1);
  e.damagePlayer(20);assert.equal(e.s.player.hp,84);e.advanceMinutes(240);assert.equal(e.c.buffs.length,0);assert.ok(e.consume('herbTea'));
});
test('skill choices affect harvest and combat; switching is paid and cannot stack branches',()=>{
  const e=stocked();e.s.xp.agriculture=80;assert.ok(e.chooseSpec('agriculture','yield'));assert.equal(e.chooseSpec('agriculture','quality'),false);
  const p=e.s.plots[0];Object.assign(p,{crop:'radish',growth:120,wateredDay:e.s.day,care:0});const n=e.qty('radish');e.harvest(p);assert.equal(e.qty('radish')-n,6);const money=e.s.money;assert.ok(e.resetSpec('agriculture'));assert.equal(e.s.money,money-60);
  e.s.xp.combat=80;e.chooseSpec('combat','melee');e.s.slot=3;const enemy=e.enemy('slow',e.s.player.x+40,e.s.player.y);e.enemies.push(enemy);e.attack(enemy);assert.ok(enemy.hp<65-24*1.1);
});
test('public projects charge each stage once and restore useful services and shorter travel',()=>{
  const e=stocked();for(const id of Object.keys(PROJECTS)){assert.ok(e.contributeProject(id));assert.ok(e.contributeProject(id));assert.equal(e.contributeProject(id),false);}
  assert.equal(e.price('food','seedRadish','buy'),15);e.s.player.hp=40;assert.ok(e.clinicHeal());assert.equal(e.s.player.hp,100);assert.equal(e.clinicHeal(),false);
  const minute=e.s.minute;e.travel('market');assert.equal(e.s.minute-minute,10);assert.equal(e.c.toolLevel,2);
});
test('rescued residents require housing and food, then tend crops, repair and heal',()=>{
  const e=stocked();assert.ok(e.recruit('farmer'));assert.ok(e.recruit('medic'));assert.ok(e.recruit('mechanic'));assert.equal(e.recruit('farmer'),false);
  assert.ok(e.feedResidents());assert.equal(e.c.residents.filter(r=>r.fed).length,1);facility(e,'bed');facility(e,'bed');e.feedResidents();
  const p=e.s.plots[0];Object.assign(p,{crop:'radish',growth:120,wateredDay:e.s.day});const fence=facility(e,'fence');fence.hp=100;e.s.player.hp=60;e.workHour();
  assert.equal(p.crop,null);assert.ok(e.s.storage.radish>0);assert.equal(fence.hp,135);assert.equal(e.s.player.hp,72);e.sleep();assert.ok(e.c.residents.every(r=>!r.fed));
});
test('NPC trust changes through daily contact and gifts; story reward and special stock cannot duplicate',()=>{
  const e=stocked();assert.ok(e.talk('food'));assert.equal(e.talk('food'),false);assert.ok(e.gift('food'));assert.equal(e.gift('food'),false);
  e.c.relationships.food.trust=50;const n=e.qty('seedPumpkin');assert.ok(e.claimStory('food',2));assert.equal(e.qty('seedPumpkin'),n+3);assert.equal(e.claimStory('food',2),false);
  const stock=e.traderStock('food');assert.equal(stock.seedHerb,3);e.traderStock('food');assert.equal(stock.seedHerb,3);
});
test('market stall keeps goods in escrow, pays for actual sales and returns unsold stock',()=>{
  const e=stocked();facility(e,'stall');const n=e.qty('radish'),money=e.s.money;assert.ok(e.listStall('radish',5,'fair'));assert.equal(e.qty('radish'),n-5);assert.equal(e.s.money,money);
  e.advanceMinutes(90);assert.equal(e.c.stall[0].qty,4);assert.equal(e.s.money,money+e.stallPrice(e.c.stall[0]));assert.ok(e.withdrawStall(e.c.stall[0].id));assert.equal(e.qty('radish'),n-1);assert.equal(e.c.stall.length,0);
});
test('exploration variants preserve unique rewards and night resources are time-dependent',()=>{
  const e=stocked();e.travel('residential');assert.equal(e.c.visits.residential,0);const poi=e.objects.find(o=>o.type==='poi').id;assert.ok(e.objects.some(o=>o.id==='residential-road'));assert.equal(e.objects.some(o=>o.type==='nightCache'),false);
  e.travel('farm');e.travel('residential');assert.equal(e.c.visits.residential,1);assert.notEqual(e.objects.find(o=>o.type==='poi').id,poi);assert.ok(e.colliders().some(r=>r.variant));
  e.travel('farm');assert.ok(e.waitUntilNight());e.s.inventory.flashlight=1;e.travel('hospital');const cache=e.objects.find(o=>o.type==='nightCache');assert.ok(cache);assert.equal(cache.loot.nightHerb,2);e.s.player.x=cache.x;e.s.player.y=cache.y;e.interact();assert.equal(e.qty('nightHerb'),2);e.interact();assert.equal(e.qty('nightHerb'),2);
});
test('graded salvage requires correct tool, spends no material on failure, and cannot repeat same day',()=>{
  const e=stocked();e.travel('residential');const car=e.objects.find(o=>o.id?.endsWith('-car'));assert.equal(e.salvageObject(car),false);e.s.inventory.crowbar=1;assert.equal(e.salvageObject(car),false);e.travel('farm');assert.ok(e.upgradeCrowbar());e.travel('residential');const parts=e.qty('parts');assert.ok(e.salvageObject(car));assert.equal(e.qty('parts'),parts+3);assert.equal(e.salvageObject(car),false);assert.ok(e.noise.some(n=>n.r===420));
});
test('fishing has a timing window, bait and nighttime species, and fish traps have a daily claim',()=>{
  const e=stocked();e.s.player.x=1040;e.s.player.y=800;assert.ok(e.startFishing());ticks(e,2.3);assert.equal(e.c.fishing.phase,'bite');e.interact();assert.equal(e.qty('fish'),1);assert.equal(e.c.fishing,null);
  e.s.minute=1140;assert.ok(e.startFishing(true));ticks(e,3);e.interact();assert.equal(e.qty('nightFish'),1);const trap=facility(e,'fishTrap',1040,790);assert.ok(e.collectFishTrap(trap));assert.equal(e.collectFishTrap(trap),false);
});
test('rescued animals produce after feeding and output claims cannot repeat',()=>{
  const e=stocked();e.travel('residential');const chicken=e.objects.find(o=>o.type==='animalRescue');e.s.player.x=chicken.x;e.s.player.y=chicken.y;e.interact();assert.ok(e.c.animals.chicken);e.travel('farm');facility(e,'coop');e.c.reputation=40;assert.ok(e.buyGoat());assert.ok(e.feedAnimals());assert.equal(e.feedAnimals(),false);e.advanceMinutes(240);assert.ok(e.collectAnimals());assert.equal(e.qty('egg'),2);assert.equal(e.qty('milk'),1);assert.equal(e.collectAnimals(),false);
});
test('irrigation needs a source and drone harvest uses generated power and real seeds',()=>{
  const e=stocked(),p=e.s.plots[0];e.s.debris=e.s.debris.filter(d=>d.id!==p.id);Object.assign(p,{tilled:true,crop:'radish',growth:120,wateredDay:0});facility(e,'rain',p.x+100,p.y);facility(e,'irrigation',p.x+80,p.y);facility(e,'solar',800,720);facility(e,'drone',p.x+70,p.y);
  const seeds=e.qty('seedRadish');e.workHour();assert.equal(p.wateredDay,e.s.day);assert.equal(p.crop,'radish');assert.equal(p.growth,0);assert.equal(e.c.energy,1);assert.equal(e.qty('seedRadish'),seeds-1);assert.ok((e.s.storage.radish||0)+(e.s.storage.fine_radish||0)>=3);
  e.s.minute=1140;const energy=e.c.energy;e.workHour();assert.equal(e.c.energy,energy);
});
test('repeat horde has warning, bounded enemy count, distinct theme and recovery period',()=>{
  const e=stocked();e.s.stats.hordes=1;e.s.horde.phase='won';e.c.nextHordeDay=2;e.sleep();assert.equal(e.s.horde.phase,'warning');assert.equal(e.hordeName(),'装甲突击群');assert.equal(e.sleep(),false);assert.ok(e.beginHorde());assert.equal(e.s.horde.remaining,10);
  for(let i=0;i<900&&e.s.horde.phase==='active';i++){e.updateHorde(.1);for(const zombie of e.enemies.filter(z=>z.horde&&!z.dead))e.hurtEnemy(zombie,2000,0);}
  assert.equal(e.s.horde.phase,'won');assert.equal(e.s.stats.hordes,2);assert.equal(e.c.nextHordeDay,e.s.day+3);assert.ok(e.c.nextEventDay>=e.s.day+2);
});
test('blueprint selection does not spend on invalid choices and unchosen technologies remain researchable',()=>{
  const e=stocked();e.grantResearch(1);const id=e.c.researchOffers[0];assert.equal(e.chooseTech('wrong'),false);assert.equal(e.c.researchCredits,1);assert.ok(e.chooseTech(id));assert.equal(e.chooseTech(id),false);const other=Object.keys(TECH).find(x=>!e.c.technologies[x]);assert.ok(e.researchTech(other));assert.ok(e.c.technologies[other]);assert.equal(e.c.researchCredits,0);
});
test('random event choices consume and reward atomically and remain in the diary',()=>{
  const e=stocked();e.sleep();assert.ok(e.c.event);e.c.event={type:'radio',day:2,done:false};const parts=e.qty('parts'),bandage=e.qty('bandage');assert.ok(e.chooseEvent(0));assert.equal(e.qty('parts'),parts+3);assert.equal(e.qty('bandage'),bandage-2);assert.equal(e.chooseEvent(0),false);assert.equal(e.c.eventLog.length,1);
});
test('colony menus render all empty and populated states with available action names',()=>{
  const e=stocked(),helpers={esc:s=>String(s).replaceAll('"','&quot;'),icon:i=>`<i>${i}</i>`,itemIcon:id=>`<i>${id}</i>`,itemName:id=>ITEMS[id]?.name||id,costs:b=>Object.entries(b).map(([i,n])=>i+n).join(' ')};
  for(const [tab]of CAMP_TABS){const html=renderCamp(e,tab,helpers);assert.ok(html.length>100,tab);assert.equal(html.includes('undefined'),false,tab);assert.equal(html.includes('NaN'),false,tab);}
  e.recruit('medic');facility(e,'stall');e.listStall('radish',3,'fair');e.craft('stew');e.advanceMinutes(30);
  for(const [tab]of CAMP_TABS)assert.ok(renderCamp(e,tab,helpers));assert.ok(renderSpecializations(e,helpers));
});
