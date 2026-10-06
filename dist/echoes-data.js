// Original event content; source links describe borrowed mechanisms, never borrowed art.
const at=(region,x,y)=>({region,x,y});
const camp=at('farm',790,595), home=at('residential',745,525), hospital=at('hospital',745,525), warehouse=at('warehouse',745,525);
const step=(title,kind='visit',cost={},loc=camp,extra={})=>({title,kind,cost,loc,...extra});
const wait=(title,cost,loc,minutes,extra={})=>step(title,'wait',cost,loc,{minutes,...extra});
const fight=(title,loc,count,theme='slow',cost={})=>step(title,'fight',cost,loc,{count,theme});
const option=(id,label,result,steps,extra={})=>({id,label,result,steps,...extra});
export const PRESSURE={factor:1.5,loot:2/3,growth:2/3,damage:1.5,hunger:1.5,enemyHealth:1.25,enemySpeed:1.1,purchase:1.5};
export const ECHO_EVENTS=[
 {id:'convoy',n:1,name:'封路的粮食车队',pillar:'expedition',unlock:'residential',hook:'护送一次，换来稳定销路。',text:'车队被旧桥外的废车堵住。带去工具，或帮助他们清理道路；粮食以后可以换回种子和金属。',source:'Surviving the Aftermath',url:'https://www.paradoxinteractive.com/games/surviving-the-aftermath/about',cooldown:7,options:[
 option('repair','修车开路','开放车队回程贸易：3干粮换种子或金属。',[wait('修复受困车队',{wood:6,parts:2},home,45),step('到农场接收车队')]),
 option('escort','武装护送','同样开放贸易；节约零件，但需要战斗与弹药。',[fight('清理车队路线',home,4,'slow',{ammo:12}),step('到农场迎接护送队')])]},
 {id:'drought',n:2,name:'水渠的第一场旱季',pillar:'farm',unlock:'canal',hook:'提前调闸，看到新田受益。',text:'未来一天水流偏弱。现在调整供水，把一次旱期变成永久水利改良。只影响扩建田，水塔供水范围不受影响。',source:'Timberborn',url:'https://store.steampowered.com/app/1062090/Timberborn/',cooldown:8,options:[
 option('reserve','保水与蓄水','首次水壶容量+6；本次保住新田成长。',[step('在水渠检查闸门','visit',{},at('farm',1110,760)),wait('建立蓄水旁路',{wood:4},at('farm',1110,760),90)]),
 option('branch','引流到新田','首次水渠灌溉半径从190扩大至240。',[wait('铺设田间旁路',{wood:6,stone:2},at('farm',1110,760),90),step('检查新田','visit',{},at('farm',980,685))])]},
 {id:'seedwall',n:3,name:'粮库里的湿墙',pillar:'farm',unlock:'grainContract',hook:'保种或试种，形成自己的作物路线。',text:'粮库里有一箱受潮种子。修好棚子留下耐旱豆种，或者在温室试出早熟棉花。已有仓库物资不会被事件损毁。',source:'Endzone — A World Apart',url:'https://store.steampowered.com/app/933820/Endzone__A_World_Apart/',cooldown:10,options:[
 option('hardy','修棚保种','首次耐旱豆种×3、耐旱豆类进入育种档案。',[wait('修好防雨棚',{wood:4,cloth:2},home,60),step('阿禾检查种箱','visit',{},camp,{resident:'farmer'})]),
 option('fast','温室试种','首次早熟棉种×3、早熟棉花进入育种档案。',[step('送去棉花试样','visit',{cotton:3},camp,{building:'greenhouse'}),step('亲手或由居民收获3株作物','harvest',{},camp,{count:3})])]},
 {id:'loadtest',n:4,name:'陈工的满负荷测试',pillar:'production',unlock:'powerPlans',hook:'解决产能瓶颈，选择永久改装。',text:'陈工要用三批成品检验产线。完成后选择调度或保养；另一项以后可以付费改装。',source:'IXION',url:'https://store.steampowered.com/app/1113120/IXION/',cooldown:12,options:[
 option('dispatch','优化供给调度','首次开放第4条同时运行的供给计划。',[step('陈工安装测试表','visit',{parts:2},camp,{resident:'mechanic'}),step('完成并领取3份干粮','produce',{},camp,{item:'bread',count:3}),step('完成调度改装')]),
 option('maintenance','优化机械保养','首次无人机每12次作业维护一次，原为10次。',[step('陈工安装测试表','visit',{parts:2},camp,{resident:'mechanic'}),step('完成并领取3份干粮','produce',{},camp,{item:'bread',count:3}),step('完成机械改装')])]},
 {id:'solar',n:5,name:'太阳能板失联',pillar:'production',unlock:'solar',hook:'诊断设备，掌握未来停工原因。',text:'阵列出现接线异常。检修期间太阳能暂停；可以立即用材料修好，也可以关闭无人机并等待天亮恢复。',source:'Project Zomboid',url:'https://store.steampowered.com/app/108600/Project_Zomboid/',cooldown:9,options:[
 option('diagnose','修复并记录故障','首次开放维护预警；以后有故障提前提示。',[wait('检修太阳能接线',{scrap:4,parts:1},at('farm',1090,410),60),step('陈工记录诊断','visit',{},camp,{resident:'mechanic'})]),
 option('reserve','停机节电后恢复','等待较久；完成后电力储备+20。',[wait('关闭设备并重新接线',{},at('farm',1090,410),360),step('重启阵列')])]},
 {id:'slowgroup',n:6,name:'迟钝尸群的窗口',pillar:'defense',unlock:'hordeWon',hook:'抓住敌群弱点，主动取回设备。',text:'住宅外围的一小群感染者动作迟缓。清理或安静回收都可利用这次窗口；普通尸潮不会因此消失。',source:'State of Decay 2',url:'https://steamcommunity.com/app/495420/announcements/?l=english',cooldown:7,options:[
 option('clear','带料理清理尸群','零件×3、废金属×4；住宅两天降低发现范围。',[fight('清理迟钝尸群',at('residential',990,680),5,'slow',{stew:1}),step('确认清理结果','visit',{},home)]),
 option('salvage','趁窗口回收电路','电路×1；住宅两天降低发现范围。',[wait('低声拆下旧控制器',{stone:1},at('residential',990,680),75),step('向前哨报告','visit',{},home)])]},
 {id:'drill',n:7,name:'防线盲点演习',pillar:'defense',unlock:'tower',hook:'布局的效果用战报证明。',text:'六名试探者接近营地。你选择方向，准备好再开战。此演习不与普通尸潮同时进行，失败可免费重试已投入的步骤。',source:'They Are Billions',url:'https://store.steampowered.com/app/644930/They_Are_Billions/',cooldown:7,options:[
 option('west','西侧近战绕行','首次陷阱材料包与纪念旗；详细报告记录布局贡献。',[fight('西侧防线演习',at('farm',810,680),6,'slow'),step('检查突破位置')],{direction:2}),
 option('south','南侧装甲试探','首次塔楼材料包与纪念旗；装甲敌人需要调整攻击。',[fight('南侧防线演习',at('farm',810,680),6,'armor'),step('检查突破位置')],{direction:1})]},
 {id:'nightclinic',n:8,name:'医院的长夜',pillar:'residents',unlock:'clinicStory',hook:'作物、医生和医疗产线共同救人。',text:'三名临时伤员来到营地。用药包迅速治疗，或让许医生用草药和绷带照护。获救者会带来复诊委托。',source:'This War of Mine',url:'https://store.steampowered.com/app/282070/This_War_of_Mine/',cooldown:8,options:[
 option('kits','使用成品药包','医生治疗能力+4生命；开启复诊物资交换。',[wait('为伤员治疗',{medkit:2},camp,45,{resident:'medic'}),step('送别康复者')]),
 option('care','医生值班护理','材料较便宜，医生暂停其他岗位120分钟；获得同样能力。',[wait('照护临时病床',{bandage:4,herb:4},camp,120,{resident:'medic'}),step('送别康复者')])]},
 {id:'signal',n:9,name:'返航无人机的最后信号',pillar:'expedition',unlock:'expeditions',hook:'装载有取舍，落下物资还能重访。',text:'定位箱内有三种货物，只能先带走两种。未选物资留在现场寄存箱，回营后可再次取回。',source:'ZERO Sievert',url:'https://store.steampowered.com/app/1782120/ZERO_Sievert/',cooldown:9,options:[
 option('repairMed','维修与医疗','带回零件与药品；电路留在现场。首次回营后行囊+2格。',[step('装载维修和医疗箱','cargo',{},at('warehouse',990,690),{carry:{parts:3,medkit:1,bandage:2},cache:{circuit:1,scrap:3}}),step('把物资带回营地')]),
 option('circuitMed','电路与医疗','带回电路与药品；维修材料留在现场。首次回营后行囊+2格。',[step('装载电路和医疗箱','cargo',{},at('warehouse',990,690),{carry:{circuit:1,scrap:3,medkit:1,bandage:2},cache:{parts:3}}),step('把物资带回营地')]),
 option('repairCircuit','维修与电路','带回工程材料；医疗箱留在现场。首次回营后行囊+2格。',[step('装载两箱工程物资','cargo',{},at('warehouse',990,690),{carry:{parts:3,circuit:1,scrap:3},cache:{medkit:1,bandage:2}}),step('把物资带回营地')])]},
 {id:'coldroom',n:10,name:'冷藏间重新亮灯',pillar:'production',unlock:'warehouse',hook:'熟悉的废墟变成可重复服务点。',text:'仓库侧室仍有完整冷藏设备。维修可获得长期食品服务；拆解则拿到立即可用的零件，以后仍可重建。',source:'Sheltered',url:'https://store.steampowered.com/app/356040/Sheltered/',cooldown:10,options:[
 option('restore','恢复冷藏设备','开启每7天一次：免费领取干粮×2、炖汤×1。',[wait('修复备用电源',{parts:2,circuit:1},at('warehouse',1120,690),90),step('向物流前哨交接','visit',{},warehouse)]),
 option('dismantle','拆下设备零件','零件×3、废金属×4；之后可重新投入材料恢复服务。',[wait('拆解停机设备',{},at('warehouse',1120,690),60),step('搬运回收材料','visit',{},warehouse)])]},
 {id:'mentor',n:11,name:'旧维修员的求助',pillar:'residents',unlock:'mechanicStory',hook:'救回知识，形成工具升级路线。',text:'陈工的同事带着维修手册被困仓库。救援后他会短期授课，永久留下节材维修或高效拆解技巧。',source:'Judgment',url:'https://store.steampowered.com/app/455980/Judgment_Apocalypse_Survival_Simulation/',cooldown:12,options:[
 option('repair','学习节材维修','手动维修材料由2木材降为1木材。',[step('送急救物资','visit',{medkit:1},at('warehouse',1180,730)),fight('清理被堵的出口',at('warehouse',1180,730),3),wait('听完维修课',{},camp,60,{resident:'mechanic'})]),
 option('salvage','学习高效拆解','每次环境拆解多回收1份废金属。',[step('送急救物资','visit',{medkit:1},at('warehouse',1180,730)),fight('清理被堵的出口',at('warehouse',1180,730),3),wait('听完拆解课',{},camp,60,{resident:'mechanic'})])]},
 {id:'migration',n:12,name:'雨后的鱼群迁徙',pillar:'farm',unlock:'fishCanal',hook:'连接水域之后才出现的新发现。',text:'水渠通了，雨后的池塘有鱼群迁入。准备鱼篓拿收成，或在岸边取样调查水质。',source:'Stranded: Alien Dawn',url:'https://store.steampowered.com/app/1324130/Stranded_Alien_Dawn/',cooldown:8,options:[
 option('fish','布置迁徙鱼篓','银鳞鱼×3，可做料理或订单。',[wait('安放临时鱼篓',{wood:2},at('farm',1050,815),120),step('提起迁徙鱼篓','visit',{},at('farm',1050,815))]),
 option('sample','观察并检验水样','新增净水证据；以后雨日鱼篓每3天可额外产1蓝背鱼。',[step('在岸边取得水样','visit',{},at('farm',1050,815)),wait('用药草检验',{herb:1},camp,60)])]},
 {id:'classroom',n:13,name:'阿禾的小课堂',pillar:'residents',unlock:'farmerStory',hook:'居民成长开始惠及其他地区。',text:'一名学徒希望把种植办法带回住宅前哨。准备教学牌和工作餐，再用五株收成完成实地示范。',source:'Fallout Shelter',url:'https://store.steampowered.com/app/588430/Fallout_Shelter/',cooldown:12,options:[
 option('seeds','教保种','住宅前哨每次种子交换多1颗。',[step('准备教学牌','visit',{bread:2,wood:2},camp,{resident:'farmer'}),step('示范收获5株作物','harvest',{},camp,{count:5}),step('学徒完成保种课')]),
 option('water','教节水','阿禾工作期间，玩家每3次手动浇水有1次不耗水。',[step('准备教学牌','visit',{bread:2,wood:2},camp,{resident:'farmer'}),step('示范收获5株作物','harvest',{},camp,{count:5}),step('学徒完成节水课')])]},
 {id:'watch',n:14,name:'谁来守这一夜',pillar:'defense',unlock:'threeResidents',hook:'守夜和生产之间作出真实选择。',text:'下一次袭击前，居民讨论轮班。轮班侦察会占用每人下一次工作；也可以花木材搭警戒路障，让大家休息。',source:'Dead State',url:'https://store.steampowered.com/app/239840/Dead_State_Reanimated/',cooldown:7,options:[
 option('shifts','轮班侦察','下一次普通或章节尸潮减少3人；3名居民各少一个工作班次。',[wait('安排侦察轮班',{},camp,180),step('记录值夜安排')]),
 option('barrier','让居民休息并搭路障','农场出现一处有真实耐久的警戒围栏。',[wait('搭好入口路障',{wood:6},at('farm',1340,650),90),step('记录值夜安排')])]},
 {id:'letter',n:15,name:'一封没寄出的家书',pillar:'residents',unlock:'finishedStory',hook:'完成旧故事以后还有新的生活。',text:'居民在档案里找到一封没寄出的家书。陪他去看旧地点，或在家里建一个私人角落。',source:'Dead In Vinland',url:'https://store.steampowered.com/app/573120/Dead_In_Vinland/',cooldown:12,options:[
 option('photo','陪同拍下旧地点','照片留在事件档案；该居民休息恢复疲劳加快。',[step('在住宅旧址拍照','photo',{},at('residential',1020,700)),step('把照片带给居民')]),
 option('corner','布置私人角落','营地出现纪念角落；该居民休息恢复疲劳加快。',[wait('建造私人纪念角落',{wood:4,cloth:1},camp,90),step('居民读完家书')])]},
 {id:'returngift',n:16,name:'两天后的一顿回礼',pillar:'residents',unlock:'surplus',hook:'一次帮助留下确定的后续回应。',text:'路过的家庭需要食物。两天后他们一定回访，按你的选择带回种子或布料。等待按游戏时间计算。',source:'This War of Mine',url:'https://store.steampowered.com/app/282070/This_War_of_Mine/',cooldown:9,options:[
 option('seeds','提供面包，约好带种子','两天后获得棉花种子×3、药草种子×2。',[step('给路过家庭送粮','visit',{bread:3}),wait('等待家人回访',{},camp,2880),step('接收种子回礼')]),
 option('cloth','提供土豆和安全路线','两天后获得布料×3、绷带×1。',[step('准备食物与路线','visit',{potato:2,stone:1}),wait('等待家人回访',{},camp,2880),step('接收布料回礼')])]},
 {id:'openhouse',n:17,name:'前哨开放日',pillar:'production',unlock:'cooperation',hook:'看到生产成果让一个地区热闹起来。',text:'协作站准备开放日。举办农产展示或医疗服务，接下来的三份合同会带回相应额外支援。',source:'Endzone 2',url:'https://store.steampowered.com/app/2144640/Endzone_2/',cooldown:7,options:[
 option('market','举办农产展示','随后3份合同额外送回1棉花种子；前哨出现摊位。',[step('准备展示食品','visit',{bread:4,jam:2}),step('在住宅前哨布展','visit',{},home),wait('举行交换日',{},home,120)]),
 option('clinic','举办健康服务日','随后3份合同额外送回1药草；前哨出现访客。',[step('准备便当和药草','visit',{beanMeal:2,herb:4}),step('在医院前哨布展','visit',{},hospital),wait('举行服务日',{},hospital,120)])]},
 {id:'bigorder',n:18,name:'一份做得完的大订单',pillar:'production',unlock:'network',hook:'分批结算，让生产链有清楚的终点。',text:'运输队提出三批订单，每批先加工再交付，并立即结算25金币。最后开放长期采购折扣。订单不会离线过期。',source:'Mr. Prepper',url:'https://store.steampowered.com/app/761830/Mr_Prepper/',cooldown:10,options:['bread','cloth','medkit'].map((item,i)=>option(item,['食品路线','纺织路线','医疗路线'][i],'每批25金币；首次完成后采购价降低10%。',[...Array.from({length:3},(_,k)=>[step('加工第'+(k+1)+'批','produce',{},camp,{item,count:item==='medkit'?1:2}),step('交付第'+(k+1)+'批','visit',{[item]:item==='medkit'?1:2},camp,{money:25})]).flat()]))},
 {id:'secondreport',n:19,name:'滤网背后的第二份报告',pillar:'research',unlock:'endgame',hook:'找到答案后，新能力打开新机会。',text:'广播后收到第二份污染报告。去医院与仓库实地比对，选择工程诊断或植物证据路线。',source:'Surviving the Aftermath',url:'https://www.paradoxinteractive.com/games/surviving-the-aftermath/about',cooldown:0,options:[
 option('equipment','设备诊断','新增过滤记录；扩建农田在酸雨和暴雨中成长额外提高25%。',[step('读取医院滤网记录','visit',{},hospital),wait('诊断仓库回流设备',{circuit:1,parts:2},warehouse,90),step('在营地汇总第二份报告')]),
 option('plants','植物比对','新增植物证据；两天预报显示扩建田的建议与风险。',[step('比对医院药草','visit',{herb:1},hospital),step('比对仓库豆类','visit',{bean:1},warehouse),step('汇总番茄对照样本','visit',{tomato:1},camp)])]},
 {id:'renewal',n:20,name:'复兴守望计划',pillar:'research',unlock:'hubEndgame',hook:'通关后继续经营原来的世界。',text:'其他营地请求建立常驻联络点。准备粮食、医疗、防御三批物资；选择护送或缓慢分批运送，最终开放新伙伴合同。',source:'Infection Free Zone',url:'https://store.steampowered.com/app/1465460/Infection_Free_Zone/',cooldown:14,options:[
 option('agriculture','护送农业伙伴','仓库出现安全联络点；3干粮换3豆种与1零件，每日一次。',[step('准备粮食箱','visit',{bread:3}),step('准备医疗箱','visit',{bandage:2,herb:2}),step('准备防御箱','visit',{wood:6,ammo:6}),fight('护送新伙伴',at('warehouse',1000,680),4,'runner'),wait('布置农业联络点',{},warehouse,60)]),
 option('medical','分批运送医疗伙伴','仓库出现安全联络点；3药草换1药包与1布料，每日一次。',[wait('运送粮食箱',{bread:3},camp,240),wait('运送医疗箱',{bandage:2,herb:2},camp,240),wait('运送防御箱',{wood:6,ammo:6},camp,240),wait('布置医疗联络点',{},warehouse,60)])]}
];
export const EVENT_IDS=ECHO_EVENTS.map(x=>x.id);
export const BENEFIT_NAMES={convoy:'车队回程贸易',drought:'水渠改良',seedwall:'特性种子档案',loadtest:'产线改装',solar:'故障诊断',slowgroup:'地区安全窗口',drill:'防线纪念旗',nightclinic:'医生治疗成长',signal:'行囊整理',coldroom:'冷藏间服务',mentor:'导师传承',migration:'迁徙水域记录',classroom:'种植课堂',watch:'值夜安排',letter:'家书与纪念',returngift:'回访记录',openhouse:'前哨开放日',bigorder:'长期采购目录',secondreport:'第二份调查报告',renewal:'复兴联络点'};
