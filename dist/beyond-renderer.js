import {Renderer as DistrictRenderer} from './district-renderer.js';
import {WORLD,CROPS,ITEMS,WEAPONS,BUILDINGS,REGIONS} from './data.js';
import {BEYOND_GEOMETRY,BEYOND_ANCHORS,BEYOND_THEMES,pixelPainter} from './beyond-art.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const isNew=id=>!!BEYOND_THEMES[id];
const NEAR=(a,b,r)=>Math.hypot(a.x-b.x,a.y-b.y)<r;
const pointIndex=o=>BEYOND_ANCHORS.reduce((best,p,i)=>Math.hypot(o.x-p[0],o.y-p[1])<Math.hypot(o.x-BEYOND_ANCHORS[best][0],o.y-BEYOND_ANCHORS[best][1])?i:best,0);
const stateOf=(e,id)=>e.bpoint?.(id)||e.b?.points?.[id]||{};
export class Renderer extends DistrictRenderer{
 draw(e,mouse,dt=.016){
  this.sceneEngine=e;this.visualFootsteps??=[];this.materialHits??=[];
  if(e.b?.track&&e.beyondTarget)this.rebuildTarget=e.beyondTarget();
  if(e.s.region==='frost'&&e.walking&&!e.paused&&this.time-(this.lastStep||0)>.23){const p=e.s.player;this.visualFootsteps.push({x:p.x,y:p.y,t:this.time,a:p.facing});this.lastStep=this.time;}this.visualFootsteps=this.visualFootsteps.filter(p=>this.time-p.t<11).slice(-40);
  super.draw(e,mouse,dt);this.sceneEngine=null;
 }
 sprite(index,...args){if(this.hideCropIcons&&(index===60||Object.values(CROPS).some(p=>p.icon===index)))return;return super.sprite(index,...args);}
 drawFarm(e){this.hideCropIcons=true;try{super.drawFarm(e);}finally{this.hideCropIcons=false;}for(const p of e.s.plots)this.drawLivingCrop(p,e);this.drawOldLandmark(e);this.drawHomeChanges(e);}
 drawRuins(e){
  if(!isNew(e.s.region)){this.hideCropIcons=e.s.region==='valley';try{super.drawRuins(e);}finally{this.hideCropIcons=false;}if(e.s.region==='valley')for(const p of e.d?.plots||[])this.drawLivingCrop(p,e);this.drawOldLandmark(e);this.drawDistrictDepth(e);this.drawEventSets(e);return;}
  const c=this.ctx,t=this.time,id=e.s.region,p=pixelPainter(c);const{rect,line,circle,pine}=p;
  // Ground-level restoration is drawn before people so no new roof hides a threat.
  if(id==='frost'){for(const step of this.visualFootsteps){c.save();c.globalAlpha=(1-(this.time-step.t)/11)*.6;c.translate(step.x,step.y);c.rotate(step.a);rect(-4,-8,8,4,'#667f85');rect(5,3,8,4,'#667f85');c.restore();}for(let i=0;i<5;i++){rect(548+i*173,890,23,3,'#e5ebdc');rect(555+i*173,897,16,2,'#8aa2a3');}}
  if(id==='shelter'){for(const [x,y]of [[190,465],[650,470],[1010,565],[1380,565]]){const flow=(t*17)%42;line(x+flow,y,x+flow+10,y,'#bfcca487',2);line(x+flow+10,y,x+flow+5,y-4,'#bfcca487',2);}}
  if(id==='pinewood'){const forest=e.b?.forest||[];for(let i=0;i<3;i++){const readyDay=Number(forest[i]||0),x=550+i*265,y=770;const cut=readyDay>e.s.day;if(cut){rect(x-13,y-6,27,17,'#79674a');circle(x,y-8,15,'#baa077');circle(x,y-8,9,'#8f7c55');}else{pine(x,y,.55);pine(x+32,y+12,.45);}if(stateOf(e,'pinewood_forest').flags?.['select'+i])rect(x-18,y+19,59,3,'#9cb17b');}}
  if(id==='shipyard'){const drained=!!stateOf(e,'shipyard_drain').flags?.pump;rect(820,350,155,165,drained?'#9ba38a':'#416c70');rect(824,354,147,157,drained?'#aab098':'#57858a');for(let k=0;k<7;k++){if(drained){rect(829,360+k*21,137,2,'#788c77');rect(834+k*18,355,2,153,'#c0bda0');}else{rect(832+(k%3)*11,365+k*21,104,3,'#81aaa7');rect(824,357+k*22,4,16,'#aac0a6');}}if(drained){rect(831,504,135,4,'#c7c09b');rect(831,358,135,4,'#c7c09b');}}
  if(e.f?.dog?.rescued&&e.b?.dog?.mode!=='home'&&!e.objects.some(o=>o.type==='partnerDog'))this.drawObject({type:'partnerDog',icon:40,x:e.f.dog.x,y:e.f.dog.y,name:'麦穗'},e);
  this.drawEventSets(e);
 }
 drawObject(o,e){
  if(o.type==='beyondEvent'){if(NEAR(o,e.s.player,140))this.badge(o.name,o.x,o.y-121,'#efdb9c');return;}
  if(['beyondPoint','beyondGate','beyondStore','beyondExit'].includes(o.type)){
   const c=this.ctx,near=NEAR(o,e.s.player,140),active=o.pointId===e.b?.track,st=o.pointId?stateOf(e,o.pointId):{},done=st.count>0;
   c.save();const behind=e.s.player.y<o.y&&e.s.player.y>o.y-95&&Math.abs(e.s.player.x-o.x)<49;c.globalAlpha=behind?.42:1;
   this.shadow(o.x,o.y,29);if(o.type==='beyondPoint')this.drawBeyondProp(o,st,e);else this.drawWayPoint(o,e);c.restore();
   if(o.type==='beyondPoint'&&(active||near)){c.fillStyle=active?'#f1d398':done?'#b6d199':'#aaa889';c.fillRect(o.x-5,o.y+10,10,3);this.badge(o.name,o.x,o.y-101,active?'#f4d899':done?'#d9e7ba':'#e7d5b0');}else if(near)this.badge(o.name,o.x,o.y-91,'#e6d6a3');return;
  }
  if(['resident','survivor','outpostResident','visitor'].includes(o.type)){super.drawObject(o,e);this.drawResidentDetails(o,e);return;}
  if(o.type==='beyondFamily'){this.drawFamilies(o,e);return;}
  if(o.type==='partnerDog'){const mode=e.b?.dog?.mode;if(mode==='home'&&e.s.region!=='farm')return;if(mode==='home')o={...o,x:830,y:500};super.drawObject(o,e);if(mode==='wait'){this.text('等候',o.x,o.y-68,'#d7dcb9',10);}if(mode==='guard'){const c=this.ctx;c.strokeStyle='#e3cb85';c.lineWidth=2;c.beginPath();c.moveTo(o.x+16,o.y-42);c.lineTo(o.x+22,o.y-49);c.moveTo(o.x+21,o.y-34);c.lineTo(o.x+31,o.y-37);c.stroke();}return;}
  return super.drawObject(o,e);
 }
 drawWayPoint(o,e){const p=pixelPainter(this.ctx),{rect,line,crate}=p,x=o.x,y=o.y;rect(x-35,y-4,70,5,'#53654f');if(o.type==='beyondStore'){crate(x-14,y,39,36);crate(x+22,y-8,28,25);rect(x-28,y-34,25,3,'#dbb884');rect(x-22,y-31,5,11,'#58775e');return;}rect(x-3,y-78,7,79,'#755e40');rect(x-35,y-69,70,23,'#b9aa77');rect(x-35,y-68,70,3,'#d8c799');line(x+15,y-58,x-12,y-58,'#536b50',3);line(x-12,y-58,x-3,y-65,'#536b50',3);line(x-12,y-58,x-3,y-51,'#536b50',3);if(o.type==='beyondGate'){rect(x+19,y-29,21,27,e.b?.unlocked?.[o.district]?'#7d9d77':'#847354');rect(x+23,y-26,13,5,'#d8c095');}}
 drawBeyondProp(o,st,e){
  const c=this.ctx,p=pixelPainter(c),{rect,line,circle,pine,crate,lamp,plank}=p,x=o.x,y=o.y,n=e.s.region==='frost'?[0,0,1,2,3,6,4,5][pointIndex(o)]:e.s.region==='archive'?[0,1,5,2,3,4,6,7][pointIndex(o)]:pointIndex(o),done=st.count>0,flags=st.flags||{},choice=st.choice||'',t=this.time;
  const wood=done?'#ae9368':'#87704e',metal=done?'#94ad9b':'#748378',light=done?'#d9d5a0':'#8e9c86';
  const table=(w=68)=>{rect(x-w/2+4,y-3,7,9,'#63513a');rect(x+w/2-11,y-3,7,9,'#63513a');rect(x-w/2,y-22,w,19,wood);rect(x-w/2,y-24,w,4,'#d0b782');};
  const pole=(h=75)=>{rect(x-3,y-h,6,h,'#66796a');rect(x-14,y,29,4,'#4f6254');};
  const dial=(xx,yy)=>{circle(xx,yy,12,'#445c50');circle(xx,yy,9,'#c9c5a0');line(xx,yy,xx+Math.sin(t)*6,yy-6,'#5a6853',2);};
  const sign=(xx,yy)=>{rect(xx-2,yy-22,5,26,'#806b4c');rect(xx-16,yy-36,33,17,wood);rect(xx-10,yy-31,18,3,light);};
  if(e.s.region==='pinewood')switch(n){
   case 0:pole(85);line(x,y-84,x+39,y-82,'#c6b185',3);rect(x+5,y-82,31,14,'#b88953');rect(x+13,y-79+Math.sin(t*2)*2,33,9,'#d4b574');rect(x+23,y-76+Math.sin(t*2)*3,28,5,'#b4bc83');dial(x-16,y-38);break;
   case 1:pine(x,y,.82);rect(x-8,y-17,16,4,'#d9b171');rect(x+5,y-14,16,18,'#725b3e');rect(x+7,y-12,12,4,'#debd79');rect(x+10,y-27+Math.floor(t*7)%9,3,5,'#e3b65f');break;
   case 2:for(const [i,dx]of [-31,1,32].entries()){const readyDay=Number(e.b?.forest?.[i]||0);if(readyDay>e.s.day){rect(x+dx-7,y-10,14,13,wood);circle(x+dx,y-11,9,'#c7af7c');}else pine(x+dx,y+(i%2)*7,.45);}sign(x+47,y);break;
   case 3:for(let i=0;i<6;i++){const xx=x-39+i*14,yy=y-14+(i%2)*5;rect(xx,yy,5,15,'#426b48');rect(xx-5,yy-9,15,9,done?'#789e62':'#62874f');rect(xx+2,yy-17,5,11,'#91ad69');rect(xx-4,yy-7,3,3,'#dbbf7b');}rect(x-48,y+3,96,3,'#637044');break;
   case 4:for(let i=0;i<3;i++){rect(x-38+i*27,y-24,23,35,'#6d5840');for(let a=0;a<2;a++){rect(x-32+i*27+a*9,y-24,3,20,'#70995b');rect(x-36+i*27+a*9,y-22,11,4,'#97b676');}}sign(x+47,y);break;
   case 5:rect(x-41,y-62,82,65,'#988460');rect(x-47,y-75,94,17,done?'#73816b':'#5f705b');rect(x-39,y-84,78,10,'#869279');rect(x-11,y-35,25,38,'#4b5e47');rect(x+20,y-43,15,18,done?'#d8cb92':'#799386');rect(x-34,y-42,16,17,'#bba97a');if(e.b?.modules?.includes(o.pointId+':warm'))rect(x-42,y-60,6,60,'#d5b486');break;
   case 6:plank(x-44,y-20,88,23);line(x-46,y-22,x+46,y-22,wood,4);if(done||flags.bridge){line(x-45,y+8,x+46,y+8,wood,4);for(const dx of [-42,42])rect(x+dx,y-30,5,40,wood);}else rect(x-7,y-23,16,29,'#506754');break;
   case 7:table(77);rect(x-35,y-23,70,8,'#c4b994');for(let i=0;i<3;i++)rect(x-28+i*23,y-22,16,4,'#6b8c65');sign(x+48,y-3);crate(x-51,y+4,22,21);break;
  }
  if(e.s.region==='shipyard')switch(n){
   case 0:rect(x-33,y-40,66,43,'#687d70');rect(x-38,y-4,77,10,'#a39a76');circle(x,y-30,22,metal);circle(x,y-30,15,'#445b51');for(let i=0;i<4;i++){const a=t*.35+i*Math.PI/2;line(x,y-30,x+Math.cos(a)*17,y-30+Math.sin(a)*17,'#c3b58c',3);}line(x+26,y-30,x+50,y+15,'#b3aa83',2);break;
   case 1:rect(x-42,y-37,85,42,'#4d6f66');rect(x-36,y-31,73,30,flags.pump?'#938b6a':'#5c9595');for(let xx=x-32;xx<x+35;xx+=13)rect(xx,y-27,8,22,flags.pump?'#c1b48c':'#8eb3a4');dial(x+45,y-24);break;
   case 2:rect(x-44,y-21,87,19,'#6c5a42');rect(x-34,y-31,67,29,'#b6a077');rect(x-24,y-28,48,20,'#5d746a');rect(x-14,y-24,28,14,'#abb998');line(x-47,y-18,x+48,y-18,'#dec58e',3);if(e.b?.boat?.includes('roof')){rect(x-23,y-52,48,8,'#adba94');line(x-24,y-51,x-24,y-20,wood,3);line(x+24,y-51,x+24,y-20,wood,3);}break;
   case 3:crate(x-16,y,45,40);crate(x+25,y-6,32,30);rect(x-32,y-37,32,7,'#ded9b7');rect(x-28,y-28,9,8,'#eee7c8');rect(x+19,y-31,13,7,'#d8cfaa');break;
   case 4:for(const dx of [-35,22]){circle(x+dx,y-4,13,'#687f77');rect(x+dx-8,y-15,16,9,'#b4b99a');}plank(x-47,y-24,94,21);for(const dx of [-43,40])line(x+dx,y-25,x+dx,y-5,'#8ba58c',3);break;
   case 5:rect(x-21,y-58,43,58,'#6c8776');rect(x-25,y-63,51,8,'#adc6ab');rect(x-16,y-47,31,5,'#253f37');rect(x-12,y-34,24,14,'#d9c69c');line(x-11,y-32,x,y-24,'#8a8865',2);line(x+10,y-32,x,y-24,'#8a8865',2);crate(x+36,y,23,28);break;
   case 6:pole(83);circle(x,y-79,18,'#526e66');circle(x,y-80,12,choice==='lamp'&&(e.c?.energy||0)>0?'#dfd99e':choice==='reflect'?'#cfccac':'#79998c');rect(x-22,y-96,44,6,'#a5b395');rect(x-16,y-62,31,4,'#b7b793');break;
   case 7:table(84);rect(x-29,y-24,59,19,'#ccc39f');line(x-22,y-20,x+22,y-10,'#6a8e79',2);line(x-6,y-22,x-6,y-5,'#929775',2);for(const dx of [-51,42]){rect(x+dx,y-3,13,7,wood);rect(x+dx+4,y+4,5,10,'#655d43');}break;
  }
  if(e.s.region==='shelter')switch(n){
   case 0:rect(x-39,y-65,78,68,'#879483');rect(x-33,y-59,66,55,'#374d44');circle(x,y-32,23,'#749185');for(let i=0;i<4;i++){const a=t*(done?2:.25)+i*Math.PI/2;line(x,y-32,x+Math.cos(a)*21,y-32+Math.sin(a)*21,'#b8c8a5',7);}circle(x,y-32,7,'#486357');rect(x-45,y-70,91,6,'#b7c0a5');break;
   case 1:for(const dx of [-41,8]){rect(x+dx,y-67,34,72,metal);rect(x+dx+5,y-58,24,52,'#435e51');rect(x+dx+10,y-53,14,12,light);rect(x+dx+23,y-25,3,10,'#c7c298');}rect(x-48,y-74,94,9,'#7b9280');rect(x-45,y+3,86,4,'#c5b991');break;
   case 2:rect(x-40,y-56,80,59,'#536d5f');for(const [i,col]of ['#b7bd86',flags.repair?'#b9d29d':'#bf9475','#84b6ae'].entries()){circle(x-23+i*23,y-39,7,col);rect(x-29+i*23,y-22,12,8,'#c5be97');}rect(x-32,y-10,64,5,'#899d81');break;
   case 3:table(82);rect(x-32,y-27,38,25,'#d5cda9');rect(x+9,y-24,23,22,'#b8b78f');for(let j=0;j<4;j++)line(x-27,y-20+j*4,x+1,y-20+j*4,'#7f9070');rect(x-36,y-50,8,23,'#697e65');rect(x-37,y-52,20,5,light);break;
   case 4:rect(x-44,y-22,63,28,'#63796a');rect(x-40,y-29,58,21,'#bbc1a0');rect(x-39,y-29,14,19,'#e1d8b1');rect(x+26,y-36,23,31,'#9b936c');rect(x+25,y-39,26,5,'#d1c49c');rect(x+31,y-35,13,5,'#799983');break;
   case 5:for(const dx of [-32,22]){rect(x+dx,y-70,12,73,'#839583');rect(x+dx+3,y-67,5,65,'#bac3a3');}rect(x-35,y-73,69,7,'#b6bea1');rect(x-24,y-36,48,6,'#546f5d');for(let i=0;i<3;i++)line(x-16+i*15,y-18,x-16+i*15,y-25-(i%2)*5,'#bdd4a6');break;
   case 6:table(82);for(let i=0;i<3;i++){rect(x-34+i*24,y-53,18,29,'#759084');rect(x-32+i*24,y-48,14,16,'#c1c8a6');rect(x-34+i*24,y-54,18,4,'#d5ce9e');}rect(x-35,y-13,66,5,'#627b67');break;
   case 7:rect(x-38,y-81,77,87,'#889787');rect(x-32,y-76,65,72,'#3a5147');for(let dx=-26;dx<33;dx+=12)rect(x+dx,y-70,4,68,metal);rect(x-31,y-39,62,5,'#c1bd93');rect(x+40,y-40,12,21,'#789780');circle(x+46,y-31,3,light);break;
  }
  if(e.s.region==='frost')switch(n){
   case 0:if(pointIndex(o)===1){for(let k=0;k<3;k++){rect(x-34+k*32,y-35,4,39,'#8ca298');rect(x-30+k*32,y-34,17,11,k%2?'#b18d64':'#b8bd91');rect(x-39+k*32,y+3,20,4,'#d6e1d3');}break;}pole(82);rect(x-28,y-71,56,24,'#829ca0');rect(x-21,y-66,43,13,'#d4ddd0');for(let k=0;k<6;k++)rect(x-17+k*7,y-63,3,7,'#65888d');rect(x-38,y-35,23,28,'#a0b4aa');rect(x-35,y-31,17,7,light);break;
   case 1:rect(x-46,y-65,92,69,'#8eaaa2');rect(x-43,y-74,86,12,'#e3e6d3');rect(x-8,y-41,25,45,'#476768');rect(x-33,y-45,19,19,done?'#e6cea0':'#729691');rect(x+23,y-45,16,19,'#bbcdbb');break;
   case 2:rect(x-31,y-51,62,57,'#829c9a');rect(x-25,y-45,50,37,'#435f63');for(let i=0;i<5;i++)rect(x-18+i*8,y-40,3,26,'#b6c3ae');rect(x-34,y-56,68,6,'#e4e5d1');dial(x+39,y-24);break;
   case 3:pole(89);line(x-40,y-88,x+45,y-88,'#889f99',4);rect(x-24,y-63+Math.sin(t*.4)*2,47,48,'#7e9492');rect(x-18,y-57+Math.sin(t*.4)*2,35,22,'#b2c5b9');line(x-17,y-85,x-17,y-63,'#c5cfbd',2);line(x+17,y-85,x+17,y-63,'#c5cfbd',2);rect(x-26,y-14,52,6,'#d0d5bf');break;
   case 4:table(78);for(let i=0;i<3;i++){rect(x-32+i*25,y-25,20,5,'#738a74');line(x-24+i*25,y-25,x-24+i*25,y-49,'#a0b771',3);for(let yy=0;yy<3;yy++)rect(x-28+i*25,y-47+yy*6,9,4,'#d6c58d');}rect(x-39,y-62,78,4,'#c1d2c1');line(x-39,y-61,x-39,y-7,'#afc4b5');line(x+39,y-61,x+39,y-7,'#afc4b5');break;
   case 5:pole(92);for(let i=0;i<3;i++){line(x-20-i*7,y-86+i*18,x+20+i*7,y-86+i*18,'#b5c3b0',3);}line(x-33,y,x,y-91,'#6b8886',3);line(x+33,y,x,y-91,'#6b8886',3);circle(x,y-94,5,light);break;
   case 6:table(71);rect(x-26,y-58,53,32,'#6f8b87');rect(x-21,y-53,43,19,'#bbcfbd');for(let i=0;i<6;i++){rect(x-17+i*6,y-49+Math.sin(t+i)*3,4,2,'#5c8179');}rect(x-19,y-19,36,8,'#c5cfb7');break;
   case 7:rect(x-43,y-62,87,65,'#75928a');rect(x-46,y-66,93,7,'#e0e5cf');rect(x-35,y-53,71,32,'#425e56');rect(x-30,y-47,18,20,'#b5c29c');rect(x-7,y-47,15,20,'#ac9370');rect(x+15,y-47,14,20,'#d3c7a4');rect(x-31,y-12,63,9,'#b3bd9b');break;
  }
  if(e.s.region==='archive')switch(n){
   case 0:plank(x-44,y-22,87,25);for(const dx of [-36,30]){rect(x+dx,y-49,7,56,'#6c8c78');rect(x+dx-4,y-51,15,5,'#c6c6a1');}line(x-29,y-39,x+31,y-39,'#b9c5a2',2);crate(x+53,y+3,23,25);break;
   case 1:table(82);for(let i=0;i<3;i++){rect(x-32+i*22,y-35,18,13,'#b7b392');rect(x-30+i*22,y-33,14,2,'#e1d8b8');rect(x-32+i*22,y-24,18,4,'#6f8b74');}rect(x-28,y-12,51,6,'#8fa683');break;
   case 2:rect(x-39,y-64,78,69,'#809a80');rect(x-32,y-57,64,52,'#3e6450');for(let r=0;r<2;r++)for(let a=0;a<4;a++){rect(x-27+a*15,y-52+r*24,10,19,['#c5b075','#749b77','#b7b395'][a%3]);rect(x-25+a*15,y-48+r*24,6,4,'#e1d4a5');}rect(x-35,y-30,70,4,'#c0b38b');break;
   case 3:table(86);rect(x-31,y-53,35,31,'#779a87');rect(x-26,y-48,25,19,'#466e5b');rect(x+13,y-40,19,17,'#c1b684');line(x+18,y-41,x+31,y-55,'#b9c3a0',3);rect(x-35,y-15,71,4,'#c5bc98');break;
   case 4:rect(x-42,y-67,84,65,'#b2ae86');rect(x-35,y-59,70,47,'#4c6d58');for(const [i,col]of ['#93ae8b','#b9a16f','#8eb6a4'].entries()){rect(x-29+i*22,y-52,16,29,col);rect(x-27+i*22,y-48,12,17,'#d7cc9e');}rect(x-47,y-72,94,7,'#6c8871');rect(x-37,y-1,7,10,wood);rect(x+29,y-1,7,10,wood);break;
   case 5:table(85);rect(x-35,y-45,20,23,'#8ca283');rect(x-12,y-39,26,16,'#d2c294');rect(x+20,y-55,12,32,'#a4b68c');for(let i=0;i<3;i++)rect(x-5+i*8,y-37,4,4,'#5b7c62');break;
   case 6:rect(x-44,y-14,86,16,'#92784d');for(let i=0;i<3;i++){crate(x-27+i*28,y-15,23,24);rect(x-30+i*28,y-41,10,4,'#b3ba86');}sign(x+52,y);break;
   case 7:rect(x-40,y-48,80,53,'#a7ab82');rect(x-47,y-62,94,17,'#6c8b71');rect(x-36,y-72,73,10,'#93a581');rect(x-9,y-33,23,38,'#3d6651');rect(x-30,y-29,15,17,done?'#e3cf8e':'#84a991');rect(x+23,y-29,12,17,'#bbbd93');break;
  }
  if(o.pointId==='pinewood_lodge'||o.pointId==='frost_inn'){const has=k=>e.b?.modules?.includes(o.pointId+':'+k);if(has('warm')){rect(x-44,y-61,6,60,'#d0b487');rect(x-41,y-4,82,5,'#d8c093');}if(has('quiet')){rect(x-9,y-35,4,35,'#b9bd92');rect(x+9,y-35,4,35,'#b9bd92');rect(x-9,y-36,21,4,'#b9bd92');}if(has('bed')){rect(x+20,y-38,17,7,'#d6cdac');rect(x+20,y-30,17,10,'#95ae94');}}
  if(o.pointId==='shipyard_boat'){if(e.b?.boat?.includes('passenger')){rect(x-16,y-22,31,5,'#d4ba84');rect(x-16,y-12,31,4,'#d4ba84');}if(e.b?.boat?.includes('cargo')){crate(x+18,y-5,23,18);}}
  if(o.pointId==='shelter_lock'){const inner=e.b?.airlock==='inner',outer=e.b?.airlock==='outer';rect(x-34,y-49,20,32,outer?'#b4c9a2':'#5f7c6b');rect(x+14,y-49,20,32,inner?'#b4c9a2':'#5f7c6b');if(inner||outer){const dx=inner?14:-34;rect(x+dx+4,y-42,13,5,'#344e42');}}
  if(done){rect(x-6,y+7,13,3,'#c8d49b');}else if(st.paid||st.progress>0){crate(x-50,y+4,22,18);line(x-44,y-42,x-44,y-7,'#b39262',3);line(x-50,y-30,x-35,y-30,'#b39262',3);}
 }
 drawLivingCrop(plot,e){if(!plot.crop||!CROPS[plot.crop])return;const p=pixelPainter(this.ctx),{rect,line,circle}=p,x=plot.x,y=plot.y+8,id=plot.crop,ratio=plot.growth/CROPS[id].grow,stage=Math.min(3,Math.floor(ratio*4)),wet=e.s.region==='valley'?e.valleyWatered?.(plot):e.plotWatered?.(plot),green=wet?'#7da352':'#83924f',dark='#456b3b';
  rect(x-10,y+2,22,3,'#3d4d3160');if(stage===0){rect(x-2,y-7,3,10,dark);rect(x-8,y-7,7,3,'#a0b96b');rect(x+1,y-11,7,4,'#8dae5d');return;}
  if(id==='corn'||id==='rye'){const h=stage===1?20:stage===2?32:43;for(const dx of id==='rye'?[-8,0,8]:[0]){rect(x+dx-1,y-h,3,h,dark);for(let k=1;k<4;k++){const yy=y-k*7;rect(x+dx-9,yy,9,3,green);rect(x+dx+2,yy-3,9,3,green);}if(stage>=2){for(let k=0;k<4;k++)rect(x+dx-3,y-h+1+k*5,7,3,stage===3?'#dec47b':'#b6bd77');}}if(id==='corn'&&stage===3){rect(x+4,y-23,8,17,'#c2ad5c');rect(x+6,y-21,5,13,'#ead28d');}return;}
  if(id==='bean'){rect(x-10,y-28,3,31,'#8e8054');rect(x+10,y-28,3,31,'#8e8054');line(x-10,y-23,x+11,y-23,'#ad9b68',2);for(let k=0;k<4;k++){rect(x-6+(k%2)*9,y-7-k*6,3,9,dark);rect(x-12+(k%2)*9,y-10-k*6,11,4,green);}if(stage>=2)for(const dx of [-7,4,11]){rect(x+dx,y-20,4,stage===3?15:8,stage===3?'#b1c378':'#89a860');rect(x+dx+1,y-19,1,11,'#d1d697');}return;}
  const radius=stage===1?8:stage===2?12:16;for(const [dx,dy]of [[-radius/2,-5],[radius/2,-8],[0,-15],[-5,-14],[6,-16]]){rect(x+dx-5,y+dy-3,10,7,dark);rect(x+dx-4,y+dy-5,8,5,green);}rect(x-1,y-19,3,23,dark);
  if(stage>=2){const pale=stage===2,fruit=id==='tomato'?(pale?'#9eb360':'#cb7156'):id==='pumpkin'?(pale?'#bbab5e':'#da9958'):id==='cotton'?(pale?'#b7c69a':'#e5dec0'):id==='radish'?'#e1d4a8':id==='potato'?'#b19767':'#bcca8b';if(id==='pumpkin'){for(const dx of [-9,9]){circle(x+dx,y-1,stage===3?9:6,fruit);rect(x+dx-1,y-13,3,5,dark);rect(x+dx,y-7,2,12,'#ad824d');}}else if(id==='radish'){rect(x-5,y-2,11,8,fruit);rect(x-3,y+6,6,5,'#d6c99e');}else for(const [dx,dy]of [[-9,-10],[8,-16],[0,-24]]){circle(x+dx,y+dy,stage===3?5:3,fruit);if(id==='cotton'&&stage===3){rect(x+dx-6,y+dy-2,12,4,'#eee7d0');}}}
 }
 drawOldLandmark(e){const c=this.ctx,p=pixelPainter(c),{rect,line,circle}=p,id=e.s.region;
  // Region-specific low profiles embellish existing landmarks without adding collision.
  if(id==='farm'){rect(863,243,30,6,'#aeb397');rect(874,215,6,29,'#739d96');line(877,215,889,215,'#b7c7b1',3);circle(896,231,8,'#607e69');line(896,225,896,237,'#b2b893',2);}
  if(id==='market'){line(585,335,1105,335,'#746946',2);for(let x=596;x<1090;x+=31){rect(x,337,16,9,(x%2)?'#a9b783':'#c6a566');rect(x+4,345,8,6,'#978c63');}rect(788,350,57,6,'#b39d72');}
  if(id==='residential'){for(const x of [285,535]){rect(x,390,16,11,'#937550');rect(x+2,392,12,4,'#c6b487');rect(x+6,399,3,15,'#756d4f');}rect(484,353,45,5,'#bbac86');line(492,357,507,357,'#668466',2);}
  if(id==='hospital'){rect(1114,337,59,27,'#c5c1a0');rect(1139,341,9,19,'#8a5b50');rect(1132,347,23,7,'#8a5b50');for(const x of [1086,1199]){rect(x,371,18,4,'#9b9473');rect(x+5,374,8,13,'#617a63');}}
  if(id==='warehouse'){for(let x=1038;x<1230;x+=19){rect(x,447,12,5,'#c0a25f');rect(x+12,447,6,5,'#5e6550');}rect(1106,462,67,5,'#b39b66');rect(1114,469,53,2,'#7b876c');}
 }
 drawDistrictDepth(e){const p=pixelPainter(this.ctx),{rect,line}=p,id=e.s.region;
  if(id==='valley')for(const y of [280,624,795]){line(266,y,1342,y,'#40554277',5);line(266,y-3,1342,y-3,'#c1ba8a88',2);}
  if(id==='stationMarket'){for(const x of [248,571,970,1327]){rect(x,415,9,16,'#54634d66');rect(x+5,415,9,16,'#53614733');}}
  if(id==='courtyard'){for(const x of [290,720,1087])for(let k=0;k<4;k++){rect(x+19+k*31,307,13,3,'#334c4066');}}
  if(id==='quarantine'){for(const x of [369,752,1169]){rect(x,272,31,5,'#adc5a288');rect(x+12,278,7,8,'#6a948699');}}
  if(id==='railDepot'){for(const y of [442,623,859]){rect(235,y+8,1187,3,'#b3ba9d44');for(let x=255;x<1420;x+=79)rect(x,y+8,17,2,'#d0cba066');}}
 }
 drawHomeChanges(e){const p=pixelPainter(this.ctx),{rect,line,crate}=p;
  if((e.b?.mail?.sent?.length||0)+(e.b?.mail?.receipts?.length||0)>0){rect(907,305,18,29,'#668775');rect(904,302,24,5,'#b2ba8c');rect(910,311,12,3,'#304e42');if(e.b.mail.receipts.length){rect(911,317,10,9,'#e0d3a8');line(912,318,916,322,'#8d946e');line(920,318,916,322,'#8d946e');}}
  for(const [i,key]of ['self','guest','knowledge'].entries()){const level=e.b?.vision?.[key]||0;if(!level)continue;const x=1173+i*69,y=294,col=['#a7b77f','#c5b586','#91b9a4'][i];rect(x-26,y+4,52,4,'#7c8760');rect(x-24,y-52,4,57,'#a98e5f');rect(x-20,y-51,17,16,col);if(key==='self'){crate(x,y,37,27);rect(x-14,y-22,29,5,'#d4b875');if(level>=2){rect(x+17,y-17,15,19,'#88a683');for(let k=0;k<3;k++)rect(x+20+k*4,y-25,3,11,'#afbd7f');}if(level>=3){rect(x-18,y-35,6,14,'#77a482');line(x-16,y-34,x+12,y-34,'#b9c99f',3);}}
   if(key==='guest'){rect(x-19,y-17,41,19,'#af976b');rect(x-14,y-21,30,5,'#d8cc9c');if(level>=2){for(const dx of [-27,21]){rect(x+dx,y+9,12,6,'#b5a371');rect(x+dx+4,y+15,4,9,'#776c4b');}}if(level>=3){rect(x-21,y-40,43,5,'#a7bd88');for(const dx of [-21,20])rect(x+dx,y-39,3,25,'#849976');}}
   if(key==='knowledge'){rect(x-19,y-19,43,21,'#ad9871');rect(x-15,y-24,34,9,'#d4c79d');if(level>=2){rect(x-10,y-44,20,18,'#718f80');rect(x-6,y-40,12,8,'#c4cd9f');}if(level>=3){rect(x+14,y-48,4,25,'#9aac8c');rect(x+9,y-51,16,6,'#dcd3a0');}}
   for(let k=0;k<level;k++)rect(x-10+k*8,y+10,5,3,col);
  }
  if(e.b?.benefits?.hedgeUntil>=e.s.day)for(const b of e.s.buildings||[])if(['fence','gate'].includes(b.type)&&b.hp>0)for(let k=0;k<5;k++){const x=b.x-27+k*13;rect(x,b.y-13,4,13,'#578459');rect(x-4,b.y-18,13,7,'#8faa69');}
  this.drawEventSets(e);
 }
 drawFamilies(o,e){const p=pixelPainter(this.ctx),{rect,line}=p,count=Math.min(4,Math.max(0,Math.floor(e.b?.family||0)));for(let i=0;i<count;i++){const x=o.x-30+(i%2)*58,y=o.y+Math.floor(i/2)*68;this.shadow(x,y,17);this.shadow(x+23,y+5,14);this.sprite(i%2?56:57,x,y,40,53);this.sprite(i%2?57:56,x+24,y+5,32,46);rect(x-16,y+10,57,5,'#ad9369');rect(x-15,y+17,18,8,'#839976');rect(x+6,y+17,17,8,'#b5ad80');if(e.b?.benefits?.familyDay===e.s.day){rect(x+25,y+16,12,7,'#c8bb90');rect(x+27,y+14,8,3,'#dfd0aa');}}
  if(NEAR(o,e.s.player,145))this.badge(o.name,o.x,o.y-78,'#e6d7a8');
 }

