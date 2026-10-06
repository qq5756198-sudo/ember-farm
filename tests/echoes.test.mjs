import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine,freshState,eventDemoState} from '../dist/echoes.js';
import {Engine as Previous,freshState as previousFresh} from '../dist/supply.js';
import {freshState as originalFresh} from '../dist/engine.js';
import {demoState as v4Demo} from '../dist/frontier.js';
import {demoState as v5Demo} from '../dist/rebuild.js';
import {ECHO_EVENTS} from '../dist/echoes-data.js';
import {ITEMS,CROPS,RECIPES,BUILDINGS} from '../dist/data.js';
import {renderEvents,renderWorkReport,renderBattleReport,renderFarmOverlay,renderEchoMap,renderCargoSummary} from '../dist/echoes-ui.js';
const make=()=>{const e=new Engine(eventDemoState());e.paused=false;e.u.plans={};e.c.nextHordeDay=999;e.s.visited.hospital=true;e.putStorage({wood:80,stone:30,parts:30,circuit:12,cloth:40,cotton:40,radish:80,herb:40,bread:50,ammo:80});return e;};
const prepare=(e,id)=>{e.paused=false;e.s.minute=600;e.s.player.hunger=100;e.s.player.hp=100;for(const r of e.c.residents){r.fed=true;r.fatigue=0;}let loc=e.echoLocation(id);if(e.s.region!==loc.region){assert.ok(e.travel(loc.region));e.paused=false;loc=e.echoLocation(id);}Object.assign(e.s.player,{x:loc.x,y:loc.y});assert.equal(e.blocked(loc.x,loc.y),false,'event marker must be reachable');for(const [key,n]of Object.entries(e.echoStep(id).cost)){if(!e.costPlan({[key]:n},loc.region==='farm'))assert.ok(e.add({[key]:n}));}};
function complete(e,id,choice,restore=true){assert.ok(e.acceptEvent(id),id);assert.ok(e.chooseEcho(id,choice));for(let safety=0;e.eventRecord(id).status==='active'&&safety<25;safety++){
 prepare(e,id);const st=e.echoStep(id),before=e.eventRecord(id).stage;
 if(st.kind==='produce'){const recipe=RECIPES.find(r=>r.minutes&&r.out[st.item]);while(e.eventRecord(id).progress<st.count){assert.ok(e.craft(recipe.id),e.batchReason(recipe.id,1));const job=e.c.production.find(j=>j.recipe===recipe.id);e.processProduction(recipe.minutes+1);assert.ok(e.storeProduction(job.id));}}
 if(st.kind==='harvest')for(let i=e.eventRecord(id).progress;i<st.count;i++){const p=e.s.plots[0];Object.assign(p,{crop:'radish',growth:CROPS.radish.grow,trait:null});assert.ok(e.harvest(p));}
 if(st.kind==='photo'){const loc=e.echoLocation(id);assert.ok(e.capturePhoto('data:image/jpeg;base64,AA==',{x:loc.x-80,y:loc.y-80,w:160,h:160}));}
 assert.equal(e.echoActionReason(id),'',id+':'+st.title);assert.ok(e.performEcho(id));
 if(st.kind==='wait'){assert.equal(e.performEcho(id),false,'waiting cannot pay twice');e.advanceMinutes(st.minutes+.01);}
 if(st.kind==='fight'){const targets=e.enemies.filter(z=>z.echoEvent===id&&!z.dead);assert.equal(targets.length,st.count);for(const z of targets)e.hurtEnemy(z,500,0,{});assert.equal(e.eventRecord(id).progress,st.count);assert.ok(e.performEcho(id));}
 assert.ok(e.eventRecord(id).stage>before,id+' must advance');
 if(restore){const saved=e.serialize(),old=e.v.records[id];e=new Engine(Engine.parse(saved));e.paused=false;assert.deepEqual(e.v.records[id],old,'stage restoration '+id);}
 }
 assert.equal(e.eventRecord(id).status,'resolved');assert.ok(e.v.benefits[id]);return e;
}
for(const d of ECHO_EVENTS)for(const o of d.options)test('event '+d.n+' '+d.id+' / '+o.id+' uses real actions and survives every stage reload',()=>{const e=complete(make(),d.id,o.id);assert.equal(e.v.benefits[d.id],o.id);if(d.id==='signal'){assert.equal(e.v.caches.length,1);assert.equal(e.capacity(),34);assert.ok(e.s.storage.cloth);}if(d.id==='loadtest')assert.equal(e.planCapacity(),o.id==='dispatch'?4:3);if(d.id==='drill')assert.equal(e.v.lastReport.won,true);if(d.id==='watch'&&o.id==='barrier')assert.ok(e.s.buildings.some(b=>b.echoBarrier));if(d.id==='bigorder')assert.equal(e.s.money,335);});

