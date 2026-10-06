import './frontier-data.js';
import {ITEMS,RECIPES} from './data.js';
import {PROJECTS} from './expansion-data.js';
import {CLUES} from './frontier-data.js';
PROJECTS.water.reward='每天浇灌原有农田；新扩建农田需要雨桶、水渠或已接通水源的灌溉站。';
const facilityNotes={residential:'灌溉记录：病斑最先出现在使用旧供水支线的菜圃，旁边靠雨水生长的植物却仍然健康。',hospital:'设备记录：净水泵回流阀损坏，医院与仓库仍接在同一条旧供水线上。许医生带走了植物样本，准备比对污染来源。',warehouse:'检修记录：过滤装置停机后，污染水倒灌进支线。东南检修间保留了通信核心与故障档案，维修必须先具备过滤技术。'};
for(const [id,text]of Object.entries(facilityNotes))CLUES[id].text+=' '+text;

export const PILLARS = [
  {id:'farm',name:'农业供给',icon:24,question:'这次收成能帮我完成什么？',purpose:'种粮做工作餐，种棉做绷带，种药草恢复前哨；新品种服务新的行动。',source:'星露谷物语',url:'https://www.stardewvalley.net/about/',tools:[['camp','genes','育种'],['frontier','land','土地'],['frontier','water','水渠'],['frontier','ecology','生态'],['frontier','kitchen','料理'],['frontier','exhibition','收获展'],['camp','life','钓鱼与养殖']]},
  {id:'production',name:'生产工程',icon:43,question:'我该先解决哪个瓶颈？',purpose:'加工补给、恢复公共设施，逐步建立能在你外出时运转的生产线。',source:'异星工厂',url:'https://www.factorio.com/',tools:[['camp','production','加工队列'],['camp','projects','公共工程'],['camp','orders','每日订单'],['camp','stall','摊位'],['camp','research','设备蓝图']]},
  {id:'expedition',name:'远征收复',icon:40,question:'这次出门要带回哪件关键设备？',purpose:'侦察、救人、处理感染源、恢复前哨；每处废墟都会留下你的重建进度。',source:'腐烂国度2',url:'https://store.steampowered.com/app/495420/State_of_Decay_2/',tools:[['frontier','expedition','行囊与路线'],['camp','explore','探索准备']]},
  {id:'residents',name:'居民生活',icon:57,question:'我想帮谁实现下一个愿望？',purpose:'让阿禾、许医生和陈工安顿下来；人物故事会解锁补种、制药和加工协作。',source:'环世界',url:'https://rimworldgame.com/',tools:[['camp','residents','工作与床位'],['frontier','rooms','房间与政策'],['camp','messages','商人与消息'],['frontier','life','伙伴与相册']]},
  {id:'defense',name:'防御战斗',icon:47,question:'这套准备能守住哪一轮袭击？',purpose:'提前看清方向和敌群，选择工程、机动或侦察路线，战后查看准备的实际效果。',source:'七日杀',url:'https://store.steampowered.com/app/251570/7_Days_to_Die/',tools:[['frontier','combat','武器与潜行'],['camp','residents','驻守与维修']]},
  {id:'research',name:'调查复兴',icon:55,question:'感染为什么沿旧设施扩散？',purpose:'把日志、植物鉴定和设施证据连接起来；找到答案，同时获得探索新区域的能力。',source:'深海迷航',url:'https://store.steampowered.com/app/264710/Subnautica/',tools:[['frontier','investigation','日志与植物'],['frontier','ecology','生态修复']]}
];

export const CHAPTERS = [
  {name:'活下来',subtitle:'让荒地有收成，让餐桌有人',change:'公共餐桌开始运作，居民可以在你外出时照料农场。'},
  {name:'站稳脚跟',subtitle:'恢复医院前哨，守住医疗通道',change:'地图出现可补充医疗用品的前哨，开启长期供给合同。'},
  {name:'连通废墟',subtitle:'修复供水、动力和运输联系',change:'三个前哨连成网络，生产提速，远郊土地可以接入供水。'},
  {name:'重新点灯',subtitle:'查明扩散原因，恢复地区通信',change:'封闭检修间开放，无线电回应新的幸存者，主线完成后继续经营。'}
];

