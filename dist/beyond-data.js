import {ITEMS,CROPS,REGIONS,RECIPES} from './data.js';
import {RESIDENTS} from './expansion-data.js';
import {BEYOND_GEOMETRY} from './beyond-art.js';
export const BMAPS={
 pinewood:{name:'雾松林场',parent:'valley',color:'#aabd83',mark:'林',tag:'风向与再生',purpose:'经营三片林地，采集树脂，培育可用于防御的异藤。',cost:{wood:12,cloth:2,bread:2},gate:{x:1450,y:910},risk:'风雾遮挡 · 林木需要再生'},
 shipyard:{name:'沉湾船坞',parent:'stationMarket',color:'#88bcc1',mark:'港',tag:'船只与运力',purpose:'恢复船坞，选择载客或载货能力，沿河开通补给线路。',cost:{scrap:12,parts:3,cloth:3},gate:{x:1450,y:910},risk:'积水与感染者 · 船位有限'},
 shelter:{name:'地底避难城',parent:'courtyard',color:'#bdac8c',mark:'舱',tag:'空气与证据',purpose:'辨认失真的安全灯，恢复通风、居住舱和医疗捷径。',cost:{scrap:10,cloth:4,parts:2},gate:{x:1450,y:910},risk:'停风回廊 · 气闸需要维护'},
 frost:{name:'白霜气象站',parent:'railDepot',color:'#b4d2db',mark:'霜',tag:'寒潮与种源',purpose:'准备温暖驿舍，测读天气，取得可稳定留种的黑麦。',cost:{parts:4,circuit:1,cloth:6},gate:{x:1450,y:910},risk:'低温消耗体力 · 可随时返程'},
 archive:{name:'余晖档案岛',parent:'shipyard',color:'#d6bf87',mark:'岛',tag:'知识与复兴',purpose:'找回工艺和生活史，完成撤离航线，选择家园的未来。',cost:{parts:6,circuit:2,cloth:6},gate:{x:1450,y:910},risk:'主线后的远征 · 需要固定航线'}
};
for(const [id,d]of Object.entries(BMAPS))REGIONS[id]={...d,sub:d.tag,res:d.purpose,asset:id,spawn:{x:145,y:510},exit:{x:110,y:510},colliders:BEYOND_GEOMETRY[id],capabilities:{beyond:true,storage:true}};
Object.assign(ITEMS,{
 resin:{name:'松脂',type:'resource',icon:29,sell:14,desc:'林场采集。用于防水、驿舍保温和耐用滤材。'},
 salt:{name:'食盐',type:'resource',icon:49,sell:9,desc:'船坞密封食品仓取得；用于盐焗杂粮，不能用工业盐替代。'},
 filterFabric:{name:'滤材',type:'resource',icon:31,sell:20,desc:'避难城工坊制作。维护气闸、医疗捷径和河水净化设施。'},
 rye:{name:'黑麦',type:'crop',icon:28,sell:19,food:12,desc:'气象站留下的耐寒谷物。加工远征餐，也可独立留种。'},
 seedRye:{name:'黑麦种子',type:'seed',crop:'rye',icon:34,protected:true,sell:3,desc:'白霜试种圃稳定取得。成熟需12游戏小时，产出4份黑麦，可在育种箱留种。'},
 trailRye:{name:'盐焗杂粮',type:'food',icon:53,food:55,heal:8,sell:42,desc:'黑麦和食盐制成。食用后6游戏小时抵御白霜站的额外体力消耗。'}
});
CROPS.rye={name:'黑麦',icon:28,seed:'seedRye',grow:720,yield:4,food:12,sell:19,desc:ITEMS.rye.desc};
for(const prefix of ['fine_','hardy_']){ITEMS[prefix+'rye']={...ITEMS.rye,name:(prefix==='fine_'?'优质':'耐候')+'黑麦',sell:prefix==='fine_'?29:17,cropBase:'rye'};}

