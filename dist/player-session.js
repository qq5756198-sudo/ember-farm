// Campaign persistence. Historic standalone saves remain untouched and are exportable.
export const CAMPAIGN_SAVE='ember-farm-save-v1';
export const CAMPAIGN_BACKUP='ember-farm-backup-v1';
export const PREFERENCES='ember-farm-preferences-v1';
export const HISTORY_KEYS=['ember-farm-demo-v4','ember-farm-demo-backup-v4','ember-farm-demo-v5','ember-farm-demo-backup-v5','ember-farm-demo-v7','ember-farm-demo-backup-v7','ember-farm-demo-v9','ember-farm-demo-backup-v9','ember-farm-before-new-v1','ember-farm-before-import-v1','ember-farm-before-alliance-v1'];
// v0.13.0 adds story progress. Before the first upgrade of an older formal save, keep its exact bytes once.
export const UPGRADE_CHECKPOINT='ember-farm-before-alliance-v1';
export function preserveBeforeUpgrade(storage,needsUpgrade){
 try{const main=storage.getItem(CAMPAIGN_SAVE),backup=storage.getItem(CAMPAIGN_BACKUP);if(!main||storage.getItem(UPGRADE_CHECKPOINT)||!needsUpgrade(main))return false;storage.setItem(UPGRADE_CHECKPOINT,JSON.stringify({format:'ember-farm-checkpoint',main,backup}));return true;}catch{return false;}
}
export const isStandalone=s=>!!(s?.frontier?.demo||s?.frontier?.echoDemo||s?.districts?.demo);
export function readCampaign(storage,parse){
 let raw=null,backup=null;try{raw=storage.getItem(CAMPAIGN_SAVE);backup=storage.getItem(CAMPAIGN_BACKUP);}catch{return {state:null,hasData:false,issue:'无法访问浏览器存档。请检查浏览器权限，或导入已导出的备份。'};}
 for(const [text,recovered]of [[raw,false],[backup,true]]){if(!text)continue;try{const state=parse(text);if(isStandalone(state))continue;return {state,hasData:true,recovered,issue:recovered?'已读取备用存档；进入游戏后将继续保存这座家园。':''};}catch{}}
 return {state:null,hasData:!!(raw||backup),issue:raw||backup?'存档暂时无法读取。可在设置中导出原文件，或导入可用备份。':''};
}
export function writeCampaign(storage,text,parse){
 if(isStandalone(parse(text)))throw new Error('旧版独立存档不能覆盖当前家园。');
 const previous=storage.getItem(CAMPAIGN_SAVE);let valid=false;
 if(previous)try{valid=!isStandalone(parse(previous));}catch{}
 if(valid)storage.setItem(CAMPAIGN_BACKUP,previous);
 storage.setItem(CAMPAIGN_SAVE,text);
}
export function replaceCampaign(storage,text,parse,kind,currentText=null){
 if(!['new','import'].includes(kind)||isStandalone(parse(text)))throw new Error('这份文件不是家园存档，当前进度未更改。');
 const main=currentText||storage.getItem(CAMPAIGN_SAVE),backup=storage.getItem(CAMPAIGN_BACKUP);
 // Refuse the replacement if its recovery checkpoint cannot be written.
 if(main||backup)storage.setItem('ember-farm-before-'+kind+'-v1',JSON.stringify({format:'ember-farm-checkpoint',main,backup}));
 writeCampaign(storage,text,parse);
}
export function recoveryFiles(storage){const result={};for(const key of [CAMPAIGN_SAVE,CAMPAIGN_BACKUP,...HISTORY_KEYS]){const text=storage.getItem(key);if(text)result[key]=text;}return {format:'ember-farm-recovery',files:result};}
export function readPreferences(storage){try{const p=JSON.parse(storage.getItem(PREFERENCES)||'{}'),out={};if(Number.isFinite(p.sound)&&p.sound>=0&&p.sound<=1)out.sound=p.sound;if([.85,1,1.2].includes(p.zoom))out.zoom=p.zoom;if([.9,1,1.15].includes(p.uiScale))out.uiScale=p.uiScale;if(typeof p.miniMap==='boolean')out.miniMap=p.miniMap;const a=p.access;if(a&&typeof a==='object'&&!Array.isArray(a))out.access={text:a.text===true,color:a.color===true,calm:a.calm===true};const k=p.keymap;if(k&&typeof k==='object'&&!Array.isArray(k)&&Object.keys(k).length<=30&&Object.entries(k).every(([id,v])=>/^[a-z]{1,12}$/.test(id)&&typeof v==='string'&&v.length===1))out.keymap={...k};return out;}catch{return {};}}
export function writePreferences(storage,s,audio){const out={sound:s.sound,zoom:s.zoom,uiScale:s.uiScale||1,miniMap:s.miniMap,access:{text:!!s.access?.text,color:!!s.access?.color,calm:!!s.access?.calm},keymap:s.keymap&&typeof s.keymap==='object'?s.keymap:{}};const keep=audio||readAudioPreferences(storage,null);if(keep)out.audio={music:keep.music,ambience:keep.ambience,sfx:keep.sfx,cues:!!keep.cues};storage.setItem(PREFERENCES,JSON.stringify(out));}
// v0.23.0：音乐、环境、音效三个音量和“声音提示”也放在偏好键里，不进存档（总音量还是 sound）。
export const AUDIO_DEFAULTS={music:.6,ambience:.7,sfx:.9,cues:false};
export function readAudioPreferences(storage,fallback=AUDIO_DEFAULTS){try{const a=JSON.parse(storage.getItem(PREFERENCES)||'{}').audio;if(!a||typeof a!=='object'||Array.isArray(a))return fallback?{...fallback}:null;const v=(x,d)=>Number.isFinite(x)&&x>=0&&x<=1?x:d,d=fallback||AUDIO_DEFAULTS;return {music:v(a.music,d.music),ambience:v(a.ambience,d.ambience),sfx:v(a.sfx,d.sfx),cues:a.cues===true};}catch{return fallback?{...fallback}:null;}}