export const TASKS = [
  {id:'harvest',chapter:0,pillar:'farm',title:'收获第一批口粮',desc:'清理、播种、浇水并收获两株作物。先从萝卜和土豆开始。',outcome:'获得豆类与棉花种子：接下来分别做工作餐和绷带。',reward:{seedBean:4,seedCotton:6,wood:6},money:35,cost:{}},
  {id:'meal',chapter:0,pillar:'production',title:'把收成做成出发餐',desc:'用萝卜加工干粮，或用土豆加工炖汤；等待完成后领取一次成品。',outcome:'工作餐可以供应居民，炖汤还能帮助你抵抗伤害。',reward:{cloth:2,parts:2},money:25,cost:{}},
  {id:'farmer',chapter:0,pillar:'expedition',title:'接回阿禾与种子档案',desc:'前往住宅区，找到阿禾和后院的种子档案箱。关键档案首次搜索必得。',outcome:'阿禾入住，种子档案让首次特性育种不再消耗零件。',reward:{seedHerb:4,parts:3,bread:2},money:35,cost:{}},
  {id:'table',chapter:0,pillar:'residents',title:'让公共餐桌有灯光',desc:'完成集市第一阶段，建好制作台，并准备至少两个床位容量。',outcome:'第一章完成，开启医院重建目标和三种防御路线。',reward:{wood:8,scrap:8,ammo:24},money:60,cost:{}},
  {id:'signal',chapter:1,pillar:'expedition',title:'回应医院的求救',desc:'救回许医生，拾取医院日志，在东侧急救区取得净水泵组件。',outcome:'医生有了净水设施的线索，药草和棉花开始服务医院重建。',reward:{seedCotton:4,seedHerb:4,cloth:2},money:40,cost:{}},
  {id:'medical',chapter:1,pillar:'production',title:'准备一箱医疗补给',desc:'种棉花纺布，在制作台加工绷带或药包并领取。再交付两条绷带和两份药草。',outcome:'医院有了第一批实物补给；许医生可以推进制药故事。',reward:{wood:8,parts:3},money:35,cost:{bandage:2,herb:2}},
  {id:'hospital',chapter:1,pillar:'research',title:'恢复医院前哨',desc:'摧毁医院感染巢，完成诊所第一阶段，带着净水泵和材料到医院入口前哨施工。',outcome:'前哨可安全补给：每次远征一次免费治疗，并用药草和布料制作药包。',reward:{scrap:8,ammo:24,stew:1},money:60,cost:{}},
  {id:'hospitalDefense',chapter:1,pillar:'defense',title:'守住医疗通道',desc:'返回农场，准备布局、弹药和料理，发起医疗通道防守。也可先去前哨侦察并减少敌群。',outcome:'医疗通道稳定，开启供给合同、罐装工艺与新农田。',reward:{parts:5,seedTomato:4,wood:10},money:85,cost:{}},
  {id:'water',chapter:2,pillar:'farm',title:'让粮田接上稳定供水',desc:'修复水塔，清理住宅区感染巢，并恢复住宅粮食前哨。原有农田保持全田供水。',outcome:'粮食前哨提供种子交换，新扩建农田需要连接雨桶、管网或水渠。',reward:{circuit:2,parts:3},money:60,cost:{}},
  {id:'power',chapter:2,pillar:'residents',title:'把陈工带回运转的家',desc:'从仓库救回陈工，击败设备箱守卫取得动力组件，在调查页研究动力恢复。',outcome:'动力组件解锁太阳能、农业无人机和陈工的生产协作。',reward:{wood:10,scrap:10},money:60,cost:{}},
  {id:'warehouse',chapter:2,pillar:'expedition',title:'修通仓库物流前哨',desc:'处理仓库感染巢，修好旧桥，再恢复入口物流前哨。',outcome:'仓库提供设备物资合同，三个已恢复的前哨可以组成运输网络。',reward:{jam:2,cloth:2,parts:4},money:75,cost:{}},
  {id:'network',chapter:2,pillar:'production',title:'让三处前哨互相供给',desc:'建设运输网络，再完成一次三站远征，或完成两份前哨长期合同。两条路线都能推进。',outcome:'网络运作：加工提速、从农场仓库送口粮到前哨，第四章开放。',reward:{herb:4,parts:5},money:100,cost:{}},
  {id:'filter',chapter:3,pillar:'research',title:'查明感染的扩散方式',desc:'收齐三地日志，鉴定至少两种植物，研究净水过滤。线索指向仓库封闭检修间。',outcome:'过滤技术保护新农田的生长，也允许开启封闭检修间。',reward:{bandage:4,ammo:24},money:60,cost:{}},
  {id:'annex',chapter:3,pillar:'expedition',title:'进入封闭检修间',desc:'带过滤技术前往仓库东南角，开启检修间，处理守卫并带回通信核心。',outcome:'检修记录确认：污染曾沿旧供水设备扩散，恢复通信可以提醒其他营地。',reward:{circuit:2,parts:5},money:80,cost:{}},
  {id:'radio',chapter:3,pillar:'production',title:'让沉默的电台再响一次',desc:'在营地用通信核心、电路和机械零件恢复无线电站。',outcome:'农场出现通信站，开始发送预警；最后一次地区防守可以发起。',reward:{stew:2,beanMeal:2,ammo:36,wood:12},money:75,cost:{}},
  {id:'broadcast',chapter:3,pillar:'defense',title:'守住重新亮起的灯',desc:'完成通信站防守，保护第一次地区广播。居民、料理和防线都会参与这一战。',outcome:'收到其他幸存者的回应。主线完成，保留家园，继续合同、人物故事和自选远征。',reward:{seedPumpkin:6,parts:10},money:180,cost:{}}
];

