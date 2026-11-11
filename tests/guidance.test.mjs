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
test('local map shows place names and the persisted target, not internal point identifiers',()=>{
 const e=new Engine(districtDemoState());e.s.region='valley';e.assignRegion();e.guidance.target={region:'valley',x:POINT_BY_ID.watergate.x,y:POINT_BY_ID.watergate.y,label:POINT_BY_ID.watergate.name};const labels=localLandmarks(e);assert.ok(labels.some(l=>l.target&&l.label===POINT_BY_ID.watergate.name));assert.ok(labels.length>=8);assert.match(renderAtlas(e,{tab:'local'}),/atlas-landmark target/);
});
