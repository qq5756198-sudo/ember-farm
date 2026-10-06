import {REGIONS,ITEMS} from './data.js';
import {DISTRICT_GEOMETRY,DISTRICT_POINTS} from './district-art.js';
export const DISTRICTS={
 valley:{name:'溪谷试验田',parent:'farm',mark:'芽',color:'#acbd78',tag:'水与土地',purpose:'用有限耕地种出工作餐、医疗药草和商品作物。',gate:{x:990,y:875},cost:{wood:6,stone:3,bread:2},risk:'安全耕作 · 浅滩按时开放',goods:['herb','bean','corn','cotton'],source:'Timberborn / Stardew Valley',url:'https://store.steampowered.com/app/1062090/Timberborn/'},
 stationMarket:{name:'旧站商街',parent:'market',mark:'商',color:'#d5ac72',tag:'顾客与流通',purpose:'把库存变成服务、利润和回头客。',gate:{x:1375,y:820},cost:{wood:6,scrap:3},risk:'安全经营 · 货位和工时有限',goods:['bread','stew','parts','seedHerb'],source:'Moonlighter',url:'https://store.steampowered.com/app/606150/Moonlighter/'},
 courtyard:{name:'雨巷住区',parent:'residential',mark:'巷',color:'#b29e8e',tag:'路线与邻里',purpose:'解决街区问题，留下捷径、安全范围和居民合作。',gate:{x:1375,y:820},cost:{wood:5,scrap:3},risk:'感染者 · 可主动发起街区防守',goods:['wood','scrap','seedBean','cloth'],source:'State of Decay 2 / This War of Mine',url:'https://support.stateofdecay.com/hc/en-us/articles/4403310472973-Update-25-Plague-Territory'},
 quarantine:{name:'检疫科研园',parent:'hospital',mark:'研',color:'#85b8b3',tag:'供电与研究',purpose:'用样本解释污染，让研究改变医疗与农业生产。',gate:{x:1375,y:820},cost:{parts:2,cloth:2,bread:2},risk:'污染回廊 · 深翼需要过滤研究',goods:['herb','bandage','medkit','fieldSample'],source:'Subnautica / Factorio',url:'https://store.steampowered.com/app/264710/Subnautica/'},
 railDepot:{name:'北线货运站',parent:'warehouse',mark:'轨',color:'#c59a74',tag:'设备与运输',purpose:'恢复设备，用电力、生产插槽和班次连接五个地区。',gate:{x:1095,y:905},cost:{scrap:6,parts:2,bread:2},risk:'工业感染者 · 超负荷引来袭击',goods:['scrap','parts','cloth','ammo'],source:'Factorio',url:'https://www.factorio.com/game/content'}
};
for(const [id,d]of Object.entries(DISTRICTS))REGIONS[id]={name:d.name,sub:d.tag,risk:d.risk,res:d.purpose,asset:id,spawn:{x:160,y:510},exit:{x:95,y:510},colliders:DISTRICT_GEOMETRY[id],capabilities:{district:true,storage:true,farming:id==='valley',industry:id==='railDepot'}};
ITEMS.fieldSample={name:'溪谷野生样本',icon:30,type:'quest',protected:true,desc:'浅滩取得，用于科研园对照温室；关键样本不随倒下遗失。'};
export const POINTS=[
 ['watergate','valley','分水闸与梯田','修复后选择上层或下层供水；另一层需亲手浇灌。','有限水量决定种植安排。',42],
 ['rotation','valley','轮作与休耕','整畦播种豆类、玉米、棉花或休耕；豆类恢复肥力。','肥力影响生长，轮作减少耗地。',32],
 ['herbbed','valley','宿根药圃','剪收后再生，或整株采走并重新栽培。','持续供应药草或满足急单。',30],
 ['intercrop','valley','豆玉米间作','下层按行搭配，间作增产但居民收获效率减半。','精耕收益与整片效率的选择。',27],
 ['wetland','valley','生态净化带','让出下层两格耕地，修建湿地缓冲带。','减少恶劣天气损失，科研后可升级。',42],
 ['shoal','valley','退水浅滩','每日10至16点退水，近岸物资或深处样本二选一。','样本用于试验，物资按日限量。',40],
 ['fieldwork','valley','整畦经营委托','派阿禾照料，设作物与留种，消耗工作餐。','阿禾离开原农场岗位，协助本区农务。',57],
 ['agrilab','valley','试验站专营','完成两次溪谷收获后选择保种、节水或商品化。','重选花材料并有一天过渡期。',45],
 ['shops','stationMarket','两间铺位经营','餐食、维修、种子三类店铺中选择两类。','店型决定商品，补货使用库存。',43],
 ['dining','stationMarket','预约餐桌','两份菜单提前备餐，按当日口味接待。','销售收入、回头客和稳定料理用途。',53],
 ['restore','stationMarket','旧物鉴定整修','先检查旧物，再拆料或修复出售。','按诊断信息决定是否投入零件。',51],
 ['barter','stationMarket','三方易货','查看交换表，每方每天一单。','余粮交换短缺物资，无循环套利。',50],
 ['groupage','stationMarket','运输拼单','两格货位选择大宗、医疗或混装订单。','时间与利润不同，货棚加快周转。',40],
 ['assistant','stationMarket','驻店助手','派居民驻店，设置保留库存与售价。','消耗商品并分成，不能两地工作。',56],
 ['fund','stationMarket','商街公共基金','逐项建设路灯、验货台与货棚。','延长营业、加快整修与运输。',55],
 ['fair','stationMarket','轮换交易会','每三天轮换粮食、织物、维修主题。','摆摊或配送消耗货物，隔日再参加。',24],
 ['routes','courtyard','屋顶与后院路线','修梯道或后院门，两条路线永久开通。','缩短旅行或获得回收机会。',46],
 ['sound','courtyard','楼宇声源诱导','修复门铃后选择两个声源。','引开附近敌人，抓住窗口穿行。',55],
 ['house','courtyard','房屋保留或拆料','修为休息点或拆料，拆后可付费重建。','恢复生命体力或一次性材料。',43],
 ['neighbors','courtyard','三个邻里家庭','园丁、缝纫师、老电工各有三阶段需求。','信任解锁种子、布料与维修交换。',57],
 ['specialist','courtyard','居民专长开路','派三名居民开不同支路，或用工具替代。','永久支路，派出者暂离营地。',56],
 ['blocks','courtyard','按街段收复','解决声源、电箱、污染并清除对应敌人。','安全范围扩大，开放社区合作。',55],
 ['streetdefense','courtyard','点灯后的街区防守','布置围栏、陷阱和射点后主动启动。','恢复夜间服务，战报显示准备的作用。',47],
 ['mutual','courtyard','社区轮值互助','交工作餐，选择采集、农务或侦察。','限时协作与明确入库，需要持续提供工作餐。',53],
 ['power','quarantine','三翼供电切换','初期一翼可用，升级后同时两翼。','样本室、病房和消毒间争夺电力。',51],
 ['corridor','quarantine','污染回廊','消耗防护走短路，或修通风打开永久通道。','材料换时间，或一次投资换安全。',39],
 ['experiment','quarantine','对照温室试验','栽培药草加野生样本，对照水质和过滤。','获得证据，改良净化带与药草产能。',30],
 ['sterile','quarantine','消毒工艺选择','高效高耗电或低耗慢加工。','按远征日期准备绷带和药包。',39],
 ['ward','quarantine','两床位康复病房','两床收治，基础照护或医生协作。','康复带来合作物资与人物记录。',56],
 ['evidence','quarantine','污染支线证据拼合','对照日志、样本和管线图判断来源。','正确结论打开处理路线，错误可重试。',55],
 ['drill','quarantine','停电应急演练','选择保样本或照明，再修故障并守中庭。','获得改良资料，失败保留研究。',51],
 ['medservice','quarantine','医疗服务专营','院内救护、急救包或农业样本分析。','加强病房、药品或溪谷药草成长。',39],
 ['crane','railDepot','龙门吊搬箱','货箱移动至侧线、掩体位或装卸位。','改变通路、掩体与运输速度。',40],
 ['diagnose','railDepot','旧机床故障诊断','测电路和传动后修复，或拆解。','恢复生产；拆料后仍可重新修建。',43],
 ['switch','railDepot','道岔与短途货轨','修复轨段，选择工坊线或装卸线。','不同路线送回材料或运输利润。',50],
 ['modules','railDepot','双插槽生产单元','安装两种弹药、零件或纺织模块。','投入材料排队，换装先处理在制品。',51],
 ['load','railDepot','有限功率配给','分配机床、吊机、照明与货轨用电。','不得超过上限，升级开放并行。',52],
 ['cargo','railDepot','货厢装载规划','按货位和重量装货，选择五区目的地。','普通便宜，急件更快；也可用随身行囊携带。',40],
 ['overload','railDepot','开机噪声守线','正常生产或主动超负荷，预先查看方向。','产线加速，失败停止加速后可重试。',47],
 ['dispatch','railDepot','跨区班次调度','设置两端、货物、保留库存与班次。','扣除货物、维护与运费，连接五区。',55]
].map(([id,region,name,desc,purpose,icon],i)=>({id,region,name,desc,purpose,icon,number:i+1,...DISTRICT_POINTS[i%8]}));
export const POINT_BY_ID=Object.fromEntries(POINTS.map(p=>[p.id,p]));
export const POWER_LABELS={lab:'样本室',ward:'病房',sterile:'消毒间',machine:'机床',crane:'吊机',lights:'照明',rail:'货轨'};
export const GOODS=['wood','stone','scrap','parts','circuit','bread','bean','corn','potato','herb','cotton','cloth','bandage','medkit','ammo','jam','fieldSample','seedBean','seedCorn','seedHerb'];
export const RESIDENT_NAMES={farmer:'阿禾',medic:'许医生',mechanic:'陈工'};
