import {CROPS, ITEMS, BUILDINGS, RECIPES, TRADERS} from './data.js';

export const TRAITS = {
  early: {name:'早熟', growth:1.4, yield:-1, desc:'成长快40%，每株少收1份。'},
  abundant: {name:'丰产', growth:.85, yield:2, water:2, desc:'每株多收2份，成长慢15%；每天消耗2格水。'},
  hardy: {name:'耐旱', growth:.9, yield:0, water:1, desc:'两天浇一次水；抵抗高温与酸雨，收成售价降低25%。'}
};
export const SPECS = {
  agriculture: [{id:'yield',name:'丰收专家',desc:'每株额外收获2份。'}, {id:'quality',name:'育种专家',desc:'优质收成概率增加，培育特性种子少用1个零件。'}],
  manufacturing: [{id:'economy',name:'节材工匠',desc:'制作与加工材料用量乘80%后向下取整，每项至少1份。'}, {id:'defense',name:'防御工程师',desc:'陷阱与瞭望塔伤害提高35%。'}],
  exploration: [{id:'salvage',name:'回收专家',desc:'拆解环境额外获得1个机械零件。'}, {id:'scout',name:'夜行侦察员',desc:'夜间敌人移速增幅降低，旅行少用10分钟。'}],
  combat: [{id:'melee',name:'近战专家',desc:'木棍伤害提高35%，挥击消耗更少体力。'}, {id:'guns',name:'枪械专家',desc:'装填速度再提高25%，枪械伤害提高15%。'}]
};
export const TECH = {
  irrigation:{name:'灌溉管网',desc:'连接雨桶或修复水塔，每小时自动浇灌附近农田。',cost:{parts:3,scrap:6}},
  canner:{name:'罐装工艺',desc:'解锁罐装机和配送货箱生产链。',cost:{parts:3,scrap:5}},
  tower:{name:'瞭望防线',desc:'解锁瞭望塔，驻守居民可以远程射击。',cost:{parts:4,scrap:8}},
  greenhouse:{name:'温室结构',desc:'解锁温室，保护周围作物并改善成长。',cost:{parts:3,cloth:3}},
  solar:{name:'太阳能',desc:'解锁太阳能板，白天储存电力。',cost:{parts:5,scrap:10}},
  drone:{name:'农业无人机',desc:'解锁无人机站，消耗电力自动收获与补种；需太阳能供电，每10次作业用1个零件维护。',cost:{parts:7,scrap:12}},
  lure:{name:'诱饵信标',desc:'解锁噪声信标，引导离你较远的感染者。',cost:{parts:3,scrap:6}}
};
export const PROJECTS = {
  market:{name:'重建集市',icon:57,stages:[{cost:{wood:12,radish:9},desc:'补好摊位与公共餐桌。'},{cost:{stone:8,stew:3,cloth:3},desc:'开放营地补给服务。'}],reward:'商人售价降低10%，解锁番茄和豆类订单。'},
  clinic:{name:'重建诊所',icon:39,stages:[{cost:{wood:12,bandage:4},desc:'整理病床与屋顶。'},{cost:{herb:6,cloth:4,parts:4},desc:'接通医务室。'}],reward:'在农场每日可免费治疗一次；居民工作餐消耗减少。'},
  water:{name:'修复水塔',icon:42,atlas:15,stages:[{cost:{scrap:12,stone:8},desc:'加固塔身。'},{cost:{parts:6,wood:10},desc:'恢复供水。'}],reward:'每天浇灌全部农田，灌溉站获得稳定水源。'},
  bridge:{name:'修复旧桥',icon:55,stages:[{cost:{wood:20,scrap:8},desc:'清理河岸、铺好桥面。'},{cost:{stone:12,parts:4},desc:'修通集市与住宅的捷径。'}],reward:'所有地图旅行缩短10分钟；回收工具升至2级。'}
};
export const RESIDENTS = {
  medic:{name:'许医生',icon:57,story:'从旧医院救回的医师。她想重新开一间能接待所有人的诊所。',defaultRole:'medic'},
  farmer:{name:'阿禾',icon:57,story:'被困在居民区的种植者。她一直随身留着家人的种子。',defaultRole:'farmer'},
  mechanic:{name:'陈工',icon:56,story:'仓库维修员。修好旧设备，是他继续生活的办法。',defaultRole:'mechanic'}
};
export const ROLES = {farmer:'种植：浇水与收获',mechanic:'维修：修复受损设施',medic:'医务：照顾角色',guard:'守卫：驻守瞭望塔',rest:'休整'};
export const WEATHER = ['晴朗','晴朗','小雨','高温','晴朗','酸雨','暴雨','小雨'];
export const WEATHER_HELP = {晴朗:'适合外出；太阳能正常发电。',小雨:'全天自然浇灌，鱼更容易咬钩。',高温:'无遮盖作物成长减半；太阳能发电更快。',酸雨:'无遮盖作物成长降至30%；温室与耐旱品种可以应对。',暴雨:'自动浇水；无遮盖作物成长65%，外出移速降低15%，太阳能发电减少。'};
export const EVENTS = {
  visitor:{title:'流浪种子商',desc:'旅人带来一包番茄、豆类与南瓜种子，愿意换一顿热饭。',options:[{label:'用1份炖汤交换',cost:{stew:1},reward:{seedTomato:2,seedBean:2,seedPumpkin:1}},{label:'付50金币买下',money:50,reward:{seedTomato:2,seedBean:2,seedPumpkin:1}},{label:'请他留一张地图',reward:{wood:3}}]},
  radio:{title:'无线电求援',desc:'附近营地缺少绷带。提供援助，可以换来机械零件与声望。',options:[{label:'送出2条绷带',cost:{bandage:2},reward:{parts:3},rep:12},{label:'共享路线信息',reward:{scrap:2},rep:3}]},
  rain:{title:'雨后的收获',desc:'农舍旁发现了一批干净的雨水与野生豆荚。',options:[{label:'蓄水灌田',water:true,rep:3},{label:'收集种子',reward:{seedBean:3}}]},
  repair:{title:'旧发电机的线索',desc:'陈工找到一份设备清单。提供金属，能换来加工技术的研究资料。',options:[{label:'交付6份废金属',cost:{scrap:6},token:1},{label:'先回收能用的部分',reward:{parts:1,wood:3}}]}
};
export const STORIES = {
  food:[{at:0,title:'留一颗种子',text:'林姨把最好的种子分给邻居：“只要有人继续种，明年就还有希望。”'},{at:20,title:'公共餐桌',text:'她想把集市修成大家能坐下来吃饭的地方。你带来的收成，让这件事开始有了可能。'},{at:50,title:'她保管的南瓜',text:'林姨终于打开那只旧木箱，送你一包珍藏的南瓜种子。',reward:{seedPumpkin:3}}],
  mechanic:[{at:0,title:'旧东西的用处',text:'老周在仓库工作了半辈子。他相信修好一件东西，就少一件必须丢掉的过去。'},{at:20,title:'修桥的人',text:'桥修好以后，老周想带着工具去看看河对面的邻居。他给你画了一张维修草图。'},{at:50,title:'最后一套工具',text:'老周交给你保管已久的精密工具：“这次，让它们修点能留下来的东西。”',reward:{parts:5,ammo:12}}]
};

