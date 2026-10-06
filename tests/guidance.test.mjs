import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine,freshState} from '../dist/guidance-engine.js';
import {freshState as oldFresh,Engine as OldEngine} from '../dist/beyond.js';
import {districtDemoState} from '../dist/districts.js';
import {DISTRICTS,POINT_BY_ID} from '../dist/district-data.js';
import {BMAPS} from '../dist/beyond-data.js';
import {TASKS} from '../dist/rebuild-data.js';
import {renderAtlas,regionAccess,gateDestination,handleAtlasAction,localLandmarks,ATLAS_POINTS} from '../dist/wayfinding.js';
import {LESSONS,mainAction} from '../dist/guidance-data.js';
import {renderJournal,handleGuidanceAction} from '../dist/guidance-ui.js';
import {renderDistricts,handleDistrictAction,districtNeedsConfirm} from '../dist/district-ui.js';
const ctx=e=>({engine:e,ui:{},rebuildUI:{},root:{querySelector:()=>null},renderMenu(){},showMenu(){},closeMenu(){},save(){},toast(){}});
const snapshot=e=>{const s=JSON.parse(e.serialize());delete s.echoes.history;return JSON.stringify(s);};
const action=(fn,name,id,c)=>fn(name,{dataset:{id}},c);
test('old formal save migrates additively and retains difficulty, inventory, maps, workers and event progress',()=>{
 const old=oldFresh();old.money=417;old.districts.unlocked.valley=true;
 const expected=OldEngine.parse(JSON.stringify(old));const migrated=Engine.parse(JSON.stringify(old));const {guidance,...rest}=migrated;
 assert.deepEqual(rest,expected);assert.deepEqual(guidance,{revision:1,focus:null,target:null});
 const e=new Engine(migrated);e.focusLesson('orders');e.guidance.target={region:'farm',x:700,y:510,label:'仓库'};
 assert.deepEqual(Engine.parse(e.serialize()).guidance,e.guidance);
});
test('bad guidance rejects unknown lessons and invalid map positions while older saves remain valid',()=>{
 for(const g of [{revision:2,focus:null,target:null},{revision:1,focus:'fake',target:null},{revision:1,focus:null,target:{region:'farm',x:-1,y:4,label:'地点'}}]){const s=freshState();s.guidance=g;assert.throws(()=>Engine.parse(JSON.stringify(s)));}
});
test('world map includes all 15 locations and exposes only navigation controls',()=>{
 const e=new Engine(),html=renderAtlas(e),actions=[...html.matchAll(/data-action="([^"]+)"/g)].map(x=>x[1]);
 assert.equal((html.match(/data-action="aSelect"/g)||[]).length,15);
 assert.ok(actions.every(x=>['aSelect','aTravel','aTab','aGate'].includes(x)));
 assert.doesNotMatch(html,/district-workspace|b-world|ePerform|dUnlock|bUnlock|生产看板|data-action="g/);
 assert.match(html,/<svg/);assert.equal(Object.keys(ATLAS_POINTS).length,15);
});
test('locked map selection and entrance pin spend no resources and find accessible parent',()=>{
 const e=new Engine(),c=ctx(e),before=snapshot(e);action(handleAtlasAction,'aSelect','archive',c);assert.equal(snapshot(e),before);action(handleAtlasAction,'aTravel','archive',c);assert.equal(snapshot(e),before);
 const target=gateDestination(e,'archive');assert.equal(target.region,'market');assert.equal(target.destination,'stationMarket');action(handleAtlasAction,'aGate','archive',c);assert.equal(e.s.region,'farm');assert.equal(e.guidance.target.region,'market');assert.equal(e.s.money,80);
});
test('unlock checklists track actual engine gates for all ten locked maps',()=>{
 for(const state of [freshState(),districtDemoState()]){const e=new Engine(state);for(const id of [...Object.keys(DISTRICTS),...Object.keys(BMAPS)]){if(e.d.unlocked[id]||e.b.unlocked[id])continue;const expected=DISTRICTS[id]?e.districtUnlockReason(id):e.beyondUnlockReason(id);assert.equal(regionAccess(e,id).ready,!expected,id);}}
});
test('each main chapter and every lesson produces a concrete action and readable journal',()=>{
 const e=new Engine(districtDemoState());for(const q of TASKS){e.r.claimed=TASKS.slice(0,TASKS.indexOf(q)).map(x=>x.id);e.r.ended=false;const h=renderJournal(e);assert.ok(mainAction(e).kind);assert.doesNotMatch(h,/undefined|NaN/);assert.match(h,/完成后，家园会怎样改变/);}
 assert.equal(LESSONS.length,92);for(const l of LESSONS){e.focusLesson(l.id);assert.doesNotMatch(renderJournal(e),/undefined|NaN/);assert.ok(l.steps(e).length);assert.ok(l.result);}
});
test('completed legacy facility task acknowledges the outcome without more payment or replay',()=>{
 const e=new Engine(districtDemoState());e.d.unlocked.valley=true;e.s.visited.valley=true;e.ensurePoint('watergate').count=1;e.focusLesson('d:watergate');const before=snapshot(e);const html=renderJournal(e);assert.match(html,/这项工作已办妥/);assert.doesNotMatch(html,/data-action="gLessonAction"/);assert.equal(snapshot(e),before);
});
test('guided cooking rejects duplicate queued input, insufficient materials and respects full bag on collection',()=>{
 const e=new Engine(),c=ctx(e);e.s.inventory.radish=6;action(handleGuidanceAction,'gCraft','trailBread',c);assert.equal(e.c.production.length,1);const n=e.qty('radish');action(handleGuidanceAction,'gCraft','trailBread',c);assert.equal(e.qty('radish'),n);e.advanceMinutes(30);const j=e.c.production[0];assert.ok(j.ready);
 const originalAdd=e.canAdd.bind(e);e.canAdd=()=>false;action(handleGuidanceAction,'gCollect',j.id,c);assert.equal(e.c.production.length,1);e.canAdd=originalAdd;action(handleGuidanceAction,'gCollect',j.id,c);assert.equal(e.c.production.length,0);const bread=e.qty('bread');action(handleGuidanceAction,'gCollect',j.id,c);assert.equal(e.qty('bread'),bread);
 e.s.inventory.radish=0;delete e.s.storage.radish;const empty=snapshot(e);action(handleGuidanceAction,'gCraft','trailBread',c);assert.equal(snapshot(e),empty);
});
test('simple local action rechecks materials and duplicate repairs, dangerous actions still require confirmation',()=>{
 const e=new Engine(districtDemoState());e.s.region='valley';e.assignRegion();Object.assign(e.s.player,POINT_BY_ID.watergate);const c=ctx(e);e.s.inventory.wood=0;e.d.stores.valley.wood=0;e.s.inventory.stone=0;e.d.stores.valley.stone=0;const no=snapshot(e);action(handleDistrictAction,'dQuick','watergate:built',c);assert.equal(snapshot(e),no);e.d.stores.valley.wood=50;e.d.stores.valley.stone=50;action(handleDistrictAction,'dQuick','watergate:built',c);assert.ok(e.flag('watergate','built'));const wood=e.districtQty('wood','valley');action(handleDistrictAction,'dQuick','watergate:built',c);assert.equal(e.districtQty('wood','valley'),wood);
 assert.ok(districtNeedsConfirm(e.districtQuote('streetdefense','start')));assert.ok(districtNeedsConfirm(e.districtQuote('herbbed','uproot')));const before=snapshot(e);action(handleDistrictAction,'dQuick','streetdefense:start',c);assert.equal(snapshot(e),before);assert.equal(c.ui.preview,'streetdefense:start');
 assert.doesNotMatch(renderDistricts(e,{region:'valley',point:'watergate',view:'point'}),/district-workspace/);
});
test('local map shows place names and the persisted target, not internal point identifiers',()=>{
 const e=new Engine(districtDemoState());e.s.region='valley';e.assignRegion();e.guidance.target={region:'valley',x:POINT_BY_ID.watergate.x,y:POINT_BY_ID.watergate.y,label:POINT_BY_ID.watergate.name};const labels=localLandmarks(e);assert.ok(labels.some(l=>l.target&&l.label===POINT_BY_ID.watergate.name));assert.ok(labels.length>=8);assert.match(renderAtlas(e,{tab:'local'}),/atlas-landmark target/);
});
