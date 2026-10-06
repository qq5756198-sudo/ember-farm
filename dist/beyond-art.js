/** Deterministic, code-native pixel environments for the five regions beyond the old boundary.
 * Walkways and all forty action anchors are clear. Large silhouettes use only the geometry
 * exported below; weather, residents and restored facilities are rendered dynamically.
 */
export const BEYOND_GEOMETRY = {
 pinewood:[{x:225,y:72,w:298,h:134},{x:930,y:78,w:374,h:124}],
 shipyard:[{x:240,y:70,w:315,h:145},{x:995,y:60,w:300,h:152}],
 shelter:[{x:230,y:74,w:310,h:142},{x:950,y:72,w:355,h:143}],
 frost:[{x:240,y:75,w:302,h:139},{x:994,y:75,w:310,h:132}],
 archive:[{x:238,y:74,w:315,h:135},{x:942,y:70,w:373,h:140}]
};
export const BEYOND_ANCHORS=[[370,310],[700,300],[1080,300],[1370,350],[410,650],[745,620],[1080,680],[1360,820]];
export const BEYOND_THEMES={
 pinewood:{seed:1101,ground:'#53654a',flecks:['#617349','#6c7850','#425741','#8c8b5b'],path:'#a48d66',edge:'#6d7452',wall:'#b3a076',roof:'#71654a',water:'#507a78'},
 shipyard:{seed:1102,ground:'#4b7175',flecks:['#567e80','#638b87','#426871','#7f9b91'],path:'#ada48a',edge:'#777e71',wall:'#b3a18b',roof:'#7b5d51',water:'#517d81'},
 shelter:{seed:1103,ground:'#555e59',flecks:['#616b63','#49564e','#6e7469','#777a6c'],path:'#878a78',edge:'#444f49',wall:'#949789',roof:'#656f65',water:'#547c70'},
 frost:{seed:1104,ground:'#c5d2cb',flecks:['#d8dfd4','#b3c5c4','#e1e4d8','#a7bdbf'],path:'#9caeaa',edge:'#a3b9b7',wall:'#b8beb0',roof:'#667f84',water:'#76999f'},
 archive:{seed:1105,ground:'#82917a',flecks:['#91a084','#72866f','#a0ab8e','#637e72'],path:'#bab59b',edge:'#829582',wall:'#c4bea3',roof:'#7b8679',water:'#638b88'}
};
const W=1536,H=1024;
const rand=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
export function pixelPainter(c,rng=rand(12)){
 const rect=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
 const line=(x,y,xx,yy,col,w=2)=>{c.strokeStyle=col;c.lineWidth=w;c.beginPath();c.moveTo(Math.round(x),Math.round(y));c.lineTo(Math.round(xx),Math.round(yy));c.stroke();};
 const pixel=(x,y,w,h,n,pal,s=2)=>{for(let k=0;k<n;k++)rect(x+rng()*w,y+rng()*h,s+rng()*s,s,pal[k%pal.length]);};
 const circle=(x,y,r,col)=>{for(let yy=-r;yy<=r;yy+=3){const span=Math.sqrt(Math.max(0,r*r-yy*yy));rect(x-span,y+yy,span*2,3,col);}};
 const pine=(x,y,s=1,snow=false)=>{rect(x-20*s,y,43*s,9*s,'#30483a65');rect(x-4*s,y-18*s,8*s,28*s,'#70593e');for(let i=0;i<4;i++){const w=23+i*13,yy=y-82*s+i*17*s;rect(x-w/2*s,yy,w*s,15*s,snow?'#536e68':'#315640');rect(x-(w/2-4)*s,yy-6*s,(w-8)*s,9*s,snow?'#87a49a':'#527349');rect(x-(w/2-8)*s,yy-10*s,(w-16)*s,7*s,snow?'#d4ded0':'#749057');}rect(x-3*s,y-98*s,7*s,12*s,snow?'#dce3d5':'#83a469');};
 const crate=(x,y,w=32,h=25)=>{rect(x-w/2+4,y-h+4,w,h,'#3d483c');rect(x-w/2,y-h,w,h,'#8d754e');rect(x-w/2,y-h,w,3,'#c3a574');for(let i=7;i<w;i+=9)rect(x-w/2+i,y-h+4,2,h-4,'#5d553e');rect(x-w/2+3,y-6,w-6,3,'#b29361');};
 const lamp=(x,y,col='#e7ca88')=>{rect(x-5,y,13,6,'#414d44');rect(x,y-43,4,45,'#526153');rect(x-7,y-51,18,13,'#394c44');rect(x-4,y-48,12,7,col);rect(x-9,y-54,22,4,'#9b9b7e');};
 const building=(r,t,variant='roof')=>{const{x,y,w,h}=r;rect(x+7,y+5,w,h,'#354c3f80');rect(x,y,w,h,'#3d4a40');rect(x+5,y+5,w-10,h-9,t.wall);rect(x+5,y+h-43,w-10,38,'#938a70');
  if(variant==='room'){rect(x+10,y+10,w-20,h-21,'#6f7769');for(let xx=x+18;xx<x+w-22;xx+=36){rect(xx,y+18,28,46,'#504f3f');rect(xx+3,y+21,22,4,'#a09b7b');for(let k=0;k<5;k++)rect(xx+4+k*4,y+27,3,29,['#aa956f','#658a86','#b1775b'][k%3]);}rect(x+29,y+h-42,w-58,7,'#b2a582');}
  else{rect(x+1,y+1,w-2,h-47,t.roof);for(let yy=y+9;yy<y+h-49;yy+=12)for(let xx=x+7;xx<x+w-8;xx+=23){rect(xx,yy,Math.min(20,x+w-xx-5),9,(xx+yy)%3?'#8b8970':t.roof);rect(xx,yy,Math.min(20,x+w-xx-5),2,'#b0a687');}rect(x+4,y+3,w-8,4,'#c4b79a');rect(x+2,y+h-47,w-4,7,'#465448');}
  for(let xx=x+20;xx<x+w-26;xx+=60){rect(xx,y+h-32,24,23,'#485c50');rect(xx+3,y+h-29,18,14,'#8fa9a0');rect(xx+10,y+h-29,3,14,'#576e60');rect(xx,y+h-10,26,3,'#c3b293');}rect(x+w/2-11,y+h-31,24,30,'#3d4d40');rect(x+w/2-7,y+h-28,16,25,'#8f7750');};
 const plank=(x,y,w,h)=>{rect(x-3,y-3,w+6,h+6,'#485e55');rect(x,y,w,h,'#8c8466');for(let xx=x;xx<x+w;xx+=12){rect(xx,y,9,h,'#b1a080');rect(xx,y+3,9,2,'#c8b891');rect(xx+2,y+7,2,Math.max(1,h-12),'#7e785e');}};
 const path=(x,y,w,h,t)=>{rect(x-7,y-7,w+14,h+14,t.edge);rect(x,y,w,h,t.path);pixel(x,y,w,h,Math.floor(w*h/180),[t.path,'#bdaf87','#9a9276'],2);for(let k=0;k<w;k+=32){rect(x+k,y-5,17,3,t.ground);rect(x+k+13,y+h+2,17,3,t.ground);}};
 return{rect,line,pixel,circle,pine,crate,lamp,building,plank,path};
}
function regionAsset(id){
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const c=canvas.getContext('2d');if(!c)return canvas;c.imageSmoothingEnabled=false;const t=BEYOND_THEMES[id],rng=rand(t.seed),p=pixelPainter(c,rng);const{rect,line,pixel,circle,pine,crate,lamp,building,plank,path}=p;
 rect(0,0,W,H,t.ground);for(let i=0;i<900;i++)rect(rng()*W,rng()*H,12+rng()*52,6+rng()*20,t.flecks[i%4]);pixel(0,0,W,H,18500,t.flecks);
 if(['shipyard','archive'].includes(id)){rect(76,231,1385,708,id==='shipyard'?'#808c7e':'#81907b');rect(169,220,1200,727,id==='shipyard'?'#b1b19b':'#a6b195');rect(180,231,1175,706,id==='shipyard'?'#9caa98':'#92a386');for(let yy=253;yy<930;yy+=27)for(let xx=180+(yy%2)*10;xx<1350;xx+=34){rect(xx,yy,31,24,id==='shipyard'?'#a7ae97':'#9ead92');rect(xx,yy+23,31,2,'#879784');}for(let yy=50;yy<1000;yy+=19){rect(24+rng()*60,yy,22+rng()*32,2,'#92b5ac');rect(1476,yy,25+rng()*23,2,'#a0beb0');}for(let xx=90;xx<1460;xx+=36)rect(xx,959,26,3,'#a7c2b2');}
 if(id==='shelter'){for(let yy=42;yy<H;yy+=32)for(let xx=45;xx<W;xx+=40){rect(xx,yy,37,29,'#687164');rect(xx+2,yy+27,35,2,'#4c5c51');}rect(46,35,1446,13,'#a0a58d');rect(46,35,14,954,'#3c4a43');rect(1480,35,14,954,'#3c4a43');rect(50,975,1440,13,'#909c85');for(let yy=53;yy<970;yy+=54){rect(48,yy,16,29,'#8f9a84');rect(1477,yy,16,29,'#8f9a84');}for(let xx=89;xx<1430;xx+=170){rect(xx,59,70,5,'#cec99d');rect(xx,948,70,5,'#c3c8a2');}}
 if(id==='frost'){for(let i=0;i<90;i++){const x=rng()*W,y=rng()*H;rect(x,y,32+rng()*85,4,'#edf0df');rect(x+9,y+5,15+rng()*50,3,'#b5c8c5');}for(let x=50;x<W-20;x+=68){rect(x,36,51,74,'#95aeb0');rect(x+7,23,38,27,'#e1e7dc');rect(x+17,13,20,18,'#edf0e5');}for(let i=0;i<10;i++)pine(90+i*142,971,1.1,true);}
 // Calm travel network. Branches end at the usable side of each purpose-built prop.
 path(75,470,1392,94,t);path(142,270,72,610,t);path(183,297,1225,74,t);path(184,618,1230,77,t);path(666,334,72,510,t);path(1036,334,77,552,t);path(1325,360,70,503,t);path(198,816,1199,63,t);path(370,650,70,207,t);
 if(id==='pinewood'){
  building(BEYOND_GEOMETRY[id][0],t);building(BEYOND_GEOMETRY[id][1],{...t,roof:'#6d7354'});
  for(let yy=235;yy<950;yy+=48){rect(1440,yy,29,39,'#4b6c5d');rect(1446,yy+3,20,32,t.water);rect(1448,yy+12,14,2,'#93bab0');}
  for(const [x,y]of [[280,450],[585,448],[890,444],[1175,436],[295,773],[600,778],[924,769],[1195,961]]){rect(x,y,60,28,'#354b36');for(let xx=0;xx<3;xx++){rect(x+xx*18,y-8,16,27,'#997951');circle(x+8+xx*18,y-7,8,'#c6ad76');rect(x+7+xx*18,y-13,2,11,'#8b744c');}}
  for(let x=46;x<W;x+=50){pine(x,64,.9+rng()*.35);pine(x,1013,.9+rng()*.25);}for(let y=120;y<938;y+=55){if(y<438||y>600)pine(40,y,1.05);pine(1501,y,1.2);}for(const x of [550,844,1171]){rect(x,745,40,30,'#485b42');rect(x+13,725,15,36,'#766045');circle(x+21,725,15,'#bca275');circle(x+21,725,9,'#8e7952');}
 }else if(id==='shipyard'){
  building(BEYOND_GEOMETRY[id][0],t);building(BEYOND_GEOMETRY[id][1],t);
  // Dry dock and hull are entirely in the inaccessible northern band.
  rect(622,82,274,144,'#354f53');rect(634,88,250,122,'#5a8586');rect(666,129,191,56,'#593f32');rect(688,119,148,15,'#b39a73');rect(648,143,18,24,'#806a4c');rect(857,139,18,31,'#806a4c');rect(687,137,153,39,'#bbad87');for(let xx=692;xx<840;xx+=12)rect(xx,140,8,34,'#8d886c');rect(746,137,46,27,'#788f81');rect(755,140,29,12,'#a7c4b8');
  for(const [x,y]of [[516,429],[943,427],[510,761],[919,789]]){rect(x,y,118,86,'#607e75');rect(x+5,y+6,108,75,'#4d7b7d');rect(x+9,y+11,100,2,'#94b6a9');for(let k=0;k<5;k++)rect(x+12+k*18,y+30+(k%2)*17,12,2,'#89a89a');}plank(79,482,153,62);for(const x of [174,631,1108,1412]){lamp(x,452);rect(x,904,8,34,'#6f715c');rect(x-4,903,16,7,'#b3a586');}for(const [x,y]of [[320,797],[894,563],[1235,461]]){crate(x,y,35,32);crate(x+31,y+9,28,26);}
 }else if(id==='shelter'){
  building(BEYOND_GEOMETRY[id][0],t,'room');building(BEYOND_GEOMETRY[id][1],t,'room');
  for(const y of [242,760,916]){rect(221,y,1173,4,'#8f9376');rect(221,y+5,1173,3,'#394e46');rect(221,y+9,1173,2,'#b5af86');}for(const x of [267,895,1222]){rect(x,237,6,678,'#5a7166');rect(x+2,237,2,678,'#9ead91');}
  for(const [x,y]of [[565,409],[865,550],[1172,749],[296,775]]){rect(x,y,76,37,'#374f43');rect(x+5,y+5,66,27,'#5a7864');for(let k=0;k<5;k++)rect(x+12+k*11,y+7,5,23,'#8da088');}for(const x of [240,560,900,1400]){lamp(x,444,'#b6d1b0');lamp(x,777,'#b6d1b0');}for(let xx=610;xx<893;xx+=47){rect(xx,122,34,72,'#3f554c');rect(xx+4,126,26,62,'#8e9e89');rect(xx+8,132,18,25,'#436b62');rect(xx+10,137,14,3,'#b2c993');rect(xx+8,167,18,4,'#c7bc82');}
 }else if(id==='frost'){
  building(BEYOND_GEOMETRY[id][0],t);building(BEYOND_GEOMETRY[id][1],t);for(const r of BEYOND_GEOMETRY[id]){rect(r.x-2,r.y-2,r.w+4,7,'#f0f0df');for(let x=r.x+5;x<r.x+r.w;x+=17)rect(x,r.y+r.h-44,3,10,'#d9e5df');}circle(772,161,52,'#607b7f');circle(770,156,46,'#c4d4cd');rect(719,161,104,46,'#8fa8a3');for(let x=730;x<810;x+=13)rect(x,169,4,32,'#587b7b');rect(760,198,23,16,'#566f70');
  for(const [x,y]of [[525,439],[905,428],[1190,766],[504,786]]){rect(x,y,79,31,'#829c9d');rect(x+5,y-5,66,20,'#d8e1d6');rect(x+16,y-11,39,17,'#e9ecdf');}for(const [x,y,w,h]of [[221,451,360,14],[869,754,376,13],[582,904,480,12]])plank(x,y,w,h);for(const x of [240,606,961,1430]){lamp(x,594,'#edd7a2');rect(x-8,590,25,5,'#e3e8d9');}line(852,211,1262,900,'#5c777a',3);line(863,211,1273,900,'#adbbb0',2);
 }else if(id==='archive'){
  building(BEYOND_GEOMETRY[id][0],t,'room');building(BEYOND_GEOMETRY[id][1],t,'room');
  for(const [x,y,w]of [[579,423,260],[975,775,240],[283,757,288]]){rect(x,y,w,47,'#6c876c');rect(x+5,y+5,w-10,37,'#426b57');for(let xx=x+12;xx<x+w-10;xx+=18){rect(xx,y+12,7,17,'#7da276');rect(xx+2,y+8,4,8,'#b1c794');}}for(const x of [330,699,1027,1383]){lamp(x,440,'#dfd6a3');lamp(x,923,'#dfd6a3');}for(let xx=661;xx<860;xx+=26){rect(xx,111,22,65,'#716f54');rect(xx+3,114,16,57,'#b4ad86');for(let k=0;k<5;k++)rect(xx+4+k*3,119,2,44,['#53776a','#aa875e','#7b8d6d'][k%3]);}rect(650,180,228,11,'#9d8d68');rect(673,191,8,22,'#575f48');rect(853,191,8,22,'#575f48');plank(79,483,148,68);for(let x=120;x<1450;x+=95){rect(x,964,55,6,'#91b0a0');rect(x+8,977,23,3,'#abc6b0');}
 }
 // Subtle cleared footprints are flooring, not repeated pedestal objects.
 for(const [x,y]of BEYOND_ANCHORS){rect(x-45,y-16,90,36,id==='shelter'?'#8c9481':id==='frost'?'#bfcfc5':t.path);pixel(x-40,y-12,80,28,14,[t.path,t.flecks[0]],2);}
 rect(75,474,143,5,'#c5b58c');rect(75,557,143,5,'#c5b58c');
 return canvas;
}
export function createBeyondAssets(){const assets={};for(const id of Object.keys(BEYOND_THEMES))assets[id]=regionAsset(id);return assets;}
