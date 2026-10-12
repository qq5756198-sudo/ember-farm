import './expansion-data.js';
import {ITEMS,BUILDINGS} from './data.js';

export const FRONTIER_RECTS=[[44,50,239,226],[370,87,211,156],[705,121,144,138],[1000,40,205,248],[75,345,182,263],[410,331,130,280],[674,348,215,257],[961,372,265,226],[31,649,259,267],[384,648,176,268],[676,702,216,159],[999,663,192,241],[41,945,238,270],[351,944,247,277],[658,964,237,244],[968,953,265,262]];
export const FEATURES=[
 ['轮作与肥力','land','播种前查看肥力预测；豆类养地，重复种植消耗肥力。','Farthest Frontier'],
 ['作物邻接','land','玉米邻豆增产，番茄邻草药提升品质。相邻范围42步。','ISLANDERS'],
 ['家具与功能房间','rooms','在地板周围摆家具，组合休息室、食堂与阅览室。','勇者斗恶龙 创世小玩家2'],
 ['水渠与闸门','water','挖通4×4水渠，开闸蓄水灌溉，排水开放浅滩捷径。','Timberborn'],
 ['生态修复','ecology','清理污染，连接草地、林地与湿地；也可改成耕地。','Terra Nil'],
 ['营地政策','rooms','加班增加产出与疲劳；食物优先给伤员会影响工作餐分配。','Frostpunk'],
 ['空间远征背包','expedition','在4×4行囊中旋转安放武器、药品和口粮；战利品占空格。','Backpack Hero'],
 ['分岔远征路线','expedition','连续三站，在物资、危险与休息站之间做选择。','Slay the Spire'],
 ['潜行与诱敌','combat','蹲行降低可见范围，草丛隐蔽；投石让敌人转向声源。','最后生还者 第二部'],
 ['双槽武器改装','combat','枪管调整射程与射速，附件调整噪声或弹匣。','Metro Exodus'],
 ['精英部位破坏','combat','切换腿部、装甲、背包和核心目标；部位影响速度与战利品。','Horizon Zero Dawn'],
 ['感染巢与收复','expedition','摧毁三个地区的感染巢，永久降低敌人数量，开放安全物资。','State of Decay 2'],
 ['电路与压力开关','investigation','旋转线路、压住开关，再选择开补给门或点亮安全照明。','The Talos Principle'],
 ['遗迹线索链','investigation','收集三地日志，按时间排列，推理种子库密码。','Outer Wilds'],
 ['未知草药鉴定','investigation','用叶形、花色和气味比对六种植物，识别后获得对应药品。','Strange Horticulture'],
 ['伙伴犬与追踪','life','在住宅区喂食救回小犬，跟随它的气味路径寻找隐藏物资。','Potion Permit'],
 ['摄影与相册','life','实际拍摄游戏画面，完成构图任务，把喜欢的照片展示在营地。','TOEM'],
 ['手动料理','kitchen','18秒内掌握开火、下料、搅拌的时机；制作具有品质的料理。','Cooking Simulator'],
 ['每周收获展','exhibition','提交三种实物，按品质、多样性和本周主题评分，赢取奖杯。','牧场物语 三个村庄的珍贵朋友'],
 ['自选远征挑战','expedition','可选择禁枪、三分钟撤离或限用一份药，成功记录积分和徽章。','Hades']
].map(([name,tab,desc,source],i)=>({id:i+1,name,tab,desc,source}));
export const SOURCES=['https://www.farthestfrontier.com/guide/gameplay/farming/','https://store.steampowered.com/app/1046030/ISLANDERS/','https://www.jp.square-enix.com/column/detail/29/','https://mechanistry.com/press/timberborn-the-beaver-city-builder-launches-on-september-15-2021','https://store.steampowered.com/app/1593030/Terra_Nil/','https://store.steampowered.com/app/323190/Frostpunk/','https://store.steampowered.com/app/1970580/Backpack_Hero/','https://store.steampowered.com/app/646570/Slay_the_Spire/','https://feedback.naughtydog.com/hc/en-us/articles/360059856992-Basic-Stealth-Strategies','https://www.metrothegame.com/fr/jeu/armes/kalash/','https://blog.playstation.com/2017/02/24/the-making-of-horizon-zero-dawns-machines/','https://support.stateofdecay.com/hc/en-us/articles/4403310472973-Update-25-Plague-Territory','https://www.devolverdigital.com/games/the-talos-principle','https://annapurnainteractive.com/games/outer-wilds','https://store.steampowered.com/app/1574580/Strange_Horticulture/','https://store.steampowered.com/app/1337760/Potion_Permit/','https://store.steampowered.com/app/1307580/TOEM_A_Photo_Adventure/','https://store.steampowered.com/app/641320/Cooking_Simulator/','https://www.storyofseasons.com/tot/life11-festivals.html','https://www.supergiantgames.com/blog/hades-welcome-to-hell-update-patch-notes/'];
export const MODULES={shortBarrel:{name:'短枪管',slot:'barrel',desc:'射程−25% · 冷却−15%',cost:{parts:2,scrap:4}},longBarrel:{name:'长枪管',slot:'barrel',desc:'射程+25% · 冷却+15% · 噪声+20%',cost:{parts:3,scrap:5}},suppressor:{name:'消音附件',slot:'accessory',desc:'噪声−72% · 伤害−10%',cost:{parts:3,scrap:6}},extendedMag:{name:'扩容弹匣',slot:'accessory',desc:'容量+4 · 换弹时间+25%',cost:{parts:2,scrap:6}}};
for(const [id,d]of Object.entries(MODULES))ITEMS[id]={name:d.name,icon:21,type:'equipment',sell:0,protected:true,desc:d.desc};
ITEMS.camera={name:'旧相机',type:'equipment',icon:40,frontierIcon:10,sell:0,protected:true,desc:'在成长与探索菜单开启相机。H拍摄实际游戏画面。'};
ITEMS.chefMeal={name:'家常手作餐',type:'food',icon:6,sell:30,food:28,heal:8,stamina:25,desc:'在厨房里照着步骤做出来的一份家常饭，顶饿，也能回些生命和体力。'};
ITEMS.fineMeal={name:'精致手作餐',type:'food',icon:6,sell:60,food:42,heal:15,stamina:40,desc:'火候和配料都拿捏得正好的一份饭，比家常饭更顶饿，回的生命和体力也更多。'};
const furniture={floor:{name:'房间地板',w:112,h:96,hp:100,cost:{wood:6},icon:40},chair:{name:'木椅',w:24,h:26,hp:100,cost:{wood:3},frontierIcon:4},lamp:{name:'暖光灯',w:24,h:28,hp:100,cost:{scrap:3,parts:1},frontierIcon:5},bookshelf:{name:'阅览书架',w:34,h:28,hp:100,cost:{wood:5,cloth:2},frontierIcon:6},table:{name:'餐桌',w:44,h:30,hp:100,cost:{wood:5},frontierIcon:7},harvestTrophy:{name:'收获展奖杯',w:22,h:22,hp:100,cost:{wood:2},frontierIcon:11}};
for(const [id,d]of Object.entries(furniture))BUILDINGS[id]={...d,icon:d.icon??40,desc:id==='floor'?'摆放家具的中心。周围75步内组成房间。':id==='harvestTrophy'?'收获展获奖后解锁，展示在农场。':'放在地板周围，组合功能房间。'};
export const KIT={stone:{name:'4颗诱敌石',item:'stone',n:4,shape:[[0,0]]},wood:{name:'4份配重木材',item:'wood',n:4,shape:[[0,0],[1,0]]},club:{name:'短棍',item:'club',n:1,shape:[[0,0],[0,1]]},pistol:{name:'手枪',item:'pistol',n:1,shape:[[0,0],[1,0],[0,1]]},shotgun:{name:'霰弹枪',item:'shotgun',n:1,shape:[[0,0],[0,1],[0,2]]},rifle:{name:'步枪',item:'rifle',n:1,shape:[[0,0],[0,1],[0,2]]},ammo:{name:'24发弹药',item:'ammo',n:24,shape:[[0,0],[1,0]]},bread:{name:'2份面包',item:'bread',n:2,shape:[[0,0],[0,1]]},bandage:{name:'2份绷带',item:'bandage',n:2,shape:[[0,0]]},medkit:{name:'急救箱',item:'medkit',n:1,shape:[[0,0],[1,0]]}};
export const HERBS=[{id:'mint',name:'薄荷',leaf:'锯齿叶',flower:'紫花',scent:'清凉',effect:'缓慢恢复生命',reward:{herbTea:1}},{id:'yarrow',name:'蓍草',leaf:'羽状叶',flower:'白花',scent:'苦香',effect:'包扎伤口',reward:{bandage:2}},{id:'calendula',name:'金盏花',leaf:'椭圆叶',flower:'金黄',scent:'淡甜',effect:'治疗伤口',reward:{medkit:1}},{id:'sage',name:'鼠尾草',leaf:'绒毛叶',flower:'蓝花',scent:'木香',effect:'防御料理',reward:{stew:1}},{id:'lemon',name:'香蜂草',leaf:'心形叶',flower:'白花',scent:'柠檬',effect:'恢复生命与口粮',reward:{herbTea:1,bread:1}},{id:'nettle',name:'荨麻',leaf:'尖齿叶',flower:'绿花',scent:'青草',effect:'制作草药',reward:{herb:4}}];
export const CLUES={residential:{title:'9月9日 · 林员手记',text:'先救住种子，再转移药品。第一把锁的刻度是3，后两位写在转运档案里。'},hospital:{title:'9月10日 · 医院转运',text:'药柜迁往仓库。新锁第二位是7；保管员说日志必须按日期阅读。'},warehouse:{title:'9月12日 · 仓库收条',text:'尾数4，种子最终藏在农场东南角的旧窖。不能把转运日期倒过来。'}};
export const COVER=[{x:350,y:775,w:145,h:70},{x:710,y:365,w:135,h:80},{x:735,y:755,w:150,h:60}];
export const CANAL={x:720,y:655,size:28,gate:5,source:0,goal:15};
export const ECO={x:1110,y:855,size:28};
export const TRACKS={residential:{x:780,y:470,loot:{parts:3,seedHerb:2}},hospital:{x:1430,y:835,loot:{medkit:1,cloth:4}},warehouse:{x:840,y:460,loot:{parts:5,ammo:12}}};
export const PUZZLE_POS={residential:{x:550,y:465},hospital:{x:850,y:455},warehouse:{x:765,y:840}};
export const NEST_POS={residential:{x:1280,y:870},hospital:{x:1390,y:425},warehouse:{x:815,y:805}};