const additions = {
  beanMeal:{name:'豆香便当',icon:27,type:'food',food:45,heal:8,sell:48,buy:75,buff:'speed',desc:'恢复45饥饿、8生命；4游戏小时内移速提高20%。'},
  herbTea:{name:'草药茶',icon:30,type:'food',food:10,heal:15,sell:50,buy:80,buff:'regen',desc:'恢复15生命；4游戏小时内缓慢恢复生命。'},
  fishStew:{name:'鲜鱼炖汤',icon:53,type:'food',food:70,heal:25,sell:85,buy:130,buff:'defense',desc:'恢复70饥饿、25生命；4游戏小时内受到伤害减少20%。'},
  eggMeal:{name:'鸡蛋早餐',icon:53,type:'food',food:60,heal:15,sell:55,buy:90,buff:'stamina',desc:'恢复60饥饿、15生命；4游戏小时内跑步体力消耗减半。'},
  parcel:{name:'蔬菜配送箱',icon:40,type:'resource',sell:175,buy:240,desc:'番茄罐头与布料制成的订单货箱。'},
  fish:{name:'银鳞鱼',icon:25,atlas:2,type:'food',food:20,sell:22,buy:48,desc:'池塘常见鱼，可出售或烹饪。'},
  riverFish:{name:'蓝背鱼',icon:26,atlas:3,type:'food',food:24,sell:36,buy:74,desc:'雨天更容易钓到的鱼。'},
  nightFish:{name:'金尾夜鱼',icon:29,atlas:4,type:'food',food:30,sell:65,buy:125,desc:'夜间池塘的稀有鱼，适合高价摊位。'},
  egg:{name:'鸡蛋',icon:34,type:'food',food:18,sell:16,buy:35,desc:'喂食鸡获得，可制作鸡蛋早餐。'},
  milk:{name:'羊奶',icon:33,type:'food',food:28,heal:5,sell:32,buy:65,desc:'喂食山羊获得，提供稳定收益。'},
  milkMeal:{name:'奶香玉米粥',icon:53,type:'food',food:65,heal:22,sell:78,buy:120,buff:'stamina',desc:'羊奶和玉米制成；4游戏小时内跑步体力消耗减半。'},
  riverMeal:{name:'蓝背鱼便当',icon:27,type:'food',food:65,heal:20,sell:98,buy:150,buff:'speed',desc:'蓝背鱼和豆类制成；4游戏小时内移速提高20%。'},
  nightMeal:{name:'金尾鱼药膳',icon:53,type:'food',food:70,heal:30,sell:155,buy:230,buff:'regen',desc:'稀有夜鱼和药草制成；4游戏小时内缓慢回血。'},
  circuit:{name:'电子电路',icon:51,type:'resource',sell:35,buy:80,desc:'拆解汽车与旧电器获得，用于太阳能与无人机设备。声望60解锁商店供货。'},
  nightHerb:{name:'月光药草',icon:30,type:'resource',sell:65,buy:130,desc:'夜间探索发现的药草，可制作草药茶。'},
  flashlight:{name:'手电筒',icon:55,type:'tool',protected:true,desc:'照亮夜间探索，提高发现夜间补给的能力。'},
  crowbar:{name:'回收撬棍',icon:35,type:'tool',protected:true,desc:'用于拆解货架、汽车和旧电器。营地中可升级工具等级。'}
};
Object.assign(ITEMS, additions);
ITEMS.stew.buff='defense'; ITEMS.stew.desc+=' 4游戏小时内受到伤害减少20%。';
for(const [crop,c] of Object.entries(CROPS)) {
  ITEMS['fine_'+crop]={...ITEMS[crop],name:'优质'+c.name,sell:Math.round(c.sell*1.6),buy:Math.round(c.sell*3),desc:'细心照料获得的优质收成，售价提高60%。'};
  ITEMS['hardy_'+crop]={...ITEMS[crop],cropBase:crop,name:'耐旱'+c.name,sell:Math.round(c.sell*.75),desc:'耐旱品种的收成，售价降低25%；可代替普通作物交订单、加工与留种。'};
  ITEMS['fine_'+crop].cropBase=crop;
  for(const [trait,t] of Object.entries(TRAITS)) ITEMS['seed_'+crop+'_'+trait]={...ITEMS[c.seed],name:t.name+c.name+'种子',trait,desc:t.desc+' 可在育种箱稳定培育。'};
}
Object.assign(BUILDINGS, {
  bed:{name:'居民床位',icon:40,atlas:14,cost:{wood:8,cloth:2},w:52,h:30,hp:90,desc:'农舍自带1个床位；每张床增加1名居民容量。'},
  stall:{name:'农场摊位',icon:43,atlas:12,cost:{wood:10,scrap:2},w:70,h:42,hp:120,desc:'设置3种商品与价格；来客按游戏时间购买。'},
  canner:{name:'罐装机',icon:43,cost:{wood:8,scrap:8,parts:3},w:54,h:42,hp:140,tech:'canner',desc:'批量制作罐头，再包装成配送箱。'},
  tower:{name:'瞭望塔',icon:44,atlas:9,cost:{wood:14,scrap:8,parts:3},w:56,h:48,hp:240,tech:'tower',desc:'安排一名守卫后自动攻击320范围内敌人，每次消耗1发弹药。'},
  lure:{name:'噪声信标',icon:42,atlas:10,cost:{scrap:8,parts:2},w:38,h:38,hp:160,tech:'lure',desc:'引导350范围内、离角色较远的感染者；会被攻击，需要维修。'},
  repairpost:{name:'支援维修点',icon:43,atlas:11,cost:{wood:8,scrap:4,parts:2},w:54,h:40,hp:140,desc:'维修居民工作效率提高；附近防御设施可在战斗中缓慢修复。'},
  irrigation:{name:'灌溉站',icon:42,atlas:6,cost:{scrap:6,parts:3},w:38,h:38,hp:100,tech:'irrigation',desc:'连接250范围内的雨桶或已修复水塔，浇灌300范围内农田。'},
  solar:{name:'太阳能板',icon:44,atlas:7,cost:{scrap:10,parts:5,circuit:1},w:60,h:42,hp:130,tech:'solar',desc:'白天每小时获得3电力，高温5、暴雨1，上限100。'},
  drone:{name:'无人机站',icon:44,atlas:8,cost:{scrap:12,parts:7,circuit:2},w:54,h:42,hp:130,tech:'drone',desc:'每小时消耗2电力，自动收获300范围内作物并用真实种子补种；每10次作业需1零件维护。'},
  greenhouse:{name:'温室',icon:45,atlas:5,cost:{wood:14,scrap:6,cloth:4},w:78,h:60,hp:180,tech:'greenhouse',desc:'保护220范围内作物免受高温、暴雨与酸雨减速，成长提高10%。'},
  coop:{name:'鸡舍',icon:40,atlas:13,cost:{wood:12,stone:4},w:66,h:48,hp:150,desc:'安置获救的鸡，每天用玉米换取鸡蛋；扩展养殖后可养山羊。'},
  fishTrap:{name:'鱼篓',icon:40,cost:{wood:6,cloth:1},w:36,h:30,hp:80,desc:'每个游戏日可领取一条银鳞鱼。'}
});
RECIPES.push(
  {id:'beanMeal',out:{beanMeal:1},cost:{bean:2},station:'cook',minutes:35,desc:ITEMS.beanMeal.desc},
  {id:'herbTea',out:{herbTea:1},cost:{herb:2},station:'cook',minutes:25,desc:ITEMS.herbTea.desc},
  {id:'moonTea',out:{herbTea:2},cost:{nightHerb:1},station:'cook',minutes:30,desc:'月光药草制成两杯功能茶。'},
  {id:'fishStew',out:{fishStew:1},cost:{fish:1,potato:1},station:'cook',minutes:40,desc:ITEMS.fishStew.desc},
  {id:'eggMeal',out:{eggMeal:1},cost:{egg:2,potato:1},station:'cook',minutes:30,desc:ITEMS.eggMeal.desc},
  {id:'milkMeal',out:{milkMeal:1},cost:{milk:1,corn:1},station:'cook',minutes:35,desc:ITEMS.milkMeal.desc},
  {id:'riverMeal',out:{riverMeal:1},cost:{riverFish:1,bean:1},station:'cook',minutes:40,desc:ITEMS.riverMeal.desc},
  {id:'nightMeal',out:{nightMeal:1},cost:{nightFish:1,herb:2},station:'cook',minutes:45,desc:ITEMS.nightMeal.desc},
  {id:'parcel',out:{parcel:1},cost:{jam:2,cloth:1},station:'canner',minutes:50,desc:'把罐头包装为高价值配送货箱。'},
  {id:'flashlight',out:{flashlight:1},cost:{scrap:4,parts:1},station:'workbench',desc:ITEMS.flashlight.desc},
  {id:'crowbar',out:{crowbar:1},cost:{scrap:4,wood:2},station:null,desc:ITEMS.crowbar.desc}
);
for(const r of RECIPES) if(['stew','jam','cloth','bandage','medkit'].includes(r.id)) r.minutes={stew:30,jam:40,cloth:35,bandage:20,medkit:35}[r.id];
TRADERS.food.stock.seedCorn=5;
export const BUFF_NAMES={defense:'防护20%',speed:'移速20%',regen:'持续回血',stamina:'跑步省力'};
export const VARIANTS=['穿越后院','绕行封锁街道','搜索临时补给点'];

