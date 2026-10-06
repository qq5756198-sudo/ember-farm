import {Engine as BeyondEngine,freshState as beyondFresh,migrateState as beyondMigrate} from './beyond.js';
import {LESSON_BY_ID,guideGoal} from './guidance-data.js';
import {REGIONS} from './data.js';
import {DISTRICTS} from './district-data.js';
import {BMAPS} from './beyond-data.js';
export function migrateState(s){beyondMigrate(s);s.guidance={revision:1,focus:null,target:null,...s.guidance};return s;}
export const freshState=()=>migrateState(beyondFresh());
export class Engine extends BeyondEngine{
 constructor(s=freshState(),notify=()=>{}){super(migrateState(s),notify);}
 get guidance(){return this.s.guidance;}
 guidedGoal(){return guideGoal(this);}
 focusLesson(id){if(!LESSON_BY_ID[id])return false;this.guidance.focus=id;this.guidance.target=null;this.d.track=null;this.b.track=null;return true;}
 static parse(text){const s=BeyondEngine.parse(text),g=s.guidance;if(g){const pos=g.target;if(g.revision!==1||g.focus!==null&&!LESSON_BY_ID[g.focus]&&!((g.focus||'').startsWith('gate:')&&(DISTRICTS[g.focus.slice(5)]||BMAPS[g.focus.slice(5)]))||pos&&(!REGIONS[pos.region]||!Number.isFinite(pos.x)||!Number.isFinite(pos.y)||pos.x<0||pos.x>1536||pos.y<0||pos.y>1024||typeof(pos.label||pos.name)!=='string'))throw Error('任务引导存档异常，请从设置恢复有效备份。');}return migrateState(s);}
}
