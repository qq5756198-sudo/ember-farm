import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine, freshState, demoState} from '../dist/echoes.js';
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

test('v7 harder rules four chapters form a complete campaign through physical rescues, production, projects, outposts and two defenses',()=>{
  const e=make();provision(e);
  e.advanceMinutes(60);assert.ok(e.harvest(e.s.plots[0]));assert.ok(e.harvest(e.s.plots[1]));claim(e,'harvest');
  produce(e,'trailBread');claim(e,'meal');
  arrive(e,'residential');rescue(e,'farmer');find(e,'seedArchive');claim(e,'farmer');
  build(e,'workbench');build(e,'bed');assert.ok(e.contributeProject('market'));claim(e,'table');assert.equal(e.chapter(),1);
  arrive(e,'hospital');rescue(e,'medic');const log=e.objects.find(o=>o.type==='clue');assert.ok(log);Object.assign(e.s.player,log);e.interact();assert.ok(e.f.clues.includes('hospital'));find(e,'pumpModule');claim(e,'signal');
  produce(e,'bandage');claim(e,'medical');assert.ok(e.contributeProject('clinic'));
  arrive(e,'hospital');clearNest(e);commission(e,'hospital');assert.ok(e.scoutSiege('hospital'));claim(e,'hospital');
  assert.ok(e.chooseStyle('scout'));win(e,'hospital');assert.equal(e.r.lastBattle.count,9);claim(e,'hospitalDefense');assert.equal(e.chapter(),2);assert.equal(e.s.plots.filter(p=>p.rebuildNew).length,6);
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

