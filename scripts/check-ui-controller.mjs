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
import * as TidyData from '../dist/tidy-data.js';
import * as CampUI from '../dist/camp-ui.js';
import * as CampData from '../dist/expansion-data.js';
import * as FrontierUI from '../dist/frontier-ui.js';
import * as FrontierActions from '../dist/frontier-actions.js';
import * as FrontierData from '../dist/frontier-data.js';
import * as Version from '../dist/version.js';
// v0.38：卡位逃脱、触屏切换精英部位的字
import * as MendData from '../dist/mend-data.js';
// v0.39：一物一用的界面
import * as SimpleUI from '../dist/simple-ui.js';
import * as LookUI from '../dist/look-ui.js';
import * as SimpleData from '../dist/simple-data.js';
import * as Atlas from '../dist/atlas.js';
import {Renderer} from '../dist/campaign-renderer.js';
import * as Visual from '../dist/visual-renderer.js';
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
import * as ZestUI from '../dist/zest-ui.js';
import * as DistrictArt from '../dist/district-art.js';
import * as DistrictUI from '../dist/district-ui.js';
import * as DistrictData from '../dist/district-data.js';
import * as Audio from '../dist/audio.js';
import * as UData from '../dist/undertow-data.js';
import * as WinterData from '../dist/winter-data.js';
import * as LnData from '../dist/longnight-data.js';
import * as Longnight from '../dist/longnight.js';
import * as Tidy from '../dist/tidy.js';
import * as BountyData from '../dist/bounty-data.js';
import * as Bounty from '../dist/bounty.js';
import * as BustleData from '../dist/bustle-data.js';
const {createCanvas,Image:NativeImage,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
// 前几段检查的是 v0.13–v0.17 的流程：只在“每日抉择”段打开清晨事件卡，其余段里不让它插进来。
const realDailyShow=Campaign.Engine.prototype.dailyShouldShow;let dailyOn=false;
Campaign.Engine.prototype.dailyShouldShow=function(){return dailyOn&&realDailyShow.call(this);};
const dir=new URL('../dist',import.meta.url).pathname;
let all=[];const listeners={};
function decode(s){return s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');}
function parse(html,parent){const out=[];for(const m of html.matchAll(/<([a-zA-Z][\w-]*)([^>]*)>/g)){const el=new El(m[1].toLowerCase(),parent);for(const a of m[2].matchAll(/([\w:-]+)(?:="([^"]*)")?/g)){const k=a[1],v=decode(a[2]||'');if(k==='id')el.id=v;else if(k==='class')el.className=v;else if(k.startsWith('data-'))el.dataset[k.slice(5).replace(/-([a-z])/g,(_,v)=>v.toUpperCase())]=v;else if(k==='disabled')el.disabled=true;else if(k==='hidden')el.hidden=true;else if(k==='value')el.value=v;}out.push(el);}return out;}
function match(el,selector){const hot=selector.match(/^#modal \[data-hotkey="(\d)"\]$/);if(hot){if(el.dataset.hotkey!==hot[1])return false;for(let p=el.parent;p;p=p.parent)if(p.id==='modal')return true;return false;}return selector.split(',').some(part=>{part=part.trim();if(part.includes(':not([disabled])')&&el.disabled)return false;part=part.replace(':not([disabled])','');const av=part.match(/\[(data-[\w-]+)="([^"]*)"\]/);if(av){if(el.dataset[av[1].slice(5).replace(/-([a-z])/g,(_,v)=>v.toUpperCase())]!==av[2])return false;part=part.replace(av[0],'');}const attr=part.match(/\[([\w-]+)\]/)?.[1];if(attr){const key=attr.slice(5).replace(/-([a-z])/g,(_,v)=>v.toUpperCase());if(attr.startsWith('data-')&&!(key in el.dataset))return false;part=part.replace(/\[[\w-]+\]/,'');}if(part.startsWith('#'))return el.id===part.slice(1);if(part.startsWith('.'))return el.className.split(' ').includes(part.slice(1));return !part||el.tag===part;});}
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
const context=vm.createContext({...LookUI,...Session,...Journey,...Data,...Frontier,...Rebuild,...RebuildUI,...SupplyUI,...EchoUI,...RebuildData,...CampUI,...CampData,...FrontierUI,...FrontierActions,...FrontierData,...Version,...MendData,...SimpleUI,...SimpleData,...Atlas,...Clarity,...ZestUI,...DistrictArt,...DistrictUI,...DistrictData,...Beyond,...BeyondUI,...BeyondArt,...BeyondData,...Guidance,...GuidanceUI,...Wayfinding,...Alliance,...AllianceUI,...Outpost,...OutpostUI,...Winter,...WinterUI,...Campaign,...CampaignUI,...Visual,...Audio,Renderer,document,localStorage,Image,innerWidth:1366,innerHeight:768,devicePixelRatio:1,getComputedStyle:()=>({width:'40px'}),requestAnimationFrame:fn=>raf=fn,setTimeout:fn=>{if(false)fn()},clearTimeout:()=>{},window:{addEventListener(){},AudioContext:null},location:{reload(){}},URL,Blob,AbortController,console});
let script=readFileSync(dir+'/game.js','utf8').replace(/^import .*?;\n/gm,'');
script+='\nglobalThis.inspect=()=>({engine,menu,menuTab,menuArgs,outpostUI,renderer,rebuildUI,districtUI,beyondUI,atlasUI,journalUI,started,campaignInfo,moments});globalThis.openRadial=openRadial;globalThis.radialState=()=>radial;globalThis.action=handleAction;globalThis.open=showMenu;globalThis.step=frame;globalThis.hud=updateHUD;globalThis.fixture=(state)=>{state.frontier.demo=false;state.frontier.echoDemo=false;state.districts.demo=false;resetEngine(state);engine.markGearIntro?.();started=true;closeMenu();};';
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
// v0.22.0：旧档第一次读进来先弹“披挂上阵”说明卡，点“知道了”关掉，之后不再弹
assert.equal(context.inspect().menu,'outpost','an upgraded save shows the gear card once');assert.match(html(),/披挂上阵/);assert.match(html(),/你的家园已经升级/);clean();click('gIntroOk');assert.equal(context.inspect().menu,null);assert.equal(old.gr.intro,true);assert.equal(old.gearIntroDue(),false,'the gear card does not come back');
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
// v0.20.0：营地手册拆成一处一页。每一类、每一个旧操作都还能打开，但只是那一页，没有左侧导航、没有分页签。
for(const p of RebuildData.PILLARS){context.open('rebuild',{tab:p.id});clean();assert.doesNotMatch(html(),/manual-nav|manual-list|camp-tabs|frontier-tabs/);context.step(2000);for(const [menu,tab]of p.tools){context.open(menu,{tab});clean();assert.match(html(),/class="place-page"/);assert.doesNotMatch(html(),/manual-nav|camp-tabs|frontier-tabs|返回营地手册/);assert.equal(context.inspect().menu,'rebuild');}}
context.open('frontier',{tab:'water'});click('fWaterControl','gate');assert.equal(e.f.canals.open,true);
context.open('frontier',{tab:'kitchen'});e.s.inventory.potato=2;e.s.inventory.bean=1;click('fStartCooking');assert.ok(e.f.cooking);for(let i=0;i<20;i++)context.step(3000+i*50);assert.ok(e.f.cooking.t>0);click('rTab','residents');const t=e.f.cooking.t;context.step(5000);assert.equal(e.f.cooking.t,t);
context.open('rebuild',{tab:'farm'});clean();assert.match(html(),/今天的菜地/);assert.match(html(),/<h2 id="modal-title">菜地告示牌<\/h2>/);click('close');
context.open('rebuild',{tab:'production'});e.c.projects.market=1;e.s.buildings.push({id:'controller-bench',type:'workbench',x:880,y:760,hp:130,rotation:0});context.open('rebuild',{tab:'production'});document.querySelector('#supply-recipe').value='trailBread';document.querySelector('#supply-target').value='6';click('sPlan');assert.equal(e.u.plans.trailBread.target,6);e.s.inventory.radish=12;click('sDeposit','radish');assert.equal(e.s.storage.radish,12);click('sToggle','trailBread');assert.equal(e.u.plans.trailBread.enabled,false);
context.fixture(Rebuild.eventDemoState());e=context.inspect().engine;context.open('rebuild',{tab:'events'});click('eFilter','all');assert.equal((html().match(/data-action="eSelect"/g)||[]).length,22);clean();click('eAccept','convoy');click('eChoose','convoy:repair');click('ePack','convoy');click('eTravel','convoy');assert.equal(e.s.region,'residential');Object.assign(e.s.player,e.echoLocation('convoy'));context.open('rebuild',{tab:'events',eventId:'convoy'});click('ePerform','convoy');const paid=e.qty('wood');click('ePerform','convoy');assert.equal(e.qty('wood'),paid);click('close');e.advanceMinutes(46);assert.equal(e.eventRecord('convoy').stage,1);click('eTravel','convoy');Object.assign(e.s.player,e.echoLocation('convoy'));context.open('rebuild',{tab:'events'});click('ePerform','convoy');assert.equal(e.eventRecord('convoy').status,'resolved');
for(const panel of ['inventory','craft','build','map','pause','skills','legacyQuests']){context.open(panel);clean();}
context.open('rebuild',{tab:'production'});clean();assert.match(html(),/class="place-page"/);assert.doesNotMatch(html(),/manual-nav|clSelect/);assert.match(html(),/<h2 id="modal-title">生产与加工<\/h2>/);
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

e.recruit('cartographer');for(const p of RebuildData.PILLARS){click('rTab',p.id);clean();}context.open('camp',{tab:'residents'});clean();assert.match(html(),/柏岚/);click('bView','life');clean();click('save');assert.ok(Beyond.Engine.parse(storage.get(Session.CAMPAIGN_SAVE)));
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
  assert.match(document.querySelector('#context').innerHTML, /旧水井 · 修好辘轳/);
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
  assert.match(document.querySelector('#context').innerHTML, /联盟终端 · 回信/);
  press('e'); run(2);
  assert.equal(e.sc.act, 2); assert.equal(e.sc.helpers.length, 1);
  // v0.39：终端只读来信——回信以后打开的是“来信”那一页，信里那一步（挑哪一包）就在这一页上
  assert.equal(context.inspect().menu, 'sx'); assert.equal(context.inspect().menuArgs?.view ?? 'letters', 'letters');
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
  // 火炉：正常建造流程（v0.38 起建东西不能罩住自己：人站在外框下边一点）
  e.s.storage.wood = 60; e.s.storage.stone = 20; e.s.storage.scrap = 20; e.s.storage.bread = 30;
  e.buildMode = 'stove'; let spot = null;
  for (let r = 60; r < 400 && !spot; r += 16) for (let a = 0; a < 6.28 && !spot; a += 0.3) { const x = Math.round((430 + Math.cos(a) * r) / 8) * 8, y = Math.round((520 + Math.sin(a) * r) / 8) * 8; Object.assign(e.s.player, { x, y: y + Math.max(40, e.buildingRect('stove', x, y).h / 2 + 24) }); if (!e.buildReason('stove', x, y)) spot = { x, y }; }
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
  // v0.30：送礼要走到他跟前（人物关系页上的送礼按钮只在跟前出现）
  e.s.storage.jam = 2; { const rf = e.resident('farmer'); Object.assign(e.s.player, { x: rf.x, y: rf.y }); } click('sView', 'people'); clean(); assert.match(html(), /人物关系|喜欢/); assert.match(html(), /data-action="kinGift" data-id="farmer\|jam"/);
  click('kinGift', 'farmer|jam'); assert.ok(e.ss.trust.farmer >= 2);
  click('sApprentice', 'farmer:tieqiao'); assert.equal(e.ss.apprentice?.pupil, 'tieqiao'); clean(); click('close');
  // 同处多对象选择
  e.ss.lodger = { name: '赶路的木匠老韩', look: 1, gift: 'item', stay: false, phase: 'staying', day: e.s.day, qin: false }; e.ss.qin.phase = 'left';
  e.assignRegion();
  for (const h of e.sc.helpers) Object.assign(h, { x: 300, y: 900, target: { x: 300, y: 900 } });
  for (const r of e.c.residents) Object.assign(r, { x: 330, y: 380, target: { x: 330, y: 380 } });
  e.assignRegion();
  const lod = e.objects.find((o) => o.type === 'seasonLodger'); Object.assign(lod, { x: SD.SSPOTS.jiang.x + 40, y: SD.SSPOTS.jiang.y });
  Object.assign(e.s.player, { x: SD.SSPOTS.jiang.x + 20, y: SD.SSPOTS.jiang.y + 10 }); run(6);
  // v0.39：两样挨着也不弹“选一个”：底栏写着离你最近的那一样，按下去就是它
  assert.doesNotMatch(document.querySelector('#context').innerHTML, /选择：/);
  assert.match(document.querySelector('#context').innerHTML, /江伯 · /);
  press('e'); run(1); assert.equal(e.ss.jiang.phase, 'c1');
  if (context.inspect().menu) { clean(); click('close'); }
  // 物品来源与用途
  e.s.inventory.potato = 2; context.open('inventory'); click('item', 'potato'); clean(); assert.match(html(), /能做：/); assert.match(html(), /种土豆种子/); click('close');
  // 建造预览：相邻加成连线与提示
  e.buildMode = 'stove'; Object.assign(e.s.player, { x: 1010, y: 560 }); run(3); e.buildMode = null;
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
  // v0.39：“☰ 菜单”是十个菜单，每个一句话（麦穗那一格挪到“人”那一页）
  click('xView', 'phone'); assert.equal(context.inspect().menu, 'sx'); clean();
  assert.match(html(), /data-menu="inventory"/); assert.match(html(), /data-id="people"/); assert.equal((html().match(/<small>/g) || []).length >= 10, true); click('close');
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
  for (let r = 60; r < 600 && !placed; r += 16) for (let a = 0; a < 6.28 && !placed; a += 0.3) { const x = Math.round((760 + Math.cos(a) * r) / 8) * 8, y = Math.round((620 + Math.sin(a) * r) / 8) * 8; Object.assign(e.s.player, { x, y: y + Math.max(40, e.buildingRect(type, x, y).h / 2 + 24) }); if (!e.buildReason(type, x, y)) placed = e.placeBuilding(x, y); }
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
  // 睡一觉：平安的早上不弹日终总结（一行提示，全文在消息记录里），卡片直接弹出（v0.23）
  // v0.38：天亮前睡只睡到当天 8 点，这里是晚上睡
  goRegion('farm'); e.s.player.hunger = 80; e.s.storage.bread = 20; e.s.minute = Math.max(e.s.minute, 20 * 60);
  context.open('home'); click('sleep'); run(2);
  assert.equal(e.s.day, 3); assert.ok(e.dailyCard(), 'a fresh card for day three');
  assert.equal(context.inspect().menu, 'outpost', 'a quiet night: the card shows without the summary page'); clean(); assert.match(html(), /class="daily-card/);
  assert.ok(e.o.log.some((l) => /第2天平安过去/.test(l.text)), 'the quiet-night line is kept in the message log');
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
  // 只看今天的补给点：前面直接跳到第 20 天，没有经过换日清理，可能还留着第 3 天的
  const cache = e.dy.caches.find((c) => c.day === e.s.day); assert.ok(cache);
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
  console.log('Daily controller passed: no card on day one, the day-two card pops up by itself at 06:00, Esc and close cannot dismiss it, number keys pick and the result starts the day once, journal strip and record page, a quiet night → no summary page, the card shows, refused options change nothing, ×2 rewards in late acts, today\'s supply point and a chain marker via E (once each), marker routing on the map, HUD buff chip, Canvas at four sizes and save/parse.');
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
  assert.match(document.querySelector('#context').innerHTML, /· 下手/);
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
  // 任何 data-menu 按钮（比如顶栏的任务手记）也绕不过去：被抓后点它，回到要了结的卡
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
  // 顶上的提示每 0.12 秒刷新一次：多走一帧，保证刷新过
  Object.assign(e.s.player, { x: dummy.x, y: dummy.y + 24 }); run(3);
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
// v0.20.0「一亩田」: E on a plot tills, opens the seed picker (number key plants), waters, tends and opens the plot card; the farm board via E; N/F no longer open the journal; no page has a “返回营地手册” footer; objects open single-place pages; weeds, bugs, cover and a scarecrow on Canvas at four sizes; save/parse.
{
  let clock = 12000000;
  const run = (n) => { for (let i = 0; i < n; i++) context.step((clock += 50)); };
  const press = (key) => { listeners.keydown({ key, target: { matches: () => false }, preventDefault() {}, repeat: false }); listeners.keyup({ key }); };
  dailyOn = false;
  context.fixture(Campaign.freshState());
  const e = context.inspect().engine;
  e.paused = false;
  run(2);
  const p = e.s.plots[1];
  const stand = (q) => Object.assign(e.s.player, { x: q.x + 2, y: q.y + 6 });
  stand(p); run(4); stand(p); run(4);
  assert.match(document.querySelector('#context').innerHTML, /开垦土地/);
  press('e'); run(1); assert.equal(p.tilled, true);
  stand(p); run(4); stand(p); run(4);
  assert.match(document.querySelector('#context').innerHTML, /选种/);
  press('e'); run(1);
  assert.equal(context.inspect().menu, 'outpost'); clean();
  assert.match(html(), /<h2 id="modal-title">选种<\/h2>/); assert.match(html(), /data-action="gPlant"/); assert.doesNotMatch(html(), /返回营地手册/);
  press('1'); run(1);
  assert.equal(context.inspect().menu, null, 'planting closes the picker'); assert.equal(p.crop, 'radish');
  stand(p); press('e'); run(1); assert.ok(e.plotWatered(p), 'E waters');
  stand(p); press('e'); run(1); assert.equal(e.g.plots[p.id].t, e.s.day, 'E tends');
  stand(p); press('e'); run(1);
  assert.equal(context.inspect().menu, 'outpost'); clean(); assert.match(html(), /<h2 id="modal-title">这块田<\/h2>/); assert.match(html(), /照料分/);
  press('Escape'); assert.equal(context.inspect().menu, null);
  // 菜地告示牌
  const sign = e.objects.find((o) => o.type === 'frontierBoard');
  Object.assign(e.s.player, { x: sign.x, y: sign.y + 24 }); run(4); Object.assign(e.s.player, { x: sign.x, y: sign.y + 24 }); run(4);
  assert.match(document.querySelector('#context').innerHTML, /菜地告示牌/);
  press('e'); run(1); clean(); assert.match(html(), /<h2 id="modal-title">菜地告示牌<\/h2>/); assert.match(html(), /今天的菜地/);
  click('gScare'); assert.equal(context.inspect().menu, 'build'); assert.match(html(), /稻草人/); clean(); click('close');
  context.open('outpost', { view: 'gBoard' }); click('gJournal'); assert.equal(context.inspect().menu, 'journey', 'the board opens the journal'); click('close');
  // 任务手记变薄；N、F 不再打开它
  press('j'); assert.equal(context.inspect().menu, 'journey'); clean(); assert.doesNotMatch(html(), /营地事务与熟悉的功能|data-action="gManage"|返回营地手册/); assert.match(html(), /garden-strip/); click('close');
  press('n'); run(1); assert.equal(context.inspect().menu, null, 'N does nothing now');
  press('f'); run(1); assert.equal(context.inspect().menu, null, 'F does nothing off an expedition');
  // 每一页的底栏都没有“返回营地手册”；HUD 的营地消息是一页
  for (const panel of ['inventory', 'craft', 'build', 'map', 'skills']) { context.open(panel); assert.doesNotMatch(html(), /返回营地手册/, panel); click('close'); }
  click('rTab', 'events'); assert.equal(context.inspect().menu, 'rebuild'); assert.match(html(), /<h2 id="modal-title">营地消息<\/h2>/); assert.doesNotMatch(html(), /manual-nav/); click('close');
  // 原来只在营地手册里的几页，现在各有各的地方：篝火灶上掌勺，出货箱上看订单，农舍里看房间与相册
  const cook = e.s.buildings.find((b) => b.type === 'cook');
  context.open('station', { buildingId: cook.id }); clean(); assert.match(html(), /掌勺料理/);
  click('rOpen', 'frontier:kitchen'); assert.match(html(), /<h2 id="modal-title">料理<\/h2>/); click('close');
  // v0.27：出货箱上的“每日订单”换成出货箱旁边的订单板
  context.open('outpost', { view: 'shipping' }); clean(); assert.doesNotMatch(html(), /每日订单/); click('bView', 'bOrders'); assert.match(html(), /<h2 id="modal-title">订单板<\/h2>/); click('close');
  // v0.39：农舍只管休息；房间与家具挪到建造页“摆件”那一组
  context.open('home'); assert.doesNotMatch(html(), /房间与家具|保存存档|家园计划/); assert.match(html(), /data-action="sleep"/);
  context.open('build'); assert.match(html(), /房间与家具/); click('rOpen', 'frontier:rooms'); assert.match(html(), /<h2 id="modal-title">房间与家具<\/h2>/); click('close');
  // 池塘按 E：只开钓鱼与养殖那一页
  const pond = e.objects.find((o) => o.type === 'pond');
  if (pond) { Object.assign(e.s.player, { x: pond.x, y: pond.y + 30 }); run(1); Object.assign(e.s.player, { x: pond.x, y: pond.y + 30 }); press('e'); run(1); if (context.inspect().menu) { assert.doesNotMatch(html(), /manual-nav|camp-tabs|返回营地手册/); click('close'); } }
  // Canvas：杂草、菜青虫、盖布、乌鸦爪印、稻草人、肥力色条
  for (let i = 2; i < 8; i++) { const q = e.s.plots[i]; e.s.debris = e.s.debris.filter((d) => Math.hypot(d.x - q.x, d.y - q.y) >= 15); q.tilled = true; }
  e.s.inventory.seedPotato = 5; e.plantSeed(2, 'seedPotato'); e.plantSeed(3, 'seedPotato');
  e.gRec(e.s.plots[2]).b = 2; e.gRec(e.s.plots[3]).w = e.s.day; e.gRec(e.s.plots[4]).w = e.s.day; e.gRec(e.s.plots[3]).cv = e.s.day; e.gRec(e.s.plots[2]).pk = 1; e.s.plots[5].fertility = 90; e.s.plots[6].fertility = 20;
  e.s.buildings.push({ id: 'ctl-scare', type: 'scarecrow', x: 520, y: 400, rotation: 0, hp: 40 });
  stand(e.s.plots[2]);
  for (const [w, hh] of [[1366, 600], [1920, 900], [390, 480], [844, 240]]) { context.inspect().renderer.resize(w, hh, 1); run(3); }
  context.inspect().renderer.resize(1366, 600, 1);
  click('save'); const back = Campaign.Engine.parse(storage.get(Session.CAMPAIGN_SAVE));
  assert.equal(back.garden.plots[2].b, 2); assert.equal(back.garden.plots[3].w, e.s.day); assert.ok(back.buildings.some((b) => b.type === 'scarecrow'));
  console.log('Garden controller passed: E on a plot tills, opens the seed picker (1 plants and closes), waters, tends and opens the plot card; the farm board via E and its scarecrow button; the slim journal; N/F no longer open it; no footer “返回营地手册” on any page; 营地消息 and the pond open single pages; weeds, bugs, cover, crow marks, fertility strips and a scarecrow on Canvas at four sizes; save/parse.');
}
// v0.22.0「披挂」: the bag (Tab) shows the gear panel with eight slots and a trap; buttons equip, swap and take off; the new hotbar (4 melee, 5 ranged, 6 throw, 7 trap) and empty slots;
// X shoves you free of a grab, E mashes; the touch 推开 button; the weapon bench gets 修理与改装 (repair, mod, dismantle); telegraphs, crawlers, traps and fire on Canvas at four sizes; save/parse.
{
  let clock = 13000000;
  const run = (n) => { for (let i = 0; i < n; i++) context.step((clock += 50)); };
  const press = (key) => { listeners.keydown({ key, target: { matches: () => false }, preventDefault() {}, repeat: false }); listeners.keyup({ key }); };
  dailyOn = false;
  context.fixture(Campaign.freshState());
  const e = context.inspect().engine;
  e.paused = false;
  run(2);
  assert.equal(e.gearIntroDue(), false, 'a new game has no upgrade card');
  // 快捷栏：10 格，4 是木棍，5（远程）空着
  assert.equal((document.querySelector('#hotbar').innerHTML.match(/class="hot-slot/g) || []).length, 10);
  assert.match(document.querySelector('#hotbar').innerHTML, /远程栏（空）/);
  press('5'); run(4); assert.equal(e.s.slot, 4); assert.match(document.querySelector('#selected-label').innerHTML, /远程栏空着/);
  press('4'); run(4); assert.equal(e.currentItem(), 'club'); assert.match(document.querySelector('#selected-label').innerHTML, /左键挥/);
  // 行囊：装备栏
  e.add({ leatherJacket: 1, tireArmor: 1, spear: 1 });
  press('Tab');
  assert.equal(context.inspect().menu, 'inventory'); clean();
  assert.match(html(), /class="gear-panel"/); assert.equal((html().match(/data-action="gSlot"/g) || []).length, 9);
  assert.match(html(), /data-doll="1"/);
  click('gSlot', 'body'); assert.match(html(), /废胎护甲/); assert.match(html(), /▲|▼/); clean();
  click('gEquip', 'tireArmor'); assert.equal(e.gr.slots.body, 'tireArmor'); clean();
  click('gUnequip', 'body'); assert.equal(e.gr.slots.body, null);
  click('gSlot', 'melee'); click('gEquip', 'spear'); assert.equal(e.gr.slots.melee, 'spear'); click('gSlot', 'melee');
  click('item', 'leatherJacket'); assert.match(html(), /data-action="gEquip" data-id="leatherJacket"/); click('gEquip', 'leatherJacket'); assert.equal(e.gr.slots.body, 'leatherJacket');
  click('close'); assert.equal(context.inspect().menu, null);
  // 被抓住：X 推开；再抓一次连按 E 三下
  e.s.region = 'residential'; e.s.enemies.residential = []; e.assignRegion(); e.enemies.length = 0;
  Object.assign(e.s.player, { x: 700, y: 520, stamina: 100, facing: 0 });
  const z = e.enemy('slow', 730, 520); z.state = 'chase'; e.enemies.push(z);
  e.startGrab(z); run(4); assert.ok(e.gx.grab); assert.match(document.querySelector('#context').innerHTML, /挣开/);
  press('x'); run(1); assert.equal(e.gx.grab, null, 'X shoves free');
  e.gx.shoveCd = 0; e.startGrab(z); press('e'); press('e'); press('e'); run(1); assert.equal(e.gx.grab, null, 'three presses of E');
  e.startGrab(z); click('touchShove'); assert.equal(e.gx.grab, null, 'the touch button shoves');
  assert.ok(document.querySelectorAll('button').some((b) => b.dataset.action === 'touchShove'), 'touch controls have 推开');
  // 场景里的状态小条
  e.gx.bleed = 4; e.gr.inf = 30; run(4);
  assert.equal(document.querySelector('#gear-status').hidden, false); assert.match(document.querySelector('#gear-status').innerHTML, /流血/); assert.match(document.querySelector('#gear-status').innerHTML, /感染 30%/);
  { const b0 = e.gx.bleed, n0 = e.s.inventory.bandage || 0; click('gStatus', 'bleed'); assert.equal(e.gx.bleed, b0, 'the chip only explains'); assert.equal(e.s.inventory.bandage || 0, n0); }
  e.gx.bleed = 0;
  // Canvas：扑人的预兆、冲撞线、尖叫、爬行者、陷阱、火、被抓、倒地
  const p = e.s.player;
  const r = e.enemy('runner', p.x + 130, p.y); Object.assign(r, { state: 'chase', lunge: { phase: 'crouch', t: 99, a: Math.PI } }); e.enemies.push(r);
  const a = e.enemy('armor', p.x + 220, p.y + 120); Object.assign(a, { state: 'chase', charge: { phase: 'stomp', t: 99, a: Math.atan2(-120, -220) } }); e.enemies.push(a);
  const c = e.enemy('slow', p.x - 50, p.y + 40); Object.assign(c, { crawl: true, reach: 0.3 }); e.enemies.push(c);
  const sc = e.enemy('screamer', p.x - 160, p.y - 60); Object.assign(sc, { state: 'chase', windup: 0.8 }); e.enemies.push(sc);
  e.gr.traps.push({ id: 99901, kind: 'bearTrap', region: 'residential', x: p.x + 60, y: p.y + 40, uses: 3 });
  e.gx.fires.push({ region: 'residential', x: p.x - 120, y: p.y + 120, r: 60, t: 99, max: 3 });
  e.paused = true;
  for (const [w, hh] of [[1366, 600], [1920, 900], [390, 480], [844, 240]]) { context.inspect().renderer.resize(w, hh, 1); context.step((clock += 50)); context.step((clock += 50)); }
  e.gx.down = 2; context.step((clock += 50)); e.gx.down = 0;
  e.s.minute = 23 * 60; e.add({ headlamp: 1 }); e.equip('headlamp'); context.step((clock += 50)); e.s.minute = 12 * 60;
  context.inspect().renderer.resize(1366, 600, 1);
  e.paused = false; e.gx.fires = []; e.enemies.length = 0;
  // 武器台：修理与改装
  e.s.region = 'farm'; e.assignRegion();
  const wb = { id: 'ctl-wb', type: 'weaponbench', x: 900, y: 640, rotation: 0, hp: 100 }; e.s.buildings.push(wb);
  Object.assign(e.s.player, { x: 900, y: 600 });
  Object.assign(e.s.storage, { scrap: 20, cloth: 10, wood: 10 });
  context.open('station', { buildingId: wb.id }); assert.match(html(), /武器与潜行 · 修理改装/); clean();
  e.cond('spear').d = 3;
  click('rOpen', 'frontier:combat'); assert.equal(context.inspect().menu, 'rebuild', 'repairs live on the existing 武器与潜行 page'); assert.match(html(), /修理与改装/); assert.match(html(), /武器改装/); clean();
  // 修理那一行直接写修好以后的上限，不只放在悬停提示里
  assert.match(html(), new RegExp('修好后耐久回满，上限 ' + e.cond('spear').m + ' → ' + e.repairNextMax('spear') + '（第 1/5 次）'));
  click('gRepair', 'spear'); assert.equal(e.cond('spear').d, e.cond('spear').m); assert.equal(e.cond('spear').r, 1);
  click('gMod', 'spear|wrap'); assert.ok(e.cond('spear').mods.wrap);
  click('gDismantle', 'tireArmor'); assert.equal(e.qty('tireArmor', true), 0);
  // 缺材料写在按钮旁边；手枪没有改装位也列出自制消音器（附带它的效果和还缺什么）
  e.cond('spear').d = 2; e.s.storage.wood = 0; e.s.inventory.wood = 0; e.add({ pistol: 1 });
  context.renderMenu();
  assert.match(html(), /修理：还缺：木材/);
  assert.match(html(), /data-action="gMod" data-id="pistol\|diySuppressor" disabled/);
  assert.match(html(), /噪音 −55%，伤害 −10%，只能用 25 发；不占改装位/);
  assert.match(html(), /还缺：自制消音器 ×1（先要拿到自制消音器的图纸）/);
  e.s.storage.wood = 10;
  clean(); click('close');
  // 说明卡按 Esc（或右上角关闭）关掉也算看过，不会一直弹
  e.gr.intro = false; run(1);
  assert.equal(context.inspect().menu, 'outpost'); assert.match(html(), /披挂上阵/);
  press('Escape'); run(2);
  assert.equal(context.inspect().menu, null, 'Esc closes the gear card'); assert.equal(e.gearIntroDue(), false);
  e.gr.intro = false; run(1); assert.equal(context.inspect().menu, 'outpost'); click('close'); run(2);
  assert.equal(context.inspect().menu, null, 'the close button closes it for good'); assert.equal(e.gearIntroDue(), false);
  // 存档
  click('save'); const back = Campaign.Engine.parse(storage.get(Session.CAMPAIGN_SAVE));
  assert.equal(back.gear.slots.melee, 'spear'); assert.equal(back.gear.slots.body, 'leatherJacket'); assert.equal(back.gear.cond.spear.r, 1); assert.ok(back.gear.cond.spear.mods.wrap);
  console.log('Gear controller passed: Tab bag with the gear panel (nine slot buttons, doll), equip/swap/take off through buttons and the item detail, hotbar 4–7 with an empty ranged slot and its label, X shove and three E presses out of a grab, the touch 推开 button, the status strip (bleeding, infection), telegraphs/crawler/trap/fire/knockdown/headlamp on Canvas at four sizes, 修理与改装 on the existing 武器与潜行 page reached from the weapon bench (repair, mod, dismantle; the repaired cap, missing materials and a pistol suppressor written next to the buttons), the gear card closed for good by Esc or the close button, and save/parse.');
}

// v0.23.0「回响」: Space rolls (it no longer attacks); a short Tab opens the bag, a held Tab opens the radial (a number and releasing Tab opens 制作);
// the touch 翻滚 button; settings has four volumes saved in the preferences key and the 声音提示 switch, help puts the rest under 更多按键;
// a new game's opening wave shows the coach strip step by step and the road fence marker; cues write a direction line;
// the daily card's 稍后再选 (the alert reopens it and it can be closed), the journal's 今天, the career table in the 成就册,
// 拍照 in the quick menu; bodies, blood and the roll drawn at four sizes; save/parse.
{
  let clock = 14000000;
  const run = (n) => { for (let i = 0; i < n; i++) context.step((clock += 50)); };
  const keydown = (key) => listeners.keydown({ key, target: { matches: () => false }, preventDefault() {}, repeat: false });
  const keyup = (key) => listeners.keyup({ key });
  const press = (key) => { keydown(key); keyup(key); };
  dailyOn = false;
  context.fixture(Campaign.newGameState());
  const e = context.inspect().engine;
  e.paused = false;
  e.s.minute = 600;
  run(2);
  // 空格是翻滚，不再是攻击
  Object.assign(e.s.player, { x: 700, y: 640 }); e.s.slot = 3; e.s.player.facing = Math.PI; run(1);
  const x0 = e.s.player.x, y0 = e.s.player.y, st0 = e.s.player.stamina;
  press(' '); run(9);
  // 没按方向键时朝面对（瞄准）的方向滚
  assert.equal(e.feel.stats.rolls, 1, 'space rolls'); assert.ok(Math.hypot(e.s.player.x - x0, e.s.player.y - y0) > 100, 'the roll carried you');
  assert.ok(st0 - e.s.player.stamina >= 12, 'a roll costs stamina (15, minus what came back while rolling)');
  run(10);
  // 触屏的翻滚按钮
  click('touchRoll'); run(9); assert.equal(e.feel.stats.rolls, 2, 'the touch 翻滚 button rolls');
  assert.ok(document.querySelector('#touch-roll'), 'the touch 翻滚 button'); assert.match(readFileSync(dir + '/index.html', 'utf8'), /<div class="touch-actions"><button id="touch-roll" data-action="touchRoll"[^>]*>翻滚<\/button><button id="touch-use">/, 'the touch 翻滚 sits next to 使用, not among the extras');
  // 轻按 Tab 是背包；按住 Tab 是轮盘，按数字选一格，松开打开
  press('Tab'); assert.equal(context.inspect().menu, 'inventory'); click('close'); run(1);
  keydown('Tab'); context.openRadial();
  assert.ok(context.radialState(), 'held Tab opens the radial'); assert.equal(e.paused, true, 'the world waits');
  // 轮盘开在鼠标所在的地方（不出画面）；往右一甩就选右边那一格
  assert.match(document.querySelector('#radial').innerHTML, /class="radial-ring" style="left:\d+px;top:\d+px"/);
  { const r = context.radialState(); listeners.pointermove({ clientX: r.cx + 100, clientY: r.cy, target: { closest: () => null } }); assert.equal(context.radialState().sel, 2, 'a flick to the right picks the right-hand entry'); listeners.pointermove({ clientX: r.cx + 3, clientY: r.cy, target: { closest: () => null } }); assert.equal(context.radialState().sel, -1, 'back in the middle picks nothing'); }
  assert.equal(document.querySelector('#radial').hidden, false); assert.equal((document.querySelector('#radial').innerHTML.match(/data-radial=/g) || []).length, 8);
  assert.doesNotMatch(document.querySelector('#radial').innerHTML, /机制参考|试玩|待验证|undefined|NaN/);
  keydown('1'); assert.match(document.querySelector('#radial').innerHTML, /radial-item selected[^>]*>[^<]*<span[^>]*>⚒/);
  keyup('Tab'); assert.equal(context.radialState(), null); assert.equal(context.inspect().menu, 'craft', 'releasing Tab opens the picked entry'); click('close');
  keydown('Tab'); context.openRadial(); keyup('Tab'); assert.equal(context.inspect().menu, null, 'releasing with nothing picked just closes'); assert.equal(e.paused, false);
  // 设置：四个音量和声音提示，都存进偏好键
  context.open('pause'); clean();
  for (const id of ['volume', 'vol-music', 'vol-ambience', 'vol-sfx']) assert.match(html(), new RegExp('id="' + id + '"'));
  assert.match(html(), /声音提示/); assert.match(html(), /更多按键/); assert.match(html(), /空格<\/kbd>翻滚/); assert.match(html(), /<kbd>B<\/kbd>翻滚/);
  listeners.input({ target: { id: 'vol-music', value: '0.25', matches: () => false } });
  assert.equal(JSON.parse(storage.get(Session.PREFERENCES)).audio.music, 0.25, 'the music volume is saved');
  click('feelCues'); assert.equal(JSON.parse(storage.get(Session.PREFERENCES)).audio.cues, true); assert.match(html(), /已开启/);
  click('close');
  assert.ok(!storage.get(Session.CAMPAIGN_SAVE).includes('"cues"'), 'audio settings never go into the save');
  // 新开的家园：13:00 左右路那头来一拨，开局提示条一步一步
  e.s.minute = 779.9; e.s.slot = 0; run(3);
  assert.equal(e.feel.open.phase, 'fight'); assert.equal(e.enemies.filter((z) => z.tut && !z.dead).length, 4);
  assert.equal(document.querySelector('#coach').hidden, false); assert.match(document.querySelector('#coach').innerHTML, /按 4 拿起木棍/);
  press('4'); run(3); assert.match(document.querySelector('#coach').innerHTML, /左键/);
  // 声音提示：带方向的一行字
  e.events.push({ type: 'hiss', x: e.s.player.x - 220, y: e.s.player.y, z: 'runner', id: 1 }); run(3);
  assert.equal(document.querySelector('#cues').hidden, false); assert.match(document.querySelector('#cues').innerHTML, /← 奔跑者在嘶叫/);
  // 打退了：路口放围栏；手记最上面“今天”带路
  for (const z of e.enemies) if (z.tut) z.dead = true;
  run(4); assert.equal(e.feel.open.phase, 'fence'); assert.match(document.querySelector('#coach').innerHTML, /围栏/);
  context.open('journey'); clean(); assert.match(html(), /class="journal-today"/); assert.match(html(), /把东边路口堵上/);
  click('feelBuild', 'fence'); assert.equal(context.inspect().menu, 'build'); assert.match(html(), /围栏/); click('close');
  // 走到路口，用真的建造流程放一段围栏
  Object.assign(e.s.player, { x: 1260, y: 400 }); e.add({ wood: 6 }); e.buildMode = 'fence'; assert.equal(e.placeBuilding(1330, 400), true); e.buildMode = null; run(3);
  assert.equal(e.feel.open.phase, 'done'); assert.equal(document.querySelector('#coach').hidden, true);
  // 每日抉择：稍后再选
  dailyOn = true;
  e.s.day = 2; e.s.minute = 359; e.dailyGenerate(2); e.s.minute = 361; run(3);
  assert.equal(context.inspect().menu, 'outpost', 'the card pops up'); clean(); assert.match(html(), /稍后再选（12:00 前）/);
  click('feelLater'); assert.equal(context.inspect().menu, null, 'put off'); run(5); assert.equal(context.inspect().menu, null, 'it does not pop again');
  const alert = document.querySelector('#alert-bar').innerHTML; assert.match(alert, /今日抉择 · 12:00 前要选/);
  const ids = [...alert.matchAll(/data-id="(\d+)"[^>]*>([^<]*)</g)]; const at = ids.find((m) => /今日抉择/.test(m[2]))[1];
  click('wAlert', at); assert.equal(context.inspect().menu, 'outpost'); assert.match(html(), /12:00 前选好/); clean();
  click('close'); assert.equal(context.inspect().menu, null, 'a put-off card can be closed');
  e.s.minute = 719.9; run(3); assert.equal(e.dailyCard(), null, 'at noon the free option is taken'); dailyOn = false;
  // 成就册：生涯记录
  e.travel('residential'); e.paused = false; run(3); e.travel('farm'); e.paused = false; run(3);
  click('wView', 'collection'); assert.equal(context.inspect().menu, 'outpost'); assert.match(html(), /生涯记录/); assert.match(html(), /废弃居民区/); clean(); click('close');
  // 窄屏菜单里的拍照
  click('xView', 'phone'); assert.match(html(), /data-action="fPhoto"/); clean(); click('close');
  // 画面：尸体、血迹、翻滚，四种大小
  e.travel('residential'); e.paused = false; run(2);
  const p = e.s.player; e.addCorpse({ type: 'slow', x: p.x + 60, y: p.y, facing: 0, id: 1 }); e.addCorpse({ type: 'armor', x: p.x - 60, y: p.y, facing: 3, id: 2 });
  e.addBlood({ type: 'slow', x: p.x + 60, y: p.y }, 'pool'); e.addBlood({ type: 'armor', x: p.x - 60, y: p.y }, 'drop');
  e.fx.rollCd = 0; e.dodge({ x: 1, y: 0 });
  for (const [w, hh] of [[1366, 600], [1920, 900], [390, 480], [844, 240]]) { context.inspect().renderer.resize(w, hh, 1); context.step((clock += 20)); }
  context.inspect().renderer.resize(1366, 600, 1);
  // 存档
  click('save'); const back = Campaign.Engine.parse(storage.get(Session.CAMPAIGN_SAVE));
  assert.equal(back.feel.open.phase, 'done'); assert.ok(back.feel.career.trips.length >= 1); assert.equal(back.feel.stats.rolls, e.feel.stats.rolls);
  console.log('Echo controller passed: Space rolls instead of attacking, the touch 翻滚 button next to 使用, a short Tab opens the bag and a held Tab the radial where the cursor is (a flick picks by direction, number + release opens 制作; release with nothing picked closes), four volumes and 声音提示 saved in the preferences key (never in the save), help with 更多按键 and pad B = roll, a new game\'s opening wave with the step-by-step coach strip and the road fence marker (finished by a fence placed through the real build flow), a direction cue line, 稍后再选 on the daily card (alert reopens it, closable, noon takes the free option), the journal\'s 今天 routing to the fence, the 生涯记录 table in the 成就册, 拍照 in the quick menu, bodies/blood/roll drawn at four sizes and save/parse.');
}

// v0.24.0「暗涌」: today's boss in the alert bar, the journal's 废墟里的动静 (标出位置 opens the map with the pins and sets the gold marker),
// the boss bar above the scene (no popup; 发狂 tag; gone after the win), lit containers searched with E, the locked one pried through E
// (8 s, loud, a progress line in the context), the backpacker's two goods picked through the chooser, the museum's 头目战利品 case
// (捐 buttons; filling it pays out), the 成就册 rows, new infected / bosses / telegraphs / airdrop drawn at four sizes, save/parse.
{
  let clock = 16000000;
  const run = (n) => { for (let i = 0; i < n; i++) context.step((clock += 50)); };
  const keydown = (key) => listeners.keydown({ key, target: { matches: () => false }, preventDefault() {}, repeat: false });
  const keyup = (key) => listeners.keyup({ key });
  const press = (key) => { keydown(key); keyup(key); };
  dailyOn = false;
  context.fixture(Campaign.newGameState());
  const e = context.inspect().engine;
  e.feel.open.phase = 'done';
  e.ut.seed = 20241; e.ut.lit = {}; e.ut.evDay = 0;
  e.s.day = 4; e.s.minute = 600; e.paused = false;
  run(3);
  // 用 E 打开一样东西；挨着好几样时走选择菜单
  const use = (o) => {
    Object.assign(e.s.player, { x: o.x, y: o.y + 30 }); run(1);
    press('e'); run(1);
    if (context.inspect().menu === 'outpost' && /pick-list/.test(html())) {
      clean(); const i = e._pickList.indexOf(o); assert.ok(i >= 0, 'the chooser lists ' + o.name); click('sPick', String(i)); run(1);
    }
  };
  // 顶上的提醒
  assert.match(document.querySelector('#alert-bar').innerHTML, /大块头今天在废弃居民区/);
  // 手记：废墟里的动静 → 标出位置 → 世界地图上的牌子
  context.open('journey'); clean();
  assert.match(html(), /class="far-strip u-strip"/); assert.match(html(), /废弃居民区有大块头（只待今天）/);
  click('uMark', 'boss:brute');
  assert.equal(context.inspect().menu, 'map', 'away from the ruin it opens the map'); clean();
  assert.match(html(), /far-pin u-pin danger/); assert.match(html(), /今天 · 大块头/);
  assert.equal(e.guidance.target.label, '大块头', 'the gold marker points at the lair');
  click('close');
  // 进居民区：大块头在等；血条在场景上方，不弹窗
  e.ut.lit.residential = { day: e.s.day, ids: ['road', 'garden', 'garage', 'u5', 'u6'] };
  e.travel('residential'); e.paused = false; run(2);
  const b = e.enemies.find((z) => z.boss === 'brute'); assert.ok(b, 'the brute waits in the residential district');
  for (const z of e.enemies) if (!z.boss) z.dead = true;
  Object.assign(e.s.player, { x: b.x + 140, y: b.y + 10, hp: 100 }); e.invulnerable = 999; b.state = 'chase'; run(3);
  const bar = document.querySelector('#boss-bar');
  assert.equal(bar.hidden, false, 'the boss bar shows'); assert.match(bar.innerHTML, /<b>大块头<\/b>/); assert.match(bar.innerHTML, /role="progressbar"/);
  assert.doesNotMatch(bar.innerHTML, /undefined|NaN/);
  assert.equal(context.inspect().menu, null, 'no popup for the boss');
  b.hp = b.maxHp * 0.4; run(3); assert.match(bar.innerHTML, /发狂/);
  e.hurtEnemy(b, b.hp + 1, 0); run(3);
  assert.equal(e.ut.boss.brute.wins, 1); assert.ok(e.qty('trophyBrute', true) >= 1, 'the trophy');
  assert.equal(bar.hidden, true, 'the bar goes away after the win');
  // 柜子：搜一个亮着的；锁着的用撬棍撬（E 开始，8 秒，很响）
  for (const z of e.enemies) z.dead = true;
  e.invulnerable = 999;
  const box = e.objects.find((o) => o.type === 'crate' && o.id === 'residential-u5');
  assert.ok(box && box.ukind === 'toolbox', 'the toolbox is lit today');
  const opened0 = e.ut.stats.opened;
  use(box);
  assert.equal(e.ut.stats.opened, opened0 + 1, 'searched with E'); assert.equal(e.s.opened[box.id].day, e.s.day);
  const lock = e.objects.find((o) => o.id === 'residential-u6');
  assert.ok(lock?.locked, 'the locked cabinet is lit today');
  e.s.inventory.crowbar = 1;
  use(lock);
  assert.ok(e.ux.pry && !e.ux.pry.silent, 'prying with the crowbar'); run(1);
  assert.match(document.querySelector('#context').innerHTML, /撬锁中 · \d+%/);
  assert.ok(e.noise.some((n) => n.r >= UData.PRY.noise), 'prying is loud');
  // 撬完要 8 秒：只走游戏逻辑，不每帧画（这个替身环境里画布内存回收很慢）
  for (let i = 0; i < Math.ceil(UData.PRY.time / 0.05) + 4; i++) e.update(0.05, {});
  run(1);
  assert.equal(e.ux.pry, null); assert.equal(e.ut.pried[lock.id], e.s.day); assert.equal(e.s.opened[lock.id]?.day, e.s.day, 'pried open and searched');
  // 背包客：两样货，挨着站用选择菜单挑
  e.travel('farm'); e.paused = false; run(1);
  e.s.day = 5; e.ut.evDay = 5; e.ut.ev = { day: 5, id: 'merchant', region: 'hospital', spot: 0, st: 'wait', bits: 0, spawned: false };
  e.travel('hospital'); e.paused = false; run(2);
  for (const z of e.enemies) z.dead = true;
  const goods = e.objects.filter((o) => o.type === 'uGood'); assert.equal(goods.length, 2, 'two goods');
  e.s.inventory.bread = 6; e.s.inventory.bandage = 3;
  const before = Object.fromEntries(Object.keys(goods[0].bundle).map((k) => [k, e.qty(k, true)]));
  // v0.39：不再弹“选一个”——站到哪一样跟前（头上写着它），按下去就是它
  Object.assign(e.s.player, { x: goods[0].x + (goods[0].x < goods[1].x ? -6 : 6), y: goods[0].y + 4 }); run(1);
  assert.equal(e.nearestObject(), goods[0]); assert.doesNotMatch(document.querySelector('#context').innerHTML, /选择：/);
  press('e'); run(1);
  if (context.inspect().menu) { clean(); click('close'); }
  assert.equal(e.ut.ev.bits & 1, 1, 'bought the first good');
  for (const [k, n] of Object.entries(goods[0].bundle)) assert.ok(e.qty(k, true) - before[k] >= Math.min(1, n), 'got ' + k);
  // 档案馆：第六个展柜（头目战利品）
  e.travel('farm'); e.paused = false; run(1);
  e.w.museum.built = true; Object.assign(e.s.player, { x: WinterData.WSPOTS.museum.x, y: WinterData.WSPOTS.museum.y + 40 });
  e.s.inventory.trophyNurse = 1; e.s.inventory.trophyGuard = 1;
  context.open('outpost', { view: 'museum' }); clean();
  assert.match(html(), /头目战利品/); assert.match(html(), /data-action="uDonate" data-id="trophyBrute"/);
  click('uDonate', 'trophyBrute'); assert.deepEqual(e.ut.trophies, ['trophyBrute']); assert.match(html(), /<span class="exhibit">大块头的铁指虎<\/span>/);
  click('uDonate', 'trophyNurse'); click('uDonate', 'trophyGuard');
  assert.equal(e.ut.trophyDone, true, 'the case is full'); assert.match(html(), /加成已生效/); clean();
  click('close');
  // 成就册
  context.open('outpost', { view: 'collection' }); clean();
  assert.match(html(), /头目战利品/); assert.match(html(), /大块头 ✓ 1 次（第一次在第 4 天）/);
  click('close');
  // 画面：新感染者、头目、预兆、毒雾、酸液、空投、撬锁，四种大小（白天、夜里、色弱）
  e.s.day = 20; e.ut.evDay = 20; e.ut.ev = null; e.travel('residential'); e.paused = false; run(1);
  for (const z of e.enemies) z.dead = true;
  e.enemies = e.s.enemies.residential = []; e.invulnerable = 999;
  const p = e.s.player; Object.assign(p, { x: 800, y: 700 });
  const mk = (type, x, y, extra = {}) => { const q = e.freePoint(x, y), z = e.enemy(type, q.x, q.y); Object.assign(z, { state: 'chase', alert: 8 }, extra); e.enemies.push(z); return z; };
  mk('spitter', 1010, 700, { scd: 99, spit: { t: 0.4, x: 800, y: 700 } });
  mk('stalker', 640, 700, { dash: { phase: 'wind', t: 9 } });
  mk('bloater', 700, 760); mk('faker', 900, 820);
  mk('brute', 1100, 520, { boss: 'brute', bossDay: e.s.day, act: { kind: 'slam', t: 0.6, max: 1.2 } });
  mk('nurse', 520, 520, { boss: 'nurse', bossDay: e.s.day, act: { kind: 'scream', t: 0.7, max: 1.4 } });
  const lie = e.makeFaker(700, 820); lie.twitch = 0.5; e.enemies.push(lie);
  e.ux.puddles.push({ x: 880, y: 780, r: 50, t: 5, max: 5 }); e.ux.fuses.push({ x: 720, y: 600, t: 0.8, max: 1, facing: 0 }); e.ux.clouds.push({ x: 980, y: 590, r: 90, t: 6, max: 6 });
  e.ux.acid.push({ x0: 1010, y0: 660, x: 860, y: 720, t: 0.2, fly: 0.5 });
  e.ux.drop = { x: 760, y: 560, t: 20, max: 60 };
  for (const [night, color] of [[false, false], [true, true]]) {
    e.s.minute = night ? 1380 : 600; e.s.settings.access = { ...(e.s.settings.access || {}), color };
    for (const [w, hh] of [[1366, 600], [1920, 900], [390, 480], [844, 240]]) { context.inspect().renderer.resize(w, hh, 1); context.step((clock += 20)); }
  }
  e.s.settings.access.color = false; e.s.minute = 600; e.ux.drop = null;
  context.inspect().renderer.resize(1366, 600, 1);
  // 存档
  click('save'); const back = Campaign.Engine.parse(storage.get(Session.CAMPAIGN_SAVE));
  assert.equal(back.undertow.seed, 20241); assert.deepEqual(back.undertow.trophies, ['trophyBrute', 'trophyNurse', 'trophyGuard']); assert.equal(back.undertow.trophyDone, true);
  assert.equal(back.undertow.boss.brute.wins, 1); assert.equal(back.undertow.pried['residential-u6'], 4);
  console.log('Undertow controller passed: today\'s boss in the alert bar, 废墟里的动静 in the journal (标出位置 opens the map with the pins and sets the gold marker), the boss bar above the scene without a popup (发狂 tag, gone after the win, trophy dropped), a lit toolbox searched with E, the locked cabinet pried through E (loud, progress in the context line, opened when done), the backpacker\'s two goods picked through the chooser, the museum\'s 头目战利品 case (捐 ×3 fills it and pays out), the 成就册 rows, new infected/bosses/telegraphs/gas/acid/airdrop drawn at four sizes by day and by night with colour-safe hues, and save/parse.');
}

// v0.25.0「长夜」: the new-game origin picker (pick → start → the kit), 带着记忆重新开始 from the settings after the story (gear picked,
// the old home kept as a checkpoint), a long night through the DOM (red date, the 长夜 banner, the alert, the boss bar on the farm,
// the dawn report and 睡到早上 8 点), the ending card, the export card and the settings line, the save-failure prompt with its export
// button, the counterattack's smoke/leader/saboteur marks, the new animals and item icons drawn at four sizes, save/parse.
{
  let clock = 17000000;
  const run = (n) => { for (let i = 0; i < n; i++) context.step((clock += 50)); };
  // 主线打完（和单元测试一样把各段都记上，存档检查才过得去）
  const storyEnd = (e) => {
    const sc = e.sc;
    sc.act = 9;
    sc.claimed = ['act1', 'supply', 'act2', 'act3', 'act4', 'act5', 'act6', 'act7', 'act8'];
    sc.choice = 'ration';
    sc.letters = ['act1', 'act2', 'act3', 'act4', 'act5', 'act6', 'act7', 'act8', 'act9'];
    sc.flags.well = sc.flags.camp = sc.flags.farmerFed = true;
    sc.camp = { x: 560, y: 735 };
    e.r.claimed = RebuildData.TASKS.slice(0, RebuildData.TASKS.findIndex((x) => x.id === 'broadcast') + 1).map((x) => x.id);
    e.o.hospital = 'water'; Object.assign(e.o, { youke: true, lathe: { mode: 'parts', day: 0 } });
    e.r.radio = true; e.o.toll = 'refuse'; e.o.raid.phase = 'won';
  };
  dailyOn = false;
  // ---------- 开始新游戏：选出身 ----------
  context.fixture(Campaign.newGameState());
  click('restart');
  assert.equal(context.inspect().menu, 'confirmRestart'); clean();
  assert.equal((html().match(/data-action="pickOrigin"/g) || []).length, 5, 'five origins');
  assert.match(html(), /aria-pressed="true"[^>]*>|class="origin-card active"/);
  assert.match(html(), /种地的/); assert.match(html(), /代价：没有木棍，开局干粮少 2/);
  click('pickOrigin', 'hunter'); clean();
  assert.match(html(), /class="origin-card active" data-action="pickOrigin" data-id="hunter"/);
  click('newGame');
  let e = context.inspect().engine;
  assert.equal(context.inspect().menu, null);
  assert.equal(e.ln.origin, 'hunter'); assert.equal(e.s.inventory.club, undefined); assert.equal(e.gr.slots.ranged, 'slingshot');
  assert.ok(storage.get(Session.CHECKPOINTS?.new || 'ember-farm-before-new-v1'), 'the old home is kept before a new game');
  // 行囊上写着出身
  context.open('inventory'); clean(); assert.match(html(), /出身：猎人/); click('close');
  // ---------- 主线打完：设置里“带着记忆重新开始” ----------
  const old = Campaign.newGameState();
  context.fixture(old);
  e = context.inspect().engine;
  e.feel.open.phase = 'done';
  storyEnd(e);
  e.s.day = 30; e.s.minute = 600; e.s.stats.hordes = 6; e.c.nextHordeDay = 80; e.dy.pending = null; e.paused = false;
  e.s.inventory.riotHelmet = 1; e.gr.bp.bp_sledge = 3; e.s.money = 4321;
  run(2);
  assert.equal(e.ln.storyDay, 30);
  context.open('pause'); clean();
  assert.match(html(), /带着记忆重新开始/); assert.match(html(), /这个存档还没导出过/);
  click('restartPlus'); clean();
  assert.equal(context.inspect().menu, 'confirmRestart'); assert.match(html(), /<h2 id="modal-title">带着记忆重新开始<\/h2>/);
  assert.match(html(), /data-action="pickKeep" data-id="riotHelmet"/);
  click('pickOrigin', 'veteran'); click('pickKeep', 'riotHelmet'); clean();
  assert.match(html(), /class="keep-item active" data-action="pickKeep" data-id="riotHelmet"/);
  click('newGame');
  e = context.inspect().engine;
  assert.equal(e.s.day, 1); assert.ok(e.s.money < 1000); assert.equal(e.ln.origin, 'veteran'); assert.equal(e.gr.slots.head, 'riotHelmet');
  assert.ok(e.gr.bp.bp_sledge); assert.equal(e.ln.legacy.ng, 1); assert.equal(e.ln.legacy.fromDay, 30);
  const kept = JSON.parse(storage.get('ember-farm-before-new-v1'));
  assert.ok(JSON.stringify(kept).includes('4321'), 'the old home (4321 gold) is in the checkpoint');
  context.open('outpost', { view: 'collection' }); clean(); click('close');
  // ---------- 长夜：日期变红、横幅、提醒、血条、天亮的战报、睡到 8 点 ----------
  context.fixture(Campaign.newGameState());
  e = context.inspect().engine;
  e.feel.open.phase = 'done';
  storyEnd(e);
  e.s.stats.hordes = 6; e.s.horde = { phase: 'won', timer: 0, remaining: 0, spawnTimer: 0, direction: 0 };
  e.c.nextHordeDay = 80; e.dy.pending = null; e.s.day = 30; e.s.minute = 600; e.paused = false;
  run(2);
  e.ct.step = 4; e.ct.done = true;
  e.s.day = 38; e.s.minute = 600; run(2);
  assert.match(document.querySelector('#date').className, /ln-day/, 'the date is red');
  assert.match(document.querySelector('#alert-bar').innerHTML, /今晚 22:00 长夜/);
  context.open('journey'); clean(); assert.match(html(), /今晚<\/b>22:00 长夜/); click('close');
  e.s.minute = 1319.9; e.invulnerable = 999; run(4);
  assert.ok(e.ln.night, 'the night began');
  const warn = document.querySelector('#horde-warning');
  assert.equal(warn.hidden, false); assert.match(warn.textContent, /长夜 · (?:[^ ·<]+夜 · )?第 1\/3 波/);
  assert.match(document.querySelector('#alert-bar').innerHTML, /长夜 · (?:[^ ·<]+夜 · )?第 1\/3 波/);
  // 第三波和头目：v0.26 头目 03:00 来；第三波打完，走到菜地北边的警钟按 E 提前叫（横幅上写着还有几秒）；血条在农场上方
  e.ln.night.wave = 2; e.lnWave(3); e.ln.night.left = 0;
  for (const z of e.enemies) if (z.horde) z.dead = true;
  e.s.player.hp = 100; e.invulnerable = 999; run(2);
  assert.equal(e.ln.night.boss, 0, 'the boss waits for 03:00');
  assert.match(document.querySelector('#horde-warning').textContent, /大块头 \d+ 秒后 · 可以敲警钟/);
  assert.match(document.querySelector('#alert-bar').innerHTML, /可以敲警钟/);
  Object.assign(e.s.player, { x: TidyData.LN_PACE.bell.x, y: TidyData.LN_PACE.bell.y + 24 }); run(2);
  assert.match(document.querySelector('#context').innerHTML, /警钟/);
  listeners.keydown({ key: 'e', target: { matches: () => false }, preventDefault() {}, repeat: false }); listeners.keyup({ key: 'e' }); run(4);
  assert.equal(e.ln.night.boss, 1); assert.equal(e.td.bell.early, 1);
  const bar = document.querySelector('#boss-bar');
  assert.equal(bar.hidden, false); assert.match(bar.innerHTML, /<b>大块头<\/b>/); assert.match(bar.innerHTML, /长夜/);
  // 画面：红的天、雷、头目，四种大小
  for (const [w, hh] of [[1366, 600], [1920, 900], [390, 480], [844, 240]]) { context.inspect().renderer.resize(w, hh, 1); context.step((clock += 20)); }
  context.inspect().renderer.resize(1366, 600, 1);
  // 天亮：战报、睡到早上 8 点
  e.s.day = 39; e.s.minute = 239.9; run(3);
  assert.equal(e.ln.night, null); assert.equal(e.ln.held, 1);
  assert.equal(context.inspect().menu, 'outpost'); clean();
  assert.match(html(), /第 1 个长夜 · (?:[^ ·<]+夜 · )?守住了/); assert.match(html(), /长夜的铁哨/);
  click('lnNap');
  assert.equal(context.inspect().menu, null); assert.equal(e.s.minute, 480);
  // 结局卡
  context.open('outpost', { view: 'lnEnd' }); clean(); assert.match(html(), /余烬地区，收复了/); click('close');
  // 导出提醒：卡片上的“导出存档”真的导出并清零
  e.ln.exportDay = 0; e.ln.remindDay = 0; e.s.day = 50;
  context.open('outpost', { view: 'lnExport' }); clean();
  assert.match(html(), /data-action="export"/);
  click('export');
  assert.equal(e.ln.exportDay, 50); assert.equal(context.inspect().menu, null, 'exporting closes the card');
  context.open('pause'); clean(); assert.match(html(), /上次导出：第 50 天（今天）/); click('close');
  // 浏览器存不进去：提示里有导出按钮
  failSave = true; click('save');
  assert.equal(context.inspect().menu, 'saveFail'); clean(); assert.match(html(), /存不进去了/); assert.match(html(), /data-action="export"/);
  failSave = false; click('close');
  // ---------- 灰隼团反扑的画面、动物 ----------
  e.ct.step = 3; e.ct.done = false; e.ct.leader = 0;
  Object.assign(e.ct.raid, { phase: 'active', day: e.s.day, total: 9, spawned: 0, killed: 0, retreated: 0, spawnTimer: 0, clock: 0 });
  const leader = e.spawnLeader(); Object.assign(leader, { x: 1150, y: 600, aim: 0.5, aimX: 900, aimY: 560 });
  e.lx.smoke.push({ x: 1000, y: 600, r: 120, t: 5, max: 8 }); e.lx.grenades.push({ x0: 1150, y0: 570, x: 1050, y: 600, t: 0.2, fly: 0.6 }); e.lx.smokeRegion = 'farm';
  const sab = e.enemy('raider', 900, 420, false); Object.assign(sab, { saboteur: true, plant: 6, aim: 0, cooldown: 9 }); e.enemies.push(sab);
  e.ct.target = 't-x';
  e.s.buildings.push({ id: 'coop-x', type: 'coop', x: 640, y: 760, rotation: 0, hp: 100 });
  e.c.animals.chicken = true; e.c.animals.goat = true;
  e.f.dog.rescued = true; Object.assign(e.f.dog, { x: 860, y: 520 }); e.assignRegion();
  for (const [night] of [[false], [true]]) {
    e.s.minute = night ? 1380 : 600;
    for (const [w, hh] of [[1366, 600], [1920, 900], [390, 480], [844, 240]]) { context.inspect().renderer.resize(w, hh, 1); context.step((clock += 20)); }
  }
  context.inspect().renderer.resize(1366, 600, 1);
  e.ct.raid.phase = 'scheduled'; e.ct.leader = 0;
  e.enemies = e.s.enemies.farm = e.enemies.filter((z) => z.type !== 'raider');
  e.lx.smoke = []; e.lx.grenades = [];
  // 物品小图：每样都换成新画的
  const icons = Object.keys(Data.ITEMS).filter((id) => !/^g\d+$/.test(String(Data.ITEMS[id].icon)));
  assert.deepEqual(icons, [], 'every item has a new icon');
  context.open('inventory'); clean(); click('close');
  // 存档
  click('save'); assert.notEqual(context.inspect().menu, 'saveFail');
  const back = Campaign.Engine.parse(storage.get(Session.CAMPAIGN_SAVE));
  assert.equal(back.longnight.held, 1); assert.equal(back.longnight.exportDay, 50); assert.equal(back.longnight.origin, 'farmer');
  console.log('Longnight controller passed: the new-game origin picker (pick → start → the kit, the bag says the origin), 带着记忆重新开始 from the settings after the story (origin and gear picked, blueprints carried, the old home kept as a checkpoint), a long night through the DOM (red date, the 长夜 banner and alert, the boss bar on the farm, the dawn report and 睡到早上 8 点), the ending card, the export card that really exports and the settings line, the save-failure prompt with its export button, smoke/leader/saboteur marks and the new animals drawn at four sizes by day and night, every item on a new icon, and save/parse.');
}

// v0.26.0「整顿」: a v0.25 save restored from a file (the three retired buildings come down with their materials back, the stall goods
// hang on the shipping box, the farmhouse overtime becomes a decree, the 营地整顿 toast on the first frame and the list in the next
// morning's summary), the build list without the retired three, E on a facility opens its own page (the solar card; the lure page whose
// 拉响信标 really sounds it; a broken trap mended with 用修理包修满), the repair kit's own button in the bag, the shipping box's 明天
// and the listing form that sells by day, the residents' mood card, decree costs and the missing ladder step, the lodger in the alert
// bar, the lathe rush, the bell, the lure rings and the mood marks drawn at four sizes by day and night, save/parse.
{
  let clock = 18000000;
  const run = (n) => { for (let i = 0; i < n; i++) context.step((clock += 50)); };
  const press = (key) => { listeners.keydown({ key, target: { matches: () => false }, preventDefault() {}, repeat: false }); listeners.keyup({ key }); };
  dailyOn = false;
  // ---------- 一份 v0.25 的旧档，从文件恢复 ----------
  const old = new Longnight.Engine(Longnight.newGameState(), () => {});
  const sc = old.sc;
  sc.act = 7; sc.claimed = ['act1', 'supply', 'act2', 'act3', 'act4', 'act5', 'act6']; sc.choice = 'ration';
  sc.letters = ['act1', 'act2', 'act3', 'act4', 'act5', 'act6', 'act7']; sc.flags.well = sc.flags.camp = sc.flags.farmerFed = true; sc.camp = { x: 560, y: 735 };
  old.r.claimed = RebuildData.TASKS.slice(0, RebuildData.TASKS.findIndex((t) => t.id === 'network') + 1).map((t) => t.id); old.r.radio = true;
  old.o.hospital = 'water'; old.o.youke = true; old.o.lathe = { mode: 'ammo', day: 0 };
  old.s.day = 12; old.s.minute = 600; if (old.feel?.open) old.feel.open.phase = 'done'; old.markGearIntro?.();
  for (const [type, x, y] of [['canner', 700, 600], ['fishTrap', 1000, 800], ['stall', 760, 600]]) old.s.buildings.push({ id: 'old-' + type, type, x, y, rotation: 0, hp: Data.BUILDINGS[type].hp, fishDay: 12 });
  old.c.stall = [{ item: 'potato', qty: 7, band: 'fair' }];
  old.f.policy.work = 'overtime'; old.w.decrees = [];
  const wood0 = old.s.storage.wood || 0;
  context.open('restoreArchive', { files: { old: old.serialize() } }); clean();
  click('restoreCandidate', '0'); click('applyImport');
  let e = context.inspect().engine;
  assert.equal(context.inspect().menu, null);
  assert.ok(!e.s.buildings.some((b) => ['canner', 'fishTrap', 'stall'].includes(b.type)));
  assert.equal(e.s.storage.wood - wood0, 8 + 6 + 10);
  assert.deepEqual(e.td.listing.map((l) => [l.item, l.qty]), [['potato', 7]]);
  assert.deepEqual(e.w.decrees, ['overtime']); assert.equal(e.f.policy.work, 'overtime'); assert.equal(e.o.lathe.mode, 'parts');
  e.paused = false; run(3);
  assert.ok(e.td.converted.told, 'told on the first frame');
  context.open('outpost', { view: 'log' }); clean(); assert.match(html(), /营地整顿/); click('close');
  // 建造菜单里没有那三样
  context.open('build'); clean();
  for (const name of ['罐装机', '鱼篓', '农场摊位']) assert.ok(!html().includes('<h3>' + name + '</h3>'), name + ' is not offered');
  click('close');
  // ---------- 设施卡：按 E 打开自己的那一页 ----------
  e.s.region = 'farm'; e.assignRegion();
  const B = (type, x, y) => { const b = { id: 'td-' + type + '-' + e.s.idCounter++, type, x, y, rotation: 0, hp: Data.BUILDINGS[type].hp }; e.s.buildings.push(b); e.navRevision++; return b; };
  const solar = B('solar', 420, 880);
  Object.assign(e.s.player, { x: solar.x, y: solar.y + 40 }); run(2);
  assert.match(document.querySelector('#context').innerHTML, /太阳能板 · /);
  press('e'); run(1);
  assert.equal(context.inspect().menu, 'building'); clean(); assert.match(html(), /营地的电/); click('close');
  const lure = B('lure', 300, 620); e.c.energy = 40;
  Object.assign(e.s.player, { x: lure.x, y: lure.y + 40 }); run(2); press('e'); run(1);
  assert.equal(context.inspect().menu, 'building'); clean(); assert.match(html(), /拉响信标/);
  click('tdLure', lure.id); assert.ok(e.pulledLure()); assert.equal(e.c.energy, 35); assert.match(html(), /正在响/); click('close');
  const trap = B('trap', 1000, 240); trap.hp = 20; e.s.storage.repairKit = 1;
  Object.assign(e.s.player, { x: trap.x, y: trap.y + 40 }); run(2); press('e'); run(1);
  assert.equal(context.inspect().menu, 'building'); clean(); assert.match(html(), /用修理包修满（有 1 个）/);
  click('tdKit', trap.id); assert.equal(trap.hp, Data.BUILDINGS.trap.hp); click('close');
  // 行囊里：修理包自己的按钮
  e.s.inventory.repairKit = 1; trap.hp = 30;
  context.open('inventory'); click('item', 'repairKit'); clean(); assert.match(html(), /data-action="useItem" data-id="repairKit"/);
  click('useItem', 'repairKit'); assert.equal(trap.hp, Data.BUILDINGS.trap.hp); assert.ok(!e.s.inventory.repairKit); click('close');
  // ---------- 出货箱：明天的行情、挂牌 ----------
  e.s.inventory.tomato = 6; e.s.storage.bread = 30; e.s.minute = 360;
  context.open('outpost', { view: 'shipping' }); clean();
  assert.match(html(), /明天/); assert.match(html(), /挂牌 · 1\/3 格/);
  document.querySelector('#td-list-item').value = 'bread'; document.querySelector('#td-list-qty').value = '4';
  click('tdList'); assert.equal(e.td.listing.length, 2); assert.match(html(), /挂牌 · 2\/3 格/); click('close');
  const money = e.s.money; e.advanceMinutes(6 * 60); assert.ok(e.s.money > money, 'sold by day');
  // ---------- 居民的心情、法令的代价、生活水准差哪一格 ----------
  for (const id of ['farmer', 'medic']) e.recruit(id);
  B('bed', 700, 330);
  e.w.decrees = ['ration'];
  context.open('rebuild', { tab: 'residents' }); clean(); assert.match(html(), /心情 /); assert.match(html(), /配给卡/); click('close');
  context.open('outpost', { view: 'decrees' }); clean(); assert.match(html(), /让谁不高兴：阿禾、许医生，心情 −10/); assert.match(html(), /差「/); click('close');
  // ---------- 警报栏：借宿 ----------
  e.ss.lodger = { name: '过路人', look: 0, gift: 'item', stay: false, phase: 'asking', day: e.s.day, qin: false }; run(4);
  assert.match(document.querySelector('#alert-bar').innerHTML, /想借宿/); e.ss.lodger = null;
  // ---------- 机床加急 ----------
  e.s.minute = 600; context.open('outpost', { view: 'lathe' }); clean(); assert.match(html(), /今晚加急/); assert.doesNotMatch(html(), /优先弹药/);
  click('tdRush'); assert.equal(e.td.lathe.rush, e.s.day); assert.match(html(), /说好了/); click('close');
  // ---------- 画面：警钟、信标的圈、头上的心情，四种大小，白天和夜里 ----------
  e.objects.push({ type: 'tdBell', name: '警钟', x: TidyData.LN_PACE.bell.x, y: TidyData.LN_PACE.bell.y, icon: 55 });
  e.c.residents[0].morale = 90; e.c.residents[1].morale = 10;
  e.td.mood[e.c.residents[0].id] = { insp: { day: e.s.day, kind: 'farmer' }, last: e.s.day, strike: 0 };
  e.pullLure(lure.id);
  for (const night of [false, true]) {
    e.s.minute = night ? 1380 : 600;
    for (const [w, hh] of [[1366, 600], [1920, 900], [390, 480], [844, 240]]) { context.inspect().renderer.resize(w, hh, 1); context.step((clock += 20)); }
  }
  context.inspect().renderer.resize(1366, 600, 1);
  // 存档
  click('save'); assert.notEqual(context.inspect().menu, 'saveFail');
  const back = Campaign.Engine.parse(storage.get(Session.CAMPAIGN_SAVE));
  assert.equal(back.tidy.listing.length, e.td.listing.length); assert.equal(back.tidy.lathe.rush, e.td.lathe.rush); assert.equal(back.tidy.converted.told, true);
  console.log('Tidy controller passed: a v0.25 save restored from a file (retired buildings down with materials back, stall goods on the shipping box, overtime as a decree, the lathe off ammo, the 营地整顿 toast on the first frame), the build list without the retired three, E opening the solar card, the lure page that sounds it and a broken trap mended with a kit, the kit\'s own button in the bag, 明天 and the listing that sells by day, the mood card, decree costs and the missing ladder step, the lodger alert, the lathe rush, the bell/lure/mood marks drawn at four sizes by day and night, and save/parse.');
}

// v0.27.0「丰年」: a v0.26 save restored from a file (the canal's water level becomes stored water, the 丰年 notice on the first frame),
// the build list with the compost bin, E on the compost bin opens its page (pick the fertiliser, throw in fodder), E on the order board
// opens it (hand in an order, tear one), the farm board's water line and collection book, the water page (move a route up),
// the sprinkler's card switches it off and on, the coop card lets the chickens out, the seed picker's mystery pack, the plot card's
// fertiliser and early-harvest buttons, a giant radish hoed from its card, the night-raid alert, the giant crop, chickens in the field,
// the order board, compost bin and Lin's garden drawn at four sizes by day and night, save/parse.
{
  let clock = 19000000;
  const run = (n) => { for (let i = 0; i < n; i++) context.step((clock += 50)); };
  const press = (key) => { listeners.keydown({ key, target: { matches: () => false }, preventDefault() {}, repeat: false }); listeners.keyup({ key }); };
  dailyOn = false;
  // ---------- 一份 v0.26 的旧档，从文件恢复 ----------
  const old = new Tidy.Engine(Tidy.newGameState(), () => {});
  const sc = old.sc;
  sc.act = 7; sc.claimed = ['act1', 'supply', 'act2', 'act3', 'act4', 'act5', 'act6']; sc.choice = 'ration';
  sc.letters = ['act1', 'act2', 'act3', 'act4', 'act5', 'act6', 'act7']; sc.flags.well = sc.flags.camp = sc.flags.farmerFed = true; sc.camp = { x: 560, y: 735 };
  old.r.claimed = RebuildData.TASKS.slice(0, RebuildData.TASKS.findIndex((t) => t.id === 'network') + 1).map((t) => t.id); old.r.radio = true;
  old.o.hospital = 'water'; old.o.youke = true; old.o.lathe = { mode: 'parts', day: 0 };
  old.s.day = 9; old.s.minute = 600; if (old.feel?.open) old.feel.open.phase = 'done'; old.markGearIntro?.();
  old.f.canals.dug = [0, 1, 5, 9, 13, 14, 15]; old.f.canals.open = true; old.f.canals.level = 2;
  context.open('restoreArchive', { files: { old: old.serialize() } }); clean();
  click('restoreCandidate', '0'); click('applyImport');
  let e = context.inspect().engine;
  assert.equal(context.inspect().menu, null);
  assert.equal(e.bt.net.pool, 10, 'two levels of canal water became 10 stored');
  e.paused = false; if (e.dy) e.dy.pending = null; run(3);
  assert.ok(e.bt.intro.told, 'told on the first frame');
  context.open('outpost', { view: 'log' }); clean(); assert.match(html(), /丰年：水井、雨水桶/); click('close');
  context.open('build'); clean(); assert.ok(html().includes('<h3>堆肥桶</h3>'), 'the compost bin can be built'); click('close');
  e.s.region = 'farm'; e.assignRegion();
  const B = (type, x, y) => { const b = { id: 'bt-' + type + '-' + e.s.idCounter++, type, x, y, rotation: 0, hp: Data.BUILDINGS[type].hp }; e.s.buildings.push(b); e.navRevision++; return b; };
  // ---------- 堆肥桶：按 E ----------
  const bin = B('compost', 720, 640); e.s.storage.fodder = 7;
  Object.assign(e.s.player, { x: bin.x, y: bin.y + 30 }); run(2);
  assert.match(document.querySelector('#context').innerHTML, /堆肥桶/);
  press('e'); run(1);
  assert.equal(context.inspect().menu, 'outpost'); clean(); assert.match(html(), /<h2 id="modal-title">堆肥桶<\/h2>/);
  click('btCompKind', bin.id + '|care'); assert.equal(e.bt.compost[bin.id].kind, 'care');
  click('btCompAdd', bin.id + '|fodder|5'); assert.equal(e.bt.compost[bin.id].n, 5); assert.match(html(), /明早 06:00 出 1 袋提质肥/); click('close');
  // ---------- 订单板：按 E ----------
  Object.assign(e.s.player, { x: BountyData.ORDERS.spot.x, y: BountyData.ORDERS.spot.y + 24 }); run(2); press('e'); run(1);
  assert.equal(context.inspect().menu, 'outpost'); clean(); assert.match(html(), /<h2 id="modal-title">订单板<\/h2>/);
  const o = e.bt.orders.list[0]; assert.ok(o, 'three orders on the board');
  e.s.storage[o.item] = (e.s.storage[o.item] || 0) + o.n;
  click('close'); press('e'); run(1);
  click('btOrderGive', o.id); assert.ok(!e.bt.orders.list.includes(o)); assert.equal(e.bt.stats.orders, 1);
  click('btOrderTear', e.bt.orders.list[0].id); assert.equal(e.bt.orders.list.length, 1); click('close');
  // ---------- 告示牌：今天的水、图鉴；水网那一页 ----------
  context.open('outpost', { view: 'gBoard' }); clean(); assert.match(html(), /今天的水够浇/); assert.match(html(), /菜地图鉴/);
  click('bView', 'bWater'); clean(); assert.match(html(), /<h2 id="modal-title">水网<\/h2>/);
  const before = e.bt.net.order.join(','); click('btNet', 'tower:-1'); assert.notEqual(e.bt.net.order.join(','), before); click('close');
  // ---------- 设施卡：喷灌头开关、放鸡 ----------
  const spr = B('irrigation', 455, 520);
  context.open('building', { buildingId: spr.id }); clean(); assert.match(html(), /喷灌头/);
  click('btSprinkler', spr.id); assert.ok(e.bt.net.off.includes(spr.id)); click('btSprinkler', spr.id); assert.ok(!e.bt.net.off.includes(spr.id)); click('close');
  const coop = B('coop', 640, 760); e.c.animals.chicken = true; e.s.minute = 600;
  context.open('building', { buildingId: coop.id }); clean(); click('btChickens', 'out'); assert.ok(e.bt.chickens.out); assert.match(html(), /赶回窝里/); click('close');
  // ---------- 选种页：神秘种子包；这块田：肥、抢收 ----------
  const q = e.s.plots[40]; e.s.debris = e.s.debris.filter((d) => Math.hypot(d.x - q.x, d.y - q.y) >= 15); q.tilled = true; if (e.g.plots[q.id]) e.g.plots[q.id].w = 0;
  e.s.storage.seedMystery = 2;
  Object.assign(e.s.player, { x: q.x + 2, y: q.y + 6 }); run(2); press('e'); run(1);
  clean(); assert.match(html(), /种一包神秘种子（有 2 包）/); click('btMystery', String(q.id)); assert.ok(q.crop); assert.equal(context.inspect().menu, null);
  q.growth = Math.round(Data.CROPS[q.crop].grow * 0.8); e.s.storage.fertGrow = 1;
  context.open('outpost', { view: 'gPlot', id: String(q.id) }); clean(); assert.match(html(), /现在抢收/);
  click('btFert', q.id + '|grow'); assert.equal(e.bt.plots[q.id].fz, 'grow');
  click('btRush', String(q.id)); assert.equal(q.crop, null); assert.equal(context.inspect().menu, null);
  // ---------- 巨型萝卜：卡片上锄三下 ----------
  const four = [12, 13, 21, 22].map((i) => e.s.plots[i]);
  for (const p of four) { e.s.debris = e.s.debris.filter((d) => Math.hypot(d.x - p.x, d.y - p.y) >= 15); Object.assign(p, { tilled: true, crop: 'radish', growth: Data.CROPS.radish.grow, wateredDay: e.s.day, waterUnits: 1 }); e.bt.plots[p.id] = { gi: 'g1' }; }
  e.bt.giants.g1 = { crop: 'radish', ids: four.map((p) => p.id), day: e.s.day, hits: 0, lost: 0 };
  context.open('outpost', { view: 'gPlot', id: String(four[0].id) }); clean(); assert.match(html(), /锄一下（还要 3 下）/);
  // ---------- 画面：巨型作物、田里的鸡、订单板、堆肥桶，四种大小，白天和夜里；集市的菜园 ----------
  click('close');
  e.bt.compost[bin.id].out = 1;
  for (const night of [false, true]) {
    e.s.minute = night ? 1380 : 600;
    for (const [w, hh] of [[1366, 600], [1920, 900], [390, 480], [844, 240]]) { context.inspect().renderer.resize(w, hh, 1); context.step((clock += 20)); }
  }
  e.s.minute = 600;
  for (let k = 0; k < 3; k++) click('btGiant', String(four[k].id));
  assert.ok(!e.bt.giants.g1, 'three strokes and the giant is in'); assert.equal(e.s.storage.giant_radish || e.s.inventory.giant_radish, 1);
  // ---------- 警报栏：夜袭 ----------
  e.bt.raid = { day: e.s.day, n: 3, state: 'warned', report: '' }; run(4);
  assert.match(document.querySelector('#alert-bar').innerHTML, /菜地夜袭/);
  e.bt.raid.state = '';
  e.s.region = 'market'; e.enemies = e.s.enemies.market ||= []; e.assignRegion(); Object.assign(e.s.player, { x: BountyData.MARKET_GARDEN.x, y: BountyData.MARKET_GARDEN.y + 40 });
  for (const [w, hh] of [[1366, 600], [390, 480]]) { context.inspect().renderer.resize(w, hh, 1); context.step((clock += 20)); }
  context.inspect().renderer.resize(1366, 600, 1);
  e.s.region = 'farm'; e.enemies = e.s.enemies.farm ||= []; e.assignRegion();
  // 存档
  click('save'); assert.notEqual(context.inspect().menu, 'saveFail');
  const back = Campaign.Engine.parse(storage.get(Session.CAMPAIGN_SAVE));
  assert.equal(back.bounty.stats.orders, 1); assert.equal(back.bounty.compost[bin.id].kind, 'care'); assert.equal(back.bounty.intro.told, true);
  console.log('Bounty controller passed: a v0.26 save restored from a file (canal water became stored water, the 丰年 notice on the first frame), the compost bin in the build list and its page on E (fertiliser picked, fodder thrown in), the order board on E (an order handed in, one torn), the farm board\'s water line and collection book, the water page (a route moved up), the sprinkler card switching it off and on, chickens let out from the coop card, the mystery pack in the seed picker, fertiliser and early harvest on the plot card, a giant radish hoed from its card, the night-raid alert, giant crop/chickens/order board/compost bin/Lin\'s garden drawn at four sizes by day and night, and save/parse.');
}

// v0.28.0「热闹」: a v0.27 save restored from a file (the radio's own noise moves onto the meter, the 热闹 notice on the first frame),
// the noise chip on the bar, the build list with the medicine cabinet, E at the radio station (a scout command sent), E at Hong Shu
// (a run loaded and sent, the page while it is away), a tower card picking a path and upgrading, the fence card's nearby segments,
// a hurt resident's card treated with a medkit, the rooms page's comfort card, the plaza canteen served on foot (E at the stove,
// E at the guest), the harvest offering picked on the plaza page, the museum's 往事 case, Jiang Bo via E, the noise attack in the
// alert bar, neighbours, the airdrop, upgraded towers/fences/traps, guests and a carried dish drawn at four sizes by day and night,
// save/parse.
{
  let clock = 20000000;
  const run = (n) => { for (let i = 0; i < n; i++) context.step((clock += 50)); };
  const press = (key) => { listeners.keydown({ key, target: { matches: () => false }, preventDefault() {}, repeat: false }); listeners.keyup({ key }); };
  dailyOn = false;
  const SD = await import('../dist/seasons-data.js');
  // ---------- 一份 v0.27 的旧档，从文件恢复 ----------
  const old = new Bounty.Engine(Bounty.newGameState(), () => {});
  const sc = old.sc;
  sc.act = 7; sc.claimed = ['act1', 'supply', 'act2', 'act3', 'act4', 'act5', 'act6']; sc.choice = 'ration';
  sc.letters = ['act1', 'act2', 'act3', 'act4', 'act5', 'act6', 'act7']; sc.flags.well = sc.flags.camp = sc.flags.farmerFed = true; sc.camp = { x: 560, y: 735 };
  old.r.claimed = RebuildData.TASKS.slice(0, RebuildData.TASKS.findIndex((t) => t.id === 'network') + 1).map((t) => t.id); old.r.radio = true;
  old.o.hospital = 'water'; old.o.youke = true; old.o.lathe = { mode: 'parts', day: 0 };
  old.o.cargo = 'food'; old.o.convoy = { departs: 0, arrives: 0, escorted: true, spawned: false, foes: [], done: true, lost: false };
  old.s.day = 9; old.s.minute = 600; if (old.feel?.open) old.feel.open.phase = 'done'; old.markGearIntro?.();
  old.w.radio.noise = 3;
  context.open('restoreArchive', { files: { old: old.serialize() } }); clean();
  click('restoreCandidate', '0'); click('applyImport');
  let e = context.inspect().engine;
  assert.equal(context.inspect().menu, null);
  assert.equal(e.hn.noise.v, 3, "the radio's own noise moved onto the meter");
  assert.equal(e.w.radio.noise, 0);
  e.paused = false; if (e.dy) e.dy.pending = null; run(3);
  assert.ok(e.hn.intro.told, 'told on the first frame');
  context.open('outpost', { view: 'log' }); clean(); assert.match(html(), /热闹：营地里吵的事会攒「动静」/); click('close');
  // ---------- 顶栏的动静格 ----------
  const chip = document.querySelector('#noise-chip');
  assert.equal(chip.hidden, false); assert.equal(chip.textContent, '动静 3'); assert.match(chip.title, /0 点结算/);
  // ---------- 建造菜单：药柜（往事陈列柜要挑过才有） ----------
  context.open('build'); clean(); assert.ok(html().includes('<h3>药柜</h3>'), 'the medicine cabinet can be built'); assert.ok(!html().includes('<h3>往事陈列柜</h3>')); click('close');
  // ---------- 通信站：按 E，发电台指令 ----------
  e.s.region = 'farm'; e.assignRegion();
  e.c.energy = 30;
  Object.assign(e.s.player, { x: 1220, y: 420 }); run(4);
  assert.match(document.querySelector('#context').innerHTML, /通信站 · 听广播/);
  press('e'); run(1);
  assert.equal(context.inspect().menu, 'outpost'); clean(); assert.match(html(), /电台指令/); assert.doesNotMatch(html(), /满了会引来尸群/);
  click('hnCmd', 'scout'); assert.equal(e.c.energy, 30 - BustleData.RADIO_CMDS.scout.power); assert.match(html(), /今天的侦察/);
  click('hnCmd', 'scout'); assert.equal(e.c.energy, 30 - BustleData.RADIO_CMDS.scout.power, 'a second click waits for the cooldown');
  click('close'); run(4);
  assert.equal(chip.textContent, '动静 4'); assert.match(chip.className, /warn/);
  // ---------- 红薯：按 E，装车出发 ----------
  e.s.storage.potato = 14; e.s.storage.radish = 3;
  Object.assign(e.s.player, { x: 800, y: 760 }); run(4);
  assert.match(document.querySelector('#context').innerHTML, /红薯 · 跑商/);
  press('e'); run(1);
  assert.equal(context.inspect().menu, 'outpost'); clean(); assert.match(html(), /<h2 id="modal-title">红薯 · 跑商<\/h2>/); assert.match(html(), /去哪卖/);
  click('hnMuleLoad', 'potato:5'); click('hnMuleLoad', 'potato:5'); assert.equal(e.hn.mule.plan.load.potato, 10); assert.match(html(), /车上 <b>10\/20<\/b> 件/);
  click('hnMuleBack', 'parts'); assert.equal(e.hn.mule.plan.back, 'parts');
  click('hnMuleGo'); assert.ok(e.hn.mule.trip, 'Hong Shu is on the road'); assert.equal(context.inspect().menu, null);
  assert.equal(e.s.storage.potato, 4); assert.equal(e.s.storage.radish, 2);
  run(1); press('e'); run(1); clean(); assert.match(html(), /在路上/); assert.match(html(), /想跟车/); click('close');
  // ---------- 设施卡：瞭望塔选路线、改；围栏一起改 ----------
  const B = (type, x, y) => { const b = { id: 'hn-' + type + '-' + e.s.idCounter++, type, x, y, rotation: 0, hp: Data.BUILDINGS[type].hp }; e.s.buildings.push(b); e.navRevision++; return b; };
  const tower = B('tower', 1180, 300);
  e.c.researchCredits = 2; e.s.storage.parts = (e.s.storage.parts || 0) + 3;
  context.open('building', { buildingId: tower.id }); clean(); assert.match(html(), /改良（二选一）/);
  click('hnUpPath', 'tower:light'); assert.equal(e.upPath('tower'), 'light'); assert.match(html(), /改成「探照灯」/);
  click('hnUpBuild', tower.id); assert.equal(tower.hnUp, 'light'); assert.match(html(), /这座已经改成「探照灯」/); click('close');
  const fences = [0, 1, 2, 3].map((i) => B('fence', 940 + i * 40, 250));
  e.unlockPath('fence', 'barb'); e.s.storage.scrap = (e.s.storage.scrap || 0) + 10;
  context.open('building', { buildingId: fences[0].id }); clean(); assert.match(html(), /附近还没改的 4 段一起改/);
  click('hnUpFences', fences[0].id); assert.ok(fences.every((f) => f.hnUp === 'barb')); click('close');
  const trap = B('trap', 1320, 520); trap.hnUp = 'net'; e.hn.up.trap = 'net';
  // ---------- 伤员：居民卡上用药包 ----------
  for (const id of ['farmer', 'medic']) e.recruit(id);
  B('bed', 700, 330);
  e.injure('r:farmer', '阿禾', '守夜时被感染者摸到'); e.s.storage.medkit = 1; run(4);
  assert.match(document.querySelector('#alert-bar').innerHTML, /1 人受伤/);
  context.open('rebuild', { tab: 'residents' }); clean(); assert.match(html(), /受伤了：还要养 48 个钟点/);
  click('hnTreat', 'r:farmer|medkit'); assert.equal(e.hn.hurt['r:farmer'].care, 'medkit'); assert.ok(!e.s.storage.medkit); click('close');
  // ---------- 农舍「房间与家具」：舒适度 ----------
  const floor = B('floor', 420, 360); B('chair', 440, 360); B('lamp', 400, 340); B('table', 440, 390); B('bed', 400, 395);
  context.open('frontier', { tab: 'rooms' }); clean(); assert.match(html(), /舒适度和「休息好」/); assert.match(html(), /舒适度 4\/9/); // v0.29：旧物摆件也算一类家具，最多 9
  assert.match(html(), /data-action="build" data-id="medCabinet"/); click('close');
  void floor;
  // ---------- 广场：节庆挑供品；食堂走着端菜上菜 ----------
  e.ss.he.stage = 4; e.s.day = 21; e.s.minute = 16 * 60 + 10; e.c.workClock = 10;
  Object.assign(e.s.storage, { fine_pumpkin: 2, fine_herb: 2, fine_cotton: 2, potato: 4, radish: 4 });
  Object.assign(e.s.player, { x: SD.SSPOTS.plaza.x, y: SD.SSPOTS.plaza.y + 20 }); run(2);
  press('e'); run(1); assert.equal(context.inspect().menu, 'outpost'); clean(); assert.match(html(), /挑三样菜去评比/);
  for (const id of ['fine_pumpkin', 'fine_herb', 'fine_cotton']) click('hnFestPick', id);
  assert.match(html(), /满堂彩/);
  click('sHost'); assert.ok(e.festivalHosted(21)); assert.ok(!e.s.storage.fine_pumpkin, 'the picked offering was paid'); click('close');
  e.s.day = 23; e.s.minute = 19 * 60 + 2; e.c.workClock = 2;
  Object.assign(e.s.storage, { stew: 4, bread: 6, jam: 2, beanMeal: 2, herbTea: 2 });
  run(2); press('e'); run(1); clean(); click('sCanteen'); assert.ok(e.ss.canteen.night); assert.match(html(), /不开菜单/); click('close');
  const stove = e.objects.find((o) => o.type === 'hnStove');
  Object.assign(e.s.player, { x: stove.x, y: stove.y + 16 }); run(4);
  assert.match(document.querySelector('#context').innerHTML, /何大勺的灶台 · 端菜/);
  press('e'); run(1); assert.ok(e.hn.carry, 'a dish in hand'); assert.equal(context.inspect().menu, null);
  const g = e.ss.canteen.night.customers.find((x) => x.id === e.hn.carry.guest), gi = e.ss.canteen.night.customers.indexOf(g), seat = e.guestSeat(gi);
  Object.assign(e.s.player, { x: seat.x, y: seat.y + 12 }); run(2);
  const money = e.s.money; press('e'); run(1);
  assert.equal(g.state, 'served'); assert.ok(e.s.money > money); assert.equal(e.hn.carry, null);
  // ---------- 档案馆：往事一柜 ----------
  e.w.museum.built = true;
  context.open('outpost', { view: 'museum' }); clean(); assert.match(html(), /<h3>往事<\/h3>/); assert.doesNotMatch(html(), /<h3>旧日志<\/h3>|<h3>老照片<\/h3>/); click('close');
  // ---------- 江伯：按 E ----------
  e.ss.jiang.phase = 'done'; e.fishSince(); e.ss.canteen.night = null; e.assignRegion();
  Object.assign(e.s.player, { x: BustleData.FISH_RUN.spot.x, y: BustleData.FISH_RUN.spot.y + 20 }); run(4);
  assert.match(document.querySelector('#context').innerHTML, /江伯 · /);
  press('e'); run(1); assert.equal(context.inspect().menu, 'outpost'); clean(); assert.match(html(), /<h2 id="modal-title">江伯 · 鱼汛<\/h2>/); click('close');
  // ---------- 循声来的感染者：警报；邻居、空投、探照灯、端着的菜，四种大小，白天和夜里 ----------
  e.hn.noise.v = 6.5; e.s.minute = 19 * 60; run(4);
  assert.match(document.querySelector('#alert-bar').innerHTML, /今夜 0 点会有 6 只循声摸来/);
  e.hn.help = { armed: false, day: e.s.day, live: true, allies: BustleData.ALLY.names.map((name, i) => ({ id: 'a' + i, name, look: BustleData.ALLY.looks[i], x: 1240 + i * 30, y: 470, hp: BustleData.ALLY.hp - 30 * i, down: false, cd: 0, facing: 0 })) };
  e.hn.carry = { dish: 'stew', guest: 'g0' };
  e.ss.canteen.night = { day: e.s.day, customers: [], spawned: 0, nextIn: 20, income: 0, score: 0, served: 0, wrong: 0, missed: 0, max: 4 };
  e.ln.night = null;
  for (const night of [false, true]) {
    e.s.minute = night ? 1380 : 600;
    for (const [w, hh] of [[1366, 600], [1920, 900], [390, 480], [844, 240]]) { context.inspect().renderer.resize(w, hh, 1); context.step((clock += 20)); }
  }
  context.inspect().renderer.resize(1366, 600, 1);
  e.ss.canteen.night = null; e.hn.carry = null; e.hn.help = { armed: false, day: 0, live: false, allies: [] };
  // 空投箱在废墟里
  e.c.energy = 20; e.s.minute = 600;
  const reg = e.dropRegions()[0];
  if (reg) {
    e.radioCmd('drop'); const d = e.hn.drop;
    e.s.region = d.region; e.enemies = e.s.enemies[d.region] ||= []; e.assignRegion(); Object.assign(e.s.player, { x: d.x, y: d.y + 40 });
    for (const [w, hh] of [[1366, 600], [390, 480]]) { context.inspect().renderer.resize(w, hh, 1); context.step((clock += 20)); }
    context.inspect().renderer.resize(1366, 600, 1);
    e.s.region = 'farm'; e.enemies = e.s.enemies.farm ||= []; e.assignRegion();
  }
  // 存档
  click('save'); assert.notEqual(context.inspect().menu, 'saveFail');
  const back = Campaign.Engine.parse(storage.get(Session.CAMPAIGN_SAVE));
  assert.equal(back.bustle.up.tower, 'light'); assert.equal(back.bustle.mule.trip.load.potato, 10); assert.equal(back.bustle.intro.told, true);
  assert.equal(back.bustle.hurt['r:farmer'].care, 'medkit');
  console.log('Bustle controller passed: a v0.27 save restored from a file (the radio noise on the meter, the 热闹 notice on the first frame), the noise chip, the medicine cabinet in the build list, E at the radio station sending a scout command (the cooldown holds a second click), E at Hong Shu loading and sending a run and showing it on the road, a tower card picking the searchlight and upgrading, four fence segments barbed in one go, a hurt resident treated from the residents page, the comfort card on the rooms page, the harvest offering picked and paid on the plaza, the canteen served on foot (E at the stove, E at the guest), the museum\'s 往事 case, Jiang Bo via E, the noise warning in the alert bar, neighbours, the airdrop, upgraded towers/fences/traps and a carried dish drawn at four sizes by day and night, and save/parse.');
}

// v0.29.0「四时」: a v0.28 save restored from a file (the cold snap moved onto the cold season, the 四时 notice on the first frame),
// the HUD date with the season, the date button opening the calendar with the four seasons, the farm board's season section,
// the seed picker's in/out of season tags, the radio page with today's luck, the build list with the jars and trees (the decor only
// once owned), a pickle jar filled and taken through its card, the coop card petting the flock, an old tree in the residential yards
// cut with E and a peach tree grafted through the build flow, a decor picked from its build card and placed, forage picked with E,
// mushrooms sorted by 许医生 from her card, a parcel at the door opened with E, the morning ledger after sleeping (held while a
// page is open, shown after, a click hides it), jars/trees/decor/forage/old trees/debris/parcel drawn at four sizes by day and night
// in all four seasons, and save/parse.
{
  let clock = 21000000;
  const run = (n) => { for (let i = 0; i < n; i++) context.step((clock += 50)); };
  const press = (key) => { listeners.keydown({ key, target: { matches: () => false }, preventDefault() {}, repeat: false }); listeners.keyup({ key }); };
  dailyOn = false;
  const AL = await import('../dist/almanac-data.js');
  const Bustle = await import('../dist/bustle.js');
  const B = (e, type, x, y, extra = {}) => { const b = { id: 'al-' + type + '-' + e.s.idCounter++, type, x, y, rotation: 0, hp: Data.BUILDINGS[type].hp, ...extra }; e.s.buildings.push(b); e.navRevision++; return b; };
  const spotFor = (e, type, cx = 760, cy = 620) => { for (let r = 60; r < 600; r += 16) for (let a = 0; a < 6.28; a += 0.3) { const x = Math.round((cx + Math.cos(a) * r) / 8) * 8, y = Math.round((cy + Math.sin(a) * r) / 8) * 8; Object.assign(e.s.player, { x, y: y + Math.max(40, e.buildingRect(type, x, y).h / 2 + 24) }); if (!e.buildReason(type, x, y)) return { x, y }; } return null; };
  // ---------- 一份 v0.28 的旧档，从文件恢复 ----------
  const old = new Bustle.Engine(Bustle.newGameState(), () => {});
  const sc = old.sc;
  sc.act = 7; sc.claimed = ['act1', 'supply', 'act2', 'act3', 'act4', 'act5', 'act6']; sc.choice = 'ration';
  sc.letters = ['act1', 'act2', 'act3', 'act4', 'act5', 'act6', 'act7']; sc.flags.well = sc.flags.camp = sc.flags.farmerFed = true; sc.camp = { x: 560, y: 735 };
  old.r.claimed = RebuildData.TASKS.slice(0, RebuildData.TASKS.findIndex((t) => t.id === 'network') + 1).map((t) => t.id); old.r.radio = true;
  old.o.hospital = 'water'; old.o.youke = true; old.o.lathe = { mode: 'parts', day: 0 };
  old.o.cargo = 'food'; old.o.convoy = { departs: 0, arrives: 0, escorted: true, spawned: false, foes: [], done: true, lost: false };
  old.s.day = 18; old.s.minute = 600; if (old.feel?.open) old.feel.open.phase = 'done'; old.markGearIntro?.();
  old.bt.cold.next = 40;
  old.s.visited = { ...(old.s.visited || {}), residential: true };
  context.open('restoreArchive', { files: { old: old.serialize() } }); clean();
  click('restoreCandidate', '0'); click('applyImport');
  let e = context.inspect().engine;
  assert.equal(context.inspect().menu, null);
  assert.ok(e.al && e.al.intro, 'the 四时 record was added to the old save');
  assert.equal(e.bt.cold.next, AL.coldStartFrom(40), 'the cold snap waits for the cold season');
  e.paused = false; if (e.dy) e.dy.pending = null; run(3);
  assert.ok(e.al.intro.told, 'told on the first frame');
  context.open('outpost', { view: 'log' }); clean(); assert.match(html(), /四时：一年 28 天/); click('close');
  // ---------- 顶栏的日期 ----------
  const date = document.querySelector('#date');
  assert.equal(date.textContent, '第 18 天 · 秋收'); assert.match(date.title, /第 1 年 · 秋收第 4 天（还有 4 天到寒潮）/);
  // ---------- 点日期：日历和四个时节 ----------
  click('sView', 'calendar'); clean(); assert.match(html(), /现在是秋收第 4 天/); assert.match(html(), /当季菜：栗子焖南瓜/); assert.match(html(), /<span class="tag gold">寒潮时节<\/span>/); click('close');
  // ---------- 告示牌、选种 ----------
  context.open('outpost', { view: 'gBoard' }); clean(); assert.match(html(), /秋收第 4 天：这一季种什么/); click('close');
  const q = e.s.plots[41]; e.s.debris = e.s.debris.filter((d) => Math.hypot(d.x - q.x, d.y - q.y) >= 15); q.tilled = true; q.crop = null; if (e.g.plots[q.id]) e.g.plots[q.id].w = 0;
  e.s.inventory.seedRadish = 2;
  Object.assign(e.s.player, { x: q.x + 2, y: q.y + 6 }); run(2); press('e'); run(1);
  clean(); assert.match(html(), /当季 快 15% · 多收 1 份/); click('close');
  // ---------- 电台：今天的签 ----------
  context.open('outpost', { view: 'radio' }); clean(); assert.match(html(), /早间广播（每天 07:00）/); assert.match(html(), /今天的手气签：/); click('close');
  // ---------- 建造菜单：腌缸、土酒坛、四种果树；摆件要有了才出现 ----------
  context.open('build'); clean();
  for (const n of ['腌缸', '土酒坛', '嫁接桃树', '嫁接柿子树']) assert.ok(html().includes('<h3>' + n + '</h3>'), n);
  assert.ok(!html().includes('<h3>旧物摆件</h3>'), 'no decor entry before you own one');
  assert.match(html(), /枝条去废弃居民区/); click('close');
  // ---------- 腌缸：放下、按 E 装缸、过几天取 ----------
  e.s.storage.stone = (e.s.storage.stone || 0) + 8; e.s.storage.wood = (e.s.storage.wood || 0) + 12; e.s.storage.radish = 6;
  context.open('build'); click('build', 'alPickleJar'); assert.equal(e.buildMode, 'alPickleJar'); assert.equal(context.inspect().menu, null);
  let spot = spotFor(e, 'alPickleJar'); assert.ok(spot); assert.ok(e.placeBuilding(spot.x, spot.y)); e.buildMode = null;
  const jar = e.s.buildings.at(-1); assert.equal(jar.type, 'alPickleJar');
  Object.assign(e.s.player, { x: jar.x, y: jar.y + 26 }); run(4);
  assert.match(document.querySelector('#context').innerHTML, /腌缸 · 空着/);
  press('e'); run(1); assert.equal(context.inspect().menu, 'building'); clean();
  click('alJarFill', jar.id + '|radish'); assert.equal(e.al.jars[jar.id]?.item, 'radish'); assert.match(html(), /还要 3 天能取/); click('close');
  e.al.jars[jar.id].start -= 3; run(4);
  assert.match(document.querySelector('#alert-bar').innerHTML, /腌缸能取了/);
  context.open('building', { buildingId: jar.id }); clean(); click('alJarTake', jar.id); assert.equal(e.qty('alPickle', true), 4); click('close');
  // ---------- 鸡舍：摸一摸 ----------
  const coop = B(e, 'coop', 980, 860); e.c.animals.chicken = true;
  context.open('building', { buildingId: coop.id }); clean(); assert.match(html(), /牲口亲近/);
  click('alHerdPet', 'flock'); assert.equal(e.al.herd.flock.pts, AL.HERD.pet); assert.match(html(), /今天已经摸过了/); click('close');
  // ---------- 居民区：老果树按 E 剪枝条；回农场嫁接 ----------
  e.s.region = 'residential'; e.enemies = e.s.enemies.residential ||= []; for (const z of e.enemies) z.dead = true; e.enemies = e.s.enemies.residential = []; e.assignRegion();
  const oldPeach = e.objects.find((o) => o.type === 'alOldTree' && o.tree === 'peach'); assert.ok(oldPeach);
  Object.assign(e.s.player, { x: oldPeach.x, y: oldPeach.y + 20 }); run(4);
  assert.match(document.querySelector('#context').innerHTML, /老桃树 · 剪枝条/);
  press('e'); run(1); assert.equal(e.qty(AL.cuttingId('peach'), true), 1);
  for (const [w, hh] of [[1366, 600], [390, 480]]) { context.inspect().renderer.resize(w, hh, 1); context.step((clock += 20)); }
  context.inspect().renderer.resize(1366, 600, 1);
  e.s.region = 'farm'; e.enemies = e.s.enemies.farm ||= []; e.assignRegion();
  e.s.storage.manure = (e.s.storage.manure || 0) + 2;
  context.open('build'); clean(); click('build', AL.treeType('peach')); assert.equal(e.buildMode, AL.treeType('peach'));
  spot = spotFor(e, AL.treeType('peach'), 900, 700); assert.ok(spot); assert.ok(e.placeBuilding(spot.x, spot.y)); e.buildMode = null;
  const tree = e.s.buildings.at(-1); assert.deepEqual(e.al.trees[tree.id], { planted: e.s.day, fruit: 0, stop: 0, winters: 0 });
  context.open('building', { buildingId: tree.id }); clean(); assert.match(html(), /还要 14 天长成/); click('close');
  // ---------- 旧物摆件：有了才出现，在建设页挑一件摆 ----------
  e.add({ [AL.decorItem('globe')]: 1, [AL.decorItem('phono')]: 1 }); run(1);
  context.open('build'); clean(); assert.ok(html().includes('<h3>旧物摆件</h3>')); assert.match(html(), /data-action="alDecorPick" data-id="globe"/);
  click('alDecorPick', 'globe'); assert.equal(e.buildMode, 'alDecor'); assert.equal(context.inspect().menu, null);
  spot = spotFor(e, 'alDecor', 1100, 700); assert.ok(spot); assert.ok(e.placeBuilding(spot.x, spot.y)); e.buildMode = null;
  const deco = e.s.buildings.at(-1); assert.equal(deco.decor, 'globe'); assert.equal(e.qty(AL.decorItem('globe'), true), 0);
  context.open('building', { buildingId: deco.id }); clean(); assert.match(html(), /国名都还在/); click('close');
  // ---------- 野物：按 E 捡 ----------
  e.forageSpawn(e.s.day); if (!e.al.forage.spots.some((p) => p.region === 'farm')) Object.assign(e.al.forage.spots[0], { region: 'farm', i: 0 }); e.forageObjects();
  const fo = e.objects.find((o) => o.type === 'alForage'); assert.ok(fo);
  Object.assign(e.s.player, { x: fo.x, y: fo.y + 4 }); run(3);
  assert.match(document.querySelector('#context').innerHTML, /捡起来/);
  const had = e.qty(fo.item, true); press('e'); run(1); assert.ok(e.qty(fo.item, true) > had);
  // ---------- 许医生认蘑菇 ----------
  e.recruit('medic'); e.add({ [AL.MUSHROOM.raw]: 3 });
  context.open('rebuild', { tab: 'residents' }); clean(); assert.match(html(), /认蘑菇（3 朵）/);
  click('alMushroom'); assert.equal(e.qty(AL.MUSHROOM.raw, true), 0); click('close');
  // ---------- 门口的包裹：按 E 打开 ----------
  e.al.good = { day: e.s.day, kind: 'parcel', taken: false, items: { bandage: 2, cloth: 2 }, x: AL.NIGHT_GOOD.door.x, y: AL.NIGHT_GOOD.door.y, note: '门口多了个包裹，不知道是谁夜里放下的' };
  e.goodObjects(); run(4);
  assert.match(document.querySelector('#alert-bar').innerHTML, /门口有个包裹/);
  const parcel = e.objects.find((o) => o.type === 'alParcel'); assert.ok(parcel);
  Object.assign(e.s.player, { x: parcel.x, y: parcel.y + 4 }); run(3);
  const band = e.qty('bandage', true); press('e'); run(1); assert.equal(e.qty('bandage', true), band + 2); assert.ok(e.al.good.taken);
  // ---------- 睡醒的账本：开着页面就等着，关了再出来，点一下收起 ----------
  // 夜里偶尔出事（随机的偷菜、夜袭……）的早上照规矩弹日终总结、不出账本：那就再睡一晚，直到一个平安的早上
  const led = document.querySelector('#ledger');
  let summaryMorning = true;
  for (let night = 0; night < 4 && summaryMorning; night++) {
    // 第二晚起：早上那张今日抉择被“稍后再选”压着、时间又是直接拨到 21:00 的（没走过中午），不先清掉睡觉会先弹它
    e.s.storage.bread = (e.s.storage.bread || 0) + 80; e.s.minute = 21 * 60; e.c.workClock = 0; if (night && e.dy) e.dy.pending = null;
    context.open('home'); click('sleep'); run(2);
    summaryMorning = false;
    for (let i = 0; i < 6 && context.inspect().menu; i++) { if (/日终总结/.test(html())) summaryMorning = true; if (e.dailyCard?.()) e.dailyLater?.(); click('close'); run(1); }
    run(2);
    // 前一天还开着的小卡片（读档那天的“重光”）换了一天就淡出：浏览器里 0.4 秒后藏起来；这里的 setTimeout 不走，只看得到它在淡出，
    // 替它藏起来（不然下一个早上的账本排在它后面出不来）。老琴抽到下签的早上——一成五的机会——早间广播是 warn，照规矩弹日终总结，
    // 原来这一项就在这种早上偶尔挂
    const fading = /(^|\s)out(\s|$)/.test(led.className);
    if (summaryMorning) assert.ok(led.hidden || fading, 'no ledger on a summary morning');
    if (fading) { led.hidden = true; led.classList.remove('out'); run(1); }
  }
  assert.equal(summaryMorning, false, 'a calm morning within four nights');
  assert.equal(context.inspect().menu, null);
  assert.equal(led.hidden, false, 'the ledger shows once the pages are closed');
  assert.match(led.innerHTML, /第 \d+ 天的账/); assert.match(led.innerHTML, /夜里：/); assert.match(led.innerHTML, /今天：/);
  led.events.click(); assert.match(led.className, /out/);
  // ---------- 画面：四个时节，白天和夜里，四种大小 ----------
  e.s.region = 'farm'; e.enemies = e.s.enemies.farm ||= []; e.assignRegion();
  B(e, 'alWineJar', 640, 860); B(e, 'alDecor', 700, 900, { decor: 'neon' }); B(e, 'alDecor', 740, 900, { decor: 'lion' });
  const t2 = B(e, AL.treeType('apple'), 820, 900); e.al.trees[t2.id] = { planted: 1, fruit: 3, stop: 0, winters: 2 };
  e.al.jars[e.s.buildings.find((b) => b.type === 'alWineJar').id] = { item: 'rye', n: 4, start: e.s.day - 11 };
  e.al.good = { day: e.s.day, kind: 'debris', taken: false, x: 900, y: 760, note: '一块卫星残骸' }; e.goodObjects();
  e.forageSpawn(e.s.day); e.forageObjects();
  Object.assign(e.s.player, { x: 760, y: 860 });
  for (const day of [3, 10, 17, 24]) {
    e.s.day = day;
    for (const night of [false, true]) {
      e.s.minute = night ? 1380 : 600;
      for (const [w, hh] of [[1366, 600], [1920, 900], [390, 480], [844, 240]]) { context.inspect().renderer.resize(w, hh, 1); context.step((clock += 20)); }
    }
  }
  context.inspect().renderer.resize(1366, 600, 1);
  e.s.minute = 600;
  // 存档
  click('save'); assert.notEqual(context.inspect().menu, 'saveFail');
  const back = Campaign.Engine.parse(storage.get(Session.CAMPAIGN_SAVE));
  assert.equal(back.almanac.intro.told, true); assert.ok(back.almanac.trees[tree.id]);
  // 摸过的亲近读回来一样（日终总结的早上多睡了一晚的话，亲近每天会掉一点，所以和眼下的比）
  assert.equal(back.almanac.herd.flock.pts, e.al.herd.flock.pts);
  assert.equal(back.buildings.find((b) => b.id === deco.id)?.decor, 'globe');
  console.log('Almanac controller passed: a v0.28 save restored from a file (the cold snap moved onto the cold season, the 四时 notice on the first frame), the HUD date with the season, the date button opening the calendar with the four seasons, the farm board\'s season section, the seed picker\'s in-season tag, the radio page with today\'s luck, the build list with the jars and trees (the decor only once owned), a pickle jar placed, filled with E and taken, the coop card petting the flock, an old peach tree cut with E and a peach grafted through the build flow, a decor picked from its build card and placed, forage picked with E, mushrooms sorted from 许医生\'s card, a parcel at the door opened with E, the morning ledger after sleeping (held behind pages, shown after, a click hides it), jars/trees/decor/forage/old trees/debris drawn at four sizes by day and night in all four seasons, and save/parse.');
}

// v0.30.0「人情」: a v0.29 save restored from a file (the old likes stay known, the 人情 notice on the first frame), the people page
// saying where everyone is with a marker button, a gift given in person from the people page, 阿禾 waiting at the field on a calm
// evening and the heart talk opened with E, the second talk sending you to a marked cupboard in the residential ruin (E takes it),
// the lantern night's lamps lit with E, a mother at the farmhouse door answered with E and the child taken in, fishing at the
// valley river (E casts, E on the bite starts the reel, holding E reels in, the reel card and the 收线 label, the touch button
// reeling the same way), 许医生 testing the water sample from the residents page, the fish book, the ring given and said at the
// fire with E, the feast paid on the plaza, lamps/the child/the waiting mother/the water stakes/the marked cupboard/the partner at
// your side/the fishing line/the "…" over someone with something to say/the sandbags drawn at four sizes by day and night, and save/parse.
{
  let clock = 23000000;
  const run = (n) => { for (let i = 0; i < n; i++) context.step((clock += 50)); };
  const keydown = (key) => listeners.keydown({ key, target: { matches: () => false }, preventDefault() {}, repeat: false });
  const press = (key) => { keydown(key); listeners.keyup({ key }); };
  // 交互那一行由 HUD 每 0.12 秒刷一次，两帧（0.1 秒）不一定刷得到：读之前先刷一下
  const ctxLine = () => (context.hud(), document.querySelector('#context').innerHTML);
  const goTo = (e, region, x, y) => { e.s.visited = { ...(e.s.visited || {}), [region]: true }; e.s.region = region; e.enemies = e.s.enemies[region] = (e.s.enemies[region] || []).filter((z) => !z.dead && false); e.assignRegion(); if (x != null) Object.assign(e.s.player, { x, y }); };
  dailyOn = false;
  const KD = await import('../dist/kin-data.js');
  const KS = await import('../dist/kin-story.js');
  const Almanac = await import('../dist/almanac.js');
  // ---------- 一份 v0.29 的旧档，从文件恢复 ----------
  const old = new Almanac.Engine(Almanac.newGameState(), () => {});
  const sc = old.sc;
  sc.act = 8; sc.claimed = ['act1', 'supply', 'act2', 'act3', 'act4', 'act5', 'act6', 'act7']; sc.choice = 'ration';
  sc.letters = ['act1', 'act2', 'act3', 'act4', 'act5', 'act6', 'act7', 'act8']; sc.flags.well = sc.flags.camp = sc.flags.farmerFed = true; sc.camp = { x: 560, y: 735 };
  old.r.claimed = RebuildData.TASKS.slice(0, RebuildData.TASKS.findIndex((t) => t.id === 'broadcast') + 1).map((t) => t.id); old.r.radio = true;
  old.o.hospital = 'water'; old.o.youke = true; old.o.lathe = { mode: 'parts', day: 0 }; old.o.toll = 'refuse'; old.o.raid.phase = 'won';
  old.assignRegion();
  for (const id of ['farmer', 'medic', 'mechanic']) old.recruit(id);
  old.addHelper('tieqiao');
  old.addCrew({ id: 'youke', name: '尤可', trait: 'nightowl', role: 'build', look: 'youke' });
  Object.assign(old.ss.he, { stage: 4 }); Object.assign(old.ss.jiang, { phase: 'done', rod: 2 }); Object.assign(old.ss.laoqin, { met: true, quest: true });
  for (let i = 0; i < 3; i++) old.s.buildings.push({ id: 'kb' + i, type: 'bed', x: 240 + i * 56, y: 980, rotation: 0, hp: 90, open: false });
  old.s.day = 20; old.s.minute = 600; old.s.weather = '晴朗'; if (old.feel?.open) old.feel.open.phase = 'done'; old.markGearIntro?.();
  old.s.visited = { ...(old.s.visited || {}), residential: true, valley: true };
  old.s.storage.bread = 60; old.s.storage.jam = 3;
  context.open('restoreArchive', { files: { old: old.serialize() } }); clean();
  click('restoreCandidate', '0'); click('applyImport');
  let e = context.inspect().engine;
  assert.equal(context.inspect().menu, null);
  assert.ok(e.kin && e.kin.intro, 'the 人情 record was added to the old save');
  assert.equal(e.kin.know.farmer.jam, 'like', 'what the old page showed is still known');
  e.paused = false; if (e.dy) e.dy.pending = null; run(3);
  assert.ok(e.kin.intro.told, 'told on the first frame');
  context.open('outpost', { view: 'log' }); clean(); assert.match(html(), /人情：送礼要猜/); click('close');
  // ---------- 人物关系：这会儿在哪、标出位置 ----------
  goTo(e, 'farm', 300, 900);
  context.open('outpost', { view: 'people' }); clean();
  assert.match(html(), /这会儿：/); assert.match(html(), /data-action="kinMark" data-id="he"/);
  assert.doesNotMatch(html(), /data-action="kinGift" data-id="farmer\|/, 'no gift button from across the farm');
  click('kinMark', 'he'); assert.equal(e.guidance.target.label, '何大勺'); assert.equal(context.inspect().menu, null);
  // ---------- 送礼：走到跟前，人物页上送 ----------
  const rf = e.resident('farmer');
  Object.assign(e.s.player, { x: rf.x, y: rf.y + 24 });
  context.open('outpost', { view: 'people' }); clean();
  assert.match(html(), /data-action="kinGift" data-id="farmer\|jam"/);
  const t0 = e.ss.trust.farmer || 0;
  click('kinGift', 'farmer|jam'); assert.equal(e.ss.trust.farmer, t0 + 1); assert.equal(e.kin.gifts.farmer.length, 1); click('close');
  // ---------- 心里话：信任到 3 的平安傍晚，阿禾在田边等，按 E ----------
  e.ss.trust.farmer = 3; e.s.minute = 19 * 60 - 0.5; e.c.workClock = 59.5; e.advanceMinutes(1);
  assert.deepEqual(rf.target, { x: KD.HEART_SPOTS.farmer.x, y: KD.HEART_SPOTS.farmer.y }, 'she walks to the field');
  Object.assign(rf, { x: KD.HEART_SPOTS.farmer.x, y: KD.HEART_SPOTS.farmer.y });
  run(2);
  assert.match(document.querySelector('#alert-bar').innerHTML, /阿禾在田边，像是有话想说/);
  Object.assign(e.s.player, { x: rf.x, y: rf.y + 22 }); run(2);
  assert.match(ctxLine(), /阿禾 · 像是有话想说/); assert.doesNotMatch(ctxLine(), /（）/);
  press('e'); run(1);
  assert.equal(context.inspect().menu, 'outpost'); clean(); assert.ok(html().includes(KS.HEARTS.farmer[0].title));
  click('kinHeartPick', 'farmer:0'); clean(); assert.match(html(), /替我记着/); assert.equal(e.heart('farmer').seg, 1); click('close');
  e.ss.trust.farmer = 6;
  context.open('outpost', { view: 'kinHeart', id: 'farmer' }); clean();
  click('kinHeartPick', 'farmer:1'); assert.equal(e.heart('farmer').req, 1); assert.match(html(), /废弃居民区/); click('close');
  // ---------- 废墟里那处记号：按 E 翻一翻 ----------
  goTo(e, 'residential');
  const cache = e.objects.find((o) => o.type === 'kinCache'); assert.ok(cache, 'the cupboard is marked');
  Object.assign(e.s.player, { x: cache.x, y: cache.y + 18 }); run(3);
  assert.match(ctxLine(), /阿禾家的橱柜 · 翻一翻/);
  press('e'); run(1); assert.equal(e.qty('kinSeedTin', true), 1);
  for (const [w, hh] of [[1366, 600], [390, 480]]) { context.inspect().renderer.resize(w, hh, 1); context.step((clock += 20)); }
  context.inspect().renderer.resize(1366, 600, 1);
  // ---------- 门口等着答复的过路人：按 E，收留孩子 ----------
  goTo(e, 'farm');
  e.s.minute = 10 * 60;
  e.ss.lodger = { name: '带外孙的刘婶', look: 1, gift: 'seeds', stay: false, phase: 'staying', day: e.s.day, qin: false };
  e.kin.ask = { name: '石榴', from: '刘婶', day: e.s.day, look: 1 };
  e.assignRegion();
  const ask = e.objects.find((o) => o.type === 'kinKidAsk'); assert.ok(ask);
  Object.assign(e.s.player, { x: ask.x, y: ask.y + 22 }); run(3);
  assert.match(ctxLine(), /刘婶和孩子 · 答复/);
  press('e'); run(1); assert.equal(context.inspect().menu, 'outpost'); clean(); assert.match(html(), /留下他/);
  click('kinKid', 'yes'); assert.equal(e.kin.kids.length, 1); assert.equal(e.kin.kids[0].name, '石榴'); assert.equal(context.inspect().menu, null);
  // ---------- 灯火夜：按 E 点亮路灯 ----------
  e.s.day = 28 + 14; e.s.minute = 16 * 60 + 30; run(2);
  const lamp = e.objects.find((o) => o.type === 'kinLamp' && o.lamp === 0); assert.ok(lamp, 'the lamps are up on the lantern night');
  Object.assign(e.s.player, { x: lamp.x, y: lamp.y + 20 }); run(3);
  assert.match(ctxLine(), /路灯 · 点亮（0\/6）/);
  press('e'); run(1); assert.deepEqual(e.kin.fest.lamps, [0]);
  // ---------- 收线钓鱼：溪谷的河 ----------
  e.s.day = 28 + 15; e.s.minute = 9 * 60;
  goTo(e, 'valley');
  const stake = e.objects.find((o) => o.type === 'kinWater' && o.water === 'river'); assert.ok(stake);
  Object.assign(e.s.player, { x: stake.x, y: stake.y + 16 }); run(3);
  assert.match(ctxLine(), /溪谷的河 · 钓鱼/);
  press('e'); run(1); assert.equal(e.kin.cast?.water, 'river');
  for (let i = 0; i < 200 && e.c.fishing?.phase !== 'bite'; i++) run(1);
  assert.equal(e.c.fishing?.phase, 'bite');
  keydown('e'); run(1);
  assert.ok(e.reeling(), 'E on the bite starts the reel');
  const card = document.querySelector('#reel'), ti = document.querySelector('#touch-interact');
  assert.equal(card.hidden, false); assert.match(card.innerHTML, /鱼线/); assert.match(card.innerHTML, /收回/); assert.equal(ti.textContent, '收线');
  assert.doesNotMatch(card.innerHTML, /undefined|NaN/);
  let p0 = e._reel.prog; run(5); assert.ok(e._reel && e._reel.prog > p0, 'holding E reels in');
  listeners.keyup({ key: 'e' }); run(2);
  Object.assign(e._reel, { prog: 0.995, pull: 0, tense: 0.2, next: 9 });
  keydown('e'); run(1); listeners.keyup({ key: 'e' }); run(1);
  assert.ok(!e.reeling(), 'landed'); assert.equal(card.hidden, true);
  // v0.39：触屏的交互按钮写着面前那一样做什么（站在河边就是“钓鱼”）
  assert.notEqual(ti.textContent, '收线'); assert.match(ti.textContent, /^(交互|钓鱼)$/);
  assert.equal(Object.values(e.kin.fish).reduce((a, b) => a + b, 0), 1);
  assert.equal(e.qty(KD.SAMPLES.river, true), 1, 'a water sample with the first river fish');
  // 手机：点「交互」提竿，按住「收线」
  press('e'); run(1); assert.equal(e.kin.cast?.water, 'river');
  for (let i = 0; i < 200 && e.c.fishing?.phase !== 'bite'; i++) run(1);
  listeners.click({ target: ti, detail: 1 }); run(1);
  assert.ok(e.reeling(), 'the touch button lifts the rod');
  ti.events.pointerdown({ preventDefault() {} }); p0 = e._reel.prog; run(4); assert.ok(e._reel && e._reel.prog > p0, 'holding 收线 reels in');
  Object.assign(e._reel, { prog: 0.995, pull: 0, tense: 0.2, next: 9 }); run(1); listeners.pointerup(); run(1);
  assert.ok(!e.reeling()); assert.equal(Object.values(e.kin.fish).reduce((a, b) => a + b, 0), 2);
  for (const [w, hh] of [[1366, 600], [390, 480], [844, 240]]) { context.inspect().renderer.resize(w, hh, 1); context.step((clock += 20)); }
  context.inspect().renderer.resize(1366, 600, 1);
  // ---------- 许医生验水样；图鉴 ----------
  goTo(e, 'farm', 700, 600);
  context.open('rebuild', { tab: 'residents' }); clean(); assert.match(html(), /验溪谷的河的水样/);
  click('kinVerify', 'river'); assert.equal(e.kin.waters.river, true); click('close');
  context.open('outpost', { view: 'collection' }); clean(); assert.match(html(), /鱼类图鉴 \d+\/24/); click('close');
  // ---------- 搭伙：人物页上送戒指；营火边按 E 说开；第二天广场上请客 ----------
  const rm = e.resident('medic');
  e.ss.trust.medic = 8; e.kin.heart.medic = { seg: 2, pick: [0, 0], req: 1, got: true }; e.s.storage.kinRing = 1;
  Object.assign(e.s.player, { x: rm.x, y: rm.y + 24 });
  context.open('outpost', { view: 'people' }); clean();
  assert.match(html(), /data-action="kinPartnerGive" data-id="medic\|kinRing"/);
  click('kinPartnerGive', 'medic|kinRing'); assert.equal(e.kin.partner?.stage, 'near'); click('close');
  e.ss.trust.medic = 10; e.kin.heart.medic.seg = 3; e.s.minute = 19 * 60 + 30;
  const f = e.fireSpot();
  Object.assign(rm, { x: f.x + 64, y: f.y + 70, target: { x: f.x + 64, y: f.y + 70 } });
  Object.assign(e.s.player, { x: f.x + 64, y: f.y + 50 }); run(2);
  Object.assign(rm, { x: f.x + 64, y: f.y + 70 }); run(1);
  assert.match(ctxLine(), /许医生 · 说开/);
  press('e'); run(1); assert.equal(context.inspect().menu, 'outpost'); clean(); assert.match(html(), /就这么过下去吧/);
  click('kinConfess', 'medic:yes'); assert.equal(e.kin.partner.stage, 'set'); assert.equal(context.inspect().menu, null);
  e.s.day++; e.s.minute = 12 * 60; Object.assign(e.s.storage, { stew: 3, bread: 66 });
  Object.assign(e.s.player, { x: KD.PLAZA.x, y: KD.PLAZA.y + 30 });
  context.open('outpost', { view: 'plaza' }); clean(); assert.match(html(), /请全营吃一顿/);
  click('kinFeast'); assert.equal(e.kin.partner.stage, 'home'); click('close');
  // ---------- 画面：路灯、孩子、门口的人、记号、守在身边的人、鱼线、“…”、沙袋，四种大小，白天和夜里 ----------
  e.s.day = 28 * 2 + 14; e.kin.fest = { day: e.s.day, chat: [], lamps: [0, 1, 2, 3, 4, 5], swap: false, read: false, table: [] };
  e.kin.ask = { name: '小苗', from: '梅姐', day: e.s.day, look: 0 };
  e.ss.trust.jiang = 3; e.c.nextHordeDay = e.s.day + 1;
  const realAlly = e.allyUpdate; e.allyUpdate = () => {};
  e._kinAlly = { id: 'medic', x: 760, y: 640, hp: 60, cd: 0, down: false, kills: 2, facing: 0, swing: 0.2, hitAt: { x: 790, y: 650 } };
  Object.assign(e.s.player, { x: 760, y: 620 });
  for (const [m, night] of [[15 * 60 + 10, false], [21 * 60 + 40, true]]) {
    e.s.minute = m; e.assignRegion();
    if (night) { e.kin.cast = { water: 'pond' }; e._reel = { water: 'pond', sp: 'kinCrucian', tier: 'common', bait: false, biteAt: 2, prog: 0.5, tense: 0.8, t: 1, pull: 0.4, pullT: 0.1, next: 9, warn: false, held: true, r: Math.random }; }
    for (const [w, hh] of [[1366, 600], [1920, 900], [390, 480], [844, 240]]) { context.inspect().renderer.resize(w, hh, 1); context.step((clock += 20)); }
    e._reel = null; e.kin.cast = null;
  }
  e.allyUpdate = realAlly; e._kinAlly = null;
  context.inspect().renderer.resize(1366, 600, 1);
  e.s.minute = 600;
  // 存档
  click('save'); assert.notEqual(context.inspect().menu, 'saveFail');
  const back = Campaign.Engine.parse(storage.get(Session.CAMPAIGN_SAVE));
  assert.equal(back.kin.heart.farmer.seg, 2); assert.equal(back.kin.heart.farmer.got, true); assert.equal(back.kin.kids.length, 1);
  assert.equal(back.kin.partner.stage, 'home'); assert.equal(back.kin.waters.river, true); assert.equal(back.kin.intro.told, true);
  console.log('Kin controller passed: a v0.29 save restored from a file (the old likes still known, the 人情 notice on the first frame), the people page saying where everyone is with a marker, a gift given in person from the people page, 阿禾 waiting at the field and the heart talk opened with E, the second talk marking a cupboard in the residential ruin (E takes the tin), a mother answered with E and her grandson taken in, a lantern-night lamp lit with E, fishing at the valley river (E casts, E on the bite reels, holding E pulls in, the reel card and the 收线 label, the touch button doing the same), 许医生 testing the water sample from the residents page, the fish book, the ring given from the people page and said at the fire with E, the feast on the plaza, lamps/the child/the waiting mother/the partner at your side/the fishing line/the heart bubble/the sandbags drawn at four sizes by day and night, and save/parse.');
}

// v0.31.0「重光」: a v0.30 save restored from a file (the 重光 notice on the first frame), the station picked from the build menu,
// placed and opened with E (an item handed in with its button, a list filled, a wall's card), the archive's 旧世界陈列 (donate with
// the button, the owner's story), 陈工 opening an iron box from the residents page, the platform by the hospital lift opened with
// E (down to floor 1 with the button; closed before the main story is done), a tunnel cabinet opened with E, the ladder taken
// with E to floor 2, the way up taking you back to the shelter, a page shown in the journal and its dig spot dug with E, the year
// review on the vigil night (the letter in the journal, lamps on the stone), the company signed, a wall bought and up the next
// morning, the company rule in the decree book, the contract torn up, the collection's 收复度 and cores, the tunnel at two depths,
// the station, the stone and the platform drawn at four sizes by day and night, and save/parse.
{
  let clock = 24000000;
  const run = (n) => { for (let i = 0; i < n; i++) context.step((clock += 50)); };
  const keydown = (key) => listeners.keydown({ key, target: { matches: () => false }, preventDefault() {}, repeat: false });
  const press = (key) => { keydown(key); listeners.keyup({ key }); };
  // 交互那一行由 HUD 每 0.12 秒刷一次，两帧（0.1 秒）不一定刷得到：读之前先刷一下
  const ctxLine = () => (context.hud(), document.querySelector('#context').innerHTML);
  const goTo = (e, region, x, y) => { e.s.visited = { ...(e.s.visited || {}), [region]: true }; e.s.region = region; e.enemies = e.s.enemies[region] = []; e.assignRegion(); if (x != null) Object.assign(e.s.player, { x, y }); };
  const spotFor = (e, type, cx = 760, cy = 640) => { for (let r = 60; r < 640; r += 16) for (let a = 0; a < 6.28; a += 0.3) { const x = Math.round((cx + Math.cos(a) * r) / 8) * 8, y = Math.round((cy + Math.sin(a) * r) / 8) * 8; Object.assign(e.s.player, { x, y: y + Math.max(46, e.buildingRect(type, x, y).h / 2 + 24) }); if (!e.buildReason(type, x, y)) return { x, y }; } return null; };
  const sizes = (list = [[1366, 600], [1920, 900], [390, 480], [844, 240]]) => { for (const [w, hh] of list) { context.inspect().renderer.resize(w, hh, 1); context.step((clock += 20)); } context.inspect().renderer.resize(1366, 600, 1); };
  dailyOn = false;
  const RD = await import('../dist/relight-data.js');
  const RS = await import('../dist/relight-story.js');
  const RL = await import('../dist/relight.js');
  const Kin = await import('../dist/kin.js');
  // ---------- 一份 v0.30 的旧档（主线打完、三个居民、档案馆分馆、地底避难城和升降井），从文件恢复 ----------
  const old = new Kin.Engine(Kin.newGameState(), () => {});
  const sc = old.sc;
  sc.act = 9; sc.claimed = ['act1', 'supply', 'act2', 'act3', 'act4', 'act5', 'act6', 'act7', 'act8']; sc.choice = 'ration';
  sc.letters = ['act1', 'act2', 'act3', 'act4', 'act5', 'act6', 'act7', 'act8', 'act9']; sc.flags.well = sc.flags.camp = sc.flags.farmerFed = true; sc.camp = { x: 560, y: 735 };
  old.r.claimed = RebuildData.TASKS.map((t) => t.id); old.r.radio = true;
  old.o.hospital = 'water'; old.o.youke = true; old.o.lathe = { mode: 'parts', day: 0 }; old.o.toll = 'refuse'; old.o.raid.phase = 'won';
  old.assignRegion();
  for (const id of ['farmer', 'medic', 'mechanic']) old.recruit(id);
  for (let i = 0; i < 3; i++) old.s.buildings.push({ id: 'rb' + i, type: 'bed', x: 240 + i * 56, y: 980, rotation: 0, hp: 90, open: false });
  old.w.museum.built = true;
  old.b.unlocked.shelter = true; old.b.points.shelter_lift = old.bpoint('shelter_lift'); old.b.points.shelter_lift.flags.repair = true;
  old.s.day = 40; old.s.minute = 600; old.s.weather = '晴朗'; if (old.feel?.open) old.feel.open.phase = 'done'; old.markGearIntro?.();
  old.s.visited = { ...(old.s.visited || {}), residential: true, hospital: true, warehouse: true, shelter: true };
  Object.assign(old.s.storage, { wood: 60, stone: 30, scrap: 60, parts: 20, cloth: 10, fish: 4, bread: 60 });
  old.s.money = 30000;
  context.open('restoreArchive', { files: { old: old.serialize() } }); clean();
  click('restoreCandidate', '0'); click('applyImport');
  let e = context.inspect().engine;
  assert.equal(context.inspect().menu, null);
  assert.ok(e.rl && e.rl.intro && !e.rl.intro.told, 'the 重光 record was added to the old save');
  e.paused = false; if (e.dy) e.dy.pending = null; run(3);
  assert.ok(e.rl.intro.told, 'told on the first frame');
  context.open('outpost', { view: 'log' }); clean(); assert.match(html(), /重光：农场上能建一座重建站/); click('close');
  // ---------- 重建站：建造页里选、放下，按 E 打开，交东西 ----------
  goTo(e, 'farm', 760, 640);
  context.open('build'); clean(); assert.match(html(), /重建站/);
  click('build', 'rlStation'); assert.equal(e.buildMode, 'rlStation'); assert.equal(context.inspect().menu, null);
  const sp = spotFor(e, 'rlStation'); assert.ok(sp); assert.ok(e.placeBuilding(sp.x, sp.y)); e.buildMode = null;
  const st = e.rlStationB(); assert.ok(st);
  Object.assign(e.s.player, { x: st.x, y: st.y + 40 }); run(3);
  assert.match(ctxLine(), /重建站 · 看清单（0\/28）/);
  press('e'); run(1); assert.equal(context.inspect().menu, 'outpost'); clean();
  assert.match(html(), /通水/); assert.match(html(), /池塘里的鱼/); assert.match(html(), /data-action="rlGive" data-id="w_pond\|fish"/);
  click('rlGive', 'w_pond|fish'); assert.equal(e.listGot('w_pond', 'fish'), 3); assert.equal(e.qty('fish', true), 1);
  Object.assign(e.s.storage, { riverFish: 1, kinCrucian: 2, alLoach: 1 });
  click('rlGive', 'w_pond|riverFish'); click('rlGive', 'w_pond|kinCrucian'); click('rlGive', 'w_pond|alLoach');
  assert.ok(e.listDone('w_pond'), 'a list filled with the buttons'); clean(); assert.match(html(), /池塘里的鱼 <small>7\/7 ✓<\/small>/);
  // 一面墙的其余四份交满，墙就通了
  for (const id of ['w_thaw', 'w_wild', 'w_pump', 'w_heat']) for (const [k, n] of RD.LISTS[id].need) { e.s.storage[k] = (e.s.storage[k] || 0) + n; click('rlGive', id + '|' + k); }
  assert.ok(e.wallOn('water'), 'the water wall is up'); clean(); click('close');
  // ---------- 档案馆：旧世界陈列 ----------
  Object.assign(e.s.player, { x: WinterData.WSPOTS.museum.x, y: WinterData.WSPOTS.museum.y + 40 });
  e.s.storage.rlOld_photo = 1;
  context.open('outpost', { view: 'museum' }); clean();
  assert.match(html(), /旧世界陈列 0\/48/); assert.match(html(), /data-action="rlDonate" data-id="rlOld_photo"/);
  click('rlDonate', 'rlOld_photo'); assert.ok(e.oldDonated('rlOld_photo')); assert.ok(html().includes(RS.OLD_STORY.rlOld_photo.slice(0, 8)), 'the owner\'s story is shown'); click('close');
  // ---------- 陈工撬铁盒：居民页上 ----------
  e.s.storage.rlIronBox = 1;
  context.open('rebuild', { tab: 'residents' }); clean(); assert.match(html(), /让陈工撬一个/);
  click('rlBox'); assert.equal(e.qty('rlIronBox', true), 0); click('close');
  // ---------- 检修平台：升降井旁边按 E；主线没打完时下不去 ----------
  goTo(e, 'shelter', RL.SHAFT.x, RL.SHAFT.y + 30); run(3);
  const shaft = e.objects.find((o) => o.type === 'rlShaft'); assert.ok(shaft, 'the platform is there');
  assert.match(ctxLine(), /检修平台 · 下隧道/);
  const claimed = [...e.sc.claimed]; e.sc.claimed = claimed.filter((x) => x !== 'act8'); e.sc.act = 8;
  press('e'); run(1); assert.equal(context.inspect().menu, 'outpost'); clean();
  assert.match(html(), /主线打完以后，联盟的检修队才来接通检修平台/); click('close');
  e.sc.claimed = claimed; e.sc.act = 9;
  press('e'); run(1); clean(); assert.match(html(), /data-action="rlDown" data-id="1"/);
  click('rlDown', '1'); assert.equal(context.inspect().menu, null); assert.equal(e.s.region, 'tunnel'); assert.equal(e.tunnelFloor(), 1);
  e.enemies.forEach((z) => (z.dead = true)); run(2);
  sizes();
  // 柜子按 E
  const crate = e.objects.find((o) => o.type === 'crate'); assert.ok(crate);
  Object.assign(e.s.player, { x: crate.x, y: crate.y + 20 }); run(3);
  press('e'); run(1); assert.equal(e.s.opened[crate.id]?.day, e.s.day, 'the cabinet opened with E');
  // 检修梯按 E：往下一层
  const lad = e.tunnelLayoutNow().ladders[0];
  Object.assign(e.s.player, { x: lad.x, y: lad.y + 10 }); run(3);
  assert.match(ctxLine(), /往下|下一层|下去/);
  press('e'); run(1); assert.equal(e.tunnelFloor(), 2, 'down the ladder with E');
  e.enemies.forEach((z) => (z.dead = true));
  // 深一点的样子（第 24 层）
  e.rl.tunnel.key = { floor: 24, day: e.s.day, luck: false }; e.s.enemies.tunnel = null; e.assignRegion(); e.tunnelArrive();
  for (const m of [10 * 60, 23 * 60]) { e.s.minute = m; sizes([[1366, 600], [390, 480]]); }
  e.rl.tunnel.key = { floor: 2, day: e.s.day, luck: false }; e.s.enemies.tunnel = null; e.assignRegion(); e.tunnelArrive(); e.s.minute = 12 * 60;
  // 往上的梯子按 E：回到避难城
  const TG = await import('../dist/tunnel-gen.js');
  Object.assign(e.s.player, { x: TG.UP.x, y: TG.UP.y + 16 }); run(3);
  press('e'); run(1); assert.equal(e.s.region, 'shelter', 'back up at the shelter');
  // ---------- 残页：任务手记里看；藏货点按 E 挖 ----------
  e.readPage('p09');
  const dig = Object.entries(RD.DIGS).find(([id]) => e.rlDigOpen(id));
  assert.ok(dig, 'the riddle opened a dig spot');
  context.open('journey'); clean(); assert.match(html(), /残页 \d+\/24/); assert.ok(html().includes(e.pageTitle('p09'))); click('close');
  goTo(e, dig[1].region, dig[1].x, dig[1].y + 20); run(3);
  assert.match(ctxLine(), /松土 · 挖一挖/);
  press('e'); run(1); assert.ok(e.rl.dug.includes(dig[0]), 'dug with E');
  // ---------- 年终评定：守夜纪念日 21:00 ----------
  goTo(e, 'farm', 760, 640);
  e.s.day = 56; e.s.minute = 21 * 60 - 0.5; e.c.workClock = 59.5; e.advanceMinutes(1);
  assert.ok(e.lastReview()?.day === 56, 'the review came on the vigil night');
  context.open('journey'); clean(); assert.match(html(), /评定信/); click('close');
  context.open('outpost', { view: 'rlReview', id: '0' }); clean(); assert.match(html(), /存粮/); assert.match(html(), /纪念石/); click('close');
  // ---------- 鼎丰物资：签约、买一面墙（第二天修好）、法令簿、撕合同 ----------
  Object.assign(e.s.player, { x: st.x, y: st.y + 40 }); e.s.minute = 10 * 60; e.s.money = 30000;
  context.open('outpost', { view: 'rlStation' }); clean(); assert.match(html(), /鼎丰物资/);
  click('rlCoSign'); assert.equal(e.rl.co.state, 'signed'); clean();
  click('rlCoBuy', 'clinic'); assert.equal(e.rl.co.pending.clinic, e.s.day, 'ordered'); click('close');
  e.s.minute = 1440 - 0.5; e.c.workClock = 0; e.advanceMinutes(1); e.s.minute = 6 * 60 - 0.5; e.c.workClock = 59.5; e.advanceMinutes(1);
  assert.ok(e.wallOn('clinic'), 'the convoy put the wall up by morning');
  context.open('outpost', { view: 'decrees' }); clean(); assert.match(html(), /公司规矩/); click('close');
  context.open('outpost', { view: 'rlStation' }); click('rlCoTear'); assert.equal(e.rl.co.state, 'torn'); clean(); click('close');
  // ---------- 成就册：收复度、余烬核 ----------
  context.open('outpost', { view: 'collection' }); clean(); assert.match(html(), /收复度/); assert.match(html(), /余烬核 \d\/7/); click('close');
  // ---------- 画面：重建站、纪念石、老怀表、检修平台，四种大小，白天和夜里 ----------
  for (const m of [15 * 60, 22 * 60]) { e.s.minute = m; goTo(e, 'farm', st.x, st.y + 60); sizes(); }
  goTo(e, 'shelter', RL.SHAFT.x, RL.SHAFT.y + 40); sizes([[1366, 600], [390, 480]]);
  goTo(e, 'farm', 760, 640); e.s.minute = 600;
  // 存档
  click('save'); assert.notEqual(context.inspect().menu, 'saveFail');
  const back = Campaign.Engine.parse(storage.get(Session.CAMPAIGN_SAVE));
  assert.ok(back.relight.done.includes('w_pond')); assert.ok(back.relight.old.includes('rlOld_photo')); assert.equal(back.relight.co.state, 'torn');
  assert.ok(back.relight.walls.water && back.relight.walls.clinic); assert.equal(back.relight.intro.told, true);
  console.log('Relight controller passed: a v0.30 save restored from a file (the 重光 notice on the first frame), the station picked from the build menu and opened with E (items handed in with their buttons, a list filled, the water wall up), the archive\'s 旧世界陈列 (donated with the button, the owner\'s story), 陈工 opening an iron box from the residents page, the platform by the hospital lift opened with E (closed before the main story, down to floor 1 with the button), a tunnel cabinet opened with E, the ladder taken with E, the way up back to the shelter, a page in the journal and its dig spot dug with E, the year review on the vigil night (journal letter and review page), the company signed, a wall bought and up the next morning, the company rule in the decree book, the contract torn up, the collection\'s 收复度 and cores, the tunnel at floors 1 and 24 and the station, the stone and the platform drawn at four sizes by day and night, and save/parse.');
}

// v0.32.0「手感」: a v0.31 save restored from a file (the 手感 card on the first frame), E held along a row of ripe radishes
// (harvested, replanted with the last seed, tended — no line per plot in the notice bar, one 这一遍田 line after a pause),
// a level-up as the moment card that stays up through a burst of notices and goes when its time is up, a click closing the next
// card early, the morning broadcast in the journal's 今天, the collection's three almanacs, the touch 建造 button and the hidden
// grey buttons, and save/parse.
{
  let clock = 26000000;
  const run = (n) => { for (let i = 0; i < n; i++) context.step((clock += 50)); };
  const keydown = (key) => listeners.keydown({ key, target: { matches: () => false }, preventDefault() {}, repeat: false });
  const keyup = (key) => listeners.keyup({ key });
  const card = () => document.querySelector('#zest-moment');
  const toastsHtml = () => document.querySelector('#toasts').innerHTML;
  dailyOn = false;
  const RL = await import('../dist/relight.js');
  // ---------- 一份 v0.31 的旧档，从文件恢复：第一帧一张“手感”卡片 ----------
  const old = new RL.Engine(RL.freshState(), () => {});
  old.s.day = 12; old.s.minute = 600; old.feel.open.phase = 'done'; old.markGearIntro?.(); if (old.dy) old.dy.pending = null;
  context.open('restoreArchive', { files: { old: old.serialize() } }); clean();
  click('restoreCandidate', '0'); click('applyImport');
  let e = context.inspect().engine;
  assert.ok(e.zx, 'the zest field was added');
  assert.equal(context.inspect().menu, null);
  e.paused = false; if (e.dy) e.dy.pending = null;
  run(3);
  assert.equal(card().hidden, false, 'the 手感 card is up');
  assert.match(card().innerHTML, /手感/);
  run(80);
  // v0.33 起旧档还会接着一张“盼头”的卡片，v0.34 起再接一张“成长”，v0.35 起再接一张“长夜”，v0.36 起再接一张“巨影”
  for (let i = 0; i < 5 && !card().hidden; i++) { assert.match(card().innerHTML, /盼头|成长|长夜|巨影/); run(80); }
  assert.equal(card().hidden, true, 'and gone after its time');
  // ---------- 按住 E 沿着一排熟了的萝卜走 ----------
  e.s.region = 'farm'; e.assignRegion(); e.s.minute = 600; e.s.debris = [];
  const row = e.s.plots.filter((p) => e.isFarmPlot(p)).sort((a, b) => a.y - b.y || a.x - b.x).slice(0, 6);
  for (const p of row) Object.assign(p, { tilled: true, crop: 'radish', growth: Data.CROPS.radish.grow, wateredDay: e.s.day });
  e.s.storage.seedRadish = 20; e.s.seed = 'seedRadish'; e.c.water = 24;
  Object.assign(e.s.player, { x: row[0].x, y: row[0].y + 20 });
  keydown('e');
  for (let i = 0; i < 6; i++) { e.s.player.x = row[i].x; run(26); }
  keyup('e');
  assert.ok(row.every((p) => p.crop === 'radish' && p.growth < Data.CROPS.radish.grow), 'harvested and replanted');
  assert.ok(row.every((p) => e.g.plots[p.id]?.t === e.s.day), 'tended');
  assert.doesNotMatch(toastsHtml(), /收获 ·|照看了|种下萝卜/);
  run(90);
  assert.ok(e.zx.stats.tallies >= 1, 'one line for the pass');
  // ---------- 大事卡片：一连串提示也挤不掉它，到时间才走；下一张点一下就收 ----------
  // 种地升的那一级先放完
  { const m = context.inspect().moments; m.queue.length = 0; m.close(); }
  e.s.xp.combat = 0; e.xp('combat', 45);
  run(2);
  assert.match(card().innerHTML, /战斗 Lv\.2/);
  for (let i = 0; i < 8; i++) e.toast('第 ' + i + ' 条消息：' + '营地里的一件小事', i % 2 ? 'gold' : 'normal');
  run(40); // 2 秒
  assert.equal(card().hidden, false); assert.match(card().innerHTML, /战斗 Lv\.2/, 'still the level card after 2 s of notices');
  e.toast('打赢了大块头：机械零件 ×4', 'gold');
  run(30);
  assert.match(card().innerHTML, /打赢了大块头/, 'the next card after the first one ran out');
  run(10);
  card().events.click?.();
  run(1);
  assert.equal(card().hidden, true, 'a click closes it');
  // ---------- 早间广播进任务手记的“今天”；成就册里的三本图鉴 ----------
  e.toast('电台早间播报：明天废弃居民区可能有大块头；老琴抽了支大吉。', 'gold');
  context.open('journey', {}); clean(); assert.match(html(), /zest-radio/); click('close');
  context.open('outpost', { view: 'collection' }); clean(); assert.match(html(), /zest-dex/); assert.match(html(), /植物图鉴/); click('close');
  // ---------- 手机上的“建造”：不建造时出现，建造时让位给旋转、取消（这几个按属性找的按钮在真浏览器里查） ----------
  run(4);
  assert.equal(document.querySelector('.touch-build').hidden, false);
  e.buildMode = 'fence'; run(4);
  assert.equal(document.querySelector('.touch-build').hidden, true);
  e.buildMode = null; run(4);
  assert.equal(document.querySelector('.touch-build').hidden, false);
  // 存档
  click('save'); assert.notEqual(context.inspect().menu, 'saveFail');
  const back = Campaign.Engine.parse(storage.get(Session.CAMPAIGN_SAVE));
  assert.equal(back.zest.intro.told, true); assert.ok(back.zest.stats.holdActs >= 6); assert.ok(back.zest.moments.level >= 1);
  console.log('Zest controller passed: a v0.31 save restored from a file (the 手感 card on the first frame and gone after its time), E held along a row of ripe radishes (harvested, replanted with the last seed, tended, no line per plot, one line for the pass), a level-up card that stays through eight notices and two seconds, the next card after it and a click closing it, the morning broadcast in the journal\'s 今天, the collection\'s three almanacs, the touch 建造 button shown except while building, and save/parse.');
}

// v0.33.0「盼头」: a v0.32 save restored from a file (the 盼头 card on the first frame and gone after its time), a traveler at the
// gate met with E (his page, the things handed over with the button, the card), this week's list on the station (a slot handed in)
// and a wall raised to level II from its row, the farmhouse wing bought on the rooms page, the coop's run from its card, this week's
// rare good bought at the station market from the district page, a peddler's stall opened with E (one thing bought), the afternoon
// airdrop box opened with E, a trapped survivor told to follow with E, the alert bar and the journal's 今天 and strip, the farm
// drawn with every expansion and device at four sizes by day and night, and save/parse.
{
  let clock = 28000000;
  const run = (n) => { for (let i = 0; i < n; i++) context.step((clock += 50)); };
  const keydown = (key) => listeners.keydown({ key, target: { matches: () => false }, preventDefault() {}, repeat: false });
  const press = (key) => { keydown(key); listeners.keyup({ key }); };
  const card = () => document.querySelector('#zest-moment');
  const goTo = (e, region, x, y) => { e.s.visited = { ...(e.s.visited || {}), [region]: true }; e.s.region = region; e.enemies = e.s.enemies[region] = []; e.assignRegion(); if (x != null) Object.assign(e.s.player, { x, y }); };
  const hourTo = (e, h) => { e.s.minute = h * 60 - 0.5; e.c.workClock = 59.5; e.advanceMinutes(1); };
  const sizes = (list = [[1366, 600], [1920, 900], [390, 480], [844, 240]]) => { for (const [w, hh] of list) { context.inspect().renderer.resize(w, hh, 1); context.step((clock += 20)); } context.inspect().renderer.resize(1366, 600, 1); };
  dailyOn = false;
  const HD = await import('../dist/hope-data.js');
  const Z = await import('../dist/zest.js');
  // ---------- 一份 v0.32 的旧档（第二年，主线打完，重建站和鸡舍、六面墙都通了），从文件恢复 ----------
  const old = new Z.Engine(Z.newGameState(), () => {});
  const sc = old.sc;
  sc.act = 9; sc.claimed = ['act1', 'supply', 'act2', 'act3', 'act4', 'act5', 'act6', 'act7', 'act8']; sc.choice = 'ration';
  sc.letters = ['act1', 'act2', 'act3', 'act4', 'act5', 'act6', 'act7', 'act8', 'act9']; sc.flags.well = sc.flags.camp = sc.flags.farmerFed = true; sc.camp = { x: 560, y: 735 };
  old.r.claimed = RebuildData.TASKS.map((t) => t.id); old.r.radio = true;
  old.o.hospital = 'water'; old.o.youke = true; old.o.lathe = { mode: 'parts', day: 0 }; old.o.toll = 'refuse'; old.o.raid.phase = 'won';
  old.o.caravan.visits = 3;
  old.assignRegion();
  old.s.day = 56; old.s.minute = 600; old.s.weather = '晴朗'; if (old.feel?.open) old.feel.open.phase = 'done'; old.markGearIntro?.();
  old.s.visited = { ...(old.s.visited || {}), residential: true, hospital: true, warehouse: true, valley: true, courtyard: true, stationMarket: true, railDepot: true };
  for (const r of ['valley', 'stationMarket', 'courtyard', 'railDepot']) old.d.unlocked[r] = true;
  Object.assign(old.s.storage, { wood: 200, stone: 120, scrap: 80, parts: 30, cloth: 20, herb: 20, circuit: 10, rlCopper: 10, rlBulb: 10, rlSpike: 20, fish: 6, bread: 60, potato: 20, stew: 3, jam: 3, cotton: 10, tomato: 10 });
  old.s.money = 90000;
  for (const w of ['water', 'clinic', 'school', 'radio', 'power', 'rail']) old.rl.walls[w] = { by: 'list', day: 50 };
  old.s.buildings.push({ id: 'hpst', type: 'rlStation', x: 760, y: 820, rotation: 0, hp: 160, open: false });
  old.s.buildings.push({ id: 'hpcoop', type: 'coop', x: 1000, y: 560, rotation: 0, hp: 150, open: false });
  context.open('restoreArchive', { files: { old: old.serialize() } }); clean();
  click('restoreCandidate', '0'); click('applyImport');
  let e = context.inspect().engine;
  assert.equal(context.inspect().menu, null);
  assert.ok(e.hp && e.hp.intro && !e.hp.intro.told, 'the 盼头 record was added to the old save');
  e.paused = false; if (e.dy) e.dy.pending = null;
  { const m = context.inspect().moments; m.queue.length = 0; m.close(); }
  run(3);
  assert.equal(card().hidden, false, 'the 盼头 card is up'); assert.match(card().innerHTML, /盼头/);
  run(80);
  // v0.34 起接着一张“成长”，v0.35 起再接一张“长夜”
  for (let i = 0; i < 3 && !card().hidden; i++) { assert.match(card().innerHTML, /成长|长夜|巨影/); run(80); }
  assert.equal(card().hidden, true, 'and gone after its time');
  // ---------- 过路人：营门口按 E，他的那一页，给他东西 ----------
  let d = 57; while (HD.weekKind(d) !== 'traveler') d += 7;
  e.s.day = d - 1; e.s.minute = 1439.5; e.c.workClock = 59.5; e.advanceMinutes(0.5 + 9 * 60 + 5);
  if (e.s.region !== 'farm') goTo(e, 'farm');
  const W = e.hp.week;
  assert.equal(W.kind, 'traveler'); assert.equal(W.st, 'here');
  const tv = e.objects.find((o) => o.type === 'hpTraveler'); assert.ok(tv);
  Object.assign(e.s.player, { x: tv.x, y: tv.y + 30 }); context.inspect().engine._picked = null;
  run(1); press('e'); run(1);
  assert.equal(context.inspect().menu, 'outpost'); assert.match(html(), new RegExp(HD.TRAVELERS[W.id].name)); clean();
  click('hpGive', W.id);
  assert.equal(W.st, 'done', 'he took the things'); click('close'); run(2);
  assert.equal(card().hidden, false); assert.match(card().innerHTML, /过路人/);
  { const m = context.inspect().moments; m.queue.length = 0; m.close(); }
  // ---------- 重建站：墙升二级（这一周不是清单周：清单的格子在单元测试里交） ----------
  const st = e.s.buildings.find((b) => b.type === 'rlStation');
  Object.assign(e.s.player, { x: st.x, y: st.y + 50 });
  context.open('outpost', { view: 'rlStation' }); clean();
  assert.match(html(), /升二级 · 二级水网/);
  click('hpWall2', 'water'); assert.ok(e.wall2On('water'), 'the water wall is level II'); clean();
  assert.match(html(), /二级 · 二级水网<\/b> ✓/); click('close');
  // ---------- 农舍「房间与家具」：东厢房；鸡舍的设施卡：大鸡舍 ----------
  goTo(e, 'farm', 760, 640);
  context.open('frontier', { tab: 'rooms' }); clean(); assert.match(html(), /农舍扩建/);
  click('hpExpand', 'home'); assert.equal(e.hpLv('home'), 1); click('close');
  context.open('building', { buildingId: 'hpcoop' }); clean(); assert.match(html(), /鸡舍扩建/);
  click('hpExpand', 'coop'); assert.equal(e.hpLv('coop'), 1); click('close');
  // ---------- 旧站商街：这周的稀罕货 ----------
  const m = e.marketGood(); assert.ok(m);
  const P = DistrictData.POINT_BY_ID.shops;
  goTo(e, 'stationMarket', P.x, P.y + 20);
  context.open('districts', {}); const dui = context.inspect().districtUI; dui.region = 'stationMarket'; dui.point = 'shops'; dui.view = 'point'; context.open('districts', {});
  clean();
  click('dQuick', 'shops:hpGood');
  assert.ok(e.hpOwn(m.good) || HD.GOODS[m.good].repeat, 'bought this week\'s rare good'); click('close');
  // ---------- 货郎：营门口按 E，买一样 ----------
  goTo(e, 'farm');
  e.hp.noon = { day: e.s.day, kind: 'peddler', st: 'soon', id: 'mei' }; hourTo(e, 14);
  const pd = e.objects.find((o) => o.type === 'hpPeddler'); assert.ok(pd);
  Object.assign(e.s.player, { x: pd.x, y: pd.y + 30 }); run(1); press('e'); run(1);
  assert.equal(context.inspect().menu, 'outpost'); assert.match(html(), /种子贩子阿梅/); clean();
  click('hpPeddle', 'sell'); assert.ok(e.hp.noon.sold); click('close');
  // ---------- 空投：那张图上按 E 开箱 ----------
  e.s.day += 1; e.hp.noon = { day: e.s.day, kind: 'drop', st: 'soon', region: 'hospital', tier: 'rare', good: 'hpBiscuit' }; hourTo(e, 14);
  goTo(e, 'hospital', 300, 520);
  const box = e.objects.find((o) => o.type === 'crate' && o.id === 'hpdrop'); assert.ok(box);
  Object.assign(e.s.player, { x: box.x, y: box.y + 22 }); run(1); press('e'); run(2);
  assert.equal(e.hp.noon.st, 'done', 'the airdrop box was opened with E');
  // ---------- 被困的人：按 E 让他跟着 ----------
  e.s.day += 1; e.hp.noon = { day: e.s.day, kind: 'survivor', st: 'soon', region: 'residential', id: 1 }; hourTo(e, 14);
  goTo(e, 'residential', 300, 520);
  const sv = e.objects.find((o) => o.type === 'hpSurvivor'); assert.ok(sv);
  Object.assign(e.s.player, e.freePoint(sv.x + 30, sv.y)); run(1); press('e'); run(1);
  assert.equal(e.hp.noon.follow, true, 'the survivor follows');
  // ---------- 顶上的提醒、任务手记 ----------
  const alerts = document.querySelector('#alerts')?.innerHTML || '';
  assert.match(alerts + WinterUI.alertItems(e).map((a) => a.text).join(' '), /下午的事 · 被困的人/);
  context.open('journey', {}); clean(); assert.match(html(), /hp-strip/); click('close');
  // ---------- 画面：所有扩建和稀罕货都在农场上，四种大小，白天和夜里 ----------
  goTo(e, 'farm', 760, 640);
  e.hp.expand = { home: 2, store: 2, coop: 2 };
  for (const id of HD.GOOD_IDS) if (!HD.GOODS[id].repeat) e.hp.goods[id] = e.s.day;
  e.hp.wall2.power = e.s.day;
  e.c.animals.goat = true; e.c.animals.chicken = true;
  e.assignRegion();
  assert.ok(e.objects.some((o) => o.type === 'hpDeco' && o.kind === 'mill'));
  assert.ok(!e.nearestObject() || e.nearestObject().type !== 'hpDeco');
  for (const [x, y] of [[560, 260], [1050, 300], [1000, 600]]) for (const mm of [15 * 60, 22 * 60]) { e.s.minute = mm; Object.assign(e.s.player, { x, y }); sizes(); }
  e.s.minute = 600;
  // 存档
  click('save'); assert.notEqual(context.inspect().menu, 'saveFail');
  const back = Campaign.Engine.parse(storage.get(Session.CAMPAIGN_SAVE));
  assert.equal(back.hope.intro.told, true); assert.ok(back.hope.wall2.water); assert.equal(back.hope.expand.home, 2);
  console.log('Hope controller passed: a v0.32 save restored from a file (the 盼头 card on the first frame and gone after its time), a traveler at the gate met with E (his page, the things handed over, the card), a wall raised to level II from the station, the farmhouse wing from the rooms page and the coop run from its card, this week\'s rare good bought at the station market, a peddler\'s stall opened with E and one thing bought, the afternoon airdrop opened with E, a trapped survivor following after E, the alert bar and the journal strip, the farm with every expansion and device drawn at four sizes by day and night, and save/parse.');
}

// v0.34.0「成长」: a v0.33 save restored from a file (the 成长 card says how far the old experience went, gone after its time),
// the HUD's skill line past level five, the skill page opened with K (levels to ten, the perks), a level-up card while playing,
// the station's second-year lists (a cell handed in with its button), the collection's challenges and 老手 rows, the weapon bench
// page saying what each melee weapon is good at, the hospital with a cramped spear and the star over a good cabinet drawn at four
// sizes, the warehouse storeroom door chopped open with the fire axe after E, a challenge card, and save/parse.
{
  let clock = 29000000;
  const run = (n) => { for (let i = 0; i < n; i++) context.step((clock += 50)); };
  const keydown = (key) => listeners.keydown({ key, target: { matches: () => false }, preventDefault() {}, repeat: false });
  const press = (key) => { keydown(key); listeners.keyup({ key }); };
  const card = () => document.querySelector('#zest-moment');
  const closeCards = () => { const m = context.inspect().moments; m.queue.length = 0; m.close(); };
  const goTo = (e, region, x, y) => { e.s.visited = { ...(e.s.visited || {}), [region]: true }; e.s.region = region; e.enemies = e.s.enemies[region] = []; e.assignRegion(); if (x != null) Object.assign(e.s.player, { x, y }); };
  const sizes = (list = [[1366, 600], [1920, 900], [390, 480], [844, 240]]) => { for (const [w, hh] of list) { context.inspect().renderer.resize(w, hh, 1); context.step((clock += 20)); } context.inspect().renderer.resize(1366, 600, 1); };
  dailyOn = false;
  const GD = await import('../dist/grow-data.js');
  const H = await import('../dist/hope.js');
  const RD2 = await import('../dist/relight-data.js');
  // ---------- 一份 v0.33 的旧档（第二年，主线打完，六面墙都通了，三项技能的经验早过了 5 级） ----------
  const old = new H.Engine(H.newGameState(), () => {});
  const sc = old.sc;
  sc.act = 9; sc.claimed = ['act1', 'supply', 'act2', 'act3', 'act4', 'act5', 'act6', 'act7', 'act8']; sc.choice = 'ration';
  sc.letters = ['act1', 'act2', 'act3', 'act4', 'act5', 'act6', 'act7', 'act8', 'act9']; sc.flags.well = sc.flags.camp = sc.flags.farmerFed = true; sc.camp = { x: 560, y: 735 };
  old.r.claimed = RebuildData.TASKS.map((t) => t.id); old.r.radio = true;
  old.o.hospital = 'water'; old.o.youke = true; old.o.lathe = { mode: 'parts', day: 0 }; old.o.toll = 'refuse'; old.o.raid.phase = 'won';
  old.assignRegion();
  old.s.day = 60; old.s.minute = 600; old.s.weather = '晴朗'; if (old.feel?.open) old.feel.open.phase = 'done'; old.markGearIntro?.();
  old.s.visited = { ...(old.s.visited || {}), residential: true, hospital: true, warehouse: true };
  old.s.xp.combat = GD.MASTER_XP.combat[2] + 50; old.s.xp.agriculture = GD.MASTER_XP.agriculture[1] + 50; old.s.xp.exploration = GD.MASTER_XP.exploration[3] + 50;
  Object.assign(old.s.storage, { wood: 200, stone: 120, scrap: 80, parts: 30, riverFish: 6, nightFish: 3, kinEel: 3, kinKoi: 1, axe: 1, machete: 1, bat: 1, crowbar: 1, sledge: 1, ironspear: 1 });
  for (const w of RD2.WALL_IDS) old.rl.walls[w] = { by: 'list', day: 50 };
  for (const id of RD2.LIST_IDS) if (!old.rl.done.includes(id)) old.rl.done.push(id);
  old.s.buildings.push({ id: 'grst', type: 'rlStation', x: 760, y: 820, rotation: 0, hp: 160, open: false });
  old.s.buildings.push({ id: 'grwb', type: 'weaponbench', x: 980, y: 300, rotation: 0, hp: Data.BUILDINGS.weaponbench.hp, open: false });
  context.open('restoreArchive', { files: { old: old.serialize() } }); clean();
  click('restoreCandidate', '0'); click('applyImport');
  let e = context.inspect().engine;
  assert.equal(context.inspect().menu, null);
  assert.ok(e.gw && e.gw.intro && !e.gw.intro.told, 'the 成长 record was added to the old save');
  e.paused = false; if (e.dy) e.dy.pending = null;
  closeCards();
  run(3);
  assert.equal(card().hidden, false, 'the 成长 card is up'); assert.match(card().innerHTML, /成长/); assert.match(card().innerHTML, /直接到了 Lv\.8/);
  run(80);
  // v0.35 起接着一张“长夜”
  for (let i = 0; i < 2 && !card().hidden; i++) { assert.match(card().innerHTML, /长夜|巨影/); run(80); }
  assert.equal(card().hidden, true, 'and gone after its time');
  assert.match(document.querySelector('#skill-summary')?.textContent || '', /Lv\.7.*Lv\.9/);
  // ---------- 技能页：按 K ----------
  goTo(e, 'farm', 760, 640); run(1);
  press('k'); run(1);
  assert.equal(context.inspect().menu, 'skills'); assert.match(html(), /gr-master/); assert.match(html(), /战斗<span>Lv\.8<\/span>/); clean(); click('close');
  // ---------- 玩着升一级 ----------
  closeCards(); e.xp('agriculture', GD.MASTER_XP.agriculture[2] - e.s.xp.agriculture + 20); run(2);
  assert.equal(card().hidden, false); assert.match(card().innerHTML, /农业 Lv\.8/); closeCards();
  // ---------- 重建站：第二年的清单，交一格 ----------
  const st = e.s.buildings.find((b) => b.type === 'rlStation');
  Object.assign(e.s.player, { x: st.x, y: st.y + 50 });
  context.open('outpost', { view: 'rlStation' }); clean();
  assert.match(html(), /第二年的清单/); assert.match(html(), /深水里的鱼/);
  click('grL2', 'w2_deep|riverFish'); assert.equal(e.list2Got('w2_deep', 'riverFish'), 4, 'four blue-backs handed in'); click('close');
  // ---------- 成就册 ----------
  context.open('outpost', { view: 'collection' }); clean(); assert.match(html(), /打法挑战/); assert.match(html(), /老手（技能 6–10 级）/); click('close');
  // ---------- 武器台那一页 ----------
  Object.assign(e.s.player, { x: 980, y: 350 });
  context.open('frontier', { tab: 'combat' }); clean();
  assert.ok((html().match(/gr-use/g) || []).length >= 6, 'six notes on what each weapon is good at'); click('close');
  // ---------- 旧医院：长矛伸不开；眼尖的星画得出来 ----------
  e.s.inventory.ironspear = 1; e.gr.slots.melee = 'ironspear'; e.s.slot = 3;
  goTo(e, 'hospital', 600, 520);
  assert.ok(e.meleeStats('ironspear').cramped);
  for (const o of e.objects.filter((x) => x.type === 'crate' && x.ukind)) { Object.assign(e.s.player, { x: o.x, y: o.y + 60 }); sizes([[1366, 600], [390, 480]]); }
  // ---------- 仓库：储藏室的铁门，拿消防斧按 E 劈开 ----------
  e.s.day += 1; e.ut.evDay = e.s.day; e.ut.ev = { day: e.s.day, id: 'storeroom', region: 'warehouse', spot: 0, st: 'wait', bits: 0, spawned: false };
  e.s.inventory.axe = 1; e.gr.slots.melee = 'axe';
  e.s.region = 'warehouse'; e.s.enemies.warehouse = null; e.assignRegion(); run(1);
  for (const z of e.enemies) z.dead = true;
  const door = e.objects.find((o) => o.type === 'uDoor'); assert.ok(door, 'the storeroom door is there');
  Object.assign(e.s.player, { x: door.x, y: door.y + 30 }); e._picked = null; run(1);
  press('e'); run(1);
  if (context.inspect().menu === 'outpost' && /sPick/.test(html())) { clean(); click('sPick', String((context.inspect().engine.pickCandidates?.() || []).findIndex((o) => o.type === 'uDoor'))); }
  assert.equal(e.ux.pry?.grTool, 'axe', 'chopping with the axe');
  run(GD.WEAPON_FX.axe.door * 20 + 10);
  assert.equal(e.ut.ev.st, 'open', 'the door is open after four seconds');
  // ---------- 打法挑战的卡片 ----------
  closeCards(); e.grChallenge('axeSplit', 12); run(2);
  assert.equal(card().hidden, false); assert.match(card().innerHTML, /劈甲/); closeCards();
  goTo(e, 'farm', 760, 640);
  // 存档
  click('save'); assert.notEqual(context.inspect().menu, 'saveFail');
  const back = Campaign.Engine.parse(storage.get(Session.CAMPAIGN_SAVE));
  assert.equal(back.grow.intro.told, true); assert.equal(back.grow.lv.combat, 8); assert.ok(back.grow.chDone.axeSplit); assert.equal(back.grow.l2.w2_deep.riverFish, 4);
  console.log('Grow controller passed: a v0.33 save restored from a file (the 成长 card saying how far the old experience went, gone after its time), the HUD skill line past level five, the skill page opened with K (levels to ten and their perks), a level-up card while playing, a second-year list cell handed in at the station, the collection\'s challenges and 老手 rows, the weapon bench page with what each melee weapon is good at, the hospital with a cramped spear and the cabinets drawn at two sizes, the warehouse storeroom door chopped open with the fire axe after E, a challenge card, and save/parse.');
}

// v0.35.0「长夜」: a v0.34 save restored from a file (the 长夜 card on the first frame, phases only from the next long night on),
// the alert bar and the journal telling tomorrow's phase, the journal's 夜相 row opening the report page with the eight phases,
// the 08:00 phase card, the banner and the alert bar naming the phase at 22:00, the farm drawn under each phase's look at two sizes,
// a lost night with next morning's card, the keepsake and the night notes on the report page, a fall in a ruin leaving a flag
// (drawn) and one reminder in the toasts, and save/parse.
{
  let clock = 31000000;
  const run = (n) => { for (let i = 0; i < n; i++) context.step((clock += 50)); };
  const card = () => document.querySelector('#zest-moment');
  const closeCards = () => { const m = context.inspect().moments; m.queue.length = 0; m.close(); };
  const goTo = (e, region, x, y) => { e.s.visited = { ...(e.s.visited || {}), [region]: true }; e.s.region = region; e.enemies = e.s.enemies[region] = []; e.assignRegion(); if (x != null) Object.assign(e.s.player, { x, y }); };
  const sizes = (list = [[1366, 600], [1920, 900], [390, 480], [844, 240]]) => { for (const [w, hh] of list) { context.inspect().renderer.resize(w, hh, 1); context.step((clock += 20)); } context.inspect().renderer.resize(1366, 600, 1); };
  dailyOn = false;
  const ND = await import('../dist/nightfall-data.js');
  const AD = await import('../dist/almanac-data.js');
  const G = await import('../dist/grow.js');
  // ---------- 一份 v0.34 的旧档：主线第 30 天打完，现在第 37 天上午（明晚是长夜） ----------
  const old = new G.Engine(G.newGameState(), () => {});
  const sc = old.sc;
  sc.act = 9; sc.claimed = ['act1', 'supply', 'act2', 'act3', 'act4', 'act5', 'act6', 'act7', 'act8']; sc.choice = 'ration';
  sc.letters = ['act1', 'act2', 'act3', 'act4', 'act5', 'act6', 'act7', 'act8', 'act9']; sc.flags.well = sc.flags.camp = sc.flags.farmerFed = true; sc.camp = { x: 560, y: 735 };
  old.r.claimed = RebuildData.TASKS.slice(0, RebuildData.TASKS.findIndex((x) => x.id === 'broadcast') + 1).map((x) => x.id); old.r.radio = true;
  old.o.hospital = 'water'; old.o.youke = true; old.o.lathe = { mode: 'parts', day: 0 }; old.o.toll = 'refuse'; old.o.raid.phase = 'won';
  old.assignRegion();
  old.ln.storyDay = 30; Object.assign(old.ct, { step: 4, done: true, region: 'residential', day: 35 });
  old.s.day = 37; old.s.minute = 600; old.s.weather = '晴朗'; old.s.stats.hordes = 6; old.c.nextHordeDay = 90;
  old.s.horde = { phase: 'won', timer: 0, remaining: 0, spawnTimer: 0, direction: 0 };
  if (old.feel?.open) old.feel.open.phase = 'done'; old.markGearIntro?.();
  old.s.visited = { ...(old.s.visited || {}), residential: true };
  context.open('restoreArchive', { files: { old: old.serialize() } }); clean();
  click('restoreCandidate', '0'); click('applyImport');
  let e = context.inspect().engine;
  assert.equal(context.inspect().menu, null);
  assert.ok(e.nf && e.nf.intro && !e.nf.intro.told, 'the nightfall record was added to the old save');
  assert.equal(e.nf.since, 37, 'phases only after the day it was loaded');
  e.paused = false; if (e.dy) e.dy.pending = null;
  closeCards();
  run(3);
  assert.equal(card().hidden, false, 'the 长夜 card is up'); assert.match(card().innerHTML, /长夜/); assert.match(card().innerHTML, /雾夜/); assert.match(card().innerHTML, /春雷夜/); assert.match(card().innerHTML, /雪夜/);
  run(80);
  // v0.36 起再接一张“巨影”
  if (!card().hidden) { assert.match(card().innerHTML, /巨影/); run(80); }
  assert.equal(card().hidden, true, 'and gone after its time');
  const ph = e.nfPhase(38), P = ND.PHASES[ph];
  assert.ok(P, 'tomorrow night has a phase');
  // ---------- 前一天：顶上的提醒、手记、战报页上的夜相 ----------
  e.s.minute = 450; run(2);
  assert.ok(document.querySelector('#alert-bar').innerHTML.includes('明晚长夜 · ' + P.name), 'the alert bar tells tomorrow night');
  context.open('journey'); clean();
  assert.ok(html().includes('（明天）· ' + P.name + ' · 约'), 'the journal names the phase');
  assert.ok(html().includes(P.name + '：' + e.nfRule(ph, 38)));
  assert.match(html(), /<b>夜相<\/b>见过 0\/8 种/);
  click('oView', 'lnight'); clean();
  assert.match(html(), /夜相 · 见过 0\/8/); assert.ok(html().includes('下一个长夜（明晚）：' + P.name));
  for (const id of ND.PHASE_IDS) assert.ok(html().includes('<b>' + ND.PHASES[id].name + '</b>'));
  click('close');
  // ---------- 当天 08:00：一张夜相卡片 ----------
  e.s.day = 38; e.s.minute = 470; run(2); closeCards();
  e.s.minute = 481; run(2);
  assert.equal(card().hidden, false, 'the phase card'); assert.ok(card().innerHTML.includes('今晚是' + P.name)); assert.match(card().innerHTML, /吃香的/);
  closeCards();
  // ---------- 22:00：横幅和提醒写夜相 ----------
  e.s.minute = 1319.9; e.invulnerable = 999; run(4);
  assert.ok(e.ln.night, 'the night began');
  assert.ok(document.querySelector('#horde-warning').textContent.includes('长夜 · ' + P.name + ' · 第 1/3 波'), 'the banner names the phase');
  assert.ok(document.querySelector('#alert-bar').innerHTML.includes('长夜 · ' + P.name + ' · 第 1/3 波'));
  // 八种夜相的样子（雾、雨、月光、热、尘、风、小雪、大雪）：两个大小各画一遍
  for (const id of ND.PHASE_IDS) { e._nfForce = id; sizes([[1366, 600], [390, 480]]); }
  e._nfForce = null;
  // ---------- 没守住：第二天早上一张卡片、纪念物、守夜笔记 ----------
  e.invulnerable = 0; e.damagePlayer(999); run(1);
  assert.equal(context.inspect().menu, 'death'); click('close');
  assert.equal(e.ln.night, null); assert.equal(e.nf.notes.length, 1);
  e.paused = false; closeCards();
  e.s.day = 39; e.s.minute = 361; run(3);
  assert.equal(card().hidden, false, 'the morning card'); assert.ok(card().innerHTML.includes('第 1 个长夜没守住 · ' + P.name));
  const keep = AD.decorItem(ND.NF_KEEPSAKE[ph]);
  assert.equal((e.s.inventory[keep] || 0) + (e.s.storage[keep] || 0), 1, 'the keepsake');
  closeCards();
  context.open('outpost', { view: 'lnight' }); clean();
  assert.ok(html().includes('第 1 个长夜 · ' + P.name + ' · 没守住')); assert.ok(html().includes('守夜笔记记下了：' + P.hint)); assert.match(html(), /<h4>守夜笔记<\/h4>/);
  click('close');
  // ---------- 废墟里倒下：一根小旗、再进去提一句 ----------
  goTo(e, 'residential', 640, 520); run(1);
  e.fx.lastHitBy = 'runner'; e.invulnerable = 0; e.damagePlayer(999); run(1);
  assert.equal(context.inspect().menu, 'death'); click('close');
  assert.equal(e.nf.falls.length, 1);
  e.paused = false; e.s.minute = 600;
  goTo(e, 'residential', 900, 520); run(2);
  assert.match(document.querySelector('#toasts').innerHTML, /上回你在这里倒下（第 39 天，被奔跑者打倒）/);
  assert.equal(e.nfFallMarks('residential').length, 1);
  Object.assign(e.s.player, { x: 680, y: 560 }); sizes();
  goTo(e, 'farm', 760, 640); run(1);
  // 存档
  click('save'); assert.notEqual(context.inspect().menu, 'saveFail');
  const back = Campaign.Engine.parse(storage.get(Session.CAMPAIGN_SAVE));
  assert.equal(back.nightfall.intro.told, true); assert.equal(back.nightfall.lost[ph], 1); assert.equal(back.nightfall.notes.length, 1); assert.equal(back.nightfall.falls[0].region, 'residential');
  console.log('Nightfall controller passed: a v0.34 save restored from a file (the 长夜 card on the first frame, phases only from the next long night on), the alert bar and the journal telling tomorrow\'s phase, the journal\'s 夜相 row opening the report page with the eight phases, the 08:00 phase card, the banner and the alert bar naming the phase at 22:00, the farm drawn under all eight looks at two sizes, a lost night with next morning\'s card, the keepsake and the night notes, a fall in a ruin leaving a flag and one reminder, and save/parse.');
}

// v0.36.0「巨影」: a v0.35 save restored from a file (the 巨影 card on the first frame, one rumour a day in the toasts),
// the journal's today line opening the collection with the 十凶录 (unknown ones a black shape), 标出它的窝 opening the map
// with the lair pin and setting the gold marker, the rag-and-bone man asleep at his lair and woken (the first-meeting card,
// the titan boss bar inside the scene with its two phase marks and poise, no popup), all five drawn awake with their
// telegraphs at four sizes by day and by night with colour-safe hues, a win (one 倒下了 card and no second 打赢了 card,
// the trophy and the gear, the bar gone), the trophy given to the 十凶柜 at the archive, the book after the win, and save/parse.
{
  let clock = 36000000;
  const run = (n) => { for (let i = 0; i < n; i++) context.step((clock += 50)); };
  const card = () => document.querySelector('#zest-moment');
  const closeCards = () => { const m = context.inspect().moments; m.queue.length = 0; m.close(); };
  const sizes = (list = [[1366, 600], [1920, 900], [390, 480], [844, 240]]) => { for (const [w, hh] of list) { context.inspect().renderer.resize(w, hh, 1); context.step((clock += 20)); } context.inspect().renderer.resize(1366, 600, 1); };
  dailyOn = false;
  const TD = await import('../dist/titan-data.js');
  const NF = await import('../dist/nightfall.js');
  // ---------- 一份 v0.35 的旧档：主线打完，第 41 天上午；城区三张图、松林、冻土都开了 ----------
  const old = new NF.Engine(NF.newGameState(), () => {});
  const sc = old.sc;
  sc.act = 9; sc.claimed = ['act1', 'supply', 'act2', 'act3', 'act4', 'act5', 'act6', 'act7', 'act8']; sc.choice = 'ration';
  sc.letters = ['act1', 'act2', 'act3', 'act4', 'act5', 'act6', 'act7', 'act8', 'act9']; sc.flags.well = sc.flags.camp = sc.flags.farmerFed = true; sc.camp = { x: 560, y: 735 };
  old.r.claimed = RebuildData.TASKS.slice(0, RebuildData.TASKS.findIndex((x) => x.id === 'broadcast') + 1).map((x) => x.id); old.r.radio = true;
  old.o.hospital = 'water'; old.o.youke = true; old.o.lathe = { mode: 'parts', day: 0 }; old.o.toll = 'refuse'; old.o.raid.phase = 'won';
  old.assignRegion();
  old.ln.storyDay = 30; Object.assign(old.ct, { step: 4, done: true, region: 'residential', day: 35 });
  old.s.day = 41; old.s.minute = 600; old.s.weather = '晴朗'; old.s.stats.hordes = 6; old.c.nextHordeDay = 90;
  old.s.horde = { phase: 'won', timer: 0, remaining: 0, spawnTimer: 0, direction: 0 };
  if (old.feel?.open) old.feel.open.phase = 'done'; old.markGearIntro?.();
  if (old.nf?.intro) old.nf.intro.told = true;
  old.s.visited = { ...(old.s.visited || {}), residential: true };
  Object.assign(old.d.unlocked, { valley: true, courtyard: true, quarantine: true });
  Object.assign(old.b.unlocked, { pinewood: true, frost: true });
  context.open('restoreArchive', { files: { old: old.serialize() } }); clean();
  click('restoreCandidate', '0'); click('applyImport');
  let e = context.inspect().engine;
  assert.equal(context.inspect().menu, null);
  assert.ok(e.tg && e.tg.intro && !e.tg.intro.told, 'the titan record was added to the old save');
  e.paused = false; if (e.dy) e.dy.pending = null;
  closeCards();
  run(3);
  assert.equal(card().hidden, false, 'the 巨影 card is up'); assert.match(card().innerHTML, /巨影/); assert.match(card().innerHTML, /十凶/);
  assert.doesNotMatch(card().innerHTML, /按末日故事|undefined|NaN/);
  // 一天只说一凶（今天是河伯），说在提示栏里
  assert.equal(e.tg.rumor.hebo, 41); assert.equal(e.tg.rumor.scrap, undefined, 'one rumour a day');
  assert.match(document.querySelector('#toasts').innerHTML, /河伯/);
  run(80);
  assert.equal(card().hidden, true, 'and gone after its time');
  // ---------- 手记“今天”：点开是成就册里的十凶录；标出它的窝：世界地图上的牌子、金色路标 ----------
  context.open('journey'); clean();
  assert.ok(html().includes('河伯 · 溪谷试验田（天黑以后）'), 'the journal names the titan heard of today');
  click('wView', 'collection'); assert.equal(context.inspect().menu, 'outpost'); clean();
  assert.match(html(), /<h3>十凶录<\/h3>/); assert.match(html(), /一团黑影/); assert.match(html(), /听说过，还没碰上。/);
  assert.match(html(), /data-action="tMark" data-id="hebo"/); assert.doesNotMatch(html(), /data-action="tMark" data-id="scrap"/, 'only the ones heard of');
  assert.match(html(), /<b>十凶<\/b>/); assert.match(html(), /<b>十凶柜<\/b>/);
  click('tMark', 'hebo');
  assert.equal(context.inspect().menu, 'map', 'away from the river it opens the map'); clean();
  assert.match(html(), /far-pin u-pin night[^>]*>河伯的窝</);
  assert.equal(e.guidance.target.label, '河伯的窝', 'the gold marker points at the lair');
  click('close');
  // ---------- 雨巷：收破烂的在窝里睡着；醒了停一张卡片，血条在场景里，不弹窗 ----------
  e.travel('courtyard'); e.paused = false; run(2);
  const z = e.titansHere('scrap')[0];
  assert.ok(z && !z.awake, 'the rag-and-bone man sleeps at his lair');
  for (const q of e.enemies) if (!q.titan) q.dead = true;
  Object.assign(e.s.player, e.freePoint(z.x - 160, z.y + 40), { hp: 100 }); e.invulnerable = 999;
  e.titanWake(z); run(3);
  assert.equal(card().hidden, false, 'the first-meeting card'); assert.match(card().innerHTML, /收破烂的/);
  closeCards();
  const bar = document.querySelector('#boss-bar');
  assert.equal(bar.hidden, false, 'the boss bar shows'); assert.match(bar.innerHTML, /class="t-bar/); assert.match(bar.innerHTML, /<b>收破烂的<span class="t-title">/); assert.match(bar.innerHTML, /aria-label="收破烂的血"/);
  assert.equal((bar.innerHTML.match(/<em style="left:/g) || []).length, 2, 'two phase marks'); assert.match(bar.innerHTML, /class="t-poise/);
  assert.doesNotMatch(bar.innerHTML, /undefined|NaN/);
  assert.equal(context.inspect().menu, null, 'no popup for a titan');
  run(40); sizes();
  // ---------- 五凶醒着出招：四个大小，白天、夜里（色弱配色）；后五凶在下一段 ----------
  for (const id of TD.TITAN_IDS.slice(0, 5)) {
    const T = TD.TITANS[id];
    e._tForce = id; e.s.minute = id === 'hebo' ? 21 * 60 : 600;
    e.travel(T.region); e.paused = false; run(1); closeCards();
    for (const q of e.enemies) if (!q.titan) q.dead = true;
    const t = e.titansHere(id)[0]; assert.ok(t, id + ' is at its lair');
    Object.assign(e.s.player, e.freePoint(T.lair.x - 150, T.lair.y + 60), { hp: 100 }); e.invulnerable = 999;
    if (!t.awake) e.titanWake(t);
    run(30); closeCards();
    for (const [night, color] of [[false, false], [true, true]]) {
      e.s.minute = night ? 1380 : (id === 'hebo' ? 21 * 60 : 600); e.s.settings.access = { ...(e.s.settings.access || {}), color };
      run(6); sizes();
    }
    e.s.settings.access.color = false;
    assert.ok(e.tx.strikes.length + e.tx.zones.length + e.tx.rings.length > 0 || e.tg.tries[id] >= 1, id + ' fought');
    e._tForce = null;
  }
  // ---------- 打赢收破烂的：一张“倒下了”，不再多一张“打赢了”；战利品、凶器；血条收起 ----------
  e._tForce = 'scrap'; e.s.minute = 600; e.travel('courtyard'); e.paused = false; run(1); closeCards();
  const s2 = e.titansHere('scrap')[0]; for (const q of e.enemies) if (!q.titan) q.dead = true;
  Object.assign(e.s.player, e.freePoint(s2.x - 160, s2.y + 40), { hp: 100 }); e.invulnerable = 999;
  if (!s2.awake) e.titanWake(s2); run(2); closeCards();
  s2.inv = 0; s2.hp = 1; e.hurtEnemy(s2, 999, 0); run(3);
  assert.equal(e.tg.wins.scrap, 1, 'won');
  assert.equal(card().hidden, false); assert.match(card().innerHTML, /收破烂的 倒下了/);
  assert.ok(!context.inspect().moments.queue.some((m) => /^打赢了/.test(m.title || '')), 'no second card for the same win');
  assert.ok(e.qty('tTrophyScrap', true) >= 1 && e.qty('scrapShoes', true) >= 1, 'the trophy and the gear');
  closeCards(); run(2);
  assert.equal(bar.hidden, true, 'the bar goes away after the win');
  e._tForce = null;
  // ---------- 档案馆：十凶柜 ----------
  e.travel('farm'); e.paused = false; run(1); closeCards();
  e.w.museum.built = true; Object.assign(e.s.player, { x: WinterData.WSPOTS.museum.x, y: WinterData.WSPOTS.museum.y + 40 });
  context.open('outpost', { view: 'museum' }); clean();
  assert.match(html(), /十凶柜/); assert.match(html(), /data-action="tDonate" data-id="tTrophyScrap"/);
  click('tDonate', 'tTrophyScrap'); assert.deepEqual(e.tg.donated, ['tTrophyScrap']); clean();
  click('close');
  // ---------- 成就册：打赢以后的那一格 ----------
  context.open('outpost', { view: 'collection' }); clean();
  assert.match(html(), /打赢 1 回/); assert.match(html(), /第 \d+ 天回来（更难打）/); assert.match(html(), /地方变了：/);
  click('close');
  // 存档
  click('save'); assert.notEqual(context.inspect().menu, 'saveFail');
  const back = Campaign.Engine.parse(storage.get(Session.CAMPAIGN_SAVE));
  assert.equal(back.titan.intro.told, true); assert.equal(back.titan.wins.scrap, 1); assert.deepEqual(back.titan.donated, ['tTrophyScrap']); assert.equal(back.titan.rumor.hebo, 41);
  assert.ok(!Object.values(back.enemies || {}).some((list) => Array.isArray(list) && list.some((q) => q.titan)), 'no titan saved among the infected');
  console.log('Titan controller passed: a v0.35 save restored from a file (the 巨影 card on the first frame, one rumour a day in the toasts), the journal\'s today line opening the 十凶录 (unknown ones a black shape), 标出它的窝 opening the map with the lair pin and the gold marker, the rag-and-bone man woken at his lair (the first-meeting card, the titan bar inside the scene with two phase marks and poise, no popup), all five drawn awake with their telegraphs at four sizes by day and by night with colour-safe hues, a win with one 倒下了 card and no second 打赢了 card (trophy, gear, bar gone), the trophy given to the 十凶柜, the book after the win, and save/parse.');
}

// v0.37.0「扑火」: a v0.36 save restored from a file (the 后五凶 card on the first frame and gone after its time, no second 巨影 card),
// the last five drawn awake with their telegraphs at four sizes by day and by night (雕爷和看门的 on the chain with both in the boss
// bar, 黑潮's oil, 风口's lungs as part bars, 末班车 on the 25th floor, 扑火 on the farm), the final night by the clock (the radio three
// days ahead, the morning line, the 21:00 warning, no sleeping, 22:00 on the farm with the boss bar and no leaving), the win (one
// 最后一夜 card, no 倒下了 card, the last lamp, the 十凶碑 drawn by the memorial stone), the book after it, and save/parse.
{
  let clock = 37000000;
  const run = (n) => { for (let i = 0; i < n; i++) context.step((clock += 50)); };
  const card = () => document.querySelector('#zest-moment');
  const closeCards = () => { const m = context.inspect().moments; m.queue.length = 0; m.close(); };
  const sizes = (list = [[1366, 600], [1920, 900], [390, 480], [844, 240]]) => { for (const [w, hh] of list) { context.inspect().renderer.resize(w, hh, 1); context.step((clock += 20)); } context.inspect().renderer.resize(1366, 600, 1); };
  const toasts = () => document.querySelector('#toasts').innerHTML;
  dailyOn = false;
  const TD = await import('../dist/titan-data.js');
  const RD = await import('../dist/relight-data.js');
  // ---------- 一份 v0.36 的档：十凶记录是第 1 版、还没有最后一夜那一块；“巨影”那张早看过了 ----------
  const raw = JSON.parse(context.inspect().engine.serialize());
  raw.titan.schema = 1; delete raw.titan.final; delete raw.titan.intro2; raw.titan.intro = { day: raw.day, told: true };
  context.open('restoreArchive', { files: { old: JSON.stringify(raw) } }); clean();
  click('restoreCandidate', '0'); click('applyImport');
  let e = context.inspect().engine;
  assert.equal(context.inspect().menu, null);
  assert.equal(e.tg.schema, 2, 'the record is brought up to date');
  assert.ok(e.tg.intro2 && !e.tg.intro2.told && e.tg.final, 'one card about the last five, and the final night');
  e.paused = false; if (e.dy) e.dy.pending = null;
  closeCards(); run(3);
  assert.equal(card().hidden, false, 'the 后五凶 card is up'); assert.match(card().innerHTML, /后五凶/); assert.match(card().innerHTML, /最后一凶/);
  assert.doesNotMatch(card().innerHTML, /巨影|undefined|NaN/);
  run(80);
  assert.equal(card().hidden, true, 'and gone after its time');
  assert.equal(e.tg.intro2.told, true);
  // ---------- 后五凶醒着出招：四个大小，白天、夜里（色弱配色） ----------
  e.d.unlocked.railDepot = true; Object.assign(e.b.unlocked, { shipyard: true, shelter: true });
  for (const id of ['diao', 'tide', 'vent', 'train', 'moth']) {
    const T = TD.TITANS[id];
    e._tForce = id; e.s.minute = id === 'moth' ? 22 * 60 + 5 : 600;
    if (T.region === 'tunnel') {
      Object.assign(e.rl.tunnel, { key: { floor: T.floor, day: e.s.day, luck: false }, floor: T.floor, deepest: Math.max(e.rl.tunnel.deepest || 0, T.floor) });
      e.s.region = 'tunnel'; e.s.enemies.tunnel = null; e._tunnel = null; e.assignRegion();
    } else e.travel(T.region);
    e.paused = false; run(1); closeCards();
    assert.equal(e.s.region, T.region, id + ' in its map');
    for (const q of e.enemies) if (!q.titan) q.dead = true;
    const all = e.titansHere(id), t = all[0];
    assert.ok(t, id + ' is at its lair');
    if (T.parts) assert.equal(all.length, TD.partKeys(id).length, id + ' has all its parts');
    Object.assign(e.s.player, e.freePoint(T.lair.x - (id === 'moth' ? 340 : 170), T.lair.y + 60), { hp: 100 }); e.invulnerable = 999;
    if (!t.awake) e.titanWake(t);
    run(40); closeCards();
    const bar = document.querySelector('#boss-bar');
    assert.equal(bar.hidden, false, id + ' boss bar'); assert.match(bar.innerHTML, new RegExp('<b>' + T.name + '<span class="t-title">'));
    assert.doesNotMatch(bar.innerHTML, /undefined|NaN/);
    if (T.parts) {
      // 有几只的：每一只一小条，同名的排在一起
      assert.match(bar.innerHTML, /class="t-parts"/, id + ' part bars');
      assert.equal((bar.innerHTML.match(/class="t-pbar/g) || []).length, TD.partKeys(id).length, id + ' one bar each');
      for (const P of Object.values(T.parts)) assert.ok(bar.innerHTML.includes('<b>' + P.name + '</b>'), id + ' ' + P.name);
      assert.equal((bar.innerHTML.match(/<em style="left:/g) || []).length, 0, 'no hp marks when the parts decide the phases');
    }
    for (const [night, color] of [[false, false], [true, true]]) {
      e.s.minute = night ? 1380 : (id === 'moth' ? 22 * 60 + 30 : 600); e.s.settings.access = { ...(e.s.settings.access || {}), color };
      run(6); sizes();
    }
    e.s.settings.access.color = false;
    assert.ok(e.tx.strikes.length + e.tx.zones.length + (e.tx.waves || []).length > 0 || e.tg.tries[id] >= 1, id + ' fought');
    e._tForce = null;
    e.travel('farm'); e.paused = false; run(1); closeCards();
  }
  // ---------- 最后一夜：主线打完、七凶打赢、三颗余烬核；早上 7 点电台说三天后 ----------
  for (const id of TD.TITAN_IDS.slice(0, 7)) e.tg.first[id] ||= e.s.day;
  for (const id of RD.CORE_IDS.slice(0, 3)) e.grantCore(id);
  closeCards(); run(2);
  e.tg.final = { day: 0, on: 0, tries: 0, lost: 0, keep: 0, won: 0 };
  delete e.tg.first.moth; delete e.tg.perks.moth;
  e.isLongNight = () => false;
  assert.ok(e.titanOpen('moth'), 'the last one is coming');
  e.s.minute = 6 * 60 + 50; run(2);
  e.s.minute = 7 * 60 + 1; run(2);
  const fday = e.tg.final.day;
  assert.ok(fday >= e.s.day + 3, 'three days ahead');
  assert.match(toasts(), new RegExp('第 ' + fday + ' 天'), 'the radio names the day');
  // 那天早上、21:00；睡不过去
  e.s.day = fday; e.s.minute = 7 * 60 + 2; run(2);
  assert.match(toasts(), /今晚 22:00/);
  e.s.minute = 21 * 60 + 1; run(2);
  assert.match(toasts(), /一小时后到/);
  assert.equal(e.sleep(), false, 'no sleeping through it');
  // 22:00：在农场打起来，血条、四盏光；走不开
  e.s.minute = 22 * 60; run(3); closeCards();
  assert.ok(e.finalLive(), 'the final night is on');
  const body = e.titansHere('moth').find((q) => q.part === 'body');
  assert.ok(body, 'it came out of the east woods');
  assert.equal(e.titansHere('moth').filter((q) => q.part === 'light').length, 4, 'four lights');
  Object.assign(e.s.player, e.freePoint(body.x - 360, body.y + 40), { hp: 100 }); e.invulnerable = 999;
  run(20); closeCards();
  const bar = document.querySelector('#boss-bar');
  assert.equal(bar.hidden, false); assert.match(bar.innerHTML, /<b>扑火<span class="t-title">/); assert.match(bar.innerHTML, /<b>光<\/b>/);
  assert.equal(e.travel('valley'), false, 'no leaving'); assert.equal(e.s.region, 'farm');
  assert.match(toasts(), /走不开/);
  sizes();
  // ---------- 打赢：四盏光、那颗心；一张“最后一夜”，没有“倒下了” ----------
  for (const L of e.titansHere('moth').filter((q) => q.part === 'light')) { L.inv = 0; L.dim = false; L.hp = 1; e.hurtEnemy(L, 999, 0); }
  run(4);
  const b2 = e.titansHere('moth').find((q) => q.part === 'body');
  assert.ok(b2 && b2.tp >= 1, 'the lights are out');
  e.tx.waves = []; Object.assign(b2, { hidden: false, act: null, heart: true, inv: 0, hp: 1 });
  closeCards();
  e.hurtEnemy(b2, 999, 0); run(3);
  assert.equal(e.tg.wins.moth, 1, 'won the last one');
  assert.ok(e.tg.final.won && !e.finalLive(), 'the night is over');
  assert.equal(card().hidden, false); assert.match(card().innerHTML, /最后一夜/); assert.match(card().innerHTML, /十凶的名号/);
  assert.ok(!context.inspect().moments.queue.some((m) => /倒下了|^打赢了/.test(m.title || '')), 'one card for the last win');
  assert.ok(e.qty('tTrophyMoth', true) >= 1, 'the last lamp');
  assert.ok(e.tg.perks.moth, 'the 十凶碑 stands');
  closeCards(); run(2);
  assert.equal(bar.hidden, true, 'the bar goes away');
  // 纪念石旁的十凶碑（画出来不出错）
  const plaza = e.objects.find((o) => o.type === 'seasonPlaza');
  if (plaza) { Object.assign(e.s.player, e.freePoint(plaza.x - 200, plaza.y + 30)); run(4); sizes(); }
  // 成就册：最后一凶那一格（十张小像是 base64 的图，查违禁词时先拿掉——图里的字母碰巧拼出 NaN 不算）
  const plain = () => html().replace(/data:[a-z]+\/[a-z+.-]+;base64,[A-Za-z0-9+\/=]+/g, '');
  context.open('outpost', { view: 'collection' });
  { const m = plain().match(/机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN/); assert.ok(!m, 'collection: ' + (m && plain().slice(Math.max(0, m.index - 120), m.index + 40))); }
  assert.match(html(), /那一夜守住了/); assert.doesNotMatch(html(), /data-action="tMark" data-id="moth"/);
  click('close');
  // 存档
  click('save'); assert.notEqual(context.inspect().menu, 'saveFail');
  const back = Campaign.Engine.parse(storage.get(Session.CAMPAIGN_SAVE));
  assert.equal(back.titan.schema, 2); assert.equal(back.titan.intro2.told, true); assert.equal(back.titan.wins.moth, 1); assert.ok(back.titan.final.won);
  assert.ok(!Object.values(back.enemies || {}).some((list) => Array.isArray(list) && list.some((q) => q.titan || q.tMan)), 'no titan or raider of his saved among the infected');
  console.log('Titan II controller passed: a v0.36 save restored from a file (the 后五凶 card on the first frame and gone after its time, no second 巨影 card), the last five drawn awake with their telegraphs at four sizes by day and by night (part bars in the boss bar, one per part, grouped by name), the final night by the clock (the radio three days ahead, the morning line, the 21:00 warning, no sleeping, 22:00 on the farm with four lights and no leaving), the win (one 最后一夜 card, no 倒下了 card, the last lamp, the 十凶碑 drawn), the book after it, and save/parse.');
}

// v0.38.0「修缮」: the stuck escape through the real pages — the settings row can't be pressed while you can walk out (and says why;
// 被抓着 says so too), a ring of fences round you makes it pressable, one press moves you to where the exit is reachable and closes the
// page, then 稍等 for a few seconds; the phone menu's 脱困 tile the same way; standing inside a new bed moves you out by itself; the
// touch 部位 button next to an elite; 睡到早上 8 点 after midnight in the farmhouse; a save refused for a data reason says so (and a full
// browser still says the space ran out); and save/parse.
{
  let clock = 38000000;
  const run = (n) => { for (let i = 0; i < n; i++) context.step((clock += 50)); };
  const closeCards = () => { const m = context.inspect().moments; m.queue.length = 0; m.close(); };
  const toasts = () => document.querySelector('#toasts').innerHTML;
  const T = MendData.MEND_TEXT, M = MendData.MEND;
  const e = context.inspect().engine;
  dailyOn = false;
  if (e.s.region !== 'farm') e.travel('farm');
  e.paused = false; if (e.dy) e.dy.pending = null; closeCards(); run(2);
  e.invulnerable = 999;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const stuck = () => e.blocked(e.s.player.x, e.s.player.y, false, M.r);
  const added = [];
  const addB = (type, x, y, extra = {}) => { const b = { id: 'mend-' + type + '-' + added.length, type, x, y, rotation: 0, hp: Data.BUILDINGS[type].hp, open: false, ...extra }; e.s.buildings.push(b); added.push(b.id); e.navRevision = (e.navRevision || 0) + 1; return b; };
  // 农场上一处空地（四周没有设施、田和交互的东西）
  let at = null;
  for (let y = 560; y < 960 && !at; y += 20) for (let x = 600; x < 1500 && !at; x += 20) {
    const p = { x, y };
    if (e.blocked(x, y, false, 70) || e.s.plots.some((q) => dist(q, p) < 170) || e.objects.some((o) => dist(o, p) < 170)) continue;
    if (dist(p, Data.REGIONS.farm.exit) < 260 || dist(p, M.home) < 200) continue;
    at = p;
  }
  assert.ok(at, 'an open spot on the farm');
  Object.assign(e.s.player, at); e.navCache = null; e._mendAt = 0; e._mendWhy = null; run(1);
  // ---------- 走得出去：设置里那一行按不了，写着为什么 ----------
  context.open('pause'); clean();
  assert.ok(html().includes(T.row.title), 'the row is in the settings');
  assert.match(html(), /data-action="mendUnstuck" disabled/);
  assert.ok(html().includes(T.why.free), 'and says why');
  click('mendUnstuck'); assert.equal(context.inspect().menu, 'pause', 'a disabled button does nothing');
  click('close');
  // 手机的快捷菜单：脱困那一格也按不了，写一句短的
  click('xView', 'phone'); clean();
  assert.ok(html().includes('>' + T.tile + '<small>' + T.short.free + '</small>'), 'the 脱困 tile with its short reason');
  assert.match(html(), /class="phone-tile" data-action="mendUnstuck" disabled/);
  click('close');
  // ---------- 一圈围栏围死：按一下挪出去 ----------
  for (const dx of [-72, 0, 72]) { addB('fence', at.x + dx, at.y - 60); addB('fence', at.x + dx, at.y + 60); }
  for (const dy of [-60, -36, 36, 60]) { addB('fence', at.x - 110, at.y + dy, { rotation: 1 }); addB('fence', at.x + 110, at.y + dy, { rotation: 1 }); }
  run(1);
  assert.equal(stuck(), false, 'not inside anything');
  // 被抓着的时候不行
  e.gx.grab = { z: null }; e._mendWhy = null;
  context.open('pause'); assert.ok(html().includes(T.why.grabbed), 'grabbed: free yourself first'); click('close');
  e.gx.grab = null; e._mendWhy = null;
  context.open('pause'); clean();
  assert.doesNotMatch(html(), /data-action="mendUnstuck" disabled/, 'walled in: the button can be pressed');
  assert.ok(html().includes(T.row.desc));
  click('mendUnstuck');
  assert.equal(context.inspect().menu, null, 'the page closes');
  assert.ok(dist(e.s.player, at) > 60, 'moved out of the ring');
  assert.equal(stuck(), false);
  assert.ok(toasts().includes(T.moved), 'and says so');
  context.open('pause'); assert.ok(html().includes(T.why.cool), 'a few seconds before the next one'); click('close');
  e._mendAt = 0; e._mendWhy = null;
  assert.equal(e.unstuckReason(), T.why.free, 'where it put you reaches the exit');
  // 再回到圈里，从手机的快捷菜单挪
  Object.assign(e.s.player, at); e.navCache = null; e._mendWhy = null;
  click('xView', 'phone');
  assert.doesNotMatch(html(), /data-action="mendUnstuck" disabled/);
  click('mendUnstuck');
  assert.equal(context.inspect().menu, null);
  assert.ok(dist(e.s.player, at) > 60 && !stuck());
  e.s.buildings = e.s.buildings.filter((b) => !added.includes(b.id)); e.navRevision++; added.length = 0;
  // ---------- 站进新放的床里：自己挪出来 ----------
  // （提示栏里同一句话 45 秒内第二遍只飘字，所以看引擎说了没有）
  const said = [], say = e.toast; e.toast = function (t, tone) { said.push(t); return say.call(this, t, tone); };
  Object.assign(e.s.player, at); e.navCache = null; e._mendSaid = 0; e._mendAt = 0;
  addB('bed', at.x, at.y);
  assert.ok(stuck(), 'standing inside the bed');
  run(8);
  assert.equal(stuck(), false, 'moved out by itself');
  assert.ok(dist(e.s.player, at) < 90, 'to somewhere close');
  assert.ok(said.includes(T.pushed), 'and says so'); e.toast = say;
  e.s.buildings = e.s.buildings.filter((b) => !added.includes(b.id)); e.navRevision++; added.length = 0;
  // ---------- 触屏：精英身边的“部位”按钮 ----------
  const aim = () => document.querySelector('[data-action="touchAim"]');
  context.hud();
  assert.equal(aim().hidden, true, 'no elite near: no button');
  const g = e.enemy('elite', e.s.player.x + 220, e.s.player.y);
  e.enemies.push(g);
  e.f.aimPart = 'armor'; context.hud();
  assert.equal(aim().hidden, false, 'an elite near: the button shows');
  assert.equal(aim().textContent, T.aim + '·装甲');
  click('touchAim');
  assert.equal(e.f.aimPart, 'legs', 'one tap switches the part');
  assert.equal(aim().textContent, T.aim + '·腿');
  g.dead = true; context.hud();
  assert.equal(aim().hidden, true, 'gone with the elite');
  e.f.aimPart = 'armor';
  // ---------- 过了半夜回农舍：睡到当天早上 8 点 ----------
  e.advanceMinutes(1440 - e.s.minute + 2 * 60); closeCards();
  if (e.dy) e.dy.pending = null;
  const day = e.s.day;
  const napWhy = () => JSON.stringify({ region: e.s.region, minute: e.s.minute, day: e.s.day, lnNap: e.lnNapOk?.(), finalNap: e.finalNapOk?.(), lnNight: !!e.ln?.night, lnPending: e.lnPending?.(), final: e.tg?.final, daily: !!(e.dy && e.dailyCard?.()), deferred: e.dailyDeferred?.(), horde: e.s.horde?.phase, raid: e.raidState?.()?.phase, echo: e.activeEvents?.().map((d) => d.id) });
  assert.ok(e.mendNapOk(), 'a quiet night past midnight ' + napWhy());
  context.open('home'); clean();
  assert.ok(html().includes(T.napButton) && html().includes(T.napNote), 'the farmhouse says so');
  click('sleep');
  assert.equal(e.s.day, day, 'the same day');
  assert.equal(e.s.minute, M.napUntil, 'at eight in the morning');
  if (context.inspect().menu) click('close');
  closeCards(); run(2);
  // ---------- 存不进去：记录对不上照实说；浏览器满了才说空间 ----------
  const keep = e.s.buildings;
  e.s.buildings = keep.concat(Array.from({ length: 301 - keep.length > 0 ? 301 - keep.length : 1 }, (_, i) => ({ id: 'mend-x' + i, type: 'fence', x: 200 + (i % 40) * 4, y: 1000, rotation: 0, hp: Data.BUILDINGS.fence.hp, open: false })));
  click('save');
  assert.equal(context.inspect().menu, 'saveFail'); clean();
  assert.ok(html().includes('存档里有一处记录对不上') && html().includes('（存档超出当前版本支持范围）'), 'a data problem is named as one');
  assert.ok(!html().includes('浏览器的空间不够'), 'not blamed on the browser');
  assert.ok(html().includes('不要清理浏览器的数据'));
  click('close');
  e.s.buildings = keep; e.navRevision++;
  failSave = true; click('save');
  assert.equal(context.inspect().menu, 'saveFail'); assert.ok(html().includes('浏览器的空间不够'), 'a full browser still says so');
  failSave = false; click('close');
  // 存档：没有新字段，读回来还是一样
  click('save'); assert.notEqual(context.inspect().menu, 'saveFail');
  const back = Campaign.Engine.parse(storage.get(Session.CAMPAIGN_SAVE));
  assert.equal(back.region, e.s.region);
  assert.ok(!Object.values(back.enemies || {}).some((list) => Array.isArray(list) && list.some((q) => q.dead)), 'no dead infected saved');
  assert.ok(!('mend' in back), 'no new save field');
  console.log('Mend controller passed: the settings row and the phone 脱困 tile cannot be pressed while you can walk out and say why (被抓着 too), a ring of fences makes them pressable and one press moves you to where the exit is reachable and closes the page (then 稍等), standing inside a new bed moves you out by itself, the touch 部位 button shows next to an elite and switches the part, 睡到早上 8 点 after midnight wakes at eight the same day, a save refused for a data reason says so (a full browser still says the space ran out), and save/parse.');
}

// v0.39.0「一物一用」: one thing, one job, through the real pages — the phone opens the ten menus (each with its line; 拍照 and 脱困
// kept), a tile opens its page with the card on top (人 has 麦穗's button), the top-bar numbers open their cards (a second click or a
// click elsewhere closes them; the date card's button opens the calendar), the terminal via E opens only the letters, a damaged tower
// via E shows its card with 修好它 (repaired by the button), the build page in four groups with 拆掉一样设施 (the next click on a
// building opens its card with 拆掉它; Esc or empty ground cancels), the craft page lists only hand recipes and a workbench only its own,
// the farmhouse only rests, an item's card, a locked gate via E opens 修通路 (the button opens the road, then E goes in and the exit
// brings you back), the touch button says what E does, a drop on the farm and a finished batch go into storage by themselves, one line
// over the thing you face (no other thing's name drawn) at four sizes by day and night, and save/parse.
{
  let clock = 39000000;
  const run = (n) => { for (let i = 0; i < n; i++) context.step((clock += 50)); };
  const closeCards = () => { const m = context.inspect().moments; m.queue.length = 0; m.close(); };
  const press = (key) => { listeners.keydown({ key, target: { matches: () => false }, preventDefault() {}, repeat: false }); listeners.keyup({ key }); };
  const toasts = () => document.querySelector('#toasts').innerHTML;
  const ui = () => context.inspect();
  const D = SimpleData;
  const e = ui().engine;
  dailyOn = false;
  if (e.s.region !== 'farm') e.travel('farm');
  e.paused = false; if (e.dy) e.dy.pending = null; closeCards(); run(2);
  e.invulnerable = 999;
  const keysBefore = Object.keys(JSON.parse(e.serialize()));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  // 面前就是这一样（别的东西不挡着）
  const face = (o) => { e.nearestObject = () => o; Object.assign(e.s.player, { x: o.x, y: o.y + 24 }); };
  const unface = () => { delete e.nearestObject; };
  const ctxLine = () => document.querySelector('#context').innerHTML;
  // ---------- 手机：菜单十项 ----------
  click('xView', 'phone'); clean();
  assert.equal(ui().menu, 'sx'); assert.equal(ui().menuArgs.view, 'menus');
  assert.equal(D.MENUS.length, 10);
  for (const [name, line] of D.MENUS) assert.ok(html().includes('<b>' + name + '</b><small>' + line + '</small>'), 'menu ' + name);
  assert.match(html(), /data-action="fPhoto"/); assert.match(html(), /data-action="mendUnstuck"/);
  // 人：最上面一张卡，麦穗那一格
  e.f.dog.rescued = true;
  const people = D.MENUS.find(([n]) => n === '人')[2];
  click(people.action, people.id); clean();
  assert.equal(ui().menu, 'outpost'); assert.equal(ui().outpostUI.view, 'people');
  assert.match(html(), /data-sx-card="page:people"/);
  assert.ok(e.dogReady?.(), '麦穗 is home'); assert.match(html(), /data-action="xView" data-id="dog"/);
  click('close');
  // ---------- 顶栏的数：点一下看卡 ----------
  context.hud();
  if (!document.body.appendChild) document.body.appendChild = (el) => { document.body.append(el); return el; };
  const tap = (el) => listeners.click({ target: el, detail: 1 });
  const date = document.querySelector('#date');
  tap(date);
  const pop = document.querySelector('#sx-pop');
  assert.ok(pop && !pop.hidden, 'the date opens its card');
  assert.ok(pop.innerHTML.includes('<h3>' + D.HUD_CARD.date[0] + '</h3>'));
  tap(date); assert.equal(pop.hidden, true, 'a second click closes it');
  for (const key of ['time', 'weather', 'money', 'food', 'cold', 'noise', 'hp', 'stamina', 'hunger']) {
    const el = document.querySelector('[data-sx="' + key + '"]');
    assert.ok(el, 'the ' + key + ' number can be clicked');
    tap(el); assert.equal(pop.hidden, false, key);
    assert.ok(pop.innerHTML.includes('<h3>' + D.HUD_CARD[key][0] + '</h3>'), key);
    assert.doesNotMatch(pop.innerHTML, /undefined|NaN/);
  }
  tap(document.querySelector('#world')); assert.equal(pop.hidden, true, 'a click elsewhere closes it');
  tap(date); tap(pop.querySelector('[data-action="sView"]'));
  assert.equal(ui().menu, 'outpost'); assert.equal(ui().outpostUI.view, 'calendar'); assert.equal(pop.hidden, true, 'the card goes when its page opens');
  click('close');
  // ---------- 联盟终端：只读来信 ----------
  const sign = e.objects.find((o) => o.type === 'sign');
  face(sign); context.hud();
  const signVerb = e.simpleLabel(sign).split(' · ')[1];
  assert.ok(ctxLine().includes('联盟终端 · ' + signVerb));
  assert.match(signVerb, /来信|回信/);
  press('e'); run(2);
  assert.equal(ui().menu, 'sx'); assert.equal(ui().menuArgs.view, 'letters'); clean();
  assert.match(html(), /data-sx-card="sign"/);
  assert.doesNotMatch(html(), /journal-options|outpost-strip|收到的消息/);
  click('close');
  unface();
  // ---------- 农场上一处空地 ----------
  let at = null;
  const Wd = Data.WORLD || { w: 2400, h: 1400 };
  for (const room of [170, 130]) for (let y = 200; y < Wd.h - 160 && !at; y += 20) for (let x = 200; x < Wd.w - 200 && !at; x += 20) {
    const p = { x, y };
    if (e.blocked(x, y, false, 70) || e.blocked(x, y + 60, false, 30) || e.s.plots.some((q) => dist(q, p) < room) || e.objects.some((o) => dist(o, p) < room) || e.s.buildings.some((b) => dist(b, p) < room)) continue;
    if (dist(p, Data.REGIONS.farm.exit) < 260) continue;
    at = p;
  }
  assert.ok(at, 'an open spot on the farm');
  // ---------- 坏了的塔：按交互看卡，“修好它” ----------
  const tower = { id: 'sx-tower', type: 'tower', x: at.x, y: at.y, rotation: 0, hp: 20, open: false };
  e.s.buildings.push(tower); e.navRevision = (e.navRevision || 0) + 1;
  Object.assign(e.s.player, { x: at.x, y: at.y + 60 }); e.navCache = null; context.hud();
  const near = e.nearestObject();
  assert.equal(near?.building, tower, 'the tower is what you face');
  assert.equal(e.context(near), Data.BUILDINGS.tower.name.split(' · ')[0].slice(0, D.NAME_CUT) + ' · 修好它');
  assert.ok(ctxLine().includes('修好它'));
  press('e'); run(1);
  assert.equal(ui().menu, 'building'); assert.equal(ui().menuArgs.buildingId, 'sx-tower'); clean();
  assert.match(html(), /data-action="repair" data-id="sx-tower"[^>]*>修好它/);
  e.s.inventory.wood = (e.s.inventory.wood || 0) + 10; e.s.inventory.scrap = (e.s.inventory.scrap || 0) + 10;
  click('repair', 'sx-tower');
  assert.ok(tower.hp > 20, 'repaired');
  click('close');
  // ---------- 建造页：四组；拆掉一样设施 ----------
  context.open('build'); clean();
  for (const t of ['种地', '吃住', '防守', '摆件']) assert.ok(html().includes('<h3 class="sx-group">' + t + '</h3>'), t);
  assert.match(html(), /data-action="rOpen" data-id="frontier:rooms"/);
  click('sxDismantle'); assert.equal(ui().menu, null); context.hud();
  const banner = document.querySelector('#building-banner');
  assert.equal(banner.hidden, false); assert.match(banner.textContent, /拆东西/);
  press('Escape'); context.hud();
  assert.equal(banner.hidden, true, 'Esc: not dismantling'); assert.equal(ui().menu, null, 'and Esc did not open the settings');
  const R = ui().renderer, world = document.querySelector('#world');
  const pointAt = (pt) => { R.worldPoint = () => pt; world.events.pointerdown({ clientX: 683, clientY: 356, button: 0 }); delete R.worldPoint; listeners.pointerup?.(); };
  context.open('build'); click('sxDismantle');
  pointAt({ x: at.x + 420, y: at.y + 300 });
  assert.equal(ui().menu, null); assert.ok(toasts().includes('没点在设施上，不拆了'), 'empty ground: nothing pulled down');
  assert.ok(e.s.buildings.includes(tower));
  context.open('build'); click('sxDismantle');
  pointAt({ x: tower.x + 10, y: tower.y });
  assert.equal(ui().menu, 'building'); assert.equal(ui().menuArgs.confirm, true); clean();
  assert.match(html(), /data-action="dismantle" data-id="sx-tower"[^>]*>拆掉它/);
  // 手指抬起来时浏览器补发的那一下点击落在刚打开的卡上：不算（不然正好落在“拆掉它”上就直接拆了）
  const ghost = document.querySelector('[data-action="dismantle"]');
  assert.ok(ghost, 'the 拆掉它 button is on the card');
  listeners.click({ target: ghost, detail: 1 });
  assert.ok(e.s.buildings.includes(tower), 'the click that comes with the tap does not pull it down');
  assert.equal(ui().menu, 'building');
  const cost = Object.keys(Data.BUILDINGS.tower.cost || {}), had = cost.reduce((n, k) => n + e.qty(k), 0);
  click('dismantle', 'sx-tower');
  assert.ok(!e.s.buildings.includes(tower), 'the tower is gone');
  assert.ok(cost.reduce((n, k) => n + e.qty(k), 0) > had, 'half its materials back');
  // ---------- 制作：只有随手做的；工作台只有它的 ----------
  context.open('craft'); clean();
  for (const r of Data.RECIPES) assert.equal(html().includes('data-action="craft" data-id="' + r.id + '"'), !r.station, 'craft menu: ' + r.id);
  click('close');
  const bench = { id: 'sx-bench', type: 'workbench', x: at.x, y: at.y, rotation: 0, hp: Data.BUILDINGS.workbench.hp, open: false };
  e.s.buildings.push(bench);
  context.open('station', { buildingId: 'sx-bench' }); clean();
  assert.match(html(), /data-sx-card="b:workbench"/);
  for (const r of Data.RECIPES) assert.equal(html().includes('data-action="craft" data-id="' + r.id + '"'), r.station === 'workbench', 'workbench: ' + r.id);
  click('close'); e.s.buildings = e.s.buildings.filter((b) => b !== bench); e.navRevision++;
  // ---------- 农舍：只休息 ----------
  context.open('home'); clean();
  const acts = [...new Set([...html().matchAll(/data-action="([^"]+)"/g)].map((m) => m[1]))].filter((a) => a !== 'close').sort();
  assert.deepEqual(acts, ['sleep', 'waitUntilNight'], 'the farmhouse: sleep or wait for the night');
  click('close');
  // ---------- 背包里一样东西：说明卡 ----------
  e.s.inventory.radish = Math.max(1, e.s.inventory.radish || 0);
  context.open('inventory'); click('item', 'radish'); clean();
  assert.match(html(), /class="sx-does"/); assert.match(html(), /<b>现在：<\/b>身上 \d+ 份 · 仓库 \d+ 份/);
  click('close');
  // ---------- 入口：没修通是“修通路”那张卡；修通了按交互就进去，出口按交互就回来 ----------
  const gate = e.objects.find((o) => o.type === 'districtGate');
  assert.ok(gate, 'a district gate on the farm');
  const gid = gate.district, gdef = DistrictData.DISTRICTS[gid];
  e.d.unlocked[gid] = false;
  face(gate); context.hud();
  assert.ok(ctxLine().includes('· 修通路'));
  press('e'); run(1);
  assert.equal(ui().menu, 'sx'); assert.equal(ui().menuArgs.view, 'gate'); clean();
  assert.match(html(), new RegExp('data-action="dUnlock" data-id="' + gid + '"'));
  // 还差一步（这一档里还没收过菜）：卡上写着为什么，按钮按不了
  if (e.districtUnlockReason(gid)) {
    assert.ok(html().includes(e.districtUnlockReason(gid)), 'the card says what is missing');
    assert.match(html(), new RegExp('data-action="dUnlock" data-id="' + gid + '" disabled'));
    if (gid === 'valley') e.s.stats.harvested = Math.max(1, e.s.stats.harvested || 0);
    context.open('sx', { view: 'gate', id: gid, kind: 'district' }); clean();
  }
  assert.doesNotMatch(html(), new RegExp('data-action="dUnlock" data-id="' + gid + '" disabled'), 'ready: the button can be pressed');
  for (const [k, n] of Object.entries(gdef.cost || {})) e.s.inventory[k] = (e.s.inventory[k] || 0) + n;
  Object.assign(e.s.player, gdef.gate);
  click('dUnlock', gid); assert.ok(e.d.unlocked[gid], 'the road is open');
  if (ui().menu) click('close');
  face(gate); context.hud(); assert.ok(ctxLine().includes('· 进去'));
  press('e'); run(1); unface();
  assert.equal(e.s.region, gid, 'E goes straight in');
  const exit = e.objects.find((o) => o.type === 'districtExit');
  face(exit); press('e'); run(1); unface();
  assert.equal(e.s.region, gdef.parent, 'and the exit straight back');
  if (e.s.region !== 'farm') e.travel('farm');
  closeCards(); if (ui().menu) click('close');
  // ---------- 触屏的交互键写着按下去做什么 ----------
  const ship = e.objects.find((o) => o.type === 'outpostShipping');
  assert.ok(ship, 'the shipping box');
  face(ship); context.hud();
  const want = e.context(ship).split(' · ').slice(1).join(' · ');
  assert.equal(document.querySelector('#touch-interact').textContent, want.length <= 8 && !/E|键/.test(want) ? want : '交互', 'the touch button: ' + want);
  unface(); Object.assign(e.s.player, at); e.navCache = null; context.hud();
  assert.ok(!e.nearestObject(), 'nothing in front'); assert.equal(document.querySelector('#touch-interact').textContent, '交互', 'nothing in front: 交互');
  // ---------- 掉在农场上的、做好的：自己进仓库 ----------
  const scrap0 = e.s.storage.scrap || 0;
  e.s.drops.push({ region: 'farm', x: at.x, y: at.y, items: { scrap: 2 } });
  run(1);
  assert.equal(e.s.storage.scrap, scrap0 + 2); assert.ok(!e.s.drops.some((d) => d.region === 'farm'));
  assert.ok(toasts().includes('掉的东西直接送进了仓库'));
  const rec = Data.RECIPES.find((x) => x.id === 'trailBread'), out = Object.keys(rec.out)[0], had2 = e.s.storage[out] || 0;
  e.c.production.push({ id: 'sx-job', recipe: rec.id, out: { ...rec.out }, cost: {}, station: rec.station || 'cook', remaining: 0, ready: true });
  run(1);
  assert.ok(!e.c.production.some((j) => j.id === 'sx-job')); assert.equal(e.s.storage[out], had2 + rec.out[out]);
  assert.ok(toasts().includes('做好了，放进了仓库'));
  // ---------- 场景里只写面前那一样 ----------
  // v0.40 起最上面多了一层（镜头）：找到“场景里的字”那一层（有 slOwners 的），拦它下面那一层
  let SP = Renderer.prototype;
  while (SP && !Object.prototype.hasOwnProperty.call(SP, 'slOwners')) SP = Object.getPrototypeOf(SP);
  const P = Object.getPrototypeOf(SP), baseText = P.text, baseBadge = P.badge;
  const ownText = Object.prototype.hasOwnProperty.call(P, 'text'), ownBadge = Object.prototype.hasOwnProperty.call(P, 'badge');
  const drawn = [];
  P.text = function (label, ...a) { drawn.push({ label: String(label), gate: !!this._sl }); return baseText.call(this, label, ...a); };
  P.badge = function (label, ...a) { drawn.push({ label: String(label), gate: !!this._sl }); return baseBadge.call(this, label, ...a); };
  const minute = e.s.minute;
  try {
    face(ship);
    const line = e.simpleLabel(ship);
    const others = e.objects.filter((o) => o !== ship && o.name && !['exit', 'districtExit', 'beyondExit'].includes(o.type) && o.name !== ship.name).map((o) => o.name);
    for (const night of [false, true]) {
      e.s.minute = night ? 22 * 60 + 30 : 10 * 60;
      for (const [w, h] of [[1366, 600], [1920, 900], [390, 480], [844, 240]]) {
        R.resize(w, h, 1); drawn.length = 0;
        R.draw(e, { x: w / 2, y: h / 2 }, 0.05);
        assert.ok(drawn.some((d) => d.label === line), 'the line over the thing you face at ' + w + 'x' + h + (night ? ' by night' : ''));
        const shown = others.filter((n) => drawn.some((d) => d.gate && d.label === n));
        assert.deepEqual(shown, [], 'no other thing\'s name at ' + w + 'x' + h);
      }
    }
  } finally {
    if (ownText) P.text = baseText; else delete P.text;
    if (ownBadge) P.badge = baseBadge; else delete P.badge;
    e.s.minute = minute; unface();
  }
  R.resize(1366, 600, 1); run(1);
  // 存档：没有新字段
  click('save'); assert.notEqual(ui().menu, 'saveFail');
  const back = JSON.parse(storage.get(Session.CAMPAIGN_SAVE));
  assert.deepEqual(Object.keys(back).filter((k) => !keysBefore.includes(k)), [], 'no new save field');
  Campaign.Engine.parse(storage.get(Session.CAMPAIGN_SAVE));
  console.log('Simple controller passed: the phone opens the ten menus (拍照 and 脱困 kept) and 人 opens its page with the card and 麦穗\'s button, the top-bar numbers open their cards (a second click or a click elsewhere closes them, the date card opens the calendar), the terminal via E opens only the letters, a damaged tower via E shows its card and 修好它 repairs it, the build page in four groups, 拆掉一样设施 then a click on the tower opens 拆掉它 (Esc and empty ground cancel), the craft page lists only hand recipes and the workbench only its own, the farmhouse only rests, an item card, a locked gate via E opens 修通路 (opened by the button, E goes in, the exit brings you back), the touch button says what E does, a drop and a finished batch go into storage, one line over the thing you face with no other name drawn at four sizes by day and night, and save/parse.');
}
// ================= v0.40.0「一套」：Esc 开菜单十项、换手里的东西当场就画、页名、顶栏分左中右 =================
{
  const ui = () => context.inspect();
  const press = (key) => { listeners.keydown({ key, target: { matches: () => false }, preventDefault() {}, repeat: false }); listeners.keyup({ key }); };
  for (let i = 0; i < 6 && ui().menu; i++) click('close');
  assert.equal(ui().menu, null);
  const e = ui().engine;
  e.paused = false;
  // Esc：没开页面时开菜单十项，开着时关上
  press('Escape');
  assert.equal(ui().menu, 'sx', 'Esc opens the ten menus');
  assert.equal(ui().menuArgs.view, 'menus');
  const modal = document.querySelector('#modal');
  assert.equal(modal.dataset.page, 'sx');
  assert.equal(modal.dataset.view, 'menus');
  assert.match(html(), /data-action="sxOpen" data-id="messages"/);
  press('Escape');
  assert.equal(ui().menu, null, 'a second Esc closes it');
  // 换手里的东西：按 2，快捷栏当场换（不等下一次刷新）
  e.paused = false;
  press('3');
  press('2');
  assert.equal(e.s.slot, 1);
  const slots = document.querySelectorAll('.hot-slot');
  assert.equal(slots.findIndex((b) => b.className.split(' ').includes('active')), 1, 'the hotbar shows the new slot at once');
  // 每一页标上是哪一页（样式按页排）
  context.open('inventory');
  assert.equal(document.querySelector('#modal').dataset.page, 'inventory');
  click('close');
  context.open('build');
  assert.equal(document.querySelector('#modal').dataset.page, 'build');
  assert.match(html(), /data-action="build"/, 'the build buttons are still on the page');
  click('close');
  context.open('outpost', { view: 'people' });
  assert.equal(document.querySelector('#modal').dataset.page, 'outpost');
  assert.equal(document.querySelector('#modal').dataset.view, 'people');
  click('close');
  // 顶栏分左中右，原来的那些数还在（手机上照旧排）
  assert.ok(document.querySelector('.hud-left'));
  assert.ok(document.querySelector('.hud-right'));
  for (const id of ['stat-bars', 'date', 'time', 'weather', 'money', 'food-days', 'region-label']) assert.ok(document.querySelector('#' + id), id);
  // 存档：没有新字段
  const keys0 = Object.keys(JSON.parse(e.serialize()));
  click('save');
  assert.deepEqual(Object.keys(JSON.parse(storage.get(Session.CAMPAIGN_SAVE))).filter((k) => !keys0.includes(k)), [], 'no new save field');
  console.log('Look controller passed: Esc opens the ten menus and closes them, a number key switches the hotbar at once, each page is marked with its name (inventory, build, people), the top bar split left / middle / right with every old number still there, and save/parse.');
}
// ================= v0.41.0「看得清」：夜里的月光、光外的感染者画淡、打中白一下、收菜那一下、四角框、场景里的字不小于 14 =================
{
  const ui = () => context.inspect();
  for (let i = 0; i < 6 && ui().menu; i++) click('close');
  assert.equal(ui().menu, null);
  const e = ui().engine, R = ui().renderer;
  const keys0 = Object.keys(JSON.parse(e.serialize()));
  const minute = e.s.minute, weather = e.s.weather;
  e.paused = false;
  if (e.s.region !== 'farm') e.travel('farm');
  try {
    // 夜里在外面：显示的天色有月光，原来的天色留着（光外的感染者按它算淡多少）
    e.s.minute = 23 * 60; e.s.weather = '晴朗';
    R.resize(1366, 600, 1);
    R.draw(e, { x: 683, y: 300 }, 0.05);
    assert.ok(R.lit && R.lit.lifted, 'moonlight at night');
    assert.ok(R.lit.moon > 0.95, 'full moonlight at 23:00');
    for (let k = 0; k < 3; k++) assert.ok(R.lit.amb[k] >= R.lit.old[k], 'never darker than before');
    const p = e.s.player;
    assert.ok(R.foeAlpha({ x: p.x + 700, y: p.y, id: -41, type: 'slow' }) < 1, 'an infected out of the light is drawn fainter');
    assert.equal(R.foeAlpha({ x: p.x, y: p.y + 18, id: -42, type: 'slow' }), 1, 'in your own light it is drawn as usual');
    assert.equal(R.foeAlpha({ x: p.x + 700, y: p.y, id: -43, type: 'slow', windup: 0.3 }), 1, 'about to strike: drawn as usual');
    // 白天：什么都不淡
    e.s.minute = 10 * 60;
    R.draw(e, { x: 683, y: 300 }, 0.05);
    assert.equal(R.foeAlpha({ x: p.x + 700, y: p.y, id: -44, type: 'slow' }), 1, 'by day nothing is faded');
    // 打中：画面那一层这一帧就取走，白 0.06 秒
    e.emitAt('hitFlesh', { x: p.x + 40, y: p.y, id: 4141, type: 'slow' }, { heavy: true });
    R.draw(e, { x: 683, y: 300 }, 0.016);
    assert.ok(R._cFlash.has(4141), 'the hit flash starts the next frame');
    // 收菜：那块田上弹一下、飞到身上
    const plot = e.s.plots.find((q) => e.isFarmPlot(q));
    Object.assign(plot, { tilled: true, crop: 'radish', growth: Data.CROPS.radish.grow, wateredDay: e.s.day });
    Object.assign(p, { x: plot.x, y: plot.y + 30 });
    assert.ok(e.harvest(plot));
    R.draw(e, { x: 683, y: 300 }, 0.016);
    assert.ok(R._cFx.some((f) => f.kind === 'harvest' && f.item === 'radish'), 'the harvest pop starts the next frame');
    assert.deepEqual(e.takeVfx(), [], 'the scene took everything');
    // 四角框：面前那一样东西的四个角是规范里“能按”的颜色
    const ship = e.objects.find((o) => o.type === 'outpostShipping');
    Object.assign(p, { x: ship.x, y: ship.y + 40 });
    R.draw(e, { x: 683, y: 300 }, 0.016);
    const target = e.nearestObject(), box = R.cBox(target, e);
    assert.ok(box, 'the thing in front of you has a box');
    const sc = R.camera.scale, cx = Math.round((box.x0 - R.camera.x) * sc), cy = Math.round((box.y0 - R.camera.y) * sc);
    const img = R.ctx.getImageData(Math.max(0, cx - 12), Math.max(0, cy - 12), 24, 24).data;
    let cream = 0;
    for (let i = 0; i < img.length; i += 4) if (img[i] === 255 && img[i + 1] === 241 && img[i + 2] === 200) cream++;
    assert.ok(cream >= 4, 'a cream corner at the top left of ' + target.type + ' (' + cream + ' pixels)');
    // 场景里的字：1366 下（镜头 1 倍）没有小于 14 像素的；1920 下也没有
    const ctx = R.ctx, fillText = ctx.fillText, seen = [];
    ctx.fillText = function (t, x, y, ...a) {
      const m = this.getTransform(), px = parseFloat(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] || '0');
      seen.push([String(t), (px * Math.hypot(m.a, m.b)) / (R.dpr || 1)]);
      return fillText.call(this, t, x, y, ...a);
    };
    try {
      for (const [w, h] of [[1366, 600], [1920, 900]]) {
        R.resize(w, h, 1);
        seen.length = 0;
        R.draw(e, { x: w / 2, y: h / 2 }, 0.016);
        const small = seen.filter(([t, s]) => /[一-鿿]/.test(t) && s < 13.99);
        assert.ok(seen.length > 0, 'some scene text at ' + w);
        assert.deepEqual(small, [], 'no scene text under 14 px at ' + w);
      }
    } finally {
      ctx.fillText = fillText;
    }
  } finally {
    e.s.minute = minute; e.s.weather = weather;
    R.resize(1366, 600, 1);
  }
  // 存档：没有新字段
  click('save');
  assert.deepEqual(Object.keys(JSON.parse(storage.get(Session.CAMPAIGN_SAVE))).filter((k) => !keys0.includes(k)), [], 'no new save field');
  Campaign.Engine.parse(storage.get(Session.CAMPAIGN_SAVE));
  console.log('Clear controller passed: moonlight at night (never darker than before), an infected out of the light drawn fainter but as usual in your light, when striking and by day, the hit flash and the harvest pop start the next frame, the scene takes every effect, cream corners on the thing in front of you, no scene text under 14 px at 1366 and 1920, and save/parse.');
}
