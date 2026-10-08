import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as Guidance from '../dist/guidance-engine.js';
import * as GuidanceUI from '../dist/guidance-ui.js';
import * as Wayfinding from '../dist/wayfinding.js';
import * as GuidanceData from '../dist/guidance-data.js';
import * as Session from '../dist/player-session.js';
import * as Journey from '../dist/player-journey.js';
import * as Data from '../dist/data.js';
import * as Frontier from '../dist/frontier.js';
import * as Rebuild from '../dist/districts.js';
import * as EchoUI from '../dist/echoes-ui.js';
import * as SupplyUI from '../dist/supply-ui.js';
import * as RebuildUI from '../dist/rebuild-ui.js';
import * as RebuildData from '../dist/rebuild-data.js';
import * as CampUI from '../dist/camp-ui.js';
import * as CampData from '../dist/expansion-data.js';
import * as FrontierUI from '../dist/frontier-ui.js';
import * as FrontierActions from '../dist/frontier-actions.js';
import * as FrontierData from '../dist/frontier-data.js';
import * as Version from '../dist/version.js';
import * as Atlas from '../dist/atlas.js';
import {Renderer} from '../dist/campaign-renderer.js';
import * as Campaign from '../dist/campaign.js';
import * as CampaignUI from '../dist/campaign-ui.js';
import * as Winter from '../dist/winter.js';
import * as WinterUI from '../dist/winter-ui.js';
import * as Outpost from '../dist/outpost.js';
import * as OutpostUI from '../dist/outpost-ui.js';
import * as Alliance from '../dist/alliance.js';
import * as AllianceUI from '../dist/alliance-ui.js';
import * as Beyond from '../dist/beyond.js';
import * as BeyondUI from '../dist/beyond-ui.js';
import * as BeyondArt from '../dist/beyond-art.js';
import * as BeyondData from '../dist/beyond-data.js';
import * as Clarity from '../dist/clarity-ui.js';
import * as DistrictArt from '../dist/district-art.js';
import * as DistrictUI from '../dist/district-ui.js';
import * as DistrictData from '../dist/district-data.js';
const {createCanvas,Image:NativeImage,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
// 前几段检查的是 v0.13–v0.17 的流程：只在“每日抉择”段打开清晨事件卡，其余段里不让它插进来。
const realDailyShow=Campaign.Engine.prototype.dailyShouldShow;let dailyOn=false;
Campaign.Engine.prototype.dailyShouldShow=function(){return dailyOn&&realDailyShow.call(this);};
const dir=new URL('../dist',import.meta.url).pathname;
let all=[];const listeners={};
function decode(s){return s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');}
function parse(html,parent){const out=[];for(const m of html.matchAll(/<([a-zA-Z][\w-]*)([^>]*)>/g)){const el=new El(m[1].toLowerCase(),parent);for(const a of m[2].matchAll(/([\w:-]+)(?:="([^"]*)")?/g)){const k=a[1],v=decode(a[2]||'');if(k==='id')el.id=v;else if(k==='class')el.className=v;else if(k.startsWith('data-'))el.dataset[k.slice(5).replace(/-([a-z])/g,(_,v)=>v.toUpperCase())]=v;else if(k==='disabled')el.disabled=true;else if(k==='hidden')el.hidden=true;else if(k==='value')el.value=v;}out.push(el);}return out;}
function match(el,selector){const hot=selector.match(/^#modal \[data-hotkey="(\d)"\]$/);if(hot){if(el.dataset.hotkey!==hot[1])return false;for(let p=el.parent;p;p=p.parent)if(p.id==='modal')return true;return false;}return selector.split(',').some(part=>{part=part.trim();if(part.includes(':not([disabled])')&&el.disabled)return false;part=part.replace(':not([disabled])','');const attr=part.match(/\[([\w-]+)\]/)?.[1];if(attr){const key=attr.slice(5).replace(/-([a-z])/g,(_,v)=>v.toUpperCase());if(attr.startsWith('data-')&&!(key in el.dataset))return false;part=part.replace(/\[[\w-]+\]/,'');}if(part.startsWith('#'))return el.id===part.slice(1);if(part.startsWith('.'))return el.className.split(' ').includes(part.slice(1));return !part||el.tag===part;});}
class El{
 constructor(tag,parent=null){this.scrollTop=0;this.classList={add:(v)=>{this.className+=' '+v},remove:v=>{this.className=this.className.split(' ').filter(x=>x!==v).join(' ')},toggle:(v,force)=>{const on=force??!this.className.split(' ').includes(v);this.className=this.className.split(' ').filter(x=>x!==v).join(' ')+(on?' '+v:'');return on}};this.tag=tag;this.parent=parent;this.children=[];this.dataset={};this.className='';this.hidden=false;this.disabled=false;this.style={setProperty(k,v){this[k]=v}};this.textContent='';this.value='';this.events={};this._width=0;this._height=0;}
 set innerHTML(html){for(const el of this._parsed||[])all=all.filter(x=>x!==el);this._html=html;this._parsed=parse(html,this);all.push(...this._parsed);this.children=this._parsed;const selects=this._parsed.filter(x=>x.tag==='select');for(const el of selects){const snippet=html.match(new RegExp('<select[^>]*'+(el.id?'id="'+el.id+'"':'')+'[^>]*>([\\s\\S]*?)</select>'))?.[1];el.value=decode(snippet?.match(/<option value="([^"]*)"[^>]*selected/)?.[1]||snippet?.match(/<option value="([^"]*)"/)?.[1]||'');}}
 click(){this.clicked=true;}
 get innerHTML(){return this._html||'';}
 querySelector(s){return (this._parsed||all).find(x=>match(x,s))||null;}
 querySelectorAll(s){return (this._parsed||all).filter(x=>match(x,s));}
 matches(s){return match(this,s);}
 closest(s){if(this.matches(s))return this;return this.parent?.closest(s)||null;}
 append(el){this.children.push(el);el.parent=this;all.push(el);}
 remove(){all=all.filter(e=>e!==this);if(this.parent)this.parent.children=this.parent.children.filter(e=>e!==this);}
 get firstChild(){return this.children[0];}
 get firstElementChild(){return this.children[0]||new El('span',this);}
 addEventListener(t,fn){this.events[t]=fn;}
 focus(){document.activeElement=this;}
 getBoundingClientRect(){return this.id==='world-viewport'||this.id==='world'?{left:0,top:56,width:1366,height:600}:{left:0,top:0,width:1366,height:768};}
 set width(v){this._width=v;if(this.native)this.native.width=v;}
 get width(){return this._width;}
 set height(v){this._height=v;if(this.native)this.native.height=v;}
 get height(){return this._height;}
 getContext(){this.native??=createCanvas(this._width||80,this._height||80);const target=this.native.getContext('2d');return new Proxy(target,{get(t,k){if(k==='drawImage')return (img,...args)=>t.drawImage(img.native||img,...args);const v=t[k];return typeof v==='function'?v.bind(t):v;},set(t,k,v){t[k]=v;return true;}});}
 toDataURL(type,quality){return this.native.toDataURL(type,quality);}
 setPointerCapture(){}hasPointerCapture(){return false;}
}
const document={querySelector:s=>all.find(e=>match(e,s))||null,querySelectorAll:s=>all.filter(e=>match(e,s)),createElement:t=>new El(t),addEventListener:(t,f)=>listeners[t]=f,documentElement:new El('html'),body:new El('body'),modelContext:{registerTool(t){return null}},activeElement:null,title:'',hidden:false};
all=parse(readFileSync(dir+'/index.html','utf8'),null);
const storage=new Map();const initial=Frontier.freshState();initial.money=777;storage.set('ember-farm-save-v1',JSON.stringify(initial));let failSave=false;const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(failSave)throw Error('quota');storage.set(k,String(v));}};
for(const key of Session.HISTORY_KEYS.slice(0,8))storage.set(key,'historic '+key);const historical=[...storage].filter(([k])=>k.includes('demo'));
class Image{set src(path){this.path=path;loadImage(dir+'/'+path).then(img=>{this.native=img;this.width=img.width;this.height=img.height;this.complete=true;this.onload?.();}).catch(e=>this.onerror?.(e));}get src(){return this.path;}}
globalThis.document=document;
let raf;
const context=vm.createContext({...Session,...Journey,...Data,...Frontier,...Rebuild,...RebuildUI,...SupplyUI,...EchoUI,...RebuildData,...CampUI,...CampData,...FrontierUI,...FrontierActions,...FrontierData,...Version,...Atlas,...Clarity,...DistrictArt,...DistrictUI,...DistrictData,...Beyond,...BeyondUI,...BeyondArt,...BeyondData,...Guidance,...GuidanceUI,...Wayfinding,...Alliance,...AllianceUI,...Outpost,...OutpostUI,...Winter,...WinterUI,...Campaign,...CampaignUI,Renderer,document,localStorage,Image,innerWidth:1366,innerHeight:768,devicePixelRatio:1,getComputedStyle:()=>({width:'40px'}),requestAnimationFrame:fn=>raf=fn,setTimeout:fn=>{if(false)fn()},window:{addEventListener(){},AudioContext:null},location:{reload(){}},URL,Blob,AbortController,console});
let script=readFileSync(dir+'/game.js','utf8').replace(/^import .*?;\n/gm,'');
script+='\nglobalThis.inspect=()=>({engine,menu,menuTab,renderer,rebuildUI,districtUI,beyondUI,atlasUI,journalUI,started,campaignInfo});globalThis.action=handleAction;globalThis.open=showMenu;globalThis.step=frame;globalThis.fixture=(state)=>{state.frontier.demo=false;state.frontier.echoDemo=false;state.districts.demo=false;resetEngine(state);started=true;closeMenu();};';
vm.runInContext(script,context,{filename:'game.js'});
for(let i=0;i<150&&!document.querySelector('#loading').hidden;i++)await new Promise(resolve=>setTimeout(resolve,20));
if(!document.querySelector('#loading').hidden)console.log('Loading details:',document.querySelector('#loading').innerHTML);assert.equal(document.querySelector('#loading').hidden,true,'all game assets should finish loading');
const html=()=>document.querySelector('#modal').innerHTML;
const clean=()=>assert.doesNotMatch(html(),/机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN/);
const click=(action,id='',more={})=>context.action({dataset:{action,id,...more}},{shiftKey:false});
assert.equal(context.inspect().menu,'welcome');assert.equal(context.inspect().started,false);clean();
assert.match(html(),/继续游戏/);assert.match(html(),/开始新游戏/);assert.match(html(),/制作人员/);assert.ok(html().includes(Version.GAME_VERSION));
context.open('pause');assert.equal(context.inspect().menu,'pause');assert.match(html(),/存档与备份/);clean();click('close');assert.equal(context.inspect().menu,'welcome');
context.open('credits');assert.match(html(),/Link/);click('close');assert.equal(context.inspect().menu,'welcome');
const original=storage.get(Session.CAMPAIGN_SAVE);click('newGame');assert.equal(storage.get(Session.CAMPAIGN_SAVE),original,'no replacement outside explicit confirmation');click('restart');assert.equal(context.inspect().menu,'confirmRestart');click('close');assert.equal(storage.get(Session.CAMPAIGN_SAVE),original);
click('continueCampaign');const old=context.inspect().engine;assert.equal(old.s.money,777);assert.equal(context.inspect().started,true);assert.equal(context.inspect().menu,null);context.step(1000);
for(const action of ['startDemo','startEchoDemo','startDistrictDemo','fDemoVisit','returnMain'])click(action);assert.equal(context.inspect().engine,old);assert.equal(context.inspect().menu,null,'removed launch commands cannot switch saves');
context.open('confirmTitle');failSave=true;click('backToTitle');assert.equal(context.inspect().menu,'confirmTitle');assert.equal(context.inspect().started,true);failSave=false;click('backToTitle');assert.equal(context.inspect().menu,'welcome');assert.equal(context.inspect().started,false);assert.equal(context.inspect().engine.s.money,777);
click('restart');click('newGame');assert.equal(context.inspect().engine.s.money,80);assert.equal(context.inspect().started,true);assert.equal(JSON.parse(JSON.parse(storage.get('ember-farm-before-new-v1')).main).money,777);const newText=storage.get(Session.CAMPAIGN_SAVE);click('newGame');assert.equal(storage.get(Session.CAMPAIGN_SAVE),newText);
context.open('rebuild',{tab:'overview'});clean();assert.match(html(),/清理一块农田/);click('gMainAction');assert.equal(context.inspect().rebuildUI.target.region,'farm');assert.equal(context.inspect().menu,null);
// A genuine new-game first loop, with no fixture supplies or unlocks.
let e=context.inspect().engine;e.paused=false;for(const p of [e.s.plots[0],e.s.plots[2]]){assert.ok(e.toolPlot(p,'hoe'));assert.ok(e.toolPlot(p,'seedRadish'));assert.ok(e.toolPlot(p,'water'));}e.advanceMinutes(220);for(const p of [e.s.plots[0],e.s.plots[2]])assert.ok(e.harvest(p));e.events=[];
context.open('rebuild',{tab:'overview'});assert.match(html(),/交付并确认成果/);clean();click('gMainAction');assert.ok(e.r.claimed.includes('harvest'));click('gCraft','trailBread');const firstMeal=e.c.production[0];click('gCraft','trailBread');assert.equal(e.c.production.length,1);e.advanceMinutes(30);click('gCollect',firstMeal.id);click('gMainAction');assert.equal(e.currentRebuildTask().id,'farmer');
click('dEntrance','valley');assert.equal(context.inspect().districtUI.view,'entrance');assert.match(html(),/修复通路/);Object.assign(e.s.player,DistrictData.DISTRICTS.valley.gate);click('dUnlock','valley');assert.ok(e.d.unlocked.valley);click('dDestination','valley');click('dGo','valley');assert.equal(e.s.region,'valley');click('save');
const cycle=storage.get(Session.CAMPAIGN_SAVE);context.open('confirmTitle');click('backToTitle');click('continueCampaign');assert.equal(context.inspect().engine.s.region,'valley');assert.equal(context.inspect().engine.currentRebuildTask().id,'farmer');
// Restore checkpoint through the same archive selection and confirmation controls.
context.open('restoreArchive',{files:{checkpoint:storage.get('ember-farm-before-new-v1')}});assert.ok(context.inspect().menu==='restoreArchive');assert.ok(html().includes('选择这座家园'));click('restoreCandidate','0');assert.equal(context.inspect().menu,'confirmImport');click('applyImport');assert.equal(context.inspect().engine.s.money,777);assert.equal(JSON.parse(JSON.parse(storage.get('ember-farm-before-import-v1')).main).region,'valley');
// Regression panels use explicit test fixtures, never shipped launch buttons.
context.fixture(Rebuild.demoState());e=context.inspect().engine;
for(const p of RebuildData.PILLARS){click('rTab',p.id);clean();context.step(2000);for(const [menu,tab]of p.tools){click('rTool',menu+':'+tab);clean();assert.match(html(),/rebuild-tool-panel/);}}
context.open('frontier',{tab:'water'});click('fWaterControl','gate');assert.equal(e.f.canals.open,true);
click('rTool','frontier:kitchen');e.s.inventory.potato=2;e.s.inventory.bean=1;click('fStartCooking');assert.ok(e.f.cooking);for(let i=0;i<20;i++)context.step(3000+i*50);assert.ok(e.f.cooking.t>0);click('rTab','residents');const t=e.f.cooking.t;context.step(5000);assert.equal(e.f.cooking.t,t);
click('rTab','farm');click('rSeed','seedBean');assert.equal(e.s.seed,'seedBean');assert.equal(context.inspect().menu,null);
context.open('rebuild',{tab:'production'});e.c.projects.market=1;e.s.buildings.push({id:'controller-bench',type:'workbench',x:880,y:760,hp:130,rotation:0});context.open('rebuild',{tab:'production'});document.querySelector('#supply-recipe').value='trailBread';document.querySelector('#supply-target').value='6';click('sPlan');assert.equal(e.u.plans.trailBread.target,6);e.s.inventory.radish=12;click('sDeposit','radish');assert.equal(e.s.storage.radish,12);click('sToggle','trailBread');assert.equal(e.u.plans.trailBread.enabled,false);
context.fixture(Rebuild.eventDemoState());e=context.inspect().engine;context.open('rebuild',{tab:'events'});click('eFilter','all');assert.equal((html().match(/data-action="eSelect"/g)||[]).length,22);clean();click('eAccept','convoy');click('eChoose','convoy:repair');click('ePack','convoy');click('eTravel','convoy');assert.equal(e.s.region,'residential');Object.assign(e.s.player,e.echoLocation('convoy'));context.open('rebuild',{tab:'events',eventId:'convoy'});click('ePerform','convoy');const paid=e.qty('wood');click('ePerform','convoy');assert.equal(e.qty('wood'),paid);click('close');e.advanceMinutes(46);assert.equal(e.eventRecord('convoy').stage,1);click('eTravel','convoy');Object.assign(e.s.player,e.echoLocation('convoy'));context.open('rebuild',{tab:'events'});click('ePerform','convoy');assert.equal(e.eventRecord('convoy').status,'resolved');
for(const panel of ['inventory','craft','build','map','pause','skills','legacyQuests']){context.open(panel);clean();}
context.open('rebuild',{tab:'production'});click('clSelect','section:1');document.querySelector('.detail-scroll').scrollTop=147;click('clSelect','section:2');click('clSelect','section:1');assert.equal(document.querySelector('.detail-scroll').scrollTop,147);click('clBack');assert.ok(!document.querySelector('.manual').className.includes('show-detail'));
click('close');e.events=[];context.step(6000);const world=document.querySelector('#world');let captured;const actualUse=e.use;e.use=p=>{captured=p;return true;};world.events.pointerdown({clientX:683,clientY:356,button:0});const expected=context.inspect().renderer.worldPoint(683,300);assert.ok(Math.abs(captured.x-expected.x)<.001);assert.ok(Math.abs(captured.y-expected.y)<.001);listeners.pointerup();let uses=0;e.use=()=>{uses++;return true};document.querySelector('#touch-use').events.pointerdown({preventDefault(){}});assert.equal(uses,1);listeners.click({target:document.querySelector('#touch-use'),detail:1});assert.equal(uses,1);listeners.pointerup();e.use=actualUse;
context.fixture(Rebuild.districtDemoState());e=context.inspect().engine;
for(const region of Object.keys(DistrictData.DISTRICTS)){click('dRegion',region);for(const p of DistrictData.POINTS.filter(p=>p.region===region)){click('dPoint',p.id);assert.match(html(),new RegExp(p.name));clean();}for(const view of ['entrance','jobs','freight','workers','needs','ledger','storage']){click('dView',view);clean();}}
click('dRegion','valley');Object.assign(e.s.player,DistrictData.POINT_BY_ID.watergate);click('dPreview','watergate:built');click('dExecute','watergate:built');assert.ok(e.flag('watergate','built'));click('dDestination','stationMarket');click('dGo','stationMarket');Object.assign(e.s.player,DistrictData.POINT_BY_ID.shops);click('dPoint','shops');click('dPreview','shops:food');click('dExecute','shops:food');assert.ok(e.flag('shops','food'));click('dView','storage');const bag=e.qty('wood');click('dDeposit','wood');assert.equal(e.qty('wood'),0);click('dWithdraw','wood');assert.ok(e.qty('wood')>=bag);
click('dView','workers');click('dWorker','farmer:stationMarket');assert.equal(e.d.workers.farmer,'stationMarket');click('dWorker','farmer:home');assert.equal(e.d.workers.farmer,undefined);
click('dWorld');assert.match(html(),/atlas-terrain/);clean();assert.doesNotMatch(html(),/data-action="(?:dOpen|bOpen|eMapFilter|dWorldFilter)"/);for(const id of Object.keys(Wayfinding.ATLAS_POINTS)){click('aSelect',id);clean();assert.equal(context.inspect().atlasUI.selected,id);}
for(const region of Object.keys(DistrictData.DISTRICTS)){e.s.region=region;e.assignRegion();Object.assign(e.s.player,{x:770,y:510});for(const [w,h] of [[1366,600],[1920,900],[390,480],[844,240]]){context.inspect().renderer.resize(w,h,1);context.step(9000);}}
assert.deepEqual([...storage].filter(([k])=>k.includes('demo')),historical,'all historical slots preserved byte-for-byte');assert.ok(!Session.isStandalone(JSON.parse(storage.get(Session.CAMPAIGN_SAVE))));
console.log('Player controller passed: title/settings/credits, guarded new game and imports, checkpoint restoration, archived save preservation, real fresh harvest/meal/gate loop, six systems, events, 40 district panels, production/transport/worker controls, pointer offsets, touch duplicate prevention and Canvas rendering. DOM substitute only: real browser CSS, device touch and 200% zoom remain unverified.');

// New border controls run through the actual controller, without shipping a demonstration entry.
context.fixture(Rebuild.districtDemoState());e=context.inspect().engine;
for(const id of Object.keys(BeyondData.BMAPS))e.b.unlocked[id]=true;
e.c.nextHordeDay=99999;e.v.lastOfferDay=99999;e.s.horde.phase='won';
for(const region of Object.keys(BeyondData.BMAPS)){
 e.b.stores[region]={wood:60,bread:15,cloth:30,resin:10,parts:12,circuit:5,filterFabric:10};
 click('bRegion',region);clean();assert.ok(html().includes(BeyondData.BMAPS[region].name));
 for(const p of BeyondData.BPOINTS.filter(p=>p.region===region)){click('bPoint',p.id);clean();assert.ok(html().includes(p.name));}
 for(const view of ['events','jobs','storage','life','ledger']){click('bView',view);clean();}
 e.s.region=region;e.s.enemies[region]=[];e.assignRegion();Object.assign(e.s.player,{x:770,y:510});
 for(const [w,h]of [[1366,600],[1920,900],[390,480],[844,240]]){context.inspect().renderer.resize(w,h,1);context.step(10000);}
}
e.s.region='pinewood';e.s.enemies.pinewood=[];e.assignRegion();Object.assign(e.s.player,BeyondData.BPOINT_BY_ID.pinewood_resin);
click('bPoint','pinewood_resin');click('bAct','pinewood_resin:tap');assert.equal(e.b.jobs.length,1);click('bAct','pinewood_resin:tap');assert.equal(e.b.jobs.length,1);click('close');e.advanceMinutes(45);assert.ok(e.b.stores.pinewood.resin>=12);
Object.assign(e.s.player,{x:220,y:570});context.open('beyond',{region:'pinewood',view:'storage'});click('bWithdraw','resin');assert.ok(e.qty('resin'));click('save');
const newest=storage.get(Session.CAMPAIGN_SAVE);assert.ok(JSON.parse(newest).beyond);assert.ok(Beyond.Engine.parse(newest));
click('bView','events');click('bEvent','stillwind');click('bAccept','stillwind');click('bChoose','stillwind:short');Object.assign(e.s.player,e.beventLocation('stillwind'));click('bPerform','stillwind');assert.ok(e.b.records.stillwind.remaining>0);click('bPause','stillwind');assert.equal(e.b.records.stillwind.status,'paused');click('bAccept','stillwind');assert.equal(e.b.records.stillwind.status,'active');
console.log('Beyond controller passed: five regions,40 point panels,20 event messages, construction costs/double-click, local storage, new save migration and native Canvas at four dimensions. Not a browser CSS/zoom test.');

e.recruit('cartographer');for(const p of RebuildData.PILLARS){click('rTab',p.id);clean();}click('rTool','camp:residents');clean();assert.match(html(),/柏岚/);click('bView','life');clean();click('save');assert.ok(Beyond.Engine.parse(storage.get(Session.CAMPAIGN_SAVE)));
e.s.region='pinewood';e.assignRegion();assert.equal(typeof e.context(e.objects.find(o=>o.type==='beyondPoint')),'string');

// The simplified journal and local facilities use the real controller, with all features retained.
context.fixture(Rebuild.districtDemoState());e=context.inspect().engine;for(const id of Object.keys(BeyondData.BMAPS))e.b.unlocked[id]=true;
for(const l of GuidanceData.LESSONS){click('gFocus',l.id);clean();assert.match(html(),new RegExp(l.title));if(!l.steps(e).every(s=>s.done)){click('gLessonAction',l.id);clean();}click('gJournal');}
click('gMain');assert.equal(e.guidance.focus,null);context.open('map',{selected:'archive'});const beforeMap=e.serialize();click('aSelect','frost');click('aTab','local');clean();assert.ok(document.querySelector('#region-preview').width>0);assert.equal(e.serialize(),beforeMap);
context.fixture(Guidance.freshState());e=context.inspect().engine;context.open('map',{selected:'archive'});click('aGate','archive');assert.equal(e.guidance.target.region,'market');assert.equal(context.inspect().atlasUI.selected,'market');assert.equal(e.s.region,'farm');assert.equal(e.guidance.focus,'gate:archive');click('save');const migrated=Guidance.Engine.parse(storage.get(Session.CAMPAIGN_SAVE));assert.equal(migrated.guidance.focus,'gate:archive');
context.open('build',{focusBuild:'bed',guided:true});assert.equal((html().match(/data-action="build"/g)||[]).length,1);click('gJournal');assert.equal(context.inspect().menu,'journey');
context.fixture(Rebuild.districtDemoState());e=context.inspect().engine;e.s.region='valley';e.assignRegion();Object.assign(e.s.player,DistrictData.POINT_BY_ID.watergate);click('dPoint','watergate');assert.doesNotMatch(html(),/district-workspace/);assert.match(html(),/dQuick/);click('dQuick','watergate:built');const wood=e.districtQty('wood','valley');click('dQuick','watergate:built');assert.equal(e.districtQty('wood','valley'),wood);click('gFocus','d:watergate');assert.match(html(),/这项工作已办妥/);
console.log('Guidance controller passed: all 92 task cards and next actions, all 15 map selections, local map Canvas, nested locked entrance routing, guided build, direct facility work and duplicate protection; formal save and migration preserved. Real browser layout remains unverified.');

context.open('camp');assert.equal(context.inspect().menu,'journey');context.open('frontier');assert.equal(context.inspect().menu,'journey');

click('dWorldResource','herb');assert.equal(context.inspect().menu,'map');assert.ok(DistrictData.DISTRICTS[context.inspect().atlasUI.selected].goods.includes('herb'));

// v0.13.0「联盟来信」: the real controller plays acts one and two through story buttons, the terminal E key and Canvas scenes.
{
  const checkpoint = storage.get('ember-farm-before-alliance-v1');
  assert.ok(checkpoint, 'the old formal save is kept once before the story upgrade');
  assert.equal(JSON.parse(JSON.parse(checkpoint).main).money, 777);
  let clock = 60000;
  const run = (n) => { for (let i = 0; i < n; i++) context.step((clock += 50)); };
  const press = (key) => { listeners.keydown({ key, target: { matches: () => false }, preventDefault() {}, repeat: false }); listeners.keyup({ key }); };
  click('restart'); click('newGame');
  let e = context.inspect().engine;
  assert.equal(e.sc.act, 1); assert.equal(e.sc.veteran, false);
  context.open('journey'); clean();
  for (const line of ['发生了什么', '现在做什么', '完成后获得什么', '楚光来信', '清理一块农田']) assert.ok(html().includes(line), line);
  assert.equal(e.sc.unread, false, 'opening the journal reads the letter');
  click('close'); e.paused = false;
  for (const p of [e.s.plots[0], e.s.plots[2]]) { assert.ok(e.toolPlot(p, 'hoe')); assert.ok(e.toolPlot(p, 'seedRadish')); assert.ok(e.toolPlot(p, 'water')); }
  context.open('journey'); assert.match(html(), /修好水井的辘轳和水槽/); clean();
  click('aStoryMark'); assert.equal(context.inspect().menu, null); assert.equal(e.guidance.target.label, '旧水井');
  Object.assign(e.s.player, { x: 880, y: 330 }); run(2);
  assert.match(document.querySelector('#context').innerHTML, /修好水井辘轳/);
  press('e'); assert.ok(e.sc.flags.well);
  const site = e.campSite(); Object.assign(e.s.player, { x: site.x, y: site.y + 30 });
  context.open('journey'); assert.match(html(), /就地搭起营地/); click('aStoryDo', 'camp'); assert.ok(e.sc.camp);
  const woodAfterCamp = e.qty('wood', true); click('aStoryDo', 'camp'); assert.equal(e.qty('wood', true), woodAfterCamp, 'double click builds once');
  click('close');
  e.advanceMinutes(200); for (const p of [e.s.plots[0], e.s.plots[2]]) assert.ok(e.harvest(p));
  Object.assign(e.s.player, { x: 830, y: 450 }); run(14);
  assert.ok(e.r.claimed.includes('harvest'), 'harvest recorded on the farm without a reward-only click');
  context.open('journey'); assert.match(html(), /用萝卜做出第一份干粮/); assert.match(html(), /准备物资/);
  click('gCraft', 'trailBread'); click('gCraft', 'trailBread'); assert.equal(e.c.production.length, 1);
  e.advanceMinutes(25); click('gCollect', e.c.production[0].id);
  assert.ok(e.r.claimed.includes('meal')); assert.match(html(), /到联盟终端回信/); clean();
  click('close'); Object.assign(e.s.player, { x: 754, y: 374 }); run(2);
  assert.match(document.querySelector('#context').innerHTML, /回信报告/);
  press('e'); run(2);
  assert.equal(e.sc.act, 2); assert.equal(e.sc.helpers.length, 1); assert.equal(context.inspect().menu, 'journey');
  assert.match(html(), /要这一包/); clean();
  click('aStoryChoose', 'cotton'); click('aStoryChoose', 'ration'); assert.equal(e.sc.choice, 'cotton');
  assert.match(html(), /在住宅区救回阿禾/);
  assert.equal(document.querySelector('#quest-number').textContent, '第二段 · 2/4');
  click('close');
  // Canvas: terminal, pulley, trough, camp and the helper at work, at four viewport sizes.
  e.s.minute = 11 * 60; e.c.workClock = 59.99; run(3);
  assert.ok(e.sc.helpers[0].fedDay === e.s.day);
  for (const [w, h] of [[1366, 600], [1920, 900], [390, 480], [844, 240]]) {
    context.inspect().renderer.resize(w, h, 1);
    for (const spot of [{ x: 760, y: 380 }, { x: site.x, y: site.y + 40 }, { x: 600, y: 470 }]) { Object.assign(e.s.player, spot); run(3); }
  }
  // Act two with the real rescue, reward and table systems.
  e.s.region = 'residential'; e.assignRegion(); assert.ok(e.recruit('farmer')); e.r.finds.push('seedArchive');
  e.s.region = 'farm'; e.assignRegion(); Object.assign(e.s.player, { x: 830, y: 450 }); run(12);
  assert.ok(e.r.claimed.includes('farmer'));
  e.c.projects.market = 1;
  e.s.buildings.push({ id: 'ctl-bench', type: 'workbench', x: 1200, y: 760, hp: 130, rotation: 0 }, { id: 'ctl-bed', type: 'bed', x: 1280, y: 880, hp: 90, rotation: 0 });
  e.s.storage.bread = (e.s.storage.bread || 0) + 3; e.s.minute = 11 * 60 + 50; e.c.workClock = 50;
  run(20);
  assert.equal(e.sc.act, 3, 'act two closes once Ahe has eaten and the table is lit');
  e.s.minute = 12 * 60 + 5; e.c.workClock = 59.99; run(3); assert.equal(e.sc.helpers[0].task, 'meal'); run(40);
  Object.assign(e.s.player, { x: 820, y: 420 }); run(6);
  context.open('journey'); clean(); assert.match(html(), /许医生/); assert.match(html(), /联盟来信与前哨记录 · 3封/);
  click('save'); const saved = storage.get(Session.CAMPAIGN_SAVE);
  assert.equal(Alliance.Engine.parse(saved).storyCampaign.act, 3);
  assert.equal(JSON.parse(storage.get('ember-farm-before-alliance-v1')).main, checkpoint && JSON.parse(checkpoint).main, 'checkpoint never overwritten');
  console.log('Alliance controller passed: new save letter, three-line task cards, well/camp/terminal E actions, duplicate clicks, automatic progress records, helper arrival and work, supply choice, act two completion, Canvas at four sizes and save/parse. Real browser layout is checked separately.');
}

// v0.14.0「商路与火光」: upkeep HUD, shipping box, station rush, gate review, caravan, raid with defence overlay, message log and day summary through the real controller.
{
  let clock = 900000;
  const run = (n) => { for (let i = 0; i < n; i++) context.step((clock += 50)); };
  const press = (key) => { listeners.keydown({ key, target: { matches: () => false }, preventDefault() {}, repeat: false }); listeners.keyup({ key }); };
  const OD = await import('../dist/outpost-data.js');
  context.fixture(Outpost.freshState());
  let e = context.inspect().engine;
  e.paused = false;
  const sc = e.sc;
  Object.assign(sc, { act: 3, claimed: ['act1', 'supply', 'act2'], choice: 'ration', letters: ['act1', 'act2', 'act3'], camp: { x: 560, y: 735 } });
  Object.assign(sc.flags, { well: true, camp: true, farmerFed: true });
  e.r.claimed = ['harvest', 'meal', 'farmer', 'table'];
  e.assignRegion();
  run(4);
  assert.match(document.querySelector('#food-days').textContent, /^口粮 [\d.]+ 天$/);
  assert.match(document.querySelector('#food-days').className, /hud-food (ok|warn|danger)/);
  // 任务手记：第三段卡片与前哨状况
  context.open('journey'); clean();
  for (const line of ['第三段「药柜空了」', '在医院救回许医生', '口粮', '联盟援建清单']) assert.ok(html().includes(line), line);
  click('oView', 'bundles'); assert.equal(context.inspect().menu, 'outpost'); clean(); assert.match(html(), /医院急救包/);
  click('close');
  // 出货箱：E 打开，放入，睡一觉结算并弹出日终总结
  Object.assign(e.s.player, { x: OD.SPOTS.shipping.x, y: OD.SPOTS.shipping.y + 20 }); run(2);
  assert.match(document.querySelector('#context').innerHTML, /出货箱/);
  press('e'); run(1); assert.equal(context.inspect().menu, 'outpost'); assert.match(html(), /出货箱/); clean();
  e.s.inventory.radish = 4;
  context.open('outpost', { view: 'shipping' });
  click('oShip', 'radish:all'); assert.equal(e.o.shipBox.radish, 4); click('oShip', 'radish:all'); assert.equal(e.o.shipBox.radish, 4, 'double click ships once');
  const money = e.s.money;
  context.open('home'); click('sleep'); run(2);
  assert.equal(context.inspect().menu, 'outpost'); assert.match(html(), /日终总结|第 \d+ 天结束/); clean();
  assert.ok(e.s.money >= money + 4 * Data.ITEMS.radish.sell);
  click('oClose');
  // 加工站抢工
  e.s.inventory.radish = 3; assert.ok(e.craft('trailBread'));
  const cook = e.s.buildings.find((b) => b.type === 'cook');
  context.open('station', { buildingId: cook.id }); clean(); assert.match(html(), /抢工/);
  e.roll = () => 0.99; click('oRush', e.c.production[0].id); delete e.roll;
  assert.ok(e.o.rushed.includes(e.c.production[0].id)); click('close');
  // 营门审查
  e.o.visitors.current = null; e.o.visitors.next = e.s.day; e.s.minute = 9 * 60 - 0.05; e.c.workClock = 59.95; run(3);
  assert.ok(e.o.visitors.current, 'a visitor arrives at 9:00');
  Object.assign(e.s.player, { x: OD.SPOTS.gate.x, y: OD.SPOTS.gate.y + 20 }); run(2);
  press('e'); run(1); assert.equal(context.inspect().menu, 'outpost'); assert.match(html(), /入营审查|证件/); clean();
  click('oCheck', 'body'); assert.ok(e.o.visitors.current.checked.includes('body'));
  click('oVisitor', 'reject'); assert.equal(e.o.visitors.current, null); assert.equal(context.inspect().menu, null);
  // 消息记录
  press('l'); assert.equal(context.inspect().menu, 'outpost'); assert.match(html(), /前哨记录/); clean(); click('close');
  // 第六段：过路费 → 备战 → 袭击，Z 键防线视图，四种尺寸画面
  Object.assign(sc, { act: 6, claimed: ['act1', 'supply', 'act2', 'act3', 'act4', 'act5'], letters: ['act1', 'act2', 'act3', 'act4', 'act5', 'act6'] });
  e.r.claimed = RebuildData.TASKS.slice(0, RebuildData.TASKS.findIndex((t) => t.id === 'network') + 1).map((t) => t.id);
  Object.assign(e.o, { hospital: 'water', youke: true, lathe: { mode: 'parts', day: 0 }, cargo: 'food', convoy: { departs: 0, arrives: 10, escorted: true, spawned: true, foes: [], done: true, lost: false } });
  e.assignRegion();
  context.open('journey'); clean(); assert.match(html(), /灰隼团要过路费/); assert.match(html(), /class="consequence"/);
  click('aStoryChoose', 'refuse'); assert.equal(e.o.toll, 'refuse');
  click('aStoryChoose', 'towers'); click('close');
  e.s.day = e.o.raid.day; e.s.minute = 1139.98; Object.assign(e.s.player, { x: 1150, y: 620 }); run(3);
  assert.equal(e.o.raid.phase, 'warning');
  assert.match(document.querySelector('#horde-warning').textContent, /灰隼团/);
  press('z'); assert.equal(context.inspect().renderer.defense, true);
  e.o.raid.timer = 0.01; e.invulnerable = 1e6; run(80);
  assert.equal(e.o.raid.phase, 'active'); assert.ok(e.enemies.some((z) => z.type === 'raider'));
  for (const [w, h] of [[1366, 600], [1920, 900], [390, 480], [844, 240]]) { context.inspect().renderer.resize(w, h, 1); run(4); }
  press('z'); assert.equal(context.inspect().renderer.defense, false);
  for (let t = 0; t < 400 && e.o.raid.phase === 'active'; t++) { for (const z of e.enemies.filter((x) => x.type === 'raider' && !x.dead)) e.hurtEnemy(z, 999, 0, { id: 'pistol' }); run(1); e.s.player.hp = 100; }
  assert.equal(e.o.raid.phase, 'won'); assert.equal(context.inspect().menu, 'outpost'); assert.match(html(), /击退灰隼团/); clean();
  click('oClose'); context.open('outpost', { view: 'dialog', id: 'yaozi' }); clean(); click('oPrisoner', 'release');
  assert.equal(e.sc.act, 7); assert.equal(e.o.prisoner, 'released');
  // 饿晕：死亡菜单换成饥饿说明
  e.invulnerable = 0; Object.assign(e.s.player, { hunger: 0, hp: 1.2 }); run(30);
  assert.equal(context.inspect().menu, 'death'); assert.match(html(), /你饿晕了/); click('close');
  click('save'); const saved = storage.get(Session.CAMPAIGN_SAVE);
  const back = Outpost.Engine.parse(saved); assert.equal(back.outpost.raid.phase, 'won'); assert.equal(back.storyCampaign.act, 7);
  console.log('Outpost controller passed: food HUD, act cards with cost/gain/impact previews, shipping box via E and overnight summary, station rush, gate review via E, message log (L), toll/prep through story buttons, raid warning banner, defence overlay (Z), raid at four Canvas sizes, victory report, prisoner choice to act seven, hunger faint menu and save/parse.');
}

// v0.15.0「寒潮之后」: act seven card, decree book, terminal forecast via E, stove warmth, season chip, alert bar, NPC dialog via E, cold Canvas, lit map and camp manual card.
{
  let clock = 1900000;
  const run = (n) => { for (let i = 0; i < n; i++) context.step((clock += 50)); };
  const press = (key) => { listeners.keydown({ key, target: { matches: () => false }, preventDefault() {}, repeat: false }); listeners.keyup({ key }); };
  const WD = await import('../dist/winter-data.js');
  const AD = await import('../dist/alliance-data.js');
  context.fixture(Campaign.freshState());
  const e = context.inspect().engine;
  e.paused = false;
  const sc = e.sc;
  Object.assign(sc, { act: 7, claimed: ['act1', 'supply', 'act2', 'act3', 'act4', 'act5', 'act6'], choice: 'ration', letters: ['act1', 'act2', 'act3', 'act4', 'act5', 'act6', 'act7'], camp: { x: 560, y: 735 } });
  Object.assign(sc.flags, { well: true, camp: true, farmerFed: true });
  e.r.claimed = RebuildData.TASKS.slice(0, RebuildData.TASKS.findIndex((t) => t.id === 'radio') + 1).map((t) => t.id);
  e.r.radio = true;
  Object.assign(e.o, { hospital: 'water', youke: true, lathe: { mode: 'parts', day: 0 }, cargo: 'food', convoy: { departs: 0, arrives: 10, escorted: true, spawned: true, foes: [], done: true, lost: false }, toll: 'refuse' });
  e.o.raid.phase = 'won';
  e.assignRegion();
  Object.assign(e.s.player, { x: 830, y: 460 }); run(4);
  assert.equal(document.querySelector('#season-chip').hidden, true, 'no season chip before the forecast');
  context.open('journey'); clean();
  for (const line of ['第七段「让所有人过冬」', '用电台联系白霜站', '生活水准', '法令簿 0/4']) assert.ok(html().includes(line), line);
  click('wView', 'decrees'); assert.equal(context.inspect().menu, 'outpost'); clean();
  assert.match(html(), /data-action="wDecree" data-id="rotation"/); assert.match(html(), /轮休制/);
  click('wDecree', 'rotation'); assert.equal(e.decree('rotation'), true);
  click('wDecree', 'rotation'); assert.equal(e.decree('rotation'), true, 'the two-day cooldown blocks a double click');
  clean(); assert.match(html(), /生效中/); click('close');
  // 联盟终端 E：呼叫白霜站
  Object.assign(e.s.player, { x: AD.TERMINAL_SPOT.x, y: AD.TERMINAL_SPOT.y + 20 }); run(2);
  assert.match(document.querySelector('#context').innerHTML, /呼叫白霜站/);
  press('e'); run(1); assert.equal(e.w.forecast, true); assert.equal(e.s.storage.seedRye, 6);
  press('e'); run(1); assert.equal(e.s.storage.seedRye, 6, 'a second E gives nothing');
  if (context.inspect().menu) { clean(); click('close'); }
  // 火炉：正常建造流程
  e.s.storage.wood = 60; e.s.storage.stone = 20; e.s.storage.scrap = 20; e.s.storage.bread = 30;
  e.buildMode = 'stove'; let spot = null;
  for (let r = 60; r < 400 && !spot; r += 16) for (let a = 0; a < 6.28 && !spot; a += 0.3) { const x = Math.round((430 + Math.cos(a) * r) / 8) * 8, y = Math.round((520 + Math.sin(a) * r) / 8) * 8; Object.assign(e.s.player, { x: x + 30, y: y + 30 }); if (!e.buildReason('stove', x, y)) spot = { x, y }; }
  run(2);
  assert.ok(e.placeBuilding(spot.x, spot.y)); e.buildMode = null;
  e.s.minute = 9 * 60 - 0.05; e.c.workClock = 59.95; run(3);
  assert.equal(e.w.winter.phase, 'prep'); assert.equal(e.w.ge.phase, 'arrived');
  run(4);
  assert.equal(document.querySelector('#season-chip').hidden, false); assert.match(document.querySelector('#season-chip').textContent, /寒潮 \d+ 天后/);
  // 先保哪样：任务手记里的选择按钮
  context.open('journey'); clean(); assert.match(html(), /寒潮里先保哪一样/); assert.match(html(), /data-action="aStoryChoose" data-id="engineering"/);
  click('aStoryChoose', 'engineering'); assert.equal(e.w.winter.priority, 'engineering'); click('close');
  // 警报栏：熄火的火炉，点一下立路标
  e.w.winter.fuelDay = e.s.day; e.w.winter.lit = false; run(4);
  const bar = document.querySelector('#alert-bar');
  assert.equal(bar.hidden, false); assert.match(bar.innerHTML, /火炉熄了/);
  const index = WinterUI.alertItems(e).findIndex((a) => /火炉熄了/.test(a.text));
  click('wAlert', String(index)); assert.match(e.guidance.target.label, /火炉/);
  e.w.winter.lit = true;
  // 葛队长：E 打开对话
  Object.assign(e.s.player, { x: WD.WSPOTS.ge.x, y: WD.WSPOTS.ge.y + 20 }); run(2);
  assert.match(document.querySelector('#context').innerHTML, /葛队长/);
  press('e'); run(1); assert.equal(context.inspect().menu, 'outpost'); clean(); assert.match(html(), /说服他们留下/); assert.match(html(), /护送回城/);
  click('close');
  // 阿兰
  Object.assign(e.s.player, { x: WD.WSPOTS.alan.x, y: WD.WSPOTS.alan.y + 20 }); run(2);
  press('e'); run(1); clean(); assert.match(html(), /分饲料给羊群/); click('wAlan', 'decline'); assert.equal(e.w.alan.phase, 'declined'); click('close');
  // 寒潮：雪、暖区、需求气泡，四种尺寸
  e.w.winter.phase = 'cold'; e.recruit('farmer'); e.addHelper('tieqiao');
  Object.assign(e.s.player, { x: 1350, y: 900 }); run(2);
  assert.match(document.querySelector('#season-chip').textContent, /寒潮 1\/3 · 冷/);
  press('z');
  for (const [w, h] of [[1366, 600], [1920, 900], [390, 480], [844, 240]]) { context.inspect().renderer.resize(w, h, 1); run(3); }
  press('z');
  context.inspect().renderer.resize(1366, 600, 1);
  // 地图：亮灯的路
  context.open('map'); clean(); assert.match(html(), /亮灯的路/); click('close');
  // 营地手册 · 居民
  context.open('rebuild', { tab: 'residents' }); clean(); assert.match(html(), /前哨法令簿与生活水准/); click('close');
  // 其它新页面
  for (const view of ['radio', 'collection', 'winter', 'museum']) { context.open('outpost', { view }); clean(); }
  click('wProgram', 'songs'); assert.equal(e.w.radio.program, 'songs');
  click('close');
  click('save'); const saved = storage.get(Session.CAMPAIGN_SAVE);
  const back = Campaign.Engine.parse(saved);
  assert.equal(back.winter.forecast, true); assert.equal(back.winter.winter.priority, 'engineering'); assert.deepEqual(back.winter.decrees, ['rotation']);
  console.log('Winter controller passed: act seven card, decree book with cooldown, terminal forecast via E (once), stove placed through the build flow, preparation and season chip, priority choice from the journal, alert bar with gold marker, 葛队长 and 阿兰 dialogs via E, cold Canvas with snow, warm zones and defence overlay at four sizes, lit map, camp manual decree card, radio/collection/winter/museum pages and save/parse.');
}

// v0.16.0「前哨四季」: date button → calendar with intro card, 新 dot on the handbook, plaza festival via E, 何大勺 via E in the market, canteen serving, campfire talk, people/gifts/apprentice, E chooser, item links, Canvas at four sizes and save/parse.
{
  let clock = 2900000;
  const run = (n) => { for (let i = 0; i < n; i++) context.step((clock += 50)); };
  const press = (key) => { listeners.keydown({ key, target: { matches: () => false }, preventDefault() {}, repeat: false }); listeners.keyup({ key }); };
  const SD = await import('../dist/seasons-data.js');
  context.fixture(Campaign.freshState());
  const e = context.inspect().engine;
  e.paused = false;
  const sc = e.sc;
  Object.assign(sc, { act: 5, claimed: ['act1', 'supply', 'act2', 'act3', 'act4'], choice: 'ration', letters: ['act1', 'act2', 'act3', 'act4', 'act5'], camp: { x: 560, y: 735 } });
  Object.assign(sc.flags, { well: true, camp: true, farmerFed: true });
  e.r.claimed = RebuildData.TASKS.slice(0, RebuildData.TASKS.findIndex((t) => t.id === 'warehouse') + 1).map((t) => t.id);
  Object.assign(e.o, { hospital: 'water', youke: true, lathe: { mode: 'parts', day: 0 } });
  e.recruit('farmer'); e.recruit('medic'); e.addHelper('tieqiao');
  e.s.storage.bread = 30;
  e.assignRegion();
  Object.assign(e.s.player, { x: 830, y: 460 }); run(4);
  assert.match(document.querySelector('.handbook-entry').className, /has-new/, 'new features mark the handbook');
  assert.equal(document.querySelector('#date').dataset.action, 'sView');
  click('sView', 'calendar'); assert.equal(context.inspect().menu, 'outpost'); clean();
  assert.match(html(), /intro-card/); assert.match(html(), /第7天/); assert.match(html(), /换种集/);
  click('close');
  // 节庆：E 打开广场，主持换种集
  e.s.day = 7; e.s.minute = 16 * 60 + 5; e.c.workClock = 5;
  e.s.storage.seedRadish = 6; e.s.storage.seedPotato = 4; e.s.storage.seedBean = 4;
  Object.assign(e.s.player, { x: SD.SSPOTS.plaza.x, y: SD.SSPOTS.plaza.y + 20 }); run(2);
  assert.match(document.querySelector('#context').innerHTML, /主持「换种集」/);
  press('e'); run(1); assert.equal(context.inspect().menu, 'outpost'); clean();
  assert.match(html(), /data-action="sHost"/); assert.match(html(), /老琴/);
  click('sHost'); assert.ok(e.festivalHosted(7)); assert.ok(e.ss.decor.includes('banner'));
  click('sHost'); assert.equal(e.ss.fest.held.length, 1, 'a double click hosts once');
  click('sSong'); assert.equal(e.ss.laoqin.quest, true);
  clean(); click('close');
  // 集市里的何大勺：E 对话、复原三道菜
  e.s.region = 'market'; e.enemies = e.s.enemies.market ||= []; e.assignRegion();
  Object.assign(e.s.player, { x: SD.SSPOTS.he.x, y: SD.SSPOTS.he.y + 20 }); run(2);
  press('e'); run(1); assert.equal(context.inspect().menu, 'outpost'); clean(); assert.match(html(), /何大勺/); assert.equal(e.ss.he.stage, 1);
  for (const d of SD.HE_DISHES) { e.s.storage[d] = 1; context.open('outpost', { view: 'dialog', id: 'he' }); click('sHe', 'deliver'); }
  assert.equal(e.ss.he.stage, 4); clean(); click('close');
  e.s.region = 'farm'; e.enemies = e.s.enemies.farm ||= []; e.assignRegion();
  // 食堂营业夜
  e.s.day = 9; e.s.minute = 19 * 60 + 2; e.s.storage.stew = 4; e.s.storage.jam = 2; e.s.storage.fishStew = 2; e.s.storage.chefMeal = 2;
  Object.assign(e.s.player, { x: SD.SSPOTS.plaza.x, y: SD.SSPOTS.plaza.y + 20 }); run(2);
  press('e'); run(1); clean(); click('sCanteen'); assert.ok(e.ss.canteen.night);
  clean(); assert.match(html(), /想吃/);
  const g = e.ss.canteen.night.customers[0], dish = SD.TASTES[g.taste].dishes.find((d) => e.quantityForCost(d, true));
  const money = e.s.money; click('sServe', g.id + ':' + dish); assert.ok(e.s.money > money); assert.equal(g.state, 'served');
  click('close');
  for (const [w, h] of [[1366, 600], [1920, 900], [390, 480], [844, 240]]) { context.inspect().renderer.resize(w, h, 1); run(3); }
  context.inspect().renderer.resize(1366, 600, 1);
  // 营火夜谈
  e.s.minute = 19 * 60 + 40; const fire = e.fireSpot();
  Object.assign(e.s.player, { x: fire.x, y: fire.y + 20 }); run(2);
  context.open('outpost', { view: 'talk' }); clean(); assert.match(html(), /说说以前/);
  click('sTalk', 'past'); assert.ok((e.ss.trust.farmer || 0) >= 1); assert.equal(context.inspect().menu, null);
  // 人物关系：送礼、带徒
  e.s.storage.jam = 2; click('sView', 'people'); clean(); assert.match(html(), /人物关系|喜欢/);
  click('sGift', 'farmer:jam'); assert.ok(e.ss.trust.farmer >= 2);
  click('sApprentice', 'farmer:tieqiao'); assert.equal(e.ss.apprentice?.pupil, 'tieqiao'); clean(); click('close');
  // 同处多对象选择
  e.ss.lodger = { name: '赶路的木匠老韩', look: 1, gift: 'item', stay: false, phase: 'staying', day: e.s.day, qin: false }; e.ss.qin.phase = 'left';
  e.assignRegion();
  for (const h of e.sc.helpers) Object.assign(h, { x: 300, y: 900, target: { x: 300, y: 900 } });
  for (const r of e.c.residents) Object.assign(r, { x: 330, y: 380, target: { x: 330, y: 380 } });
  e.assignRegion();
  const lod = e.objects.find((o) => o.type === 'seasonLodger'); Object.assign(lod, { x: SD.SSPOTS.jiang.x + 40, y: SD.SSPOTS.jiang.y });
  Object.assign(e.s.player, { x: SD.SSPOTS.jiang.x + 20, y: SD.SSPOTS.jiang.y + 10 }); run(6);
  assert.match(document.querySelector('#context').innerHTML, /选择：/);
  press('e'); run(1); assert.equal(context.inspect().menu, 'outpost'); clean(); assert.match(html(), /data-hotkey="1"/);
  const pickIndex = e._pickList.findIndex((o) => o.type === 'seasonJiang');
  click('sPick', String(pickIndex)); assert.equal(e.ss.jiang.phase, 'c1');
  if (context.inspect().menu) { clean(); click('close'); }
  // 物品来源与用途
  e.s.inventory.potato = 2; context.open('inventory'); click('item', 'potato'); clean(); assert.match(html(), /能做：/); assert.match(html(), /种土豆种子/); click('close');
  // 建造预览：相邻加成连线与提示
  e.buildMode = 'canner'; Object.assign(e.s.player, { x: 1010, y: 560 }); run(3); e.buildMode = null;
  click('save'); const saved = storage.get(Session.CAMPAIGN_SAVE);
  const back = Campaign.Engine.parse(saved);
  assert.equal(back.seasons.he.stage, 4); assert.ok(back.seasons.fest.held.includes(7)); assert.equal(back.seasons.apprentice.pupil, 'tieqiao');
  console.log('Seasons controller passed: date button to calendar with intro card, 新 dot on the handbook, plaza festival via E with double-click guard, 老琴 request, 何大勺 via E in the market and three dishes, canteen opening and serving, campfire talk, gifts and apprenticeship, E chooser with real action, item source/use links, plaza/canteen Canvas at four sizes, build preview and save/parse.');
}
// v0.17.0「远方来客」: phone menu, night choice via E with amends in the journal, today's hazard via E, 麦穗 page, 彭姐 via E, 贺满仓 audit and an advanced build, settings (accessibility, key remap through real key presses), fog Canvas at four sizes and save/parse.
{
  let clock = 3900000;
  const run = (n) => { for (let i = 0; i < n; i++) context.step((clock += 50)); };
  const press = (key) => { listeners.keydown({ key, target: { matches: () => false }, preventDefault() {}, repeat: false }); listeners.keyup({ key }); };
  const FD = await import('../dist/farlands-data.js');
  context.fixture(Campaign.freshState());
  const e = context.inspect().engine;
  e.paused = false;
  const sc = e.sc;
  Object.assign(sc, { act: 9, claimed: ['act1', 'supply', 'act2', 'act3', 'act4', 'act5', 'act6', 'act7', 'act8'], choice: 'ration', letters: ['act1', 'act2', 'act3', 'act4', 'act5', 'act6', 'act7', 'act8'], camp: { x: 560, y: 735 } });
  Object.assign(sc.flags, { well: true, camp: true, farmerFed: true });
  e.r.claimed = RebuildData.TASKS.slice(0, RebuildData.TASKS.findIndex((t) => t.id === 'broadcast') + 1).map((t) => t.id);
  Object.assign(e.o, { hospital: 'water', youke: true, lathe: { mode: 'parts', day: 0 }, toll: 'refuse' });
  e.o.raid.phase = 'won'; e.r.radio = true;
  e.f.dog.rescued = true;
  e.s.storage.bread = 30;
  const toHour = (h) => { e.s.minute = h * 60 - 0.5; e.c.workClock = 59.5; e.advanceMinutes(1); };
  const goRegion = (id) => { e.s.region = id; e.enemies = e.s.enemies[id] ||= []; e.assignRegion(); };
  e.s.day = 3; while (e.nightFor(e.s.day).kind !== 'ruin') e.s.day++; goRegion('farm');
  Object.assign(e.s.player, { x: 830, y: 460 }); run(3);
  // 手机式快捷菜单
  assert.equal(document.querySelector('.hud-phone').dataset.action, 'xView');
  click('xView', 'phone'); assert.equal(context.inspect().menu, 'outpost'); clean();
  assert.match(html(), /data-menu="inventory"/); assert.match(html(), /麦穗/); click('close');
  // 夜里的抉择：19:00 → 走到废墟 → E → 选择 → 任务手记里补救
  toHour(19); const n = e.fr.night; assert.equal(n.kind, 'ruin');
  goRegion(n.region); const spot = FD.NIGHT_SPOTS[n.region];
  Object.assign(e.s.player, { x: spot.x, y: spot.y + 20 }); run(3);
  assert.match(document.querySelector('#context').innerHTML, /做个决定/);
  press('e'); run(1); assert.equal(context.inspect().menu, 'outpost'); clean(); assert.match(html(), /就这么办/);
  click('xNight', 'take'); assert.equal(context.inspect().menu, null); assert.ok(e.fr.night.done);
  click('xNight', 'leave'); assert.equal(e.fr.nightLog.length, 1, 'a second click does not decide twice');
  context.open('journey'); clean(); assert.match(html(), /补救/); assert.match(html(), /明天的险地|今日险地/);
  e.s.storage.bread = 30; e.s.storage.cloth = 4;
  click('xAmends', e.fr.amends[0].id); assert.equal(e.fr.amends.length, 0); click('close');
  // 今日险地：E 打开补给
  e.s.minute = 23 * 60; e.c.workClock = 0; e.s.minute = 1440 - 0.5; e.advanceMinutes(1);
  const h = e.hazardToday(); assert.ok(h);
  goRegion('farm'); e.travel(h.region) || goRegion(h.region);
  for (const z of e.enemies) if (z.hazard) z.dead = true;
  const hs = FD.HAZARD_SPOTS[h.region]; Object.assign(e.s.player, { x: hs.x, y: hs.y + 20 }); run(3);
  if (h.kind === 'ashore') e.s.minute = 10 * 60;
  press('e'); run(1); assert.ok(e.fr.hazard.opened, 'hazard supply opened by E');
  for (const [w, hh] of [[1366, 600], [1920, 900], [390, 480], [844, 240]]) { context.inspect().renderer.resize(w, hh, 1); run(3); }
  context.inspect().renderer.resize(1366, 600, 1);
  goRegion('farm'); Object.assign(e.s.player, { x: 830, y: 460 });
  // 麦穗
  click('xView', 'dog'); clean(); assert.match(html(), /默契/); click('xDog', 'feed'); assert.equal(e.fr.dog.bond >= 1, true); click('xDog', 'feed'); assert.equal(e.fr.dog.fedDay, e.s.day); click('close');
  // 彭姐：08:00 来借粮，E 打开对话
  toHour(8); assert.equal(e.fr.peng.phase, 'asking'); goRegion('farm');
  Object.assign(e.s.player, { x: FD.FSPOTS.peng.x, y: FD.FSPOTS.peng.y + 20 }); run(3);
  press('e'); run(1); assert.equal(context.inspect().menu, 'outpost'); clean(); assert.match(html(), /彭姐/);
  click('xPeng', 'lend'); assert.equal(e.fr.peng.phase, 'waiting'); assert.equal(context.inspect().menu, null);
  // 贺满仓：核账、垫付、建造
  e.o.ledger = [1, 2, 3].map((d) => ({ day: d, income: 10, items: { radish: 1 } })); e.o.bundles = ['clinic', 'caravan'];
  Object.assign(e.s.player, { x: FD.FSPOTS.hemc.x, y: FD.FSPOTS.hemc.y + 20 }); run(3);
  press('e'); run(1); clean(); assert.match(html(), /贺满仓/); assert.equal(e.fr.hemc.phase, 'open'); click('close');
  const [type, def] = Object.entries(Data.BUILDINGS).find(([id, b]) => !b.tech && id !== 'field' && Object.values(b.cost).some((v) => v >= 3));
  for (const k of Object.keys(def.cost)) { delete e.s.storage[k]; delete e.s.inventory[k]; }
  context.open('build'); clean(); assert.match(html(), /贺满仓垫付/);
  click('xAdvance', type); assert.equal(e.buildMode, type); assert.equal(context.inspect().menu, null);
  let placed = false;
  for (let r = 60; r < 600 && !placed; r += 16) for (let a = 0; a < 6.28 && !placed; a += 0.3) { const x = Math.round((760 + Math.cos(a) * r) / 8) * 8, y = Math.round((620 + Math.sin(a) * r) / 8) * 8; Object.assign(e.s.player, { x: x + 30, y: y + 30 }); if (!e.buildReason(type, x, y)) placed = e.placeBuilding(x, y); }
  assert.ok(placed); assert.ok(e.fr.hemc.debt);
  context.open('journey'); clean(); assert.match(html(), /还这一期/); click('close');
  // 设置：无障碍、改键（真按键）
  context.open('pause'); clean(); assert.match(html(), /无障碍/); assert.match(html(), /键位/); assert.match(html(), /手柄/);
  click('xAccess', 'text'); assert.match(document.body.className, /a11y-text/); assert.equal(JSON.parse(storage.get(Session.PREFERENCES)).access.text, true);
  click('xAccess', 'text'); assert.doesNotMatch(document.body.className, /a11y-text/);
  click('xKey', 'interact'); assert.match(html(), /按下新键/);
  press('x'); assert.equal(JSON.parse(storage.get(Session.PREFERENCES)).keymap.interact, 'x');
  click('close'); e.paused = false;
  Object.assign(e.s.player, { x: FD.FSPOTS.hemc.x, y: FD.FSPOTS.hemc.y + 20 }); run(3);
  assert.match(document.querySelector('#context').innerHTML, /<kbd>X<\/kbd>/);
  press('e'); run(1); assert.equal(context.inspect().menu, null, 'the old key no longer interacts');
  press('x'); run(1); assert.equal(context.inspect().menu, 'outpost', 'the new key interacts'); click('close');
  context.open('pause'); click('xKeyReset'); assert.deepEqual(JSON.parse(storage.get(Session.PREFERENCES)).keymap, {});
  click('xKey', 'reload'); click('close'); press('w'); assert.deepEqual(e.s.settings.keymap, {}, 'closing the menu cancels a pending remap');
  click('save'); const back = Campaign.Engine.parse(storage.get(Session.CAMPAIGN_SAVE));
  assert.ok(back.far.hemc.debt); assert.equal(back.far.peng.phase, 'waiting'); assert.equal(back.far.nightLog.length, 1);
  // 标题画面的设置里，无障碍开关同样生效
  context.open('confirmTitle'); click('backToTitle'); assert.equal(context.inspect().started, false);
  context.open('pause'); click('xAccess', 'calm'); assert.match(document.body.className, /a11y-calm/); click('xAccess', 'calm'); assert.doesNotMatch(document.body.className, /a11y-calm/); click('close');
  console.log('Farlands controller passed: phone menu, night choice via E with one decision and amends paid from the journal, hazard supply via E, 麦穗 feeding, 彭姐 via E, 贺满仓 audit and an advanced build placed and owed, accessibility toggles saved to preferences, key remap by real key presses (old key freed, prompt updated), reset, pending remap cancelled by closing, title-screen accessibility, Canvas at four sizes and save/parse.');
}
// v0.18.0「每日抉择」: the morning card pops up by itself from day two, cannot be closed, number keys pick, the result starts the day, sleep → summary → card, journal strip and record page, today's supply point and a chain marker via E, HUD chip and save/parse.
{
  let clock = 4500000;
  const run = (n) => { for (let i = 0; i < n; i++) context.step((clock += 50)); };
  const press = (key) => { listeners.keydown({ key, target: { matches: () => false }, preventDefault() {}, repeat: false }); listeners.keyup({ key }); };
  const DD = await import('../dist/daily-data.js');
  const DJ = await import('../dist/daily.js');
  dailyOn = true;
  context.fixture(Campaign.freshState());
  let e = context.inspect().engine;
  e.paused = false;
  const nextDay = () => { e.s.minute = 1440 - 0.5; e.c.workClock = 0; e.advanceMinutes(1); };
  const goRegion = (id) => { e.s.region = id; e.enemies = e.s.enemies[id] ||= []; e.assignRegion(); };
  // 第一天没有卡
  e.s.minute = 9 * 60; run(3); assert.equal(context.inspect().menu, null); assert.equal(e.dailyCard(), null);
  // 零点抽好第 2 天的卡，06:00 前不弹
  nextDay(); assert.equal(e.s.day, 2);
  const p = e.dailyCard(); assert.ok(p); assert.ok(DD.EVENTS[p.id].newbie, 'days 2–5 draw newbie events');
  run(3); assert.equal(context.inspect().menu, null, 'no card before 06:00');
  e.s.minute = 360; run(2);
  assert.equal(context.inspect().menu, 'outpost', 'the card pops up by itself at 06:00'); clean();
  assert.match(html(), /class="daily-card/); assert.match(html(), /data-hotkey="1"/); assert.match(html(), /data-hotkey="3"/);
  assert.equal((html().match(/data-action="dPick"/g) || []).length, 3);
  // 卡开着时关不掉：Esc、关闭按钮都不行
  press('Escape'); assert.equal(context.inspect().menu, 'outpost', 'Esc does not close the card');
  click('close'); assert.equal(context.inspect().menu, 'outpost', 'close does not close the card');
  // 数字键选择
  const free = [0, 1, 2].find((i) => !e.optionReason(i));
  assert.notEqual(free, undefined, 'every card has an option you can take');
  const money0 = e.s.money;
  press(String(free + 1));
  assert.equal(e.dy.pending.choice, free); assert.equal(e.dy.stats.cards, 1); clean();
  assert.match(html(), /class="daily-result/); assert.match(html(), /开始第 2 天/);
  press(String(free + 1)); press('1');
  assert.equal(context.inspect().menu, null, 'the result button starts the day'); assert.equal(e.dy.stats.cards, 1, 'one choice a day');
  run(5); assert.equal(context.inspect().menu, null, 'the card does not come back the same day');
  // 任务手记的今日抉择条 → 抉择记录
  context.open('journey'); clean(); assert.match(html(), /class="daily-strip"/); assert.match(html(), /今日抉择/);
  click('dView', 'dlog'); clean(); assert.match(html(), /已经做过 1 次抉择/); assert.match(html(), /种子换口粮|连贯事件/); click('close');
  assert.equal(context.inspect().menu, null);
  // 睡一觉：先出日终总结，关掉后卡片弹出
  goRegion('farm'); e.s.player.hunger = 80; e.s.storage.bread = 20;
  context.open('home'); click('sleep'); run(2);
  assert.equal(context.inspect().menu, 'outpost'); assert.match(html(), /日终总结|第 \d+ 天结束/);
  assert.equal(e.s.day, 3); assert.ok(e.dailyCard(), 'a fresh card for day three');
  click('oClose'); run(2);
  assert.equal(context.inspect().menu, 'outpost', 'after the summary the card shows'); clean(); assert.match(html(), /class="daily-card/);
  // 买不起的选项点了没反应，只提示原因
  const blocked = [0, 1, 2].find((i) => e.optionReason(i));
  if (blocked !== undefined) { const before = JSON.stringify(e.s.storage) + e.s.money; click('dPick', String(blocked)); assert.equal(e.dy.pending.choice, null); assert.equal(JSON.stringify(e.s.storage) + e.s.money, before); }
  click('dPick', String([0, 1, 2].find((i) => !e.optionReason(i)))); click('dStart'); assert.equal(context.inspect().menu, null);
  // 第 6 天以后：补给点（S02）与连贯事件标记（C4-2），都用 E 互动
  const sc = e.sc;
  Object.assign(sc, { act: 9, claimed: ['act1', 'supply', 'act2', 'act3', 'act4', 'act5', 'act6', 'act7', 'act8'], choice: 'ration', letters: ['act1', 'act2', 'act3', 'act4', 'act5', 'act6', 'act7', 'act8'], camp: { x: 560, y: 735 } });
  Object.assign(sc.flags, { well: true, camp: true, farmerFed: true });
  e.r.claimed = RebuildData.TASKS.slice(0, RebuildData.TASKS.findIndex((t) => t.id === 'broadcast') + 1).map((t) => t.id);
  Object.assign(e.o, { hospital: 'water', youke: true, lathe: { mode: 'parts', day: 0 }, toll: 'refuse' });
  e.o.raid.phase = 'won'; e.r.radio = true;
  e.s.day = 20; e.s.minute = 7 * 60; e.assignRegion();
  e.dy.pending = { day: 20, id: 'S02', rolls: [0.5, 0.5, 0.5], tier: e.tier(), luck: false, choice: null, win: null, lines: [] };
  run(2); assert.equal(context.inspect().menu, 'outpost'); clean(); assert.match(html(), /奖励 ×2/);
  click('dPick', '0'); clean(); assert.match(html(), /补给/); click('dStart');
  const cache = e.dy.caches[0]; assert.ok(cache);
  e.travel(cache.region) || goRegion(cache.region);
  for (const z of e.enemies) z.dead = true;
  const ob = e.objects.find((o) => o.type === 'dailyCache'); assert.ok(ob);
  Object.assign(e.s.player, { x: ob.x, y: ob.y + 20 }); run(3);
  assert.match(document.querySelector('#context').innerHTML, /今日补给|补给/);
  const ammo = e.qty('ammo', true);
  press('e'); run(1); assert.equal(e.qty('ammo', true), ammo + e.scaleN(6, 2), 'the supply point opens once by E');
  press('e'); run(1); assert.equal(e.qty('ammo', true), ammo + e.scaleN(6, 2));
  assert.ok(!e.objects.some((o) => o.type === 'dailyCache'));
  // 连贯事件：标记点
  goRegion('farm'); e.s.day = 21; e.s.minute = 7 * 60;
  e.dy.chains.C4 = { step: 'C4-2', due: 21, flags: [], mark: null, start: 20 }; delete e.dy.done.C4;
  e.dy.pending = { day: 21, id: 'C4-2', rolls: [0.5, 0.5, 0.5], tier: e.tier(), luck: false, choice: null, win: null, lines: [] };
  run(2); assert.equal(context.inspect().menu, 'outpost'); clean(); assert.match(html(), /第 2\/\d 步/);
  click('dPick', '1'); clean(); assert.match(html(), /标记点/); click('dStart');
  assert.ok(e.dy.chains.C4.mark);
  context.open('journey'); clean(); assert.match(html(), /data-action="dMark"/);
  click('dMark', 'C4'); assert.equal(context.inspect().menu, 'map', 'the marker opens the map when it is elsewhere'); click('close');
  e.travel('warehouse') || goRegion('warehouse');
  for (const z of e.enemies) z.dead = true;
  const mk = e.objects.find((o) => o.type === 'dailyMark'); assert.ok(mk);
  Object.assign(e.s.player, { x: mk.x, y: mk.y + 20 }); run(3);
  press('e'); run(1); assert.equal(e.dy.chains.C4.due, 22); assert.ok(!e.objects.some((o) => o.type === 'dailyMark'));
  // 顶栏的增益标签
  e.dy.buffs.push({ kind: 'growth', value: 0.3, from: 21, until: 22, src: 'test' }); run(4);
  assert.equal(document.querySelector('#daily-chip').hidden, false); assert.match(document.querySelector('#daily-chip').textContent, /✦ 1/);
  for (const [w, hh] of [[1366, 600], [1920, 900], [390, 480], [844, 240]]) { context.inspect().renderer.resize(w, hh, 1); run(3); }
  context.inspect().renderer.resize(1366, 600, 1);
  click('save'); const back = Campaign.Engine.parse(storage.get(Session.CAMPAIGN_SAVE));
  assert.ok(back.daily.chains.C4); assert.equal(back.daily.chains.C4.due, 22); assert.equal(back.daily.stats.cards, 4);
  assert.ok(back.daily.history.length >= 4);
  dailyOn = false;
  console.log('Daily controller passed: no card on day one, the day-two card pops up by itself at 06:00, Esc and close cannot dismiss it, number keys pick and the result starts the day once, journal strip and record page, sleep → summary → card, refused options change nothing, ×2 rewards in late acts, today\'s supply point and a chain marker via E (once each), marker routing on the map, HUD buff chip, Canvas at four sizes and save/parse.');
}
// v0.19.0「妙手」: skills page (K) learns a talent, crouch (V) behind a person shows 下手 in the context bar, E opens the preview, 1 starts, number keys pick, space takes, Esc stops, a failed first gate locks the caught card until a choice, journal strip → thief book, the dummy via E, Canvas marks at four sizes and save/parse.
{
  let clock = 9000000;
  const run = (n) => { for (let i = 0; i < n; i++) context.step((clock += 50)); };
  const press = (key) => { listeners.keydown({ key, target: { matches: () => false }, preventDefault() {}, repeat: false }); listeners.keyup({ key }); };
  dailyOn = false;
  context.fixture(Campaign.freshState());
  const e = context.inspect().engine;
  e.paused = false;
  const goRegion = (id) => { e.s.region = id; e.enemies = e.s.enemies[id] ||= []; e.assignRegion(); };
  const sc = e.sc;
  Object.assign(sc, { act: 9, claimed: ['act1', 'supply', 'act2', 'act3', 'act4', 'act5', 'act6', 'act7', 'act8'], choice: 'ration', letters: ['act1', 'act2', 'act3', 'act4', 'act5', 'act6', 'act7', 'act8'], camp: { x: 560, y: 735 } });
  Object.assign(sc.flags, { well: true, camp: true, farmerFed: true });
  e.r.claimed = RebuildData.TASKS.slice(0, RebuildData.TASKS.findIndex((t) => t.id === 'broadcast') + 1).map((t) => t.id);
  Object.assign(e.o, { hospital: 'water', youke: true, lathe: { mode: 'parts', day: 0 }, toll: 'refuse' });
  e.o.raid.phase = 'won'; e.r.radio = true;
  for (const id of ['farmer', 'medic', 'mechanic']) if (!e.resident(id)) e.recruit(id);
  e.s.day = 12; e.s.minute = 10 * 60; e.dy.pending = null;
  e.s.xp.agriculture = 160; e.s.xp.combat = 160;
  goRegion('farm'); run(2);
  // K → 技能页，点“学会”
  press('k'); assert.equal(context.inspect().menu, 'skills'); clean();
  assert.match(html(), /class="tree-grid"/); assert.match(html(), /可用技能点 \d+/);
  click('kLearn', 'pickpocket'); assert.ok(e.hasTalent('pickpocket')); clean(); assert.match(html(), /顺手牵羊/);
  click('kLearn', 'nightOwl'); assert.ok(!e.hasTalent('nightOwl'), 'a locked talent stays locked');
  click('close'); assert.equal(context.inspect().menu, null);
  // V 蹲下，站到阿禾背后：提示栏写着“下手”
  const who = (id) => e.objects.find((o) => o.type === 'resident' && o.resident === id);
  const behind = (ob) => Object.assign(e.s.player, { x: ob.x + 4, y: ob.y - 46 });
  press('v'); assert.equal(e.f.crouch, true);
  let ob = who('farmer'); assert.ok(ob); behind(ob); run(2); ob = who('farmer'); behind(ob); run(1);
  assert.match(document.querySelector('#context').innerHTML, /下手 · /);
  // E → 下手之前
  behind(who('farmer')); press('e'); run(1);
  assert.equal(context.inspect().menu, 'outpost'); clean();
  assert.match(html(), /没被察觉的机会/); assert.match(html(), /data-action="kGo"/);
  const tid = e.targetNear().id;
  for (let s = 1; s < 20000; s++) { e.th.seed = s; if (e.stealRoll(tid) < 0.05) break; }
  // 1 = 下手
  press('1'); run(1); clean();
  assert.ok(e.steal && e.steal.phase === 'pick'); assert.match(html(), /id="st-attn"/);
  const tries = e.th.stats.tries;
  // 数字键选口袋，空格在安全区里抽
  press('1'); assert.equal(e.steal.phase, 'swing');
  for (let i = 0; i < 200 && e.steal.phase === 'swing'; i++) {
    const st = e.steal;
    if (st.marker > st.zone.a + 0.02 && st.marker < st.zone.a + st.zone.w - 0.02) { press(' '); break; }
    run(1);
  }
  assert.ok(['pick', 'done', 'caught'].includes(e.steal.phase));
  const gotFirst = e.steal.slots[0].done; assert.ok(gotFirst, 'space inside the zone takes the item');
  // Esc = 收手，结果页；再按 Esc 关掉
  if (['pick', 'swing'].includes(e.steal.phase)) { press('Escape'); assert.equal(e.steal.phase, 'done'); clean(); assert.match(html(), /得手了|收手/); }
  if (e.steal.phase === 'done') { press('Escape'); assert.equal(context.inspect().menu, null); assert.equal(e.steal, null); }
  else { click('kFace'); click('kCaught', '0'); click('kOk'); }
  assert.equal(e.th.stats.tries, tries); if (gotFirst) { assert.equal(e.th.stats.wins, 1); assert.ok(e.th.taken[tid].ids.length >= 1, 'the pocket is empty for the rest of the week'); }
  // 第二次：对许医生，第一道运气没过 → 当场被抓，卡片锁住
  const med = who('medic'); assert.ok(med); behind(med); run(1); behind(who('medic'));
  for (let s = 1; s < 20000; s++) { e.th.seed = s; if (e.stealRoll('medic') > 0.97) break; }
  e.f.crouch = true; behind(who('medic')); press('e'); run(1);
  assert.equal(context.inspect().menu, 'outpost'); assert.equal(e.targetNear()?.id, 'medic');
  const money = e.s.money;
  click('kGo', 'medic'); clean();
  assert.ok(e.th.pending, 'caught on the first gate'); assert.match(html(), /被发现了/);
  // 底栏“返回营地手册”也绕不过去：被抓后点它，回到要了结的卡
  const footer = () => listeners.click({ target: { closest: () => ({ dataset: { menu: 'rebuild' } }) } });
  footer(); assert.equal(context.inspect().menu, 'outpost', 'the footer cannot skip the caught card'); assert.ok(e.th.pending);
  if (!/caught-card/.test(html())) press('1');
  clean(); assert.match(html(), /caught-card locked/);
  footer(); assert.equal(context.inspect().menu, 'outpost');
  press('Escape'); assert.equal(context.inspect().menu, 'outpost', 'Esc cannot dismiss the caught card');
  click('close'); assert.equal(context.inspect().menu, 'outpost', 'close cannot dismiss it either');
  e.s.money = Math.max(e.s.money, 40);
  const m1 = e.s.money;
  press('1'); assert.equal(e.th.pending, null); assert.equal(e.s.money, m1 - 20, 'apologising costs 20 gold'); clean();
  press('1'); assert.equal(context.inspect().menu, null);
  assert.ok(money >= 0);
  // 任务手记的“妙手”条 → 妙手手记
  context.open('journey'); clean(); assert.match(html(), /class="thief-strip"/);
  click('kView', 'thief'); clean(); assert.match(html(), /妙手手记|宝贝/); click('close');
  // 稻草人：站着按 E 练手
  e.f.crouch = false;
  const dummy = e.objects.find((o) => o.type === 'thiefDummy'); assert.ok(dummy);
  Object.assign(e.s.player, { x: dummy.x, y: dummy.y + 24 }); run(2);
  assert.match(document.querySelector('#context').innerHTML, /稻草人/);
  Object.assign(e.s.player, { x: dummy.x, y: dummy.y + 24 }); press('e'); run(1);
  assert.equal(context.inspect().menu, 'outpost'); assert.ok(e.steal?.practice); clean();
  press('Escape'); press('Escape'); assert.equal(context.inspect().menu, null);
  // 蹲着时 Canvas 画出眼睛
  e.f.crouch = true; behind(who('farmer'));
  for (const [w, hh] of [[1366, 600], [1920, 900], [390, 480], [844, 240]]) { context.inspect().renderer.resize(w, hh, 1); run(3); }
  context.inspect().renderer.resize(1366, 600, 1);
  e.f.crouch = false;
  click('save'); const back = Campaign.Engine.parse(storage.get(Session.CAMPAIGN_SAVE));
  assert.ok(back.skills.talents.includes('pickpocket')); assert.equal(back.theft.sus.medic >= 1, true);
  assert.equal(back.theft.pending, null); assert.equal(back.theft.stats.tries, 2); assert.equal(back.theft.stats.caught, 1);
  console.log('Thief controller passed: skills page via K learns a talent (locked ones refuse), V crouch behind a person shows 下手 in the context bar, E opens the preview, 1 starts, number keys pick a pocket, space takes inside the zone, Esc stops then closes, a failed first gate locks the caught card (Esc and close refused) until 1 apologises for 20 gold, journal strip → thief book, the dummy via E, Canvas marks at four sizes and save/parse.');
}