 drawResidentDetails(o,e){const r=(e.s.colony?.residents||[]).find(a=>a.id===o.resident),role=r?.workRole||r?.role;if(!r)return;const p=pixelPainter(this.ctx),{rect,line,circle}=p,x=o.x,y=o.y,moving=r.target&&Math.hypot(r.x-r.target.x,r.y-r.target.y)>8,swing=moving?Math.sin(this.time*8)*2:0;
  const colors={farmer:'#b1a870',mechanic:'#8a9e98',medic:'#d0cfb6',guard:'#8f9b70',cartographer:'#a8b2a1',rest:'#a2a982'};rect(x-7,y-29,14,4,colors[role]||'#a8b091');
  if(role==='farmer'){line(x+15,y-13,x+18+swing,y-42,'#b49765',3);line(x+11+swing,y-43,x+24+swing,y-43,'#96aaa0',3);}else if(role==='mechanic'){rect(x+14,y-25+swing,5,14,'#b9c7b0');rect(x+10,y-29+swing,13,5,'#a6baa8');}else if(role==='medic'){rect(x+11,y-25,14,18,'#d7cfaa');rect(x+16,y-22,4,11,'#a7785e');rect(x+13,y-19,10,4,'#a7785e');}else if(role==='cartographer'||String(r.id).includes('bailan')){rect(x+10,y-27,15,17,'#dfd3a9');line(x+13,y-24,x+21,y-17,'#789171',2);}else if(role==='rest'&&!moving){rect(x+10,y-17,9,8,'#c1b795');circle(x+14,y-18,4,'#e2d6b0');}
 }
 drawBuilding(b,e){super.drawBuilding(b,e);if(b.hp<=0)return;const c=this.ctx,p=pixelPainter(c),{rect,line,circle}=p,job=(e.c?.production||[]).find(j=>j.station===b.type&&!j.ready),ready=(e.c?.production||[]).some(j=>j.station===b.type&&j.ready),t=this.time;
  if(job){if(b.type==='canner'){rect(b.x-24,b.y-13,49,6,'#4e6853');for(let k=0;k<3;k++){const x=b.x-24+(k*17+t*13)%45;rect(x,b.y-24,9,11,'#b6c6ac');rect(x,b.y-24,9,3,'#ddd8b1');}}else if(Object.hasOwn(job.out||{},'cloth')){const dx=Math.sin(t*4)*13;rect(b.x-20,b.y-24,40,16,'#c4c6a0');line(b.x+dx,b.y-25,b.x+dx,b.y-8,'#786b4c',3);}else if(b.type==='cook'){for(let k=0;k<3;k++){const yy=b.y-50-((t*12+k*9)%28);rect(b.x-7+k*7+Math.sin(t+k)*2,yy,5,5,'#d4d5b074');}}else{rect(b.x+17,b.y-38,5,5,'#c1d09c');line(b.x-9,b.y-31,b.x+9,b.y-31+Math.sin(t*8)*4,'#c1ae74',3);}}
  if(ready){rect(b.x+24,b.y-10,13,9,'#b6c99c');rect(b.x+26,b.y-9,9,3,'#e2d5a8');}
  if(b.type==='irrigation'&&(e.c?.energy||0)>0){for(let k=0;k<4;k++){const a=t*.9+k*Math.PI/2;rect(b.x+Math.cos(a)*24,b.y-19+Math.sin(a)*9,3,3,'#b0d5ce');}}
  if(b.type==='drone'&&(e.c?.energy||0)>0){const busy=(e.s.plots||[]).some(q=>q.crop&&CROPS[q.crop]&&q.growth>=CROPS[q.crop].grow&&NEAR(q,b,300));if(busy){const dx=Math.sin(t)*15,dy=Math.cos(t*.9)*6;rect(b.x+dx-8,b.y-56+dy,17,6,'#b2c6ae');line(b.x+dx-15,b.y-57+dy,b.x+dx+16,b.y-57+dy,'#d2d9b866',2);}}
 }
 drawPlayer(e){const p=e.s.player,c=this.ctx,a=p.facing,paint=pixelPainter(c),{rect,line}=paint;this.shadow(p.x,p.y,19);let index=a>=Math.PI/4&&a<Math.PI*.75?0:a<-Math.PI/4&&a>-Math.PI*.75?4:a>=-Math.PI/4&&a<=Math.PI/4?8:12;index+=e.walking?Math.floor(e.moveTime*9)%4:0;const swing=e.actionAnim>0,alpha=e.invulnerable>0&&Math.floor(e.invulnerable*12)%2===0?.45:1;this.sprite(index,p.x,p.y,54,65,true,alpha);
  const id=e.currentItem(),weapon=WEAPONS[id],recoil=swing&&weapon?.mag?Math.sin(clamp(e.actionAnim/.2,0,1)*Math.PI)*4:0;const handX=p.x+Math.cos(a)*12,handY=p.y-26+Math.sin(a)*7;c.save();c.translate(handX,handY);c.rotate(a);c.globalAlpha=alpha;
  if(weapon&&e.qty(id)){if(weapon.mag){const length=id==='pistol'?19:id==='shotgun'?32:37;rect(-3-recoil,-3,length,6,'#424e42');rect(3-recoil,-5,length-5,3,'#99a99b');rect(-7-recoil,-1,11,6,'#a68b5d');rect(length-3-recoil,-3,4,5,'#3e5146');if(swing&&e.actionAnim>.13){rect(length+2-recoil,-2,7,3,'#eadb9c');rect(length+5-recoil,-4,3,7,'#d6b66d');}if(e.reload){rect(-2,7,8,11,'#879887');line(-5,4,2,9,'#cfaf7e',4);}}else{c.rotate(swing?-.8+(1-e.actionAnim/.2)*1.9:.5);rect(-2,-2,30,6,'#9b8153');rect(16,-4,14,10,'#baa372');rect(-4,-1,8,5,'#d2ad79');}}
  else if(swing){if(id==='water'){rect(4,-8,15,15,'#739f96');rect(7,-11,9,4,'#a4c2ab');line(17,-3,28,-6,'#a9c5b1',3);for(let k=0;k<4;k++)rect(29+k*3,-5+k*3,2,4,'#b4d9cf');}else if(id==='hoe'){c.rotate(-.7+(1-e.actionAnim/.25)*1.3);rect(-2,-2,31,4,'#ad9364');rect(22,-9,12,7,'#9fae9b');}else if(ITEMS[id]?.type==='seed'){rect(1,-3,9,8,'#bea874');for(let k=0;k<3;k++)rect(15+k*5,3+k*2,2,2,'#dcc48b');}else{rect(-2,-2,16,7,'#b59a6c');}}
  c.restore();if(e.reload){rect(p.x-25,p.y-78,50,5,'#17291f');rect(p.x-25,p.y-78,50*(1-e.reload.t/e.reload.max),5,'#e3d49b');this.text('装填中',p.x,p.y-87,'#eee1b3',11);}if(e.f?.crouch)this.badge(e.inCover?.()?'草丛隐蔽':'蹲行',p.x,p.y+20,'#cbdda5');
 }
 drawEnemy(z,e){super.drawEnemy(z,e);if(z.nest)return;const c=this.ctx,p=pixelPainter(c),{rect,line}=p,x=z.x,y=z.y;
  if(z.type==='armor'){rect(x-25,y-44,10,13,'#899489');rect(x+16,y-44,10,13,'#899489');rect(x-10,y-44,20,18,'#697d73');line(x-7,y-41,x+7,y-30,'#aeb5a0',2);}
  if(z.type==='runner'){const k=Math.sin(this.time*10)*3;line(x-13,y-5,x-20+k,y+3,'#809876',3);line(x+11,y-6,x+21-k,y-2,'#809876',3);}
  if(z.windup>0){c.save();c.strokeStyle='#f0c48e';c.lineWidth=2;c.setLineDash(z.type==='runner'?[9,5]:[]);const a=z.facing||0,r=z.type==='elite'?76:49;c.beginPath();c.moveTo(x+Math.cos(a-.55)*r,y+Math.sin(a-.55)*r);c.lineTo(x+Math.cos(a)*r*1.2,y+Math.sin(a)*r*1.2);c.lineTo(x+Math.cos(a+.55)*r,y+Math.sin(a+.55)*r);c.stroke();c.restore();}
  if(z.flash>0){const progress=1-clamp(z.flash/.15,0,1),color=z.type==='armor'||z.type==='elite'?'#ebd28d':'#bdad7a';for(let k=0;k<5;k++){const a=k*2.2+z.x,xx=x+Math.cos(a)*(8+progress*23),yy=y-26+Math.sin(a)*(5+progress*17);line(xx,yy,xx+Math.cos(a)*5,yy+Math.sin(a)*5,color,2);}}
 }
 drawEventSets(e){
  const sets=(e.objects||[]).filter(o=>o.type==='beyondEvent');
  const records=e.b?.records||{};
  // Finished civic installations remain as a small scene marker after their active objective moves on.
  if(records.cinema?.status==='resolved'&&e.s.region==='stationMarket')sets.push({eventId:'cinema',x:410,y:650,finished:true});
  if(records.mailbag?.status==='resolved'&&e.s.region==='shipyard')sets.push({eventId:'mailbag',x:745,y:620,finished:true});
  if(records.reunion?.status==='resolved'&&e.s.region==='courtyard')sets.push({eventId:'reunion',x:705,y:644,finished:true});
  for(const o of sets){const{x,y}=o,p=pixelPainter(this.ctx),{rect,line,circle,crate}=p,id=o.eventId,st=records[id]||{},t=this.time;this.ctx.save();
   if(id==='cinema'){rect(x-54,y-105,5,107,'#817051');rect(x+50,y-105,5,107,'#817051');rect(x-54,y-107,109,5,'#b8a174');rect(x-48,y-99,98,61,st.choice==='stories'?'#8b8d6a':'#d5d2aa');if(st.choice!=='stories'){rect(x-36,y-87,75,37,'#759b83');rect(x-31,y-60,20,9,'#adc287');rect(x+1,y-77,20,28,'#b6b893');rect(x-3,y-82,29,7,'#637c63');}for(const yy of [y+16,y+42]){rect(x-45,yy,90,7,'#aa9267');rect(x-41,yy+7,6,7,'#756c4d');rect(x+35,yy+7,6,7,'#756c4d');}}
   else if(id==='reunion'){rect(x-29,y-13,60,18,'#9f8058');for(const dx of [-15,16]){circle(x+dx,y-15,8,'#d3c6a0');circle(x+dx,y-16,5,'#7d805d');}rect(x+36,y+12,17,8,'#ad976b');rect(x+42,y+19,5,9,'#786b49');}
   else if(id==='mailbag'){for(let k=0;k<3;k++){rect(x-31+k*24,y-22+(k%2)*7,20,26,'#b5a97b');rect(x-28+k*24,y-18+(k%2)*7,14,11,'#dfd6af');line(x-27+k*24,y-17+(k%2)*7,x-20+k*24,y-11+(k%2)*7,'#8c9471');}rect(x-32,y+6,74,3,'#677b5a');}
   else if(['bordertalk','visions','blueprint','cartographer'].includes(id)){rect(x-44,y-13,89,18,'#a18b62');rect(x-34,y-18,68,19,'#d1c7a0');line(x-27,y-12,x+27,y-3,'#6d9078',2);line(x-16,y-14,x+2,y-3,'#8d9e79',2);for(const dx of [-51,42])rect(x+dx,y+18,13,8,'#8c7c57');if(id==='visions')for(let k=0;k<3;k++){rect(x-32+k*32,y-50,3,36,'#99865f');rect(x-29+k*32,y-49,15,18,['#a7b779','#c6b388','#8db4a2'][k]);}}
   else if(id==='lastferry'||id==='lastmile'){crate(x+33,y+4,22,26);crate(x+51,y+12,24,19);const people=id==='lastmile'?1:Math.max(1,4-(st.stage||0));for(let i=0;i<Math.min(3,people);i++){const xx=x-28+i*24,yy=y+(i%2)*7;circle(xx,yy-35,7,'#c6aa7d');rect(xx-7,yy-28,15,20,['#8b9a79','#a7a079','#79978a'][i]);rect(xx-6,yy-8,5,12,'#566e56');rect(xx+3,yy-8,5,12,'#566e56');}}
   else if(id==='woodline'){for(let k=0;k<4;k++){const xx=x-45+k*30;rect(xx,y-18,4,26,'#b6a176');rect(xx-3,y-17,11,6,'#b9865f');}line(x-44,y-12,x+48,y-12,'#d0c28c',2);}
   else if(id==='vines'){for(let k=0;k<7;k++){rect(x-43+k*14,y-20+(k%2)*6,5,22,'#67875a');rect(x-47+k*14,y-24+(k%2)*6,13,8,'#96ad6c');}crate(x+56,y,20,18);}
   else if(id==='rivertruth'){rect(x-39,y-12,78,15,'#aa9266');for(let k=0;k<3;k++){rect(x-28+k*24,y-36,16,22,'#aabda2');rect(x-25+k*24,y-25,10,9,['#778672','#7f9d85','#a5c5b3'][k]);rect(x-29+k*24,y-38,18,4,'#d3c79d');}}
   else if(id==='reports'||id==='daystreet'){for(let k=0;k<6;k++){const xx=x-42+k*15,yy=y-10+(k%2)*9;rect(xx,yy,7,4,'#696e4f');}crate(x+37,y-13,23,29);if(id==='daystreet')for(let k=0;k<3;k++)rect(x-38,y-38+k*9,45,5,'#b09b6a');}
   else if(id==='safetylamp'||id==='airlock'){for(let k=0;k<2;k++){rect(x-35+k*56,y-50,15,54,'#7e927b');rect(x-32+k*56,y-47,9,10,k===0?'#b7c486':'#c59e79');}crate(x+4,y+3,28,25);}
   else if(id==='seedcontract'){for(let k=0;k<3;k++){rect(x-30+k*24,y-26,19,29,'#b8ad82');rect(x-26+k*24,y-19,11,10,'#79965d');rect(x-23+k*24,y-24,4,10,'#d2c391');}rect(x-38,y+7,83,4,'#b6b792');}
   else if(id==='frostline'){crate(x-20,y+4,38,30);rect(x-38,y-31,75,11,'#bcbea0');rect(x-35,y-23,65,8,'#779985');rect(x+25,y-19,22,20,'#c5b690');}
   else if(id==='dogbridge'){for(let k=0;k<4;k++)rect(x-36+k*19,y-9,13,16,'#bd9f6c');line(x-39,y-12,x+39,y-12,'#6e7956',2);}
   else{rect(x-3,y-48,6,53,'#9e8b61');rect(x-26,y-50,52,21,'#b7b589');rect(x-21,y-46,41,5,'#7c9a70');crate(x+33,y,23,21);}
   this.ctx.restore();
  }
 }
 drawWeather(e){
  const c=this.ctx,s=e.s,t=this.time,id=s.region,quality=s.settings?.visualEffects||'full',p=s.player,low=quality==='reduced',off=quality==='off';
  const roofs=BEYOND_GEOMETRY[id]||REGIONS[id]?.colliders?.filter(r=>r.w>120&&r.h>65)||[];
  const roofAt=(x,y)=>roofs.some(r=>x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h);
  const actors=[p,...(e.enemies||[]).filter(z=>!z.dead)];
  const protectedAt=(x,y)=>actors.some(a=>Math.abs(x-a.x)<(a.windup>0?80:29)&&Math.abs(y-a.y+26)<(a.windup>0?85:52));
  c.save();
  // Lighting remains quiet enough that enemy tells retain their original contrast.
  const minute=s.minute;let wash=null;
  if(minute>=300&&minute<450)wash='#dfbd7411';else if(minute>=900&&minute<1110)wash='#b9824b12';else if(minute>=450&&minute<900&&id!=='shelter')wash='#d6dd9f05';
  if(wash){c.fillStyle=wash;c.fillRect(0,0,WORLD.w,WORLD.h);}
  if(!off){
   if(['shipyard','archive'].includes(id)){const clean=!!e.b?.benefits?.cleanRiver,water=clean?'#b4d5bd':'#85b4af';c.fillStyle=water;for(let i=0;i<(low?20:42);i++){const x=i%2?1479+(i%3)*8:29+(i%4)*11,y=(i*67+t*9)%960+20;c.fillRect(x,y,12+(i%4)*4,2);}for(let k=0;k<15;k++){const x=100+k*93,y=967+Math.sin(k+t*.7)*4;c.fillRect(x,y,23,2);}if(id==='shipyard'&&stateOf(e,'shipyard_ferry').flags?.service){const x=240+(t*16)%1000,y=976;c.fillStyle='#607d6e';c.fillRect(x,y-5,26,8);c.fillStyle='#d5d3a5';c.fillRect(x+6,y-7,14,3);c.fillStyle='#accaba';c.fillRect(x-12,y-3,9,2);c.fillRect(x-17,y+2,10,2);}}
   const rain=['小雨','暴雨','酸雨'].includes(s.weather)&&id!=='shelter'&&id!=='frost';
   if(rain){c.strokeStyle=s.weather==='酸雨'?'#b0c7965a':'#bcd5d960';c.lineWidth=1;const amount=low?45:s.weather==='暴雨'?145:86;for(let i=0;i<amount;i++){const x=(i*137+t*22)%WORLD.w,y=(i*73+t*(s.weather==='暴雨'?390:265))%WORLD.h;if(roofAt(x,y)||protectedAt(x,y))continue;c.beginPath();c.moveTo(x,y);c.lineTo(x-4,y+12);c.stroke();if(i%5===0){c.fillStyle='#abc7c343';c.fillRect(x-3,y+15,3,2);c.fillRect(x+4,y+15,3,2);}}
    for(const roof of roofs)for(let k=0;k<(low?2:5);k++){const x=roof.x+11+(roof.w-20)*k/5,y=roof.y+roof.h+(t*70+k*13)%20;if(protectedAt(x,y))continue;c.fillStyle='#c0d7cc77';c.fillRect(x,y,2,5);}}
   if(id==='frost'){c.fillStyle='#edf2dd93';for(let i=0;i<(low?28:68);i++){const x=(i*97+t*22)%WORLD.w,y=(i*57+t*32)%WORLD.h;if(roofAt(x,y)||protectedAt(x,y))continue;c.fillRect(x,y,2+(i%2),2);}c.fillStyle='#e2ebdb12';for(let i=0;i<3;i++){const y=(i*345+t*7)%1024;for(let k=0;k<14;k++){const x=k*123+Math.sin(i+t*.2)*30;if(!protectedAt(x,y))c.fillRect(x,y,73,7);}}}
   if(id==='pinewood'||id==='shipyard'){const max=low?4:8;for(let i=0;i<max;i++){const x=(i*251+t*5)%1660-80,y=125+(i*173)%805;if(protectedAt(x+70,y))continue;c.fillStyle=id==='pinewood'?'#c3d0b210':'#c3d6ca12';c.fillRect(x,y,170,9);c.fillRect(x+24,y-7,130,8);c.fillRect(x-14,y+8,205,6);}if(id==='pinewood'){c.fillStyle='#c5c6866b';for(let i=0;i<(low?10:23);i++){const x=(i*149+t*14)%WORLD.w,y=110+(i*67+t*3)%800;if(!protectedAt(x,y))c.fillRect(x,y,2,2);}}}
  }
  // Light is clipped to its own street side by the actual collision geometry.
  if((minute>1080||minute<360||id==='shelter')&&!off){const lights=[];
   if(s.region==='farm')for(const b of s.buildings||[])if(b.hp>0&&((b.type==='lamp'&&(e.c?.energy||0)>0)||b.type==='cook'&&(e.c?.production||[]).some(j=>j.station==='cook'&&!j.ready)))lights.push({x:b.x,y:b.y-30,r:60,color:'#edcb852c'});
   for(const o of e.objects||[])if(o.type==='beyondPoint'){const st=stateOf(e,o.pointId),flags=st.flags||{},energy=(e.c?.energy||0)>0;let lit=false;if(o.pointId==='shipyard_fog')lit=st.choice==='lamp'&&energy;else if(o.pointId==='shelter_signals')lit=!!flags.repair;else if(o.pointId==='shelter_housing')lit=!!flags.repair&&!!stateOf(e,'shelter_air').flags?.service;else if(o.pointId==='frost_weather')lit=!!flags.repair&&energy;else if(o.pointId==='frost_bearing')lit=!!flags.survey&&energy;else if(['pinewood_lodge','frost_inn'].includes(o.pointId))lit=e.b?.modules?.includes(o.pointId+':warm');if(lit)lights.push({x:o.x,y:o.y-35,r:55,color:o.pointId==='shelter_signals'?'#bdcf9a25':'#dacd9029'});}
   for(const l of lights){c.save();const g=c.createRadialGradient(l.x,l.y,3,l.x,l.y,l.r);g.addColorStop(0,l.color);g.addColorStop(1,'#ebcf8e00');c.beginPath();const steps=32;for(let i=0;i<=steps;i++){const a=i/steps*Math.PI*2;let range=l.r;for(let d=7;d<l.r;d+=7)if(roofAt(l.x+Math.cos(a)*d,l.y+Math.sin(a)*d)){range=d;break;}const x=l.x+Math.cos(a)*range,y=l.y+Math.sin(a)*range;if(!i)c.moveTo(x,y);else c.lineTo(x,y);}c.closePath();c.clip();c.fillStyle=g;c.fillRect(l.x-l.r,l.y-l.r,l.r*2,l.r*2);c.restore();}
  }
  c.restore();
 }
 drawMapPreview(canvas,e){super.drawMapPreview(canvas,e);if(!isNew(e.s.region))return;const c=canvas.getContext('2d');for(const p of e.objects||[])if(p.type==='beyondPoint'){const x=p.x/WORLD.w*canvas.width,y=p.y/WORLD.h*canvas.height,st=stateOf(e,p.pointId);c.fillStyle=p.pointId===e.b?.track?'#f5d49b':st.count?'#c2dda4':'#a8c7c0';c.fillRect(x-4,y-4,8,8);if(p.pointId===e.b?.track){c.font='12px sans-serif';c.fillStyle='#fff4d5';c.fillText(p.name,x>570?x-120:x+9,y+4);}}}
}