export const REP_TIERS = [
  {at:30,name:'可靠供货者',food:{seedCotton:4,beanMeal:3},mechanic:{medkit:3},desc:'棉花种子、豆香便当、药包与加工订单'},
  {at:60,name:'营地合伙人',food:{seedHerb:4,herbTea:3,riverFish:3},mechanic:{circuit:4},desc:'药草种子、功能茶、蓝背鱼与电子电路'},
  {at:100,name:'家园建设者',food:{seed_pumpkin_early:2,seed_corn_abundant:2,seed_herb_hardy:2},mechanic:{circuit:4,ammo:40},desc:'特性种子与额外电路、弹药供应'}
];
export const DIALOGUES = {
  food:[
    {text:'林姨：公共餐桌快没热饭了。你觉得这周应该先照顾谁？',options:[{label:'给伤员煮饭 · 交1份炖汤',cost:{stew:1},trust:8,result:'她把你的热饭送去了诊所。',demand:'food'},{label:'分种子，让每家都能种',trust:4,result:'林姨在地图上圈出了能重新开垦的院子。',demand:'crop'},{label:'先储备粮食，准备守家',trust:4,result:'你们约定提前准备尸潮期间的补给。',demand:'food'}]},
    {text:'林姨：今年的种子不多了。你愿意帮我留下哪种希望？',options:[{label:'留1份番茄 · 信任+8',cost:{tomato:1},trust:8,result:'她把番茄种子记在了来年的清单上。',demand:'crop'},{label:'把育种方法告诉邻居',trust:4,result:'林姨认真记下了你的育种建议。',demand:'crop'}]},
    {text:'林姨：大家想办一个小小的收获日。摊位该摆什么？',options:[{label:'摆料理，让大家吃顿好的',trust:4,result:'营地决定举办一场公共晚餐。',demand:'food'},{label:'摆材料，交换修家的东西',trust:4,result:'邻居们开始整理可以交换的建材。',demand:'resource'}]}
  ],
  mechanic:[
    {text:'老周：旧桥和防线都缺材料。你准备先修哪边？',options:[{label:'捐1零件，先修桥 · 信任+8',cost:{parts:1},trust:8,result:'老周把你的零件放进了修桥工具箱。',demand:'resource'},{label:'先加固防线',trust:4,result:'你们一起在纸上画好了火力与诱饵位置。',demand:'resource'},{label:'先修居民的设备',trust:4,result:'老周准备逐户检查旧机器。',demand:'resource'}]},
    {text:'老周：仓库的电器还能拆出好电路，只是动静会招来麻烦。',options:[{label:'带4金属，做一份回收清单',cost:{scrap:4},trust:8,result:'老周替你画好了安全撤退路线。',demand:'resource'},{label:'问他以前的仓库是什么样',trust:4,result:'他讲起同事们每次下班都要一起喝茶。',demand:'food'}]},
    {text:'老周：家园有电之后，你最想把什么交给机器？',options:[{label:'收获与补种',trust:4,result:'他拿出了无人机保养笔记。',demand:'resource'},{label:'先让水送到每一块田',trust:4,result:'你们商量好了雨桶和管线的走向。',demand:'crop'}]}
  ]
};
export const HORDE_DIRECTIONS = [
  {id:'east',name:'东侧林间小路',x:1440,y:440,spawns:[[1435,395],[1410,580]],tip:'围栏留射击通道；诱饵放在林间入口前。'},
  {id:'south',name:'南侧池塘岸边',x:820,y:950,spawns:[[750,945],[945,940]],tip:'保护鸡舍与灌溉设备，在池塘西岸布置陷阱。'},
  {id:'west',name:'西侧农田小径',x:75,y:520,spawns:[[75,440],[75,670]],tip:'守住农田外沿，把引导通道留在田地之外。'},
  {id:'north',name:'北侧旧水井通道',x:970,y:75,spawns:[[965,75],[1040,80]],tip:'从水井以东进入；保护电力设备与仓库。'}
];
export const ENCOUNTERS = [
  {name:'封锁的侧室',text:'侧室被旧门挡住了，主路仍然畅通。门后传来金属碰撞声。',options:[{label:'用Lv.2撬棍安静开门',tool:2,reward:{parts:3,circuit:1}}, {label:'用2木材撑开门，承受噪声',cost:{wood:2},noise:true,reward:{parts:3,bread:2}}, {label:'记下位置，先沿主路撤退',skip:true}]},
  {name:'危险的储备间',text:'门后有两名感染者。可以冒险打开、用弹药引开，或保持安全距离。',options:[{label:'打开储备间，迎战2名感染者',enemies:2,reward:{ammo:18,parts:3}}, {label:'用4发弹药引开它们',cost:{ammo:4},noise:true,reward:{cloth:3,bandage:2}}, {label:'关闭门，放弃这次补给',skip:true}]},
  {name:'补给点的纸条',text:'纸条写着：“缺药的人可以拿药，缺工具的人可以拿工具。给后来的人留一些。”',options:[{label:'拿医药包',reward:{medkit:1,herb:3}}, {label:'拿维修包',reward:{parts:2,circuit:1}}, {label:'留1干粮，换2份种子',cost:{bread:1},reward:{seedCorn:2},rep:3}]}
];
EVENTS.stranger={title:'陌生访客',desc:'一名背着工具的旅人想在营地借宿一晚。你的招待会影响接下来几天的集市需求。',options:[{label:'提供2份干粮，举办交换会',cost:{bread:2},rep:8,demand:'resource',reward:{scrap:4}},{label:'请她分享沿途消息',rep:3,demand:'food'},{label:'送1份作物，交流育种',cost:{radish:1},reward:{seed_radish_hardy:2},demand:'crop'}]};
EVENTS.visitor.options.forEach(o=>o.demand='crop');
EVENTS.radio.options.forEach(o=>o.demand='resource');
EVENTS.rain.options.forEach(o=>o.demand='food');
EVENTS.repair.options.forEach(o=>o.demand='resource');