test('fixed pressure preserves old resources and separates resource scarcity from guaranteed progression rewards',()=>{
 for(const old of [originalFresh(),v4Demo(),v5Demo(),previousFresh()]){old.money=777;old.inventory.parts=17;const inv=structuredClone(old.inventory);const e=new Engine(Engine.parse(JSON.stringify(old)));assert.equal(e.s.money,777);assert.deepEqual(e.s.inventory,inv);assert.equal(e.s.difficulty,'standard');assert.equal(e.s.echoesVersion,7);}
 const a=new Previous(previousFresh('standard')),e=new Engine(freshState());a.paused=e.paused=false;a.damagePlayer(10);e.damagePlayer(10);assert.equal(100-e.s.player.hp,1.5*(100-a.s.player.hp));
 assert.equal(e.cropGrowthRate(e.s.plots[0])/a.cropGrowthRate(a.s.plots[0]),2/3);
 const n=e.qty('scrap');e._scarce=true;for(let i=0;i<3;i++)assert.ok(e.add({scrap:1}));e._scarce=false;assert.equal(e.qty('scrap')-n,2);const circuit=e.qty('circuit',true);e.putStorage({circuit:2});assert.equal(e.qty('circuit',true),circuit+2);
 assert.equal(e.price('mechanic','parts','buy'),Math.ceil(a.price('mechanic','parts','buy')*1.5));assert.equal(freshState('casual').difficulty,'standard');
});

test('shortages, distance and full bag never consume event input or cargo; a cache can be recovered exactly once',()=>{
 let e=make();assert.ok(e.acceptEvent('convoy'));assert.ok(e.chooseEcho('convoy','repair'));e.s.inventory={};e.s.storage={};prepare(e,'convoy');e.s.inventory={};const before=e.serialize();assert.equal(e.performEcho('convoy'),false);assert.equal(e.eventRecord('convoy').paid,false);assert.equal(e.s.storage.wood,undefined);Object.assign(e.s.player,{x:100,y:100});assert.match(e.echoActionReason('convoy'),/标记/);
 e=make();e.acceptEvent('signal');e.chooseEcho('signal','repairMed');prepare(e,'signal');e.s.inventory=Object.fromEntries(Object.keys(ITEMS).filter(id=>!['parts','medkit','bandage'].includes(id)).slice(0,e.capacity()).map(id=>[id,1]));assert.equal(e.performEcho('signal'),false);assert.equal(e.eventRecord('signal').stage,0);assert.equal(e.v.caches.length,0);e.s.inventory={};assert.ok(e.performEcho('signal'));const c=e.v.caches[0];Object.assign(e.s.player,c);const circuit=e.qty('circuit');assert.ok(e.collectEchoCache(c.id));assert.equal(e.qty('circuit'),circuit+1);assert.equal(e.collectEchoCache(c.id),false);assert.equal(e.objects.some(o=>o.type==='echoCache'),false);
});

test('event combat survives midnight while away, and retries paid action after defeat without charging twice',()=>{
 let e=make();e.acceptEvent('convoy');e.chooseEcho('convoy','escort');prepare(e,'convoy');assert.ok(e.performEcho('convoy'));const ammo=e.qty('ammo');e.travel('farm');e.s.minute=1435;e.s.day=9;e.advanceMinutes(10);e.travel('residential');assert.equal(e.enemies.filter(z=>z.echoEvent==='convoy'&&!z.dead).length,4);e.die();assert.equal(e.eventRecord('convoy').spawned,false);assert.equal(e.eventRecord('convoy').paid,true);const afterDeath=e.qty('ammo');prepare(e,'convoy');assert.ok(e.performEcho('convoy'));assert.equal(e.qty('ammo'),afterDeath);assert.equal(e.enemies.filter(z=>z.echoEvent==='convoy'&&!z.dead).length,4);assert.ok(Engine.parse(e.serialize()));
});

