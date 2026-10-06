import {Renderer as EchoRenderer} from './echoes-renderer.js';
import {WORLD} from './data.js';

export class Renderer extends EchoRenderer {
  draw(e,mouse,dt=.016){this.labelEngine=e;this.labelScope=null;this.nearestLabel=e.nearestObject();super.draw(e,mouse,dt);this.labelEngine=null;}
  labelsAllowed(x,y){
    if(!this.labelEngine)return true;
    if(this.labelScope==='object')return this.objectLabels;
    if(this.labelScope==='scenery')return Math.hypot(x-this.labelEngine.s.player.x,y-this.labelEngine.s.player.y)<170;
    return true;
  }
  text(label,x,y,...args){if(this.labelsAllowed(x,y)||this.labelScope==='scenery'&&/^(水[✓×]|肥\d+|棚✓|险!|晴✓|事件田|\d{1,3})$/.test(String(label)))return super.text(label,x,y,...args);}
  badge(label,x,y,...args){if(this.labelsAllowed(x,y))return super.badge(label,x,y,...args);}
  drawObject(o,e){
    const previous=this.labelScope;this.labelScope='object';
    const goal=this.rebuildTarget;
    this.objectLabels=o===this.nearestLabel||!!o.id&&o.id===this.nearestLabel?.id||!!goal&&goal.region===e.s.region&&Math.hypot(goal.x-o.x,goal.y-o.y)<35;
    super.drawObject(o,e);this.labelScope=previous;
  }
  drawFarm(e){this.labelScope='scenery';super.drawFarm(e);this.labelScope=null;}
  drawRuins(e){this.labelScope='scenery';super.drawRuins(e);this.labelScope=null;}
  // Current-area minimap is available in the paused map screen, outside combat view.
  drawMinimap(){}
  drawMapPreview(canvas,e){
    const c=canvas.getContext('2d');canvas.width=768;canvas.height=384;
    c.imageSmoothingEnabled=false;c.drawImage(this.assets[e.region.asset],0,0,768,384);
    const mark=(x,y,color,r=4)=>{c.fillStyle='#182a20';c.fillRect(x/WORLD.w*768-r-2,y/WORLD.h*384-r-2,r*2+4,r*2+4);c.fillStyle=color;c.fillRect(x/WORLD.w*768-r,y/WORLD.h*384-r,r*2,r*2);};
    for(const o of e.objects)if(o.type==='crate'&&e.s.opened[o.id]?.day!==e.s.day)mark(o.x,o.y,'#eedc93');
    for(const z of e.enemies)if(!z.dead)mark(z.x,z.y,'#e98c78',3);
    for(const m of e.s.markers[e.s.region]||[])mark(m.x,m.y,'#9bcfde');
    mark(e.s.player.x,e.s.player.y,'#ffffe1',5);
  }
}