export const FEATURES = [
  ['轮换订单与声望','orders','每天选2单；30 / 60 / 100声望解锁新商品。','沙石镇时光'],
  ['有取舍的作物育种','genes','早熟减产、丰产耗水、耐旱低价；成熟后稳定留种。','多洛可小镇'],
  ['料理临时能力','overview','最多2种效果；防护、移速、回血与跑步省力。','星露谷物语'],
  ['批量队列与生产链','production','一次加工1 / 3 / 5批；同类设施越多，产线越多。','墓场物语'],
  ['技能专精选择','overview','K打开四类技能；3级选分支，60金币重选。','星露谷物语'],
  ['看得见的公共重建','projects','集市、诊所、水塔、旧桥各2阶段，场景和服务一起恢复。','星露谷物语'],
  ['居民入住与工作','residents','3名幸存者；床位、工作餐、工作优先级与日夜作息。','环世界'],
  ['可预判的循环尸潮','overview','每3天一轮；提前公布方向、敌群、规模与准备建议。','七日杀'],
  ['摊位与定价反馈','stall','3个商品槽可改价；订单、对话和事件共同改变需求。','夜勤人'],
  ['NPC信任与故事','messages','每日对话可选回应；3阶段故事、礼物与供应优惠。','星露谷物语'],
  ['探索地点不同组合','explore','3种侧室与路线；每次探索选择开门、应战或放弃。','夜勤人'],
  ['自愿夜间探索','explore','清楚显示风险、黎明时间和撤退；手电与料理提升准备。','渔帆暗涌'],
  ['蓝图三选一','research','保存随机候选；选一项，剩余项目以后可独立研究。','风暴之城'],
  ['有分工的防御','residents','塔楼需要守卫与弹药；信标引敌，维修点支援，地形遮挡射击。','墓场物语2'],
  ['农业自动化','research','雨桶连管网、太阳能供电、无人机收获补种并定期维护。','多洛可小镇'],
  ['预报与温室规划','overview','提前2天预报高温、暴雨、酸雨；温室和品种共同应对。','多洛可小镇'],
  ['拆解与工具升级','life','3级工具拆货架、汽车、电器，得到木材、金属和电路。','DYSMANTLE'],
  ['钓鱼与鱼篓','life','3种鱼受天气时段影响；各有料理与订单用途。','星露谷物语'],
  ['鸡舍与养殖','life','救鸡、种玉米喂养；鸡蛋与羊奶进入料理和订单。','多洛可小镇'],
  ['有节奏的随机事件','messages','每2–3天抽取事件，做出选择；尸潮后安排休整日。','环世界']
];