export const OUTPOSTS = {
  residential:{name:'住宅粮食前哨',resident:'farmer',component:'seedArchive',cost:{wood:8,bread:2,bean:3},service:'用2份豆类交换2颗所选种子，每游戏日一次。',x:710,y:455},
  hospital:{name:'医院医疗前哨',resident:'medic',component:'pumpModule',cost:{wood:8,cloth:2,bandage:2,pumpModule:1},service:'前哨防护区可安全补给；每次到访免费恢复35生命，用2药草和1布料制作1药包。',x:710,y:455},
  warehouse:{name:'仓库物流前哨',resident:'mechanic',component:'driveModule',cost:{wood:10,scrap:8,parts:3},service:'用6份废金属交换2个电路，每游戏日一次。',x:710,y:455}
};

export const FIND_LOCATIONS = {
  seedArchive:{region:'residential',name:'后院种子档案箱',x:720,y:745,icon:55},
  pumpModule:{region:'hospital',name:'急救区净水泵',x:1370,y:475,icon:51},
  driveModule:{region:'warehouse',name:'精密动力组件箱',x:1390,y:605,icon:51,elite:true},
  relayCore:{region:'warehouse',name:'检修间通信核心',x:1420,y:885,icon:55,annex:true}
};
for(const [id,d] of Object.entries(FIND_LOCATIONS))ITEMS[id]={name:{seedArchive:'种子档案',pumpModule:'净水泵组件',driveModule:'动力组件',relayCore:'通信核心'}[id],type:'quest',icon:d.icon,protected:true,desc:'首次在'+d.name+'取得，用于重建与研究。受保护，不会在倒下时遗失。'};

if(!RECIPES.some(r=>r.id==='trailBread'))RECIPES.push({id:'trailBread',out:{bread:2},cost:{radish:3},station:'cook',minutes:20,desc:'把3份萝卜做成2份干粮，供应居民工作餐和远征口粮。'});

export const RESEARCH = {
  filtration:{name:'净水过滤',cost:{herb:4,parts:4},desc:'比对医院日志和至少一种植物：新扩建农田的成长加快15%，并开启封闭检修间。'},
  power:{name:'动力恢复',cost:{driveModule:1,circuit:2,parts:3},desc:'陈工利用仓库动力组件：解锁太阳能与无人机蓝图。'}
};

