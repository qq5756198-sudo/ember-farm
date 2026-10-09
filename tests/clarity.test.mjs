import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canvasPoint,NoticeQueue,splitSections,worldNotice} from '../dist/clarity-ui.js';
import {Engine,freshState,eventDemoState} from '../dist/echoes.js';
import {renderRebuild} from '../dist/rebuild-ui.js';
import {renderEvents,handleEchoAction} from '../dist/echoes-ui.js';
import {PILLARS} from '../dist/rebuild-data.js';
import {ECHO_EVENTS} from '../dist/echoes-data.js';
import {ITEMS} from '../dist/data.js';
const helper={esc:String,icon:()=>'',costs:()=>'',itemIcon:()=>'',itemName:id=>ITEMS[id]?.name||id};

test('pointer coordinates subtract layout offsets and compensate canvas CSS resizing at all target sizes',()=>{
 for(const [w,h,top,left,k] of [[1366,600,56,0,1],[1920,912,56,0,1],[390,520,82,0,1],[844,240,48,0,1],[683,228,48,0,2],[320,300,82,12,1.25]]){
  const rect={left,top,width:w/k,height:h/k};
  assert.deepEqual(canvasPoint(left,top,rect,w,h),{x:0,y:0});
  assert.deepEqual(canvasPoint(left+rect.width/2,top+rect.height/2,rect,w,h),{x:w/2,y:h/2});
  const p=canvasPoint(left+rect.width,top+rect.height,rect,w,h);assert.ok(Math.abs(p.x-w)<1e-8&&Math.abs(p.y-h)<1e-8);
 }
});
test('repeated notifications merge, expired ones leave and no more than two are visible',()=>{
 const q=new NoticeQueue();q.push('木材 +1','normal',100);q.push('木材 +1','normal',200);assert.equal(q.visible(201)[0].count,2);
 q.push('加工完成','gold',300);q.push('材料不足','warn',400);assert.equal(q.visible(401).length,2);assert.equal(q.visible(7401).length,0);
});
test('combat delays routine rewards and still exposes failures, then flushes a bounded summary',()=>{
 const q=new NoticeQueue();for(let i=0;i<30;i++)q.push('产出 '+i,'normal',i,true);q.push('弹药不足','warn',40,true);
 assert.equal(q.visible(41,true).length,1);assert.equal(q.visible(41,true)[0].text,'弹药不足');assert.equal(q.deferred.length,20);
 const items=q.visible(42,false);assert.equal(items.length,2);assert.match(items[1].text,/战斗期间20条/);assert.equal(q.deferred.length,0);
});
test('section extraction retains nested real controls without splitting their forms or details',()=>{
 const source='<p class="rebuild-note">说明</p><div class="rebuild-grid"><article class="rebuild-card"><h3>材料</h3><details><summary>条件</summary><input value="a>b"><button data-action="pay">交付</button></details></article><article class="rebuild-card"><h3>床位</h3><progress value="1" max="3"></progress></article></div>';
 const parts=splitSections(source);assert.equal(parts.length,3);assert.equal(parts[0].title,'');assert.equal(parts[1].title,'材料');assert.ok(parts[1].html.includes('data-action="pay"'));assert.ok(parts[1].html.endsWith('</article>'));assert.equal(parts[2].title,'床位');
});
test('the camp manual hub is gone: every pillar and every old tool is its own single-place page with working controls',()=>{
 const e=new Engine(eventDemoState());
 for(const tab of ['overview',...PILLARS.map(p=>p.id)]){
  const html=renderRebuild(e,tab,helper,{});assert.match(html,/class="place-page"/,tab);assert.doesNotMatch(html,/manual-nav|manual-list|manual-detail|clSelect|undefined|NaN/,tab);
  assert.ok((html.match(/data-action=/g)||[]).length>0,tab);
  for(const [menu,sub,label] of PILLARS.find(p=>p.id===tab)?.tools||[]){const tool=renderRebuild(e,tab,helper,{tool:{menu,tab:sub}});assert.match(tool,/class="place-page"/,label);assert.doesNotMatch(tool,/manual-nav|camp-tabs|frontier-tabs|undefined|NaN/,label);assert.ok(tool.length>200,label);}
 }
});
test('the 20 event list has exactly one expanded event and routes each selected row to its own detail',()=>{
 const e=new Engine(eventDemoState());for(const d of ECHO_EVENTS){const html=renderEvents(e,{eventFilter:'all',eventId:d.id});assert.equal((html.match(/id="event-/g)||[]).length,1);assert.ok(html.includes('id="event-'+d.id+'"'));assert.equal((html.match(/data-action="eSelect"/g)||[]).length,22);}
 const services=renderEvents(e,{eventId:'services'});assert.ok(services.includes('事件留下的服务与改装'));assert.ok(!services.includes('id="event-'));
});
test('event selection only changes interface state and supports return to list',()=>{
 const e=new Engine(eventDemoState()),before=e.serialize(),ui={};let renders=0;
 assert.ok(handleEchoAction('eSelect',{dataset:{id:'convoy'}},{engine:e,ui,renderMenu:()=>renders++}));assert.equal(ui.eventId,'convoy');assert.equal(ui.mobileDetail,true);assert.equal(e.serialize(),before);assert.equal(renders,1);
 handleEchoAction('eFilter',{dataset:{id:'all'}},{engine:e,ui,renderMenu:()=>renders++});assert.equal(ui.mobileDetail,false);assert.equal(ui.eventId,null);
});
test('UI rendering preserves old resources and the unified harder rules',()=>{
 const e=new Engine(freshState());e.s.money=876;e.s.storage.wood=37;const loaded=new Engine(Engine.parse(e.serialize()));
 for(const p of PILLARS)renderRebuild(loaded,p.id,helper,{});assert.equal(loaded.s.money,876);assert.equal(loaded.s.storage.wood,37);assert.equal(loaded.s.difficulty,'standard');assert.equal(Engine.parse(loaded.serialize()).money,876);
 assert.ok(worldNotice(loaded).includes('·'));assert.ok(!/undefined|NaN/.test(worldNotice(loaded)));
});
test('shipped markup reserves distinct header, map and operation regions, without old floating HUD',()=>{
 const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');const css=['style','rebuild','supply','echoes','clarity'].map(n=>readFileSync(new URL('../dist/'+n+'.css',import.meta.url),'utf8')).join('\n');
 assert.ok(html.indexOf('</header>')<html.indexOf('id="world-viewport"'));assert.ok(html.indexOf('</canvas></section>')<html.indexOf('<footer'));
 assert.doesNotMatch(html,/class="(?:frontier-quick|side-tools|objectives|play-controls)/);assert.doesNotMatch(css,/\.frontier-quick\s*\{|\.side-tools\s*\{/);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);assert.ok(html.includes('id="menu-toasts"'));
});