test('ordinary raids wait for event combat, and drill failure produces a persistent loss report',()=>{
 const e=make();e.acceptEvent('drill');e.chooseEcho('drill','west');prepare(e,'drill');assert.ok(e.performEcho('drill'));e.c.nextHordeDay=e.s.day;e.advanceMinutes(20);assert.equal(e.s.horde.phase,'won');assert.equal(e.travel('residential'),false);e.damagePlayer(10);e.die();assert.equal(e.v.lastReport.won,false);assert.ok(e.v.lastReport.damage>0);assert.equal(e.v.normalBattle,null);assert.equal(Engine.parse(e.serialize()).echoes.lastReport.won,false);
});

test('loot left by an enemy after a full bag has the same scarcity as direct pickup',()=>{
 const e=make();e.s.inventory=Object.fromEntries(Object.keys(ITEMS).filter(id=>id!=='scrap').slice(0,e.capacity()).map(id=>[id,1]));e.s.stats.kills=2;const z=e.enemy('slow',800,600);e.hurtEnemy(z,1000,0,{});assert.equal(e.s.drops.at(-1).items.scrap,1);assert.equal(e.v.remainder.scrap,1);const d=e.s.drops.at(-1);delete e.s.inventory[Object.keys(e.s.inventory)[0]];assert.ok(e.add(d.items));assert.equal(e.qty('scrap'),1);
});

test('repeat events do not duplicate permanent capacity and service cooldown is retained across reload',()=>{
 let e=complete(make(),'drought','reserve');const capacity=e.c.waterCapacity;e.s.day+=9;e=complete(e,'drought','reserve');assert.equal(e.c.waterCapacity,capacity);
 e=complete(make(),'convoy','repair');assert.ok(e.useEchoService('caravanSeeds'));const bread=e.qty('bread',true),seed=e.qty('seedCotton',true);assert.equal(e.useEchoService('caravanMetal'),false);e=new Engine(Engine.parse(e.serialize()));assert.equal(e.useEchoService('caravanSeeds'),false);assert.equal(e.qty('bread',true),bread);assert.equal(e.qty('seedCotton',true),seed);e.s.day++;assert.ok(e.useEchoService('caravanMetal'));
});

test('four plan upgrade cannot be removed while a fourth job is in flight and extended equipment saves load',()=>{
 const e=complete(make(),'loadtest','dispatch');Object.assign(e.s.storage,{bread:0,cloth:3,bandage:0,medkit:0});for(const id of ['trailBread','cloth','bandage','medkit'])assert.ok(e.setSupplyPlan(id,12));e.fillSupplyPlans();assert.equal(e.u.autoJobs.length,4);for(const p of Object.values(e.u.plans))p.enabled=false;assert.equal(e.retrofitEcho('loadtest','maintenance'),false);assert.equal(Engine.parse(e.serialize()).supply.autoJobs.length,4);e.processProduction(200);assert.ok(e.retrofitEcho('loadtest','maintenance'));assert.equal(e.droneServiceLimit(),12);e.s.buildings.push({id:'test-drone',type:'drone',hp:BUILDINGS.drone.hp,x:1190,y:850,rotation:0,wear:11});assert.ok(Engine.parse(e.serialize()));assert.ok(e.retrofitEcho('loadtest','dispatch'));assert.equal(e.s.buildings.at(-1).wear,10);assert.ok(Engine.parse(e.serialize()));
});

test('all six system panels and 20-event catalog render valid human labels; permanent services are visible',()=>{
 const e=make();for(const render of [()=>renderEvents(e,{eventFilter:'all'}),()=>renderWorkReport(e),()=>renderBattleReport(e),()=>renderFarmOverlay(e),()=>renderEchoMap(e,{}),()=>renderCargoSummary(e)])assert.doesNotMatch(render(),/undefined|NaN/);
 const catalog=renderEvents(e,{eventFilter:'all'});assert.equal((catalog.match(/data-action="eSelect"/g)||[]).length,22);assert.equal((catalog.match(/id="event-/g)||[]).length,1);
 for(const d of ECHO_EVENTS){const detail=renderEvents(e,{eventFilter:'all',eventId:d.id});assert.ok(detail.includes('id="event-'+d.id+'"'));assert.ok(detail.includes(d.name));assert.equal((detail.match(/id="event-/g)||[]).length,1);}
});