export const STYLES = {
  engineer:{name:'工程防线',desc:'陷阱和瞭望塔伤害提高25%。用布局与居民驻守保护农场。'},
  mobile:{name:'机动作战',desc:'移动速度提高10%，枪械装填时间缩短15%，近战伤害提高15%。'},
  scout:{name:'侦察先行',desc:'武器噪声降低35%；完成对应前哨侦察后，章节防守再少2名敌人。'}
};

export const SIEGES = {
  hospital:{name:'医疗通道防守',region:'hospital',count:10,direction:1,theme:0,requires:'hospital',reward:'医疗通道稳定，开启长期供给合同与罐装工艺。'},
  broadcast:{name:'通信站防守',region:'warehouse',count:16,direction:0,theme:1,requires:'radio',reward:'地区广播成功，其他营地回应，主线可以完成。'}
};

export const CONTRACTS = {
  residential:[{name:'种子交换站的工作餐',cost:{bread:3,bean:4},reward:{seedCotton:3,parts:2},money:65},{name:'粮食前哨的炖汤',cost:{stew:2},reward:{seedHerb:3,wood:8},money:80}],
  hospital:[{name:'恢复门诊药柜',cost:{bandage:3,herb:4},reward:{cloth:3,parts:3},money:85},{name:'医生的轮班补给',cost:{bread:3,medkit:1},reward:{seedHerb:4,circuit:1},money:90}],
  warehouse:[{name:'物流队的维修材料',cost:{wood:8,scrap:8},reward:{circuit:2,parts:3},money:95},{name:'运输队的配送箱',cost:{parcel:1},reward:{ammo:24,parts:4},money:110}]
};

export const ARCS = {
  farmer:[{title:'先有一顿安心饭',text:'阿禾把留下的种子放在桌上：“有人照看它们，我才敢相信还能有明年。”',cost:{bread:2},effect:'愿望记录在营地；阿禾每天的工作餐改为自动供应。'}, {title:'种子要留给下一季',text:'她希望你选一种作物，由她照看收获后的补种。',cost:{bean:4,wood:4},effect:'阿禾工作时每小时补种一块空田，消耗真实种子，可选择作物。'}, {title:'让别人也能种下去',text:'粮食前哨开始分发种子。阿禾第一次主动提起了家人的农田。',cost:{fine_bean:1,bread:3},effect:'住宅种子交换每次多获得1颗种子，营地出现种子展示。'}],
  medic:[{title:'为留下的人整理病床',text:'许医生想把药柜重新分类，让伤员知道自己还有人照顾。',cost:{bread:2},effect:'愿望记录在营地，开启植物鉴定指引。'}, {title:'把药草变成可以依靠的药',text:'有了干净的水和可靠的布料，她想恢复每日制药。',cost:{herb:4,cloth:2},effect:'医生在营地工作时，每天最多用2药草和1布料自动生产1药包。'}, {title:'走得更远也有人接应',text:'医院前哨开始接待路过的幸存者。她终于不用只等待求救。',cost:{medkit:2,bread:3},effect:'医院前哨免费治疗提高至55生命，营地出现求医访客。'}],
  mechanic:[{title:'工具先有个落脚的地方',text:'陈工擦干净一把扳手：“修得好的东西，别急着扔。”',cost:{bread:2},effect:'愿望记录在营地，开启动力恢复指引。'}, {title:'让机器替我们多做一点',text:'他把动力组件接进制作台，准备给加工队列增添稳定的协助。',cost:{parts:3,scrap:6},effect:'陈工有床位和工作餐时，加工速度提高20%。'}, {title:'听见河对面的声音',text:'物流网络建好以后，陈工想把修好的设备送给还没有灯的地方。',cost:{circuit:2,bread:3},effect:'运输网络加工增益提高至20%，营地出现运输访客。'}]
};

export const ANNEX={x:1300,y:810,w:190,h:130,door:{x:1420,y:807},inside:{x:1420,y:885}};
