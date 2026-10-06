export const WORLD={w:1536,h:1024};
export const CROPS={
 radish:{name:'萝卜',icon:24,seed:'seedRadish',grow:120,yield:3,food:20,sell:13,desc:'长得快，适合第一份收成。'},
 potato:{name:'土豆',icon:25,seed:'seedPotato',grow:420,yield:4,food:28,sell:16,desc:'耐储存的口粮，也能加工炖菜。'},
 tomato:{name:'番茄',icon:26,seed:'seedTomato',grow:600,yield:4,food:16,sell:24,desc:'加工后价值更高，粮食商喜欢它。'},
 bean:{name:'豆类',icon:27,seed:'seedBean',grow:540,yield:5,food:18,sell:18,desc:'产量高，适合长期种植。'},
 corn:{name:'玉米',icon:28,seed:'seedCorn',grow:850,yield:5,food:24,sell:25,desc:'从居民区带回的高产作物。'},
 pumpkin:{name:'南瓜',icon:29,seed:'seedPumpkin',grow:1200,yield:3,food:40,sell:52,desc:'长得慢，但适合大餐与订单。'},
 herb:{name:'药草',icon:30,seed:'seedHerb',grow:650,yield:4,sell:28,desc:'医院温室的遗存，制作药品的原料。'},
 cotton:{name:'棉花',icon:31,seed:'seedCotton',grow:850,yield:4,sell:30,desc:'工业区发现的种子，可加工绷带。'},
};
export const ITEMS={
 hoe:{name:'锄头',icon:32,type:'tool',protected:true,desc:'开垦荒地、清理杂物。靠近地块按 E，或左键使用。'},
 water:{name:'浇水壶',icon:33,type:'tool',protected:true,desc:'给种下的作物浇水；每个游戏日浇一次。'},
 club:{name:'木棍',icon:35,type:'weapon',protected:true,desc:'近战伤害 24 · 无弹药 · 不会用枪声吸引敌人。'},
 pistol:{name:'手枪',icon:36,type:'weapon',protected:true,desc:'伤害 38 · 弹匣 8 发 · 中等射程与噪声。'},
 shotgun:{name:'霰弹枪',icon:37,type:'weapon',protected:true,desc:'近距离 5 发弹丸 · 弹匣 4 发 · 噪声大。'},
 rifle:{name:'栓动步枪',icon:38,type:'weapon',protected:true,desc:'伤害 100 · 弹匣 5 发 · 射程远，射速慢。'},
 bread:{name:'干粮',icon:53,type:'food',food:35,heal:5,sell:8,buy:18,desc:'恢复 35 饥饿、5 生命，是探索的补给。'},
 stew:{name:'蔬菜炖汤',icon:53,type:'food',food:65,heal:18,sell:42,buy:70,desc:'恢复 65 饥饿和 18 生命。'},
 jam:{name:'番茄罐头',icon:26,type:'food',food:32,heal:8,sell:68,buy:100,desc:'两份番茄加工而成。售价更高，也便于携带。'},
 bandage:{name:'绷带',icon:39,type:'medicine',heal:35,sell:12,buy:28,desc:'恢复 35 生命。打开背包时世界暂停。'},
 medkit:{name:'药包',icon:39,type:'medicine',heal:75,sell:40,buy:75,desc:'药草制成，恢复 75 生命。'},
 wood:{name:'木材',icon:48,type:'resource',sell:2,buy:6,desc:'建造、维修与制作的基础材料。'},
 stone:{name:'石材',icon:49,type:'resource',sell:2,buy:6,desc:'建造灶台和工作台。'},
 scrap:{name:'废金属',icon:50,type:'resource',sell:5,buy:13,desc:'用于弹药、武器与防御设施。'},
 parts:{name:'机械零件',icon:51,type:'resource',sell:12,buy:30,desc:'探索居民区与仓库。工作台升级的重要资源。'},
 ammo:{name:'弹药',icon:52,type:'resource',sell:2,buy:5,desc:'三种枪械共用的弹药；装填时从背包扣除。'},
 cloth:{name:'布料',icon:31,type:'resource',sell:25,buy:40,desc:'由棉花加工，制作绷带与药包。'},
 blueprint:{name:'精密蓝图',icon:55,type:'quest',protected:true,desc:'仓库的技术遗存。解锁二级武器工作台与长枪。'},
};
for(const [id,c] of Object.entries(CROPS)){
 ITEMS[id]={name:c.name,icon:c.icon,type:c.food?'food':'crop',food:c.food||0,sell:c.sell,buy:c.sell*2+5,desc:c.desc};
 ITEMS[c.seed]={name:c.name+'种子',icon:34,type:'seed',crop:id,protected:true,buy:Math.round(c.sell*1.2),sell:Math.max(2,Math.round(c.sell*.3)),desc:`成熟需 ${Math.round(c.grow/60*10)/10} 游戏小时 · 每株 ${c.yield} 份收成。${c.desc}`};
}
export const BUILDINGS={
 field:{name:'扩建农田',icon:62,cost:{stone:1},w:40,h:40,hp:0,desc:'增加一块已开垦的农田。'},
 chest:{name:'仓库箱',icon:40,cost:{wood:6},w:50,h:36,hp:100,desc:'保管材料；工作台可以使用附近仓库物资。'},
 cook:{name:'篝火灶',icon:41,cost:{wood:6,stone:4},w:52,h:44,hp:100,desc:'加工炖汤、罐头和布料。'},
 rain:{name:'雨水桶',icon:42,cost:{wood:6,scrap:3},w:44,h:44,hp:100,desc:'每天自动浇灌周围 220 距离内的农田。交互可补水恢复体力。'},
 workbench:{name:'制作台',icon:43,cost:{wood:8,stone:4},w:60,h:40,hp:130,desc:'制作弹药、药品和加工材料。'},
 weaponbench:{name:'武器工作台',icon:44,cost:{wood:12,scrap:6,parts:3},w:64,h:44,hp:150,desc:'制作手枪。获得精密蓝图后升级，解锁长枪。'},
 breeder:{name:'育种箱',icon:45,cost:{wood:8,parts:1},w:48,h:40,hp:100,desc:'用一份作物培育两颗种子，稳定繁殖稀有种子。'},
 fence:{name:'围栏',icon:46,cost:{wood:3},w:72,h:18,hp:150,desc:'阻挡敌人，为射击争取时间。受损后可维修。'},
 gate:{name:'营地大门',icon:63,cost:{wood:5,scrap:1},w:72,h:18,hp:180,desc:'角色可以通过。E 切换开关；关闭时阻挡僵尸。'},
 trap:{name:'路障陷阱',icon:47,cost:{wood:4,scrap:2},w:48,h:38,hp:80,desc:'敌人踩中受到 45 伤害。每次触发损耗 10 耐久。'},
};
export const RECIPES=[
 {id:'club',out:{club:1},cost:{wood:4},station:null,desc:'安静可靠的近战工具。'},
 {id:'ammo',out:{ammo:12},cost:{scrap:2},station:'workbench',desc:'制作 12 发弹药。'},
 {id:'pistol',out:{pistol:1,ammo:18},cost:{scrap:8,parts:2},station:'weaponbench',unlock:'residential',desc:'第一把枪，附带 18 发弹药。'},
 {id:'shotgun',out:{shotgun:1,ammo:12},cost:{scrap:12,parts:4,wood:4},station:'weaponbench2',unlock:'blueprint',desc:'近距离阻止成群的感染者。'},
 {id:'rifle',out:{rifle:1,ammo:10},cost:{scrap:16,parts:5,wood:4},station:'weaponbench2',unlock:'blueprint',desc:'远距离单发高伤害。'},
 {id:'stew',out:{stew:1},cost:{potato:2},station:'cook',desc:'两份土豆煮成恢复能力更好的炖汤。'},
 {id:'jam',out:{jam:1},cost:{tomato:2},station:'cook',desc:'把番茄加工为高价值罐头。'},
 {id:'cloth',out:{cloth:2},cost:{cotton:3},station:'workbench',desc:'棉花纺织成布料。'},
 {id:'bandage',out:{bandage:2},cost:{cloth:1},station:'workbench',desc:'一份布料制作两条绷带。'},
 {id:'medkit',out:{medkit:1},cost:{herb:2,cloth:1},station:'workbench',unlock:'hospital',desc:'药草与布料制成药包。'},
 ...Object.keys(CROPS).map(c=>({id:'breed_'+c,out:{[CROPS[c].seed]:2},cost:{[c]:1},station:'breeder',desc:'保留一份收成，培育两颗种子。'})),
];
export const WEAPONS={club:{damage:24,range:65,cooldown:.43,noise:60},pistol:{damage:38,range:540,cooldown:.3,mag:8,reload:1.1,noise:430,speed:900},shotgun:{damage:24,range:290,cooldown:.9,mag:4,reload:1.7,noise:740,speed:780,pellets:5},rifle:{damage:100,range:850,cooldown:1.2,mag:5,reload:2.2,noise:620,speed:1400}};
export const ZOMBIES={slow:{name:'游荡者',icon:16,hp:65,speed:48,damage:9,xp:4},runner:{name:'奔跑者',icon:18,hp:48,speed:98,damage:7,xp:5},screamer:{name:'尖叫者',icon:20,hp:75,speed:45,damage:9,xp:6},armor:{name:'重甲感染者',icon:22,hp:145,speed:37,damage:15,xp:9},elite:{name:'仓库守卫',icon:58,hp:650,speed:42,damage:24,xp:40}};
export const REGIONS={
 farm:{name:'余烬农场',sub:'家园 · 种植与建设',risk:'安全区 / 尸潮期间危险',res:'种植 · 仓库 · 休息',asset:'farm',spawn:{x:830,y:480},exit:{x:1440,y:392},colliders:[{x:120,y:70,w:355,h:218},{x:650,y:80,w:245,h:164},{x:1090,y:634,w:310,h:195}]},
 market:{name:'幸存者集市',sub:'集市 · 交易与订单',risk:'安全区',res:'粮食商 · 机械商 · 补给',asset:'ruins',spawn:{x:800,y:570},exit:{x:105,y:523},colliders:[{x:140,y:90,w:385,h:270},{x:1030,y:80,w:340,h:310},{x:970,y:660,w:420,h:250}]},
 residential:{name:'废弃居民区',sub:'探索 · 居民区',risk:'低危险 · 7 名感染者',res:'机械零件 · 玉米种子 · 金属',asset:'ruins',spawn:{x:170,y:520},exit:{x:95,y:523},colliders:[{x:140,y:90,w:385,h:270},{x:1030,y:80,w:340,h:310},{x:970,y:660,w:420,h:250}]},
 hospital:{name:'旧医院',sub:'探索 · 旧医院',risk:'中危险 · 10 名感染者',res:'药草种子 · 药品 · 幸存者',asset:'ruins',spawn:{x:170,y:520},exit:{x:95,y:523},colliders:[{x:140,y:90,w:385,h:270},{x:1030,y:80,w:340,h:310},{x:970,y:660,w:420,h:250}]},
 warehouse:{name:'工业仓库',sub:'探索 · 工业区',risk:'高危险 · 精英守卫',res:'棉花种子 · 精密蓝图 · 枪械零件',asset:'ruins',spawn:{x:170,y:520},exit:{x:95,y:523},colliders:[{x:140,y:90,w:385,h:270},{x:1030,y:80,w:340,h:310},{x:970,y:660,w:420,h:250}]},
};
for(const id of ['market','residential','hospital','warehouse'])REGIONS[id].colliders=[{x:128,y:72,w:470,h:190},{x:875,y:35,w:447,h:300},{x:125,y:543,w:495,h:196},{x:974,y:516,w:356,h:275}];
export const TRADERS={
 food:{name:'林姨 · 粮食商',icon:57,desc:'“只要土地还能长出东西，日子就过得下去。”',stock:{seedRadish:30,seedPotato:20,seedTomato:12,seedBean:12,seedPumpkin:6,bread:20,bandage:8},want:['radish','potato','tomato','bean','corn','pumpkin','jam','stew']},
 mechanic:{name:'老周 · 机械商',icon:56,desc:'“旧东西总有用处，别把零件扔了。”',stock:{wood:60,stone:40,scrap:40,parts:12,ammo:80,cloth:10,bandage:8},want:['scrap','parts','cloth','cotton']},
};
export const QUESTS=[
 {id:'clear',title:'01 · 让土地重新呼吸',desc:'清理农田中的 3 处杂物。靠近杂物按 E，或用锄头点击。',goal:3,metric:'cleared',reward:{wood:8},money:30},
 {id:'harvest',title:'02 · 第一份收成',desc:'播种并浇水，收获至少一株作物。萝卜约 75 秒成熟，也可在小屋休息。',goal:1,metric:'harvested',reward:{seedPotato:3,bread:2},money:40},
 {id:'trade',title:'03 · 带着收成去集市',desc:'按 M 前往集市，向商人出售至少一件物品。',goal:1,metric:'sold',reward:{bandage:2},money:50},
 {id:'parts',title:'04 · 废墟里的希望',desc:'探索居民区，搜索路边补给箱，累计带回 5 个机械零件。',goal:5,metric:'partsFound',reward:{scrap:6},money:40},
 {id:'gun',title:'05 · 让家园有力量',desc:'按 B 建造武器工作台，再按 C 制造第一把手枪。',goal:1,metric:'gunsCrafted',reward:{ammo:36,wood:16,scrap:8},money:60},
 {id:'defend',title:'06 · 今夜，我们守住这里',desc:'建造围栏或陷阱，准备弹药，抵御首轮尸潮。',goal:1,metric:'hordes',reward:{seedCotton:2,seedCorn:3,parts:4},money:200},
];
export const SIDES=[
 {id:'order',title:'林姨的蔬菜订单',desc:'为林姨准备 6 份萝卜。',cost:{radish:6},reward:{seedTomato:4},money:100},
 {id:'herb',title:'找回药草',desc:'从旧医院带回一颗药草种子。',metric:'hospital',reward:{cloth:3,bandage:2},money:60},
 {id:'rain',title:'把雨水留下',desc:'在农场建造一座雨水桶。',building:'rain',reward:{seedBean:3},money:40},
 {id:'rescue',title:'医院的求救信号',desc:'在医院东侧寻找被困的幸存者，按 E 救援。',metric:'rescued',reward:{medkit:2,parts:3},money:80},
];
export const SKILLS={agriculture:{name:'农业',desc:'三级起每株收成增加 1 份；五级降低种植体力消耗。'},manufacturing:{name:'制造',desc:'三级后维修成本减半；五级陷阱伤害提高。'},exploration:{name:'探索',desc:'三级增加 8 格背包；五级获得额外回收物资。'},combat:{name:'战斗',desc:'每级提高伤害 5%；三级后缩短装填时间。'}};
