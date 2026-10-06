/** Native Canvas smoke check; this is deliberately not labelled a real browser test. */
import {createRequire} from 'node:module';
import {writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createBeyondAssets,BEYOND_GEOMETRY,BEYOND_ANCHORS} from '../dist/beyond-art.js';
import {createDistrictAssets} from '../dist/district-art.js';
import {Renderer} from '../dist/beyond-renderer.js';
import {Engine,freshState} from '../dist/beyond.js';
import {CROPS} from '../dist/data.js';
import {BPOINTS,BEVENTS} from '../dist/beyond-data.js';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
const assets={...createDistrictAssets(),...createBeyondAssets()};
for(const name of ['farm','ruins','sprites','expansion','frontier'])assets[name]=await loadImage(new URL('../dist/assets/'+name+'.png',import.meta.url).pathname);
const e=new Engine(freshState());Object.assign(e.b,{points:{},unlocked:{},records:{},forest:[0,0,0],dog:{mode:'follow',foodDay:0},modules:[],mail:{sent:[],receipts:[]},vision:{self:0,guest:0,knowledge:0}});e.d.track=null;e.paused=false;e.beyondTarget=()=>null;
const out=process.env.BEYOND_ART_OUTPUT||'/workspace/scratch/045dbbdb756b/beyond-art-check';mkdirSync(out,{recursive:true});
let frames=0;for(const id of ['farm','market','residential','hospital','warehouse','valley','stationMarket','courtyard','quarantine','railDepot',...Object.keys(BEYOND_GEOMETRY)]){
 e.s.region=id;e.assignRegion();e.s.player.x=790;e.s.player.y=550;e.s.minute=780;e.s.weather='晴';e.objects=BPOINTS.filter(p=>p.region===id).map(p=>({...p,type:'beyondPoint',pointId:p.id}));e.enemies=[];for(const def of BEVENTS.filter(d=>d.region===id).slice(0,1)){const point=e.objects[1];e.objects.push({type:'beyondEvent',eventId:def.id,name:def.name,icon:55,x:point?.x||800,y:point?.y||500});e.b.records[def.id]={status:'active',stage:0,choice:def.choices[0].key};}
 if(BEYOND_GEOMETRY[id]){assert.equal(e.objects.filter(o=>o.type==='beyondPoint').length,8);for(const [x,y]of BEYOND_ANCHORS)assert.ok(!BEYOND_GEOMETRY[id].some(r=>x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h),id+' anchor in collider');}
 for(const [w,h]of [[1366,768],[1920,1080],[390,844]]){const canvas=createCanvas(w,h),r=new Renderer(canvas,assets);r.resize(w,h,1);for(const weather of ['晴','暴雨']){e.s.weather=weather;r.draw(e,{x:400,y:400},.016);frames++;}const preview=createCanvas(768,384);r.drawMapPreview(preview,e);assert.ok(preview.toBuffer('image/png').length>1000);if(w===1366&&BEYOND_GEOMETRY[id])writeFileSync(out+'/'+id+'.png',canvas.toBuffer('image/png'));}
 for(const o of e.objects.filter(o=>o.pointId))e.b.points[o.pointId]={count:2,flags:{completed:true,active:true},choice:'drain'};
 e.s.minute=1320;e.s.settings.visualEffects='reduced';const can=createCanvas(1366,768),r=new Renderer(can,assets);r.resize(1366,768,1);r.draw(e,{x:400,y:400},.016);frames++;e.s.settings.visualEffects='off';r.draw(e,{x:400,y:400},.016);frames++;
}
// Exercise every event prop set, all weapon/tool actions, crop stages and enemy tells.
e.s.region='farm';e.assignRegion();e.objects=[];e.s.weather='暴雨';e.s.settings.visualEffects='full';e.s.player.x=820;e.s.player.y=480;e.enemies=['slow','runner','screamer','armor','elite'].map((type,i)=>({...e.enemy(type,520+i*100,440),windup:.2,flash:.08}));
const actionCanvas=createCanvas(1366,768),actionRenderer=new Renderer(actionCanvas,assets);actionRenderer.resize(1366,768,1);
for(const def of BEVENTS){e.objects=[{type:'beyondEvent',eventId:def.id,name:def.name,icon:55,x:800,y:480}];e.b.records[def.id]={status:'active',stage:1,choice:def.choices[0].key};actionRenderer.draw(e,{x:400,y:400},.016);frames++;}
e.objects=[];for(const item of ['hoe','water','seedRadish','club','pistol','shotgun','rifle']){e.s.inventory[item]=1;e.currentItem=()=>item;e.actionAnim=.15;e.reload=item==='rifle'?{t:.4,max:1}:null;actionRenderer.draw(e,{x:400,y:400},.016);frames++;}e.reload=null;
for(const stage of [0,.35,.7,1]){e.s.plots=Object.keys(CROPS).map((id,i)=>({x:450+i*50,y:610,tilled:true,crop:id,growth:CROPS[id].grow*stage,wateredDay:e.s.day,fertility:70}));actionRenderer.draw(e,{x:400,y:400},.016);frames++;}
writeFileSync(out+'/actions-crops-events.png',actionCanvas.toBuffer('image/png'));
// Save-backed visible progress: forest dates, room/boat modules, mail, households and three visions.
e.s.region='farm';e.assignRegion();Object.assign(e.b,{family:4,vision:{self:3,guest:2,knowledge:1},modules:['pinewood_lodge:warm','frost_inn:bed'],boat:['cargo','roof'],forest:[e.s.day+2,0,e.s.day+5],mail:{sent:['medical'],receipts:['已送达']}});e.b.benefits.cleanRiver=true;e.b.benefits.familyDay=e.s.day;e.f.dog.rescued=true;e.b.dog.mode='home';e.assignRegion();e.enemies=[];actionRenderer.draw(e,{x:400,y:400},.016);frames++;writeFileSync(out+'/restored-households.png',actionCanvas.toBuffer('image/png'));
for(const id of ['pinewood','shipyard','frost']){e.s.region=id;e.assignRegion();e.enemies=[];e.s.player.x=920;e.s.player.y=565;actionRenderer.draw(e,{x:400,y:400},.016);frames++;if(id==='shipyard'){const before=actionCanvas.toBuffer('image/png');e.bensure('shipyard_drain').flags.pump=true;actionRenderer.draw(e,{x:400,y:400},.016);frames++;assert.notDeepEqual(actionCanvas.toBuffer('image/png'),before,'real pump flag must visibly drain the blocking basin');}}
// Observation alone must not light a repaired safety signal. Reflection never emits light.
const lightCanvas=createCanvas(1536,1024),lightRenderer=new Renderer(lightCanvas,assets),lc=lightCanvas.getContext('2d');e.s.region='shelter';e.s.minute=1320;e.s.settings.visualEffects='full';e.objects=[{type:'beyondPoint',pointId:'shelter_signals',x:1080,y:500}];Object.assign(e.bensure('shelter_signals'),{count:1,flags:{air:true}});lightRenderer.drawWeather(e);assert.equal(lc.getImageData(1080,465,1,1).data[3],0,'air reading cannot light safety lamp');e.bensure('shelter_signals').flags.repair=true;lightRenderer.drawWeather(e);assert.ok(lc.getImageData(1080,465,1,1).data[3]>0,'calibrated safety lamp is visible');e.s.region='shipyard';e.c.energy=10;e.objects=[{type:'beyondPoint',pointId:'shipyard_fog',x:1080,y:500}];Object.assign(e.bensure('shipyard_fog'),{count:1,flags:{reflect:true},choice:'reflect'});lc.clearRect(0,0,1536,1024);lightRenderer.drawWeather(e);assert.equal(lc.getImageData(1080,465,1,1).data[3],0,'reflective buoy must not emit powered light');e.bensure('shipyard_fog').choice='lamp';lc.clearRect(0,0,1536,1024);lightRenderer.drawWeather(e);assert.ok(lc.getImageData(1080,465,1,1).data[3]>0);e.c.energy=0;lc.clearRect(0,0,1536,1024);lightRenderer.drawWeather(e);assert.equal(lc.getImageData(1080,465,1,1).data[3],0,'empty battery extinguishes the powered harbor lamp');
const sheet=createCanvas(1536,1024*5);let at=0;for(const id of Object.keys(BEYOND_GEOMETRY)){sheet.getContext('2d').drawImage(assets[id],0,at++*1024);}writeFileSync(out+'/five-region-backdrops.png',sheet.toBuffer('image/png'));
console.log(JSON.stringify({nativeCanvas:true,realBrowser:false,frames,regions:15,points:40,sizes:['1366×768','1920×1080','390×844'],output:out}));
