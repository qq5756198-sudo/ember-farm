import './rebuild-data.js';
// Deliberately limited to existing, timed recipes and existing world resources.
export const PLAN_RECIPES=['trailBread','cloth','bandage','stew','jam','medkit','beanMeal','herbTea','parcel'];
export const RESERVE_ITEMS=['radish','potato','cotton','bean','herb','tomato','cloth','jam'];
export const COOP_THRESHOLDS=[2,5,9];
export const COOP_COSTS=[{wood:8,cloth:2},{wood:12,parts:4},{parts:6,circuit:2}];
export const COOP_LEVELS=['待建设','协作站','地区工坊','复兴枢纽'];
export const COOP = {
  residential:{supply:{name:'育种支援',bundle:{seedCotton:2,seedHerb:2},use:'接续棉花与药草种植，维持医疗生产。'},field:{name:'粮食支援',bundle:{bread:2,beanMeal:1},use:'工作餐供应居民，豆香便当帮助下一次远征。'}},
  hospital:{supply:{name:'纺织支援',bundle:{cloth:2,herb:2},use:'接入绷带与药包计划，也可留给诊所和建设。'},field:{name:'医疗支援',bundle:{medkit:1,herbTea:1},use:'为远征提供急救和持续恢复。'}},
  warehouse:{supply:{name:'工程支援',bundle:{parts:2,circuit:1},use:'用于研究、自动化维护和地区工坊升级。'},field:{name:'防线支援',bundle:{ammo:12,scrap:2},use:'弹药供枪械与瞭望塔，废金属可再造防线。'}}
};
