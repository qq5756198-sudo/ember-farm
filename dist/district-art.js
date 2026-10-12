/** Five deterministic, region-specific pixel backdrops. No network or image dependencies.
 * Blocking silhouettes exactly follow DISTRICT_GEOMETRY; all other details are floor art.
 * Dynamic crops, workstations, residents and restoration overlays belong to the renderer.
 */
export const DISTRICT_POINTS = [
  {x:370,y:360},{x:650,y:360},{x:960,y:360},{x:1260,y:360},
  {x:370,y:730},{x:650,y:730},{x:960,y:730},{x:1260,y:730}
];
export const DISTRICT_GEOMETRY = {
  valley: [{x:180,y:90,w:350,h:170},{x:1040,y:80,w:300,h:160},{x:700,y:440,w:120,h:150}],
  stationMarket: [{x:230,y:100,w:310,h:150},{x:630,y:100,w:300,h:150},{x:1040,y:100,w:270,h:150},{x:480,y:480,w:200,h:100},{x:1000,y:480,w:230,h:100}],
  courtyard: [{x:250,y:100,w:240,h:150},{x:620,y:100,w:240,h:150},{x:1000,y:100,w:290,h:150},{x:260,y:450,w:270,h:150},{x:800,y:450,w:220,h:150},{x:1170,y:450,w:180,h:150}],
  quarantine: [{x:220,y:100,w:320,h:150},{x:620,y:100,w:280,h:150},{x:1040,y:100,w:300,h:150},{x:610,y:470,w:310,h:100}],
  railDepot: [{x:240,y:80,w:380,h:170},{x:970,y:70,w:390,h:180},{x:250,y:480,w:270,h:100}]
};
const W=1536,H=1024;
const themes={
  valley: {seed:9401,ground:'#6c7d36',grain:['#7d8b3c','#839246','#596c30','#9e9b4c'],road:'#a9814e',roof:'#91543a',wall:'#b39a65',tree:'#426334'},
  stationMarket: {seed:9402,ground:'#666348',grain:['#737056','#77715a','#535b43','#898166'],road:'#978568',roof:'#575e61',wall:'#a48662',tree:'#455d3c'},
  courtyard: {seed:9403,ground:'#57634d',grain:['#667357','#748064','#4d6049','#85826b'],road:'#8b8772',roof:'#8e5446',wall:'#a48f76',tree:'#3c6348'},
  quarantine: {seed:9404,ground:'#6c8170',grain:['#7d8b73','#597362','#8c9681','#617b68'],road:'#afb5a0',roof:'#587b78',wall:'#b4b7a5',tree:'#3c6655'},
  railDepot: {seed:9405,ground:'#6e6955',grain:['#827961','#625f4d','#8b8067','#545b50'],road:'#a18c6b',roof:'#655e53',wall:'#998570',tree:'#4e6240'}
};
function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function nearPoint(x,y,r=66){return DISTRICT_POINTS.some(p=>Math.abs(p.x-x)<r&&Math.abs(p.y-y)<r)||Math.abs(x-140)<90&&Math.abs(y-510)<70;}
function inside(r,x,y,pad=0){return x>=r.x-pad&&x<=r.x+r.w+pad&&y>=r.y-pad&&y<=r.y+r.h+pad;}
function makePainter(c,rng){
  const rect=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
  const pixels=(x,y,w,h,n,pal,size=3)=>{for(let i=0;i<n;i++)rect(x+rng()*w,y+rng()*h,size+rng()*size,size,pal[Math.floor(rng()*pal.length)]);};
  const line=(x1,y1,x2,y2,col,width=3)=>{c.strokeStyle=col;c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();};
  const stone=(x,y,s=10)=>{rect(x+2,y+3,s+3,s*.65,'#3f4941');rect(x,y,s,s*.65,'#90907a');rect(x+2,y,Math.max(2,s-5),3,'#b1ac91');rect(x+s-2,y+3,3,s*.3,'#6d7162');};
  const tuft=(x,y,col='#8d9855')=>{rect(x,y,2,6,col);rect(x-3,y+3,2,4,col);rect(x+3,y+1,2,5,col);};
  const tree=(x,y,s=1,tone='#446539')=>{
    rect(x-25*s,y+7*s,59*s,13*s,'#344535');rect(x-4*s,y-7*s,9*s,29*s,'#59482e');rect(x-2*s,y-6*s,3*s,25*s,'#a17b42');
    // Clustered stepped crowns: discrete leafy masses, not a uniform rectangular hedge.
    const lobes=[[-19,-18,14],[-4,-31,19],[15,-19,17],[-13,-6,19],[8,-7,19],[0,-42,11]];
    for(const [dx,dy,rr] of lobes){
      rect(x+(dx-rr)*s,y+(dy-rr*.55)*s,rr*2*s,rr*1.12*s,'#2f5635');
      rect(x+(dx-rr*.7)*s,y+(dy-rr*.9)*s,rr*1.4*s,rr*1.8*s,tone);
      rect(x+(dx-rr*.85)*s,y+(dy-rr*.45)*s,rr*1.7*s,rr*.85*s,tone);
      for(let k=0;k<20;k++){const px=dx+(rng()-.5)*rr*1.5,py=dy+(rng()-.5)*rr*1.35;rect(x+px*s,y+py*s,(2+rng()*3)*s,2*s,['#799547','#99a447','#62893f','#466c36'][k%4]);}
    }
  };
  const fence=(x,y,w)=>{rect(x,y+4,w,4,'#3e4937');rect(x,y+1,w,3,'#a58450');rect(x,y+12,w,3,'#765c3b');for(let a=x;a<x+w;a+=33){rect(a,y-4,5,24,'#514833');rect(a,y-5,4,4,'#c2a16a');}};
  const bed=(x,y,w,h,green=false)=>{
    rect(x-5,y-5,w+10,h+10,'#75815a');rect(x-3,y-3,w+6,h+6,'#443f2f');rect(x,y,w,h,'#70563a');
    for(let row=y+9;row<y+h-3;row+=15){rect(x+4,row,w-8,3,'#493d2b');rect(x+4,row+3,w-8,2,'#937448');if(green)for(let col=x+8;col<x+w-4;col+=13){rect(col,row-4,4,5,'#526d37');rect(col-2,row-2,8,2,'#86a155');}}
    pixels(x,y,w,h,Math.floor(w*h/400),['#a38750','#59462f'],2);
  };
  const path=(x,y,w,h,color)=>{rect(x-4,y-4,w+8,h+8,'#686b4d');rect(x,y,w,h,color);pixels(x,y,w,h,Math.floor(w*h/190),['#b69c70','#947c54','#c1ad7f','#7c7152'],2);};
  const paving=(x,y,w,h,col='#8f927f')=>{rect(x,y,w,h,col);for(let yy=y+2;yy<y+h;yy+=18)for(let xx=x+((yy-y)%36?11:0);xx<x+w;xx+=27){rect(xx,yy,24,15,['#9b9c86','#858c7b','#a4a38a'][Math.floor(rng()*3)]);rect(xx,yy+14,24,1,'#717968');}};
  const lamp=(x,y,warm=true)=>{rect(x-6,y+4,15,5,'#444e41');rect(x,y-20,4,25,'#424c46');rect(x-4,y-26,12,11,'#37443b');rect(x-2,y-24,8,7,warm?'#d7b76e':'#91bab0');rect(x-4,y-29,12,3,'#77745b');};
  const building=(r,roof,wall,kind='house')=>{
    const {x,y,w,h}=r, roofH=Math.floor(h*.63),bottom=y+h;
    // Every dark wall and roof pixel stays inside the authoritative collider.
    rect(x,y,w,h,'#353f37');rect(x+5,y+5,w-10,h-10,wall);rect(x+8,y+roofH,w-16,h-roofH-4,'#7b735b');
    for(let row=y+roofH+6;row<bottom-5;row+=9)for(let col=x+9+((row-y)%18?0:12);col<x+w-10;col+=27){rect(col,row,Math.min(24,x+w-8-col),2,'#968367');}
    rect(x+3,y+3,w-6,roofH,roof);rect(x+3,y+roofH-2,w-6,7,'#3e443c');
    // Overlapping shingles with uneven weathering and a bright ridge.
    const tiles=roof==='#8b5445'||roof==='#8e5446'||roof==='#91543a'||roof==='#7f5845' ? ['#9e6043','#a66c47','#91553e','#af734a'] : ['#65746b',roof,'#728075','#5b6b64'];
    for(let row=y+8;row<y+roofH-5;row+=13){
      for(let col=x+7+((row-y)%26?0:10);col<x+w-8;col+=23){
        const tw=Math.min(21,x+w-8-col);if(tw<1)continue;
        rect(col,row,tw,11,tiles[Math.floor(rng()*tiles.length)]);rect(col+1,row,Math.max(1,tw-2),2,'#b39a70');rect(col,row+10,tw,2,'#434d42');
        if(rng()<.18)rect(col+5,row+6,4,3,'#6c7750');
      }
    }
    rect(x+6,y+5,w-12,3,'#b5a17b');rect(x+w-11,y+6,5,roofH-8,'#514d42');
    for(let wx=x+22;wx<x+w-25;wx+=61){rect(wx,y+roofH+12,24,24,'#3e443b');rect(wx+3,y+roofH+15,18,16,kind==='lab'?'#6d9e9a':'#b1a16b');rect(wx+11,y+roofH+15,3,17,'#535847');rect(wx+1,y+roofH+32,25,3,'#b29c70');rect(wx-4,y+roofH+14,4,20,'#58654f');rect(wx+25,y+roofH+14,4,20,'#58654f');rect(wx+4,y+roofH+15,7,3,'#d1c88b');}
    let dx=x+Math.floor(w*.5)-13;rect(dx,bottom-32,27,30,'#453e32');rect(dx+4,bottom-29,19,27,'#79633e');rect(dx+18,bottom-16,3,3,'#d1b277');
    if(kind==='shop'){rect(x+15,y+roofH+2,w-30,10,'#476459');for(let sx=x+16;sx<x+w-20;sx+=24)rect(sx,y+roofH+2,12,10,'#b5a575');}
    if(kind==='lab'){rect(x+w-43,y+roofH+5,27,12,'#d0c9aa');rect(x+w-33,y+roofH+6,5,10,'#688b77');rect(x+w-37,y+roofH+9,13,4,'#688b77');}
    if(kind==='depot'){for(let dx=x+28;dx<x+w-35;dx+=65){rect(dx,bottom-34,39,30,'#444a41');for(let yy=bottom-30;yy<bottom-5;yy+=5)rect(dx+3,yy,33,2,'#7b7e67');}}
    const crackX=x+w*.76;line(crackX,y+9,crackX-8,y+23,'#414b41',2);line(crackX-8,y+23,crackX-2,y+39,'#414b41',2);
    for(let k=0;k<4;k++){const vx=x+10+k*(w-24)/4;rect(vx,bottom-7,8,5,'#617747');rect(vx+3,bottom-11,3,8,'#7a8f50');}
  };
  return {rect,pixels,line,stone,tuft,tree,fence,bed,path,paving,lamp,building};
}
function drawRegion(id){
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const c=canvas.getContext('2d');if(!c)return canvas;c.imageSmoothingEnabled=false;
 const t=themes[id],rand=random(t.seed),p=makePainter(c,rand);const {rect,pixels,line,stone,tuft,tree,fence,bed,path,paving,lamp,building}=p;
 rect(0,0,W,H,t.ground);
 for(let i=0;i<700;i++){const xx=rand()*W,yy=rand()*H,ww=12+rand()*54,hh=8+rand()*28;rect(xx,yy,ww,hh,t.grain[Math.floor(rand()*t.grain.length)]);pixels(xx,yy,ww,hh,12,[t.ground,t.grain[0],t.grain[1]],2);}
 pixels(0,0,W,H,26000,t.grain,2);
 // Fine grass, fallen petals and damp soil flecks create scale before roads are laid.
 for(let i=0;i<1400;i++){const xx=rand()*W,yy=rand()*H;tuft(xx,yy,t.grain[i%4]);if(i%8===0)rect(xx+2,yy-1,2,2,'#c2b664');}
 
 // Branching roads provide a legible continuous walking network to all eight points.
 path(76,460,1390,103,t.road);path(128,250,86,625,t.road);path(192,317,1190,85,t.road);path(192,687,1190,88,t.road);
 for(const x of [608,918,1218])path(x,400,82,288,t.road);
 if(id==='valley'){
   // Shallow, walkable irrigation channels; broad stone crossings at road intersections.
   rect(855,55,43,920,'#405b50');rect(861,55,31,920,'#69958c');
   for(let y=68;y<972;y+=23){rect(865+rand()*12,y,15,2,'#a0b7a0');rect(859,y+9,4,8,'#708056');}
   for(const y of [328,475,700]){paving(839,y,73,54,'#9b9778');rect(841,y+4,69,3,'#c2b38a');}
   for(const [x,y,w,h] of [[260,426,310,166],[942,427,239,165],[272,822,433,117],[987,824,307,111]])bed(x,y,w,h,y<600);
   // Terraced retaining edges lie flat and leave the action anchors open.
   for(const yy of [279,623,795])for(let x=265;x<1350;x+=19)if(!nearPoint(x,yy))stone(x,yy,12);
   rect(1050,936,230,28,'#b1ad7d');pixels(1050,936,230,28,150,['#cfbf92','#a49e76','#778d71'],3);
   for(let x=1062;x<1270;x+=42){rect(x,946,23,2,'#749d8d');}
   building(DISTRICT_GEOMETRY[id][0],t.roof,t.wall,'house');building(DISTRICT_GEOMETRY[id][1],'#6a7053','#a89769','house');
   const pump=DISTRICT_GEOMETRY[id][2];rect(pump.x,pump.y,pump.w,pump.h,'#565e48');rect(pump.x+7,pump.y+7,pump.w-14,pump.h-14,'#8b9276');
   for(let yy=pump.y+12;yy<pump.y+pump.h-7;yy+=14){rect(pump.x+8,yy,pump.w-16,2,'#606d57');}rect(pump.x+28,pump.y+30,62,65,'#446b61');rect(pump.x+36,pump.y+38,46,42,'#72a094');rect(pump.x+53,pump.y+82,12,41,'#545d4c');
   fence(259,950,450);fence(968,951,325);
 }else if(id==='stationMarket'){
   paving(246,406,1114,48);paving(245,796,1110,144,'#8e8b70');
   DISTRICT_GEOMETRY[id].forEach((r,i)=>building(r,i===0?'#7f5845':t.roof,t.wall,i<3?'shop':'depot'));
   // Clock face belongs to the waiting-hall roof and does not add hidden collision.
   rect(348,108,62,56,'#3d4841');rect(354,112,50,44,'#c1b28a');rect(359,117,40,34,'#d7cc9f');line(379,120,379,135,'#4d5142',3);line(379,135,391,141,'#4d5142',3);
   for(let x=290;x<1345;x+=130){rect(x,851,76,3,'#c3b087');rect(x,851,3,44,'#c3b087');rect(x+73,851,3,44,'#c3b087');}
   // Flat awning shadows and unloaded pallet marks set a trading-yard rhythm.
   for(const x of [270,753,1325]){rect(x,477,50,4,'#655f49');rect(x+5,486,40,3,'#b6a37b');}
   for(const x of [247,570,973,1330]){lamp(x,432);lamp(x,809);}
   for(let x=740;x<929;x+=16)rect(x,593,12,5,x%32?'#bfaa6d':'#6e7760');
   fence(272,950,1060);
 }else if(id==='courtyard'){
   paving(550,456,214,176,'#8b9080');paving(1045,455,100,170,'#808875');
   DISTRICT_GEOMETRY[id].forEach((r,i)=>building(r,['#8b5445','#656962','#805c4f'][i%3],t.wall));
   // Rooftop links are represented as flat timber walkways, all passable.
   for(const [x,y,w] of [[490,172,130],[860,185,140],[530,530,250]]){rect(x,y,w,29,'#5c604e');for(let xx=x+2;xx<x+w;xx+=11){rect(xx,y+3,8,23,'#9a8764');rect(xx+1,y+4,2,21,'#b9a074');}}
   for(const [x,y,w,h] of [[283,829,267,99],[658,829,203,99],[1081,829,239,99]]){bed(x,y,w,h,true);fence(x,y+h+7,w);}
   for(const x of [290,720,1087]){line(x,282,x+163,282,'#465747',2);for(let xx=x+17;xx<x+150;xx+=31){rect(xx,284,15,19,['#b3a78b','#698783','#a87e60'][Math.floor(rand()*3)]);rect(xx+3,284,2,18,'#cab997');}}
   // Worn plaza tile emblem remains clear for navigation.
   paving(572,473,169,139);rect(624,519,63,5,'#b5b394');rect(651,491,5,62,'#b5b394');
   for(const x of [227,577,933,1379])lamp(x,653,false);
 }else if(id==='quarantine'){
   paving(243,418,1110,214,'#899b8d');paving(276,810,1060,133,'#9ca896');
   DISTRICT_GEOMETRY[id].forEach((r,i)=>building(r,i===3?'#70978a':t.roof,t.wall,'lab'));
   for(const [x,y,w,h] of [[285,828,276,86],[661,829,198,85],[1001,827,285,88]]){rect(x,y,w,h,'#758c6c');rect(x+4,y+4,w-8,h-8,'#4d7058');for(let xx=x+10;xx<x+w-6;xx+=20){rect(xx,y+10,9,h-20,'#8da36c');rect(xx+2,y+11,3,h-22,'#adc08a');}}
   // Painted supply conduits show how the wings join the central courtyard.
   for(const [sx,ex] of [[380,672],[760,765],[1195,851]]){line(sx,260,sx,286,'#b7aa66',5);line(sx,286,ex,286,'#b7aa66',5);line(ex,286,ex,450,'#b7aa66',5);line(sx+2,262,sx+2,282,'#d5c884',1);}
   // Ground-level purification basins: shallow and explicitly traversable.
   for(const x of [342,1052]){rect(x,475,158,115,'#5d776b');rect(x+7,482,144,100,'#9da991');rect(x+15,490,128,84,'#628e83');for(let yy=500;yy<570;yy+=14){rect(x+24,yy,105,3,'#81aaa0');}rect(x+66,491,5,82,'#acc2ae');}
   for(const x of [253,562,929,1370]){lamp(x,425,false);lamp(x,790,false);}
   for(let x=280;x<1360;x+=27){rect(x,950,19,3,'#d0c9a2');rect(x+1,954,17,2,'#617968');}
 }else if(id==='railDepot'){
   // Three full-width track pairs cross the yard. Sleepers and rails are floor art.
   for(const y of [444,625,861]){rect(220,y-19,1220,46,'#595a4e');for(let x=226;x<1434;x+=24){rect(x,y-21,8,52,'#8e7957');rect(x+2,y-21,2,52,'#b4976c');}for(const yy of [y-10,y+15]){rect(220,yy,1220,5,'#404940');rect(220,yy,1220,2,'#b0ae95');}}
   DISTRICT_GEOMETRY[id].forEach(r=>building(r,t.roof,t.wall,'depot'));
   for(const x of [690,1070]){line(x,640,x+90,870,'#abb09b',4);line(x+20,640,x+110,870,'#515e52',4);}
   // Gantry footprint and suspended beam are painted overhead but never block the yard.
   rect(661,471,662,9,'#444e43');rect(666,469,652,4,'#b29154');
   for(const x of [675,1304]){rect(x,460,13,138,'#635d43');rect(x+3,460,4,138,'#c09850');for(let yy=470;yy<590;yy+=23){rect(x+1,yy,11,7,'#3c4941');}rect(x-9,594,32,6,'#525b47');}
   rect(903,472,59,17,'#a4824b');line(932,490,932,543,'#d0b67a',3);line(932,543,943,551,'#d0b67a',3);
   for(const x of [590,846,1102]){rect(x,908,168,35,'#665f47');for(let xx=x+2;xx<x+166;xx+=13){rect(xx,911,10,25,'#968566');}rect(x+5,946,158,3,'#b9a474');}
   for(const x of [261,641,980,1380])lamp(x,288);
   for(let x=280;x<1400;x+=31){rect(x,965,17,4,'#a68b51');rect(x+17,965,11,4,'#454e42');}
 }
 // Landmark contact pads are intentionally quiet: dynamic station sprites read clearly here.
 for(let i=0;i<DISTRICT_POINTS.length;i++){
   const {x,y}=DISTRICT_POINTS[i];rect(x-43,y-33,86,66,'#6b7253');rect(x-40,y-30,80,60,id==='quarantine'?'#a8b09a':id==='railDepot'?'#a19272':'#b09b70');
   pixels(x-36,y-26,72,52,18,['#bbaa80','#a8976e','#c0ad85'],2);
   // Four fine corner stones communicate a usable plot without painting a UI button into art.
   for(const dx of [-43,36])for(const dy of [-33,26]){rect(x+dx,y+dy,7,7,'#697263');rect(x+dx,y+dy,7,2,'#c1b694');}
 }
 // Mixed boundary canopy, rock piles and flowering scrub frame rather than obstruct play.
 for(let x=15;x<W;x+=48){tree(x,26+rand()*26,.8+rand()*.45,t.tree);tree(x,1000+rand()*18,.8+rand()*.45,t.tree);}
 for(let y=93;y<H-40;y+=46){if(y<425||y>601)tree(25+rand()*14,y,.85+rand()*.4,t.tree);tree(1510+rand()*7,y,.82+rand()*.4,t.tree);}
 for(let i=0;i<180;i++){
   const x=45+rand()*(W-90),y=55+rand()*(H-110);if(nearPoint(x,y)||DISTRICT_GEOMETRY[id].some(r=>inside(r,x,y,12)))continue;
   // Decorations stay on verge strips, not in the central travel corridors.
   const verge=y<83||y>973||x<72||x>1450||(y>267&&y<302)||(y>789&&y<807);
   if(!verge)continue;if(i%5===0)stone(x,y,7+rand()*9);else {tuft(x,y,t.grain[i%4]);if(i%3===0)rect(x,y-2,3,3,id==='quarantine'?'#c9d9bb':'#d1b868');}
 }
 // Stable western entrance. Ground arrows are diegetic route markings, not text labels.
 paving(72,478,135,62,'#a4a087');rect(82,491,6,34,'#516c56');rect(90,495,5,26,'#687f5c');
 return canvas;
}
// v0.25：旧画法的底图只在新底图画不出来时才用得上，一张张按需画
export const DISTRICT_ART_IDS=Object.keys(themes);
export function districtAsset(id){return themes[id]?drawRegion(id):null;}
export function createDistrictAssets(){
 const result={};for(const id of Object.keys(themes))result[id]=drawRegion(id);return result;
}
