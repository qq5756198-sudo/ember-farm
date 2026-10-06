import {Renderer as FrontierRenderer} from './frontier-renderer.js';
import {REGIONS} from './data.js';
import {ANNEX,OUTPOSTS} from './rebuild-data.js';

export class Renderer extends FrontierRenderer {
  drawFarm(e){
    super.drawFarm(e);const c=this.ctx;
    for(const p of e.s.plots.filter(p=>p.rebuildNew)){c.strokeStyle=e.plotWatered(p)?'#8ec8bb':'#e4b675';c.lineWidth=2;c.strokeRect(p.x-19,p.y-19,38,38);}
    if(e.r.fields)this.text('扩建农田 · 接通水源后成长',980,615,'#f1d393',14);
    if(e.r.radio){this.atlas(7,1220,370,66,46);this.sprite(55,1220,390,40,48);this.badge(e.r.ended?'广播中 · 家园已重新点灯':'通信站 · 等待首次广播',1220,310,'#e8d69c');}
    if(e.r.network){this.sprite(40,905,320,48,48);this.sprite(48,948,320,42,40);this.text('运输网络运作中',925,257,'#c9dfa8',14);}
  }
  drawRuins(e){
    super.drawRuins(e);const c=this.ctx,d=OUTPOSTS[e.s.region];
    if(d&&e.r.outposts[e.s.region]>=2){c.save();c.beginPath();c.arc(d.x,d.y,115,0,Math.PI*2);c.fillStyle='#314d3750';c.fill();c.strokeStyle='#b6ce8d90';c.stroke();c.fillStyle='#314d37b5';c.fillRect(d.x-52,d.y-23,150,70);c.strokeStyle='#b6ce8d';c.strokeRect(d.x-52,d.y-23,150,70);this.atlas(e.s.region==='hospital'?14:e.s.region==='residential'?5:7,d.x-28,d.y+32,43,40);this.badge('已恢复 · 防护区补给',d.x+20,d.y-100,'#d9e7b6');c.restore();}
    if(e.s.region==='warehouse'){c.save();c.fillStyle=e.r.annexOpen?'#51615199':'#26382ddd';c.fillRect(ANNEX.x,ANNEX.y,ANNEX.w,ANNEX.h);c.strokeStyle='#a49769';c.lineWidth=3;c.strokeRect(ANNEX.x,ANNEX.y,ANNEX.w,ANNEX.h);if(e.r.annexOpen){c.fillStyle='#938b61';c.fillRect(1380,808,80,6);}this.text(e.r.annexOpen?'检修间 · 通信核心':'封闭检修间',1395,952,'#e2d5a7',14);c.restore();}
  }
  drawObject(o,e){
    if(o.type==='radioStation'||o.type==='network')return;
    if(['visitor','outpostResident'].includes(o.type)){this.shadow(o.x,o.y,20);this.sprite(o.icon,o.x,o.y,49,64);this.text(o.name,o.x,o.y-78,'#e7d8b0',13);return;}
    if(o.type==='rebuildFind'){this.shadow(o.x,o.y,22);this.sprite(40,o.x,o.y,50,45);this.sprite(o.icon,o.x,o.y-17,27,27);this.badge(o.name,o.x,o.y-73,'#f0d699');return;}
    if(o.type==='outpost'){if(o.coopLevel){for(let i=0;i<o.coopLevel;i++){this.sprite(40,o.x-45+i*27,o.y+50,26,26);this.ctx.fillStyle=o.coopMode==='supply'?'#a8c688':'#d9b276';this.ctx.fillRect(o.x-57+i*27,o.y+15,23,5);}this.badge(o.coopMode==='supply'?'工程与生产支援':'生活与远征支援',o.x+10,o.y+90,'#dfd8a8');}this.shadow(o.x,o.y,22);this.sprite(o.icon,o.x,o.y,50,52);this.text(o.name,o.x,o.y-66,'#dfd8a8',14);return;}
    if(o.type==='annexDoor'){this.sprite(63,o.x,o.y,54,37,true,e.r.annexOpen?.4:1);this.text(e.r.annexOpen?'检修间入口':'E检查封闭门',o.x,o.y-50,'#e6c790',14);return;}
    return super.drawObject(o,e);
  }
  drawEnemy(enemy,e){super.drawEnemy(enemy,e);if(enemy.annexGuardian)this.badge('检修间守卫 · 通信核心',enemy.x,enemy.y-167,'#e5be96');}
  draw(e,mouse,dt=.016){
    super.draw(e,mouse,dt);const goal=this.rebuildTarget||(e.r.focus?e.taskDestination(e.r.focus):null);if(!goal||e.paused)return;const c=this.ctx;c.save();c.setTransform(this.dpr,0,0,this.dpr,0,0);
    if(goal.region===e.s.region){const p=this.screenPoint(goal.x,goal.y),x=Math.max(45,Math.min(this.w-45,p.x)),y=Math.max(56,Math.min(this.h-35,p.y));c.strokeStyle='#f2d48a';c.lineWidth=2;c.beginPath();c.arc(x,y,19+Math.sin(this.time*3)*3,0,Math.PI*2);c.stroke();const label='目标：'+goal.label+' · '+Math.round(Math.hypot(e.s.player.x-goal.x,e.s.player.y-goal.y))+'步';c.font='12px "Microsoft YaHei",sans-serif';const half=Math.min(this.w/2-8,c.measureText(label).width/2+9),bx=Math.max(half+8,Math.min(this.w-half-8,x));this.badge(label,bx,y-34,'#f2d48a');}
    else this.badge('目标在'+REGIONS[goal.region].name+' · M地图',this.w/2,32,'#ead19a');c.restore();
  }
}