RECIPES.push({id:'breed_rye',out:{seedRye:2},cost:{rye:1},station:'breeder',minutes:10,desc:'将黑麦留作下一季种源，种子可稳定繁殖。'});
RECIPES.push({id:'trailRye',out:{trailRye:2},cost:{rye:3,salt:1},station:'cook',minutes:35,desc:ITEMS.trailRye.desc});
RESIDENTS.cartographer={name:'柏岚',icon:57,story:'戴手套的制图员。康复期间愿意先整理路线，再选择驻站或随队工作。',defaultRole:'mechanic'};
const names={pinewood:[['wind','风标坡','观察风标，在静风窗口进入深林。'],['resin','采脂树林','按日采脂，防水与保温都用得上。'],['forest','三片经营林','轮换采伐，选择眼前木材或长期再生。'],['thorn','刺藤围地','驯养异藤，给家园添一道需要浇灌的缓行篱。'],['trial','林下试种带','豆类改土，黑麦在取得种源后进入试种。'],['lodge','护林小屋','两个改造位置，保温、隔音或临时床铺各有用途。'],['bridge','断桥与犬径','修桥缩短林场回程，也可沿安全犬径绕行。'],['coop','林业互助站','派出真实居民，消耗工作餐换取持续采集。']],shipyard:[['ramp','绞盘坡道','修复绞盘，取得重型船材。'],['drain','排水船坞','排走积水，打开中央通道。'],['boat','小艇改装架','两处改装位置，载客、货舱、雨棚需要取舍。'],['salt','密封盐仓','从标有食用字样的密封桶取盐。'],['pontoon','浮桥连接点','调整浮桥，连接邮政或船坞近道。'],['post','旧邮政码头','邮袋占用货位，送达后才会收到回信。'],['fog','雾中泊位','供电灯或反光浮标，引导返航。'],['ferry','自治会码头','恢复固定航线，把农场物资运入船坞。']],shelter:[['air','主风道','修复通风，改善整片地下空间。'],['lock','双向气闸','两扇门不能同时打开；滤材换安全与时间。'],['signals','失真指示室','核对两份证据，修正会误导人的灯。'],['files','旧档案间','记录空气读数和事故时间，证据进入调查手册。'],['housing','公共居住舱','准备床铺，让新居民有地方休养。'],['echo','回声走廊','辨认声源，用安静路线避开感染者。'],['filter','滤材工坊','普通布料也能制成滤材；树脂可提高产量。'],['lift','医院升降井','恢复升降设备；滤材维护捷径，也能走免费地面路线。']],frost:[['pass','山口风廊','先搭背风屏障，降低寒风中的消耗。'],['snow','积雪观测径','寻找旗杆，在下一次降雪前留下安全路线。'],['inn','背风驿舍','温暖、隔音和床位只能装两种。'],['power','手摇备电间','付出一段工时充电，不需要反复点按。'],['cable','旧缆车台','修通缆车后更快往返北线。'],['weather','气象仪器坪','修复仪器，读取未来两天的天气。'],['rye','耐寒试种圃','领取第一批黑麦种子，完成试种后继续留种。'],['bearing','山顶测向台','记录档案岛方位，给远航一个可靠目的地。']],archive:[['landing','礁岸登陆点','加固栈桥，减少重装上岸的疲惫。'],['vault','防潮档案库','农业、工程、生活档案先选一类，其余可继续整理。'],['incident','旧事故记录室','调查河流污染来源，寻找绕开污染管线的办法。'],['seeds','公共种源库','存入种子作备份，失去种源后付出材料补种。'],['prototype','工艺试验庭','读图、制作原型，用新的配方解决材料瓶颈。'],['museum','生活史展厅','展出实际拍下的照片，让家园有故事可讲。'],['evac','避风撤离港','调查航道、安排三批撤离，再准备新家。'],['council','复兴议事厅','选择自给、好客或求知愿景，逐段建设。']]};
const coords=[[370,310],[700,300],[1080,300],[1370,350],[410,650],[745,620],[1080,680],[1360,820]];
export const BPOINTS=Object.entries(names).flatMap(([region,rows])=>rows.map(([suffix,name,purpose],i)=>({id:region+'_'+suffix,region,name,purpose,x:coords[i][0],y:coords[i][1],icon:[55,48,43,42,34,43,55,57][i]})));
export const BPOINT_BY_ID=Object.fromEntries(BPOINTS.map(p=>[p.id,p]));
// Action definitions are shared by quotation, execution and the player-facing panel.
const a=(key,label,cost,out={},minutes=0,extra={})=>({key,label,cost,out,minutes,...extra});
export const BACTIONS={
 pinewood_wind:[a('observe','测读风标',{}, {},20,{effect:'wind',repeat:1,note:'留下当天风向；静风时采脂多1份。'})],
 pinewood_resin:[a('tap','采集松脂',{bread:1},{resin:2},40,{repeat:1,effect:'resin',note:'每日一次；风标观测提高收益。'})],
 pinewood_forest:[...Array.from({length:3},(_,i)=>[a('select'+i,'择伐第'+(i+1)+'片林',{bread:1},{wood:5,resin:1},60,{repeat:2,forest:i,note:'这片林地两天后恢复。'}),a('clear'+i,'清伐第'+(i+1)+'片林',{bread:2},{wood:12},90,{repeat:5,forest:i,note:'木材更多；五天内不能在这片林采伐。'})]).flat()],
 pinewood_thorn:[a('tame','驯养刺藤',{wood:6,resin:2},{},90,{note:'开放农场浇灌服务，使靠近围栏的敌人减速。'}),a('water','运回并浇灌篱根',{bread:1},{},30,{requires:'tame',repeat:1,effect:'hedge',note:'消耗浇水壶6格水；守家缓行效果持续一天。'})],
 pinewood_trial:[a('bean','林下种豆',{seedBean:2,bread:1},{bean:6,seedBean:2},540,{repeat:1,note:'营地可同时探索，成熟后入林场仓库。'}),a('rye','林下种黑麦',{seedRye:2,bread:1},{rye:6,seedRye:2},720,{repeat:1})],
 pinewood_lodge:['warm','quiet','bed'].map((k,i)=>a(k,['加装保温层','加装隔音层','铺设临时床'][i],{wood:6,cloth:3},{},60,{module:true,note:['两处改造位之一；休息额外恢复15体力。','两处改造位之一；休息减少居民疲劳。','两处改造位之一；增加1名居民床位。'][i]})).concat([a('rest','休息一小时',{bread:1},{},60,{repeat:0,effect:'rest'})]),
 pinewood_bridge:[a('repair','加固断桥',{wood:10,parts:1},{},60,{note:'林场往返缩短8分钟。'}),a('detour','记录安全犬径',{}, {},40,{note:'取得木材补给；无需养犬也能使用。',out:{wood:3}})],
 pinewood_coop:[a('service','修好互助站',{wood:8,cloth:2},{},90,{note:'解锁居民外派，收获存入当地仓库。'})],
 shipyard_ramp:[a('repair','修复绞盘',{scrap:8,parts:2},{wood:6},90,{note:'开放船坞工程。'})],
 shipyard_drain:[a('pump','修泵排水',{parts:2,cloth:2},{scrap:5},120,{note:'中央积水通道永久开放。'})],
 shipyard_boat:['passenger','cargo','roof'].map((k,i)=>a(k,['安装载客长椅','扩建货舱','搭建防雨棚'][i],{wood:8,cloth:3},{},90,{boat:true,note:['撤离航次可搭载2人。','货运每航次可带12份物资，默认6份。','旅行额外恢复8体力。'][i]})),
 shipyard_salt:[a('gather','检查密封并取食盐',{bread:1},{salt:3},35,{repeat:2,note:'两天补充一批；可加工远征杂粮。'})],
 shipyard_pontoon:[a('post','接向邮政码头',{wood:4},{},45,{choice:true,note:'邮袋运输缩短30分钟。'}),a('dock','接向船坞',{wood:4},{},45,{choice:true,note:'船坞货运缩短30分钟。'})],
 shipyard_post:[a('sort','整理可投递邮件',{}, {},30,{effect:'mail',note:'开放邮袋事件；邮件与货物共用两条运输班次。'})],
 shipyard_fog:[a('lamp','架设航标灯',{parts:2,circuit:1},{},60,{choice:true,note:'每次航运消耗1电；航程缩短30分钟。'}),a('reflect','布设反光浮标',{scrap:4,resin:1},{},60,{choice:true,note:'无需电力，标准航程。'})],
 shipyard_ferry:[a('service','恢复固定航线',{wood:10,parts:3,cloth:2},{},120,{note:'需先排水并设航标；开放农场货运与档案岛航路。'})],
 shelter_air:[a('service','修复主风机',{parts:3,scrap:6},{},120,{note:'地下体力消耗降低；白霜站解锁所需的地区服务之一。'})],
 shelter_lock:[a('outer','打开外门，关闭内门',{}, {},5,{repeat:0,effect:'airOuter'}),a('inner','过滤后打开内门',{filterFabric:1},{},15,{repeat:0,effect:'airInner',note:'需先关闭外门；可在工坊制作滤材。'}),a('close','关闭两扇门',{}, {},5,{repeat:0,effect:'airClose'})],
 shelter_signals:[a('air','采集独立空气读数',{}, {},25,{note:'取得空气证据。'}),a('repair','校准指示灯',{scrap:2},{},45,{requires:'air',note:'需同时取得旧档案；正确安全灯会变为绿色。'})],
 shelter_files:[a('read','比对值班与维修记录',{}, {},30,{note:'证据留在手册，不占背包。'})],
 shelter_housing:[a('repair','整理公共床铺',{wood:10,cloth:6},{},120,{note:'为家园增加2个床位。'})],
 shelter_echo:[a('map','标出回声源',{}, {},30,{note:'引开走廊敌人，记录安静路线。'})],
 shelter_filter:[a('weave','制作基础滤材',{cloth:2},{filterFabric:1},45,{repeat:0}),a('resin','制作覆脂滤材',{cloth:2,resin:1},{filterFabric:2},55,{repeat:0}),a('prototype','按新工艺制作滤材',{cloth:1,resin:1},{filterFabric:2},40,{repeat:0,global:'prototype'})],
 shelter_lift:[a('repair','修复医院升降井',{parts:3,scrap:8},{},120,{note:'通往医院的捷径；单次滤材1，地面路线免费。'}),a('ride','滤净轿厢，前往医院',{filterFabric:1},{},0,{requires:'repair',repeat:0,effect:'hospital'})],
 frost_pass:[a('screen','搭建背风屏障',{wood:8,cloth:3},{},90,{note:'本地区额外体力消耗减半。'})],
 frost_snow:[a('mark','补设路旗',{cloth:1},{},30,{repeat:2,note:'两天内白霜站往返缩短5分钟。'})],
 frost_inn:['warm','quiet','bed'].map((k,i)=>a(k,['安装炉壁保温','修整隔音门','安排临时床'][i],{wood:6,cloth:3},{},60,{module:true,note:'最多两处改造；可拆回部分材料。'})).concat([a('rest','围炉休息',{bread:1},{},60,{repeat:0,effect:'rest'})]),
 frost_power:[a('charge','完成一班手摇充电',{bread:1},{},120,{repeat:1,effect:'charge',note:'一班工作产生8电；每日一次。'})],
 frost_cable:[a('repair','加固缆车',{parts:3,resin:2,cloth:2},{},120,{note:'往返白霜站缩短10分钟。'})],
 frost_weather:[a('repair','修复气象仪器',{parts:2,circuit:1},{},120,{note:'显示两天预报。'}),a('read','记录下一轮天气',{}, {},15,{requires:'repair',repeat:1,effect:'forecast'})],
 frost_rye:[a('seed','领出封存的黑麦种子',{}, {seedRye:3},20,{note:'种源确定获得，无随机掉落。'}),a('trial','在试种圃培育黑麦',{seedRye:2,bread:1},{rye:6,seedRye:3},720,{repeat:1})],
 frost_bearing:[a('survey','测定档案岛航向',{bread:2},{},120,{note:'需气象仪器修复；主线结束后可从船坞远航。'})],
 archive_landing:[a('repair','加固登陆栈桥',{wood:10,resin:2},{},90,{note:'每次抵达岛屿恢复15体力。'})],
 archive_vault:['agri','engineering','life'].map((k,i)=>a(k,['整理农业档案','整理工程档案','整理生活档案'][i],{cloth:2,bread:2},{},120,{effect:'archive:'+k,note:['种源库补种时少用1布料。','研究原型时返回1零件。','生活史展出后居民额外恢复10疲劳。'][i]})),
 archive_incident:[a('read','查阅污染管线记录',{}, {},45,{note:'解锁上游净化调查。'}),a('bypass','修通清水旁路',{parts:4,filterFabric:3,wood:8},{},180,{requires:'read',effect:'cleanRiver',note:'每天农场灌溉多4格水；林下试种产量加1。'})],
 archive_seeds:[a('backup','备份黑麦种源',{seedRye:2},{},30,{note:'留存档案后可持续补领。'}),a('restore','整理培养基并补种',{cloth:2,bread:1},{seedRye:2},90,{requires:'backup',repeat:1,note:'每天限一次；农业档案节省布料。'})],
 archive_prototype:[a('read','核对实物尺寸',{}, {},30,{note:'为正确原型提供测量证据。'}),a('build','制作滤材原型',{parts:2,cloth:2,resin:1},{},90,{requires:'read',effect:'prototype',note:'永久开放滤材工坊的新配方。'})],
 archive_museum:[a('exhibit','布置一组生活照片',{wood:4,cloth:2},{},90,{repeat:2,effect:'exhibit',note:'需已拍摄照片；居民疲劳下降，回赠食物入农场仓。'})],
 archive_evac:[a('survey','调查撤离航道',{bread:2},{},90,{note:'最后一班渡船事件的前置；保留每批进度。'})],
 archive_council:['self','guest','knowledge'].map((k,i)=>a(k,['推进自给家园','推进好客家园','推进求知家园'][i],{wood:10,stew:2,parts:2},{},180,{vision:k,repeat:0,note:['三期工程；完成后居民采集额外产出木材。','三期工程；完成后增加2床位，每日1份免费餐。','三期工程；完成后每天获得1研究凭证。'][i]}))
};
const step=(title,point,cost={},minutes=30)=>({title,point,cost,minutes});
const choice=(id,label,desc,cost={})=>({id,label,desc,cost});
export const BEVENTS=[
 {id:'frostline',name:'霜线将至',region:'frost',repeat:3,pressure:true,story:'守站人希望在寒潮前决定如何度过这一个工作日。',choices:[choice('warm','加厚驿舍','消耗木布，让驻站居民休息得更好。',{wood:4,cloth:2}),choice('work','搭背风工棚','消耗木材，留出一天额外户外作业窗口。',{wood:6})],steps:[step('记录即将到来的寒潮','frost_weather'),step('完成防寒安排','frost_inn')],reward:'暖房降低居民疲劳；工棚减免一天寒冷消耗。'},
 {id:'reunion',name:'多出来的一副碗筷',region:'pinewood',story:'阿禾把饭碗留给失散的家人。旧商街与雨巷可能有人见过他们。',choices:[choice('escort','亲自接回','两处访问后准备团聚餐。',{bread:3}),choice('guide','雇向导带路','花物资请熟悉街道的人领路。',{parts:2})],steps:[step('向商街餐桌打听',{region:'stationMarket',x:700,y:300}),step('确认雨巷门牌',{region:'courtyard',x:700,y:300}),step('准备团聚餐',{region:'farm',x:830,y:480},{stew:2},60)],reward:'家人入住营地，每天可用1份工作餐换2木材；需要空床位。'},
 {id:'stillwind',name:'静风之后',region:'pinewood',repeat:2,story:'树梢停了一瞬。是进入采脂林的窗口，还是暴风前的短暂平静？',choices:[choice('short','遮面走近路','花布料，带回更多松脂。',{cloth:1}),choice('long','绕行背风坡','多带口粮，带回木材。',{bread:2})],steps:[step('读山坡风标','pinewood_wind'),step('核对林中枝叶','pinewood_resin'),step('标出可返程路线','pinewood_bridge')],reward:'近路松脂3；绕行木材6。完成后一天内林场旅行缩短5分钟。'},
 {id:'reports',name:'两份相反的战报',region:'shelter',repeat:3,pressure:true,story:'一份报告说敌群从东来，另一份写着西岸。现场痕迹能缩小备战范围。',choices:[choice('verify','核对脚印与时刻','付一份口粮；下一轮守家能提前识别来袭方向。',{bread:1}),choice('patrol','布置双向巡逻','多备弹药，减少开战时的敌人数。',{ammo:6})],steps:[step('取回值班记录','shelter_files'),step('勘察河岸足迹',{region:'residential',x:700,y:300}),step('向营地报告',{region:'farm',x:830,y:480})],reward:'核实方向或减少下一轮2名来敌；战报记录实际作用。'},
 {id:'lastmile',name:'最后一段路',region:'shipyard',story:'邵舟伤了腿。他知道河道，但走不到码头。途中可以休息，已经护送的路段会保留。',choices:[choice('care','多带药品','药品换更轻的体力负担。',{bandage:2}),choice('cargo','腾出货物位置','带干粮途中休息。',{bread:3})],steps:[step('在绞盘旁找到邵舟','shipyard_ramp'),step('送到浮桥休息点','shipyard_pontoon',{},60),step('护送到自治会码头','shipyard_ferry',{},60)],reward:'邵舟提供向导服务，船坞与档案岛旅行缩短8分钟。'},
 {id:'cinema',name:'屋顶露天电影',region:'shipyard',repeat:3,story:'旧投影机还能亮。有人想看家园的照片，也有人只想坐下来讲讲过去。',choices:[choice('screen','放映照片','需已有照片与2电；居民疲劳减少25。',{cloth:2}),choice('stories','围坐讲故事','用两份汤招待大家；疲劳减少15。',{stew:2})],steps:[step('布置商街屋顶',{region:'stationMarket',x:410,y:650},{},60),step('邀请居民聚会',{region:'farm',x:830,y:480},{},120)],reward:'居民休息，次日访客带来一次盐与口粮交换。'},
 {id:'safetylamp',name:'失真的安全灯',region:'shelter',story:'绿色灯还亮着，仪表却说这里已经停风。两份独立证据才能证明哪边可信。',choices:[choice('repair','校正灯的含义','用零件修复灯具。',{parts:1}),choice('mark','留下清楚路标','用布条标出可信路线。',{cloth:2})],steps:[step('采集空气读数','shelter_signals'),step('比对旧维修日期','shelter_files'),step('标出真正安全的路','shelter_echo')],reward:'指示室永久校准，走廊敌人移离安全通路。'},
 {id:'airlock',name:'双向气闸',region:'shelter',repeat:3,pressure:true,story:'对面有人等着送药，滤材箱也堵在门口。内外两扇门必须错开。',choices:[choice('people','先送人','交滤材1和工作餐，获得药包。',{filterFabric:1,bread:1}),choice('filters','先送滤材','先花时间运过滤箱，取得更多滤材。',{bread:2})],steps:[step('确认外门已闭合','shelter_lock'),step('交换这一批物资','shelter_lift',{},60)],reward:'送人获得药包2；送滤材获得滤材3。'},
 {id:'mailbag',name:'没有地址的邮袋',region:'shipyard',story:'三封信没有门牌，只写着收信人的工作与窗外的景象。',choices:[choice('community','先投社区信','雨巷的人会回赠种子。'),choice('medical','先投医务信','医院会回赠药品。')],steps:[step('辨认邮戳与收件人','shipyard_post'),step('核对商街地标',{region:'stationMarket',x:1080,y:680}),step('核对雨巷职业',{region:'courtyard',x:410,y:650}),step('把邮袋交给船班','shipyard_post',{bread:1},120)],reward:'开启占一条运输班次的邮运；选择先收到的回信，其余以后可投递。'},
 {id:'blueprint',name:'读反的施工图',region:'archive',story:'图上两个孔位似乎正好相反。先量一量实物，可以少浪费一批材料。',choices:[choice('measure','先量后做','用足工时，直接完成可靠原型。',{parts:2,cloth:2}),choice('cheap','先做小样','省零件，之后补一次布料校正。',{parts:1,cloth:1})],steps:[step('寻找图纸的朝向','archive_vault'),step('比对实物尺寸','archive_prototype'),step('装配并校正原型','archive_prototype',{resin:1},90)],reward:'解锁节省布料的覆脂滤材配方；工程档案可回收1零件。'},
 {id:'woodline',name:'林地红线',region:'pinewood',repeat:3,story:'邻营标出了下一季要留的幼林。你可以换取眼前木材，也可以一起经营再生林。',choices:[choice('quota','遵守轮伐约定','少砍一点，换来持续采脂协作。',{bread:2}),choice('cut','买下应急采伐权','多付工作餐，立即得到木材。',{bread:4})],steps:[step('查看三片林的界线','pinewood_forest'),step('把约定写在互助站','pinewood_coop',{},60)],reward:'轮伐：林场居民每班额外松脂1，持续三天；应急：木材10。'},
 {id:'vines',name:'围墙上的异藤',region:'pinewood',story:'异藤会在浇水后舒展，在声响中收紧。可以剪走，也可以学着让它守住围墙。',choices:[choice('tame','观察后驯养','花材料换一天的家园缓行篱。',{wood:4,bread:1}),choice('cut','剪取可用纤维','先取得布料，之后仍可重新驯养。')],steps:[step('观察晨昏的刺藤','pinewood_thorn',{},60),step('决定围墙的安排',{region:'farm',x:830,y:480})],reward:'驯养开放刺藤篱服务；剪取获得布料4。'},
 {id:'daystreet',name:'白昼的空街',region:'shelter',repeat:3,pressure:true,story:'街上安静得反常，后门里传出睡眠般的喘息。可以趁白天封住，也可以夜里引开。',choices:[choice('block','白天加固后门','消耗木材，留下安全绕行。',{wood:6}),choice('lure','夜晚引向空地','需19点后行动，使用诱饵材料。',{scrap:2})],steps:[step('确认沉睡的敌群',{region:'courtyard',x:1080,y:300}),step('执行封锁或诱导',{region:'courtyard',x:1080,y:680},{},45)],reward:'下一次雨巷探索有一段安全通路；取得零件2。'},
 {id:'cartographer',name:'戴手套的制图员',region:'shelter',story:'柏岚还不能远行。只要有床铺和一张桌子，他愿意从整理旧地图开始。',choices:[choice('station','安排驻站工作','专心绘图，每班获得研究凭证。',{cloth:2}),choice('field','逐步恢复随队能力','先休养再带路；远征旅行更省时间。',{bandage:2})],steps:[step('找到柏岚','shelter_housing'),step('准备桌面与恢复餐',{region:'farm',x:830,y:480},{wood:4,stew:2},120),step('完成第一份路线图',{region:'farm',x:830,y:480},{},120)],reward:'新居民柏岚加入，真实消耗床位和工作餐；可安排驻站或随队。'},
 {id:'dogbridge',name:'狗在桥前停住了',region:'pinewood',story:'桥板下的水声不对劲。即使没有同行的狗，也能从松动的铆钉看出危险。',choices:[choice('repair','修好桥板','木材换更快返程。',{wood:6}),choice('detour','记录犬径','不花材料，多走一段时间。')],steps:[step('检查桥板和铆钉','pinewood_bridge'),step('标记返回小屋的路','pinewood_lodge',{},45)],reward:'保留修桥或绕行成果；已救回的狗开放警戒、等待、回家指令。'},
 {id:'visions',name:'三个明天',region:'archive',story:'有人盼收成，有人盼重逢，有人盼知道这一切因何发生。家园可以先回应一个愿望。',choices:[choice('self','自给的明天','第一期自给工程。'),choice('guest','好客的明天','第一期接待工程。'),choice('knowledge','求知的明天','第一期研究工程。')],steps:[step('听取三种愿望','archive_council'),step('建设第一期公共项目',{region:'farm',x:830,y:480},{wood:10,stew:2,parts:2},180)],reward:'推进所选愿景一期；三期后开放永久服务，可继续完成其他愿景。'},
 {id:'rivertruth',name:'河流没有说谎',region:'archive',story:'水面已经清了，沉积物却留下旧事故的痕迹。真正的源头还在上游管线。',choices:[choice('filter','先保障眼前用水','先用滤材，再修旁路。',{filterFabric:2}),choice('bypass','直接修旁路','投入零件，保留滤材。',{parts:2})],steps:[step('对照事故与水位','archive_incident'),step('采集溪谷对照样本',{region:'valley',x:410,y:650}),step('截断旧污染管线','archive_incident',{wood:8,parts:3},180)],reward:'河道永久净化，林下试种增产，农场每天增加可用水。'},
 {id:'seedcontract',name:'封条上的小字',region:'frost',repeat:4,story:'种子能救急，封条上却写着归还日期。也可以自己留种，少拿一点、少一份义务。',choices:[choice('contract','签种源合同','领取4种子；四天内交4黑麦换6盐，逾期可延期。'),choice('independent','独立留种','领取2种子，交1工作餐，不欠交货。',{bread:1})],steps:[step('读清数量与期限','frost_rye'),step('在种源册上留下约定','frost_rye',{},15)],reward:'合同种子或自由种子确定获得；合同不会滚出无限债务。'},
 {id:'bordertalk',name:'边界会谈',region:'shipyard',story:'邻营愿意共享河道，只是希望你也承担其中一种成本。条约三天后可重选。',choices:[choice('fee','物资通行费','零件换三天更便宜的货运。',{parts:2}),choice('guard','承担守卫班次','安排一名吃饱且有床的居民，换安全航次。',{bread:2}),choice('wood','共享林木配额','木材换来滤材和互助。',{wood:8})],steps:[step('在自治会说明条件','shipyard_ferry'),step('确认三天的约定','shipyard_ferry',{},60)],reward:'条约产生真实成本与运输收益；到期自动释放岗位，免费步行路线一直可用。'},
 {id:'lastferry',name:'最后一班渡船',region:'archive',story:'岛上还有三户人家。船位、食物和家园床位决定这趟撤离如何安排。',choices:[choice('people','优先载人','每批消耗餐食；客船改装减少航次。'),choice('supplies','同时带回生活物资','每批多准备口粮，带回木材和布料。')],steps:[step('确认避风航道','archive_evac'),step('接回第一批家庭','archive_evac',{bread:2,bandage:1},120),step('接回第二批家庭','archive_evac',{bread:2,bandage:1},120),step('接回最后一批家庭','archive_evac',{bread:2,bandage:1},120),step('布置新的家',{region:'farm',x:830,y:480},{wood:12,cloth:6},180)],reward:'三户人家迁入；保留每批撤离进度，解锁长期援建与真实生产互助。'}
];
export const BEVENT_BY_ID=Object.fromEntries(BEVENTS.map(e=>[e.id,e]));
export const BWEATHER=['晴朗','晴朗','小雨','高温','暴雨','晴朗','酸雨'];
