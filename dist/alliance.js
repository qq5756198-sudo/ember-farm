// 联盟前哨 · v0.13.0「联盟来信」：在既有家园系统之上增加故事进度与援建队员。
// 只新增 storyCampaign 字段；所有扣除、奖励、搬运都走已有的仓库、加工与居民路径。
import {
  Engine as GuidanceEngine,
  freshState as guidanceFresh,
  migrateState as guidanceMigrate,
} from "./guidance-engine.js";
import { ITEMS, CROPS, WORLD, BUILDINGS } from "./data.js";
import {
  STORY_SCHEMA,
  STORY_IDS,
  HELPERS,
  HELPER_TASKS,
  LETTER_IDS,
  WELL_SPOT,
  TERMINAL_SPOT,
  WELL_COST,
  CAMP_COST,
  TROUGH_PLOTS,
  ACT2_REWARD,
  NEIGHBOR_SPOT,
  NEIGHBOR_COST,
  NEIGHBOR_GIFT,
  SUPPLY,
  CAMP_CANDIDATES,
  TABLE_SEATS,
  bundleText,
  missingCost,
  storyGoal,
} from "./alliance-data.js";

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const defaults = () => ({
  schema: STORY_SCHEMA,
  act: 1,
  flags: { well: false, camp: false, farmerFed: false },
  site: null,
  camp: null,
  choice: null,
  claimed: [],
  helpers: [],
  letters: ["act1"],
  unread: true,
  log: [],
  veteran: false,
  wellDay: 0,
  neighborDay: 0,
  neighborHelps: 0,
});
const HELPER_KEYS = [
  "id",
  "role",
  "x",
  "y",
  "facing",
  "target",
  "fedDay",
  "hungryDay",
  "status",
  "task",
  "moved",
];

export function migrateState(s) {
  guidanceMigrate(s);
  const d = defaults();
  if (!s.storyCampaign) {
    // 旧档从一封联络信接入：已有成果按真实记录计入，不重新上锁也不补发奖励。
    d.veteran = (s.rebuild?.claimed?.length || 0) > 0 || (s.stats?.harvested || 0) > 0 || s.day > 1;
    s.storyCampaign = d;
  } else {
    const sc = s.storyCampaign;
    s.storyCampaign = { ...d, ...sc, flags: { ...d.flags, ...sc.flags } };
  }
  return s;
}
export const freshState = () => migrateState(guidanceFresh());
export const needsStoryMigration = (text) => {
  try {
    const raw = JSON.parse(text);
    return !!raw && typeof raw === "object" && !raw.storyCampaign;
  } catch {
    return false;
  }
};

export class Engine extends GuidanceEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(migrateState(s), notify);
    this.assignRegion();
  }
  get sc() {
    return this.s.storyCampaign;
  }
  storyGoal() {
    return storyGoal(this);
  }
  storyLog(text) {
    this.sc.log.unshift({ day: this.s.day, text });
    this.sc.log = this.sc.log.slice(0, 12);
  }
  helperName(id) {
    return HELPERS[id]?.name || "援建队员";
  }

  // ---------- 场景对象 ----------
  campSpotFree(p, strict = true) {
    if (p.x < 120 || p.y < 120 || p.x > WORLD.w - 120 || p.y > WORLD.h - 90) return false;
    if (dist(p, this.region?.exit || { x: 1440, y: 392 }) < 160) return false;
    if (this.blocked(p.x, p.y, false, 34)) return false;
    if (this.s.plots.some((q) => Math.abs(q.x - p.x) < 62 && Math.abs(q.y - p.y) < 58)) return false;
    const pad = strict ? 1 : 0.6;
    for (const b of this.s.buildings) {
      const d = BUILDINGS[b.type];
      if (d && Math.abs(b.x - p.x) < d.w / 2 + 60 * pad && Math.abs(b.y - p.y) < d.h / 2 + 50 * pad) return false;
    }
    const fixed = [
      { x: 328, y: 315 },
      WELL_SPOT,
      TERMINAL_SPOT,
      { x: 695, y: 300 },
      { x: 820, y: 300 },
      { x: 1190, y: 550 },
      { x: 1390, y: 480 },
      { x: 1040, y: 820 },
      { x: 735, y: 570 },
      { x: 905, y: 320 },
      { x: 1220, y: 390 },
      { x: 875, y: 570 },
    ];
    if (fixed.some((o) => dist(o, p) < 95 * pad)) return false;
    return !(this.objects || []).some(
      (o) =>
        !["resident", "allianceHelper", "allianceSite", "partnerDog", "plot"].includes(o.type) &&
        dist(o, p) < 85 * pad,
    );
  }
  campSite() {
    const sc = this.sc;
    if (!sc) return null;
    if (sc.camp) return sc.camp;
    // 只在农场按农场地形挑选；外出时沿用上次选好的空地。
    if (this.s.region !== "farm") return sc.site;
    if (sc.site && this.campSpotFree(sc.site, false)) return sc.site;
    let site = CAMP_CANDIDATES.find((p) => this.campSpotFree(p));
    for (let y = 420; !site && y <= 900; y += 40)
      for (let x = 200; !site && x <= 1340; x += 40) if (this.campSpotFree({ x, y })) site = { x, y };
    // 农场很拥挤时放宽间距，仍不压住建筑、田地和地形。
    for (let y = 400; !site && y <= 920; y += 20)
      for (let x = 160; !site && x <= 1360; x += 20) if (this.campSpotFree({ x, y }, false)) site = { x, y };
    sc.site = site ? { x: site.x, y: site.y } : null;
    return sc.site;
  }
  assignRegion() {
    super.assignRegion();
    const sc = this.s.storyCampaign;
    if (sc && this.s.region === NEIGHBOR_SPOT.region && sc.claimed.includes("act2"))
      this.objects.push({ type: "allianceNeighbors", name: "邻里互助点", x: NEIGHBOR_SPOT.x, y: NEIGHBOR_SPOT.y, icon: 57 });
    if (!sc || this.s.region !== "farm") return;
    const sign = this.objects.find((o) => o.type === "sign");
    if (sign) sign.name = "联盟终端 · 家园留言板";
    if (sc.camp)
      this.objects.push({ type: "allianceCamp", name: "援建营地", x: sc.camp.x, y: sc.camp.y, icon: 40 });
    else {
      const site = this.campSite();
      if (site)
        this.objects.push({ type: "allianceSite", name: "援建营地空地", x: site.x, y: site.y, icon: 40 });
    }
    for (const h of sc.helpers)
      this.objects.push({
        type: "allianceHelper",
        helper: h.id,
        name: this.helperName(h.id) + " · 援建队",
        x: h.x,
        y: h.y,
        icon: 40,
      });
  }
  nearestObject() {
    // 终端有新信或可以回信时，站在旁边的居民不挡住它。
    const sc = this.s.storyCampaign,
      p0 = this.s.player;
    if (sc && this.s.region === "farm" && (sc.unread || this.canReply())) {
      const sign = (this.objects || []).find((o) => o.type === "sign");
      if (sign && dist(sign, p0) < 82) {
        const o = this.nearestHelperless();
        if (!o || o.type === "resident") return sign;
        return o;
      }
    }
    return this.nearestHelperless(true);
  }
  nearestHelperless(allowHelper = false) {
    // 走动中的援建队员不抢占农田、设施的 E 交互；身边没有别的对象时才和他说话。
    const helpers = (this.objects || []).filter((o) => o.type === "allianceHelper");
    if (!helpers.length) return super.nearestObject();
    const all = this.objects;
    this.objects = all.filter((o) => o.type !== "allianceHelper");
    let o;
    try {
      o = super.nearestObject();
    } finally {
      this.objects = all;
    }
    if (o || !allowHelper) return o;
    const p = this.s.player;
    return helpers.filter((h) => dist(h, p) < 70).sort((a, b) => dist(a, p) - dist(b, p))[0] || null;
  }
  context(o) {
    const sc = this.sc;
    if (sc && o) {
      if (o.type === "sign")
        return this.canReply()
          ? "联盟终端 · 回信报告"
          : sc.unread
            ? "联盟终端 · 读新来信"
            : "联盟终端 · 来信与任务";
      if (o.type === "well" && !sc.flags.well) return "修好水井辘轳 · " + bundleText(WELL_COST);
      if (o.type === "allianceSite") return "搭起援建营地 · " + bundleText(CAMP_COST);
      if (o.type === "allianceCamp") {
        const h = sc.helpers[0];
        return h ? "援建营地 · " + this.helperName(h.id) + "：" + h.status : "援建营地 · 等援建队员抵达";
      }
      if (o.type === "allianceNeighbors")
        return sc.neighborDay === this.s.day
          ? "邻里互助点 · 今天已经互助过"
          : "邻里互助 · " + bundleText(NEIGHBOR_COST) + " 换 " + bundleText(NEIGHBOR_GIFT);
      if (o.type === "allianceHelper") {
        const h = sc.helpers.find((x) => x.id === o.helper);
        return "和" + this.helperName(o.helper) + "说话 · " + (h?.status || "待命");
      }
    }
    return super.context(o);
  }
  interact() {
    if (this.paused) return;
    const sc = this.sc,
      o = this.nearestObject();
    if (sc && o) {
      if (o.type === "sign") {
        if (this.canReply()) {
          this.replyAlliance();
          this.emit("menu", { menu: "journey" });
          return;
        }
        sc.unread = false;
        this.emit("menu", { menu: "journey" });
        return;
      }
      if (o.type === "well" && !sc.flags.well) {
        const lack = missingCost(this, WELL_COST);
        if (!lack.length) this.repairWell();
        const result = super.interact();
        if (lack.length) this.toast("修水井还缺：" + lack.join("、") + "。清理田里的杂物或去集市换。", "warn");
        return result;
      }
      if (o.type === "allianceSite") {
        this.buildCamp();
        return;
      }
      if (o.type === "allianceCamp") {
        this.emit("menu", { menu: "journey" });
        return;
      }
      if (o.type === "allianceHelper") {
        this.talkHelper(o.helper);
        return;
      }
      if (o.type === "allianceNeighbors") {
        this.neighborAid();
        return;
      }
    }
    const result = super.interact();
    this.checkStory();
    return result;
  }

  clearMark(spot = null) {
    // 目标完成后撤下金色路标；指向别处的新路标保留。
    const t = this.guidance.target;
    if (!spot || (t && t.region === (spot.region || "farm") && dist(t, spot) < 45)) this.guidance.target = null;
    this.emit("clearTarget");
  }

  // ---------- 第一段：收到回信 ----------
  troughWater() {
    let n = 0;
    for (const p of this.s.plots)
      if (p.id < TROUGH_PLOTS && !p.rebuildNew && p.crop && !this.plotWatered(p)) {
        this.waterPlot(p);
        n++;
      }
    this.sc.wellDay = this.s.day;
    return n;
  }
  repairWell() {
    const sc = this.sc;
    if (!sc || sc.flags.well) return false;
    if (this.s.region !== "farm" || dist(this.s.player, WELL_SPOT) > 120) {
      this.toast("走到旧水井旁，再修辘轳和水槽。", "warn");
      return false;
    }
    const lack = missingCost(this, WELL_COST);
    if (lack.length || !this.takeFarm(WELL_COST)) {
      this.toast("修水井还缺：" + lack.join("、") + "。", "warn");
      return false;
    }
    sc.flags.well = true;
    this.clearMark(WELL_SPOT);
    const n = this.troughWater();
    this.storyLog("修好水井辘轳和水槽：每天清晨自动浇灌第一排田。");
    this.toast(
      "水井修好了：水槽" +
        (n ? "已给第一排" + n + "株作物浇透" : "已经通到第一排田") +
        "，此后每天清晨自动放水。",
      "gold",
    );
    this.particlesAt(WELL_SPOT.x, WELL_SPOT.y - 20, "#89c6d0", 18);
    this.emit("quest");
    return true;
  }
  buildCamp() {
    const sc = this.sc;
    if (!sc || sc.camp) return false;
    const site = this.campSite();
    if (!site) {
      this.toast("农场没有能搭帐篷的空地，先回收一处闲置设施。", "warn");
      return false;
    }
    if (this.s.region !== "farm" || dist(this.s.player, site) > 120) {
      this.toast("走到营地空地，再搭帐篷和火盆。", "warn");
      return false;
    }
    const lack = missingCost(this, CAMP_COST);
    if (lack.length || !this.takeFarm(CAMP_COST)) {
      this.toast("搭营地还缺：" + lack.join("、") + "。", "warn");
      return false;
    }
    sc.camp = { x: site.x, y: site.y };
    sc.flags.camp = true;
    this.clearMark(site);
    this.navRevision++;
    this.assignRegion();
    this.storyLog("搭起援建营地：帐篷、火盆和一圈能坐人的木墩。");
    this.toast("援建营地搭好了。援建队员到了就住这里，开饭时大家会围着火盆坐下。", "gold");
    this.particlesAt(site.x, site.y - 20, "#e7c27a", 16);
    this.emit("quest");
    return true;
  }
  replyReason() {
    const sc = this.sc,
      list = [];
    if (!this.r.claimed.includes("harvest")) list.push("记录第一份收成");
    if (!this.r.claimed.includes("meal")) list.push("做出第一份干粮");
    if (!sc.flags.well) list.push("修好水井");
    if (!sc.flags.camp) list.push("搭起援建营地");
    return list.join("、");
  }
  canReply() {
    const sc = this.sc;
    return (
      !!sc &&
      sc.act === 1 &&
      !sc.claimed.includes("act1") &&
      this.s.region === "farm" &&
      !this.replyReason()
    );
  }
  replyAlliance() {
    const sc = this.sc;
    if (!sc || sc.claimed.includes("act1")) return false;
    if (this.s.region !== "farm") {
      this.toast("回到农场，在联盟终端回信。", "warn");
      return false;
    }
    const reason = this.replyReason();
    if (reason) {
      this.toast("回信前还要：" + reason + "。", "warn");
      return false;
    }
    sc.claimed.push("act1");
    sc.act = 2;
    this.clearMark();
    this.putStorage({ bread: 2 });
    this.addHelper("tieqiao");
    if (!sc.letters.includes("act2")) sc.letters.push("act2");
    sc.unread = true;
    const t = this.taskDestination("farmer");
    if (!this.r.claimed.includes("farmer") && t) {
      this.guidance.focus = null;
      this.guidance.target = { region: t.region, x: t.x, y: t.y, label: t.label || "住宅区求援" };
      this.d.track = null;
      this.b.track = null;
    }
    this.storyLog("回信发出。援建队员铁锹抵达营地。");
    this.toast("回信已发出。援建队员铁锹到了营地，带来 2 份干粮（已入仓）。", "gold");
    this.toast("小柒：住宅区的求援信号已标在地图上。", "gold");
    this.emit("quest");
    return true;
  }
  addHelper(id) {
    const sc = this.sc;
    if (!HELPERS[id] || sc.helpers.some((h) => h.id === id)) return false;
    const camp = sc.camp || this.campSite() || { x: 830, y: 480 },
      spot = { x: camp.x + 64, y: camp.y + 20 };
    sc.helpers.push({
      id,
      role: HELPERS[id].role,
      x: spot.x,
      y: spot.y,
      facing: 0,
      target: { ...spot },
      fedDay: 0,
      hungryDay: 0,
      status: "刚到营地，正在放行李",
      task: "idle",
      moved: 0,
    });
    if (this.s.region === "farm") this.assignRegion();
    return true;
  }
  talkHelper(id) {
    const h = this.sc.helpers.find((x) => x.id === id),
      d = HELPERS[id];
    if (!h || !d) return false;
    const line =
      h.fedDay !== this.s.day && this.s.minute >= 360
        ? d.hungry
        : h.moved
          ? d.lines[(this.s.day + h.moved) % d.lines.length]
          : d.arrive;
    this.toast(d.name + "：" + line + "（" + d.roleName + " · 已搬运 " + h.moved + " 趟）");
    return true;
  }

  // ---------- 第二段：今天吃饭的人 ----------
  chooseSupply(kind) {
    const sc = this.sc,
      pack = SUPPLY[kind];
    if (!sc || !pack) return false;
    if (sc.choice) {
      this.toast("第一批援建物资已经选过了。");
      return false;
    }
    if (sc.act < 2) {
      this.toast("先回信，联络站才会安排援建物资。", "warn");
      return false;
    }
    sc.choice = kind;
    if (!sc.claimed.includes("supply")) sc.claimed.push("supply");
    this.putStorage(pack.items);
    let carried = false;
    if (this.s.region === "farm")
      for (const id of Object.keys(pack.items))
        if (ITEMS[id].type === "seed") carried = this.transfer(id, false, true) || carried;
    if (CROPS[pack.plan]) this.r.farmPlan = pack.plan;
    this.storyLog(pack.name + "送到：" + bundleText(pack.items) + "。");
    this.toast(
      pack.name + "送到了：" + bundleText(pack.items) + (carried ? "。种子已放进背包，其余在仓库。" : "，都在农场仓库。"),
      "gold",
    );
    this.emit("quest");
    return true;
  }
  collectProduction(id) {
    const ok = super.collectProduction(id);
    if (ok) this.checkStory();
    return ok;
  }
  storeProduction(id, automatic = false) {
    const ok = super.storeProduction(id, automatic);
    if (ok && !automatic) this.checkStory();
    return ok;
  }
  recruit(id) {
    const ok = super.recruit(id);
    if (ok) this.checkStory();
    return ok;
  }
  feedFarmer() {
    if (this.s.region !== "farm") {
      this.toast("回到农场才能供餐。", "warn");
      return false;
    }
    const ok = this.feedResidents();
    this.checkStory();
    return ok;
  }
  neighborAid() {
    const sc = this.sc;
    if (!sc?.claimed.includes("act2")) return false;
    if (this.s.region !== NEIGHBOR_SPOT.region || dist(this.s.player, NEIGHBOR_SPOT) > 120) {
      this.toast("邻里互助点在废弃居民区，走近后按 E。", "warn");
      return false;
    }
    if (sc.neighborDay === this.s.day) {
      this.toast("今天已经和邻居互助过了，明天再来。");
      return false;
    }
    if (this.qty("bread") < NEIGHBOR_COST.bread) {
      this.toast("邻居们缺口粮：背包里带 1 份干粮再来。", "warn");
      return false;
    }
    if (!this.canAdd(NEIGHBOR_GIFT)) {
      this.toast("背包满了，腾出空间再接邻居的回礼。", "warn");
      return false;
    }
    this.s.inventory.bread -= NEIGHBOR_COST.bread;
    if (!this.s.inventory.bread) delete this.s.inventory.bread;
    if (!this.add(NEIGHBOR_GIFT, true)) {
      this.s.inventory.bread = (this.s.inventory.bread || 0) + NEIGHBOR_COST.bread;
      return false;
    }
    sc.neighborDay = this.s.day;
    sc.neighborHelps++;
    this.toast("邻居们收下干粮，拆下两扇旧门板给你，还塞来一把萝卜种子：" + bundleText(NEIGHBOR_GIFT) + "。", "gold");
    this.emit("loot");
    return true;
  }
  finishAct2() {
    const sc = this.sc;
    if (sc.claimed.includes("act2")) return false;
    sc.claimed.push("act2");
    sc.act = 3;
    this.s.money += ACT2_REWARD.money;
    this.addReputation(ACT2_REWARD.reputation);
    if (!sc.letters.includes("act3")) sc.letters.push("act3");
    sc.unread = true;
    this.storyLog("公共餐桌坐满了人。联盟记下：前哨供粮合格。住宅区开放邻里互助点。");
    this.toast(
      "今天的饭桌坐满了人。联盟记下前哨供粮合格：" +
        ACT2_REWARD.money +
        " 金币、营地声望 +" +
        ACT2_REWARD.reputation +
        "。",
      "gold",
    );
    this.toast("小柒：医院方向收到新的求援，详情在任务手记。住宅区的邻居也开了互助点。", "gold");
    this.emit("quest");
    return true;
  }
  autoRecordTask() {
    // 普通完成条件满足后直接记录进展；需要实物交付的节点仍等玩家确认。
    if (this.s.region !== "farm" || ["warning", "active"].includes(this.s.horde?.phase)) return false;
    const q = this.currentRebuildTask();
    if (!q || Object.keys(q.cost).length || !this.taskReady(q.id)) return false;
    const ok = this.claimRebuildTask(q.id);
    if (ok) this.clearMark();
    return ok;
  }
  checkStory() {
    const sc = this.sc;
    if (!sc || this._storyBusy) return;
    this._storyBusy = true;
    try {
      if (this.resident("farmer")?.fed && !sc.flags.farmerFed) {
        sc.flags.farmerFed = true;
        this.storyLog("阿禾吃上了前哨的第一顿工作餐。");
      }
      this.autoRecordTask();
      if (
        sc.act === 2 &&
        sc.choice &&
        sc.flags.farmerFed &&
        this.r.claimed.includes("farmer") &&
        this.r.claimed.includes("table")
      )
        this.finishAct2();
    } finally {
      this._storyBusy = false;
    }
  }

  // ---------- 援建队员：搬运 ----------
  diningSeat(i) {
    if (this.projectStage("market") >= 1) return TABLE_SEATS[i % TABLE_SEATS.length];
    const c = this.sc.camp;
    if (!c) return null;
    return [
      { x: c.x - 28, y: c.y + 32 },
      { x: c.x + 46, y: c.y + 34 },
      { x: c.x + 10, y: c.y + 52 },
      { x: c.x - 40, y: c.y + 50 },
    ][i % 4];
  }
  mealHour() {
    const hour = Math.floor(this.s.minute / 60);
    return hour === 12 || hour === 18;
  }
  helperEat() {
    if ((this.s.storage.bread || 0) > 0) {
      this.s.storage.bread--;
      if (!this.s.storage.bread) delete this.s.storage.bread;
      return true;
    }
    if (this.s.region === "farm" && (this.s.inventory.bread || 0) > 0) {
      this.s.inventory.bread--;
      if (!this.s.inventory.bread) delete this.s.inventory.bread;
      return true;
    }
    return false;
  }
  helperJob(name) {
    const ready = this.c.production.find((j) => j.ready);
    if (ready) {
      const station = this.s.buildings.find((b) => b.type === ready.station && b.hp > 0) || {
          x: 1010,
          y: 480,
        },
        out = { ...ready.out };
      return {
        at: { x: station.x + 34, y: station.y + 34 },
        status: "把" + bundleText(out) + "搬进仓库",
        run: () => {
          if (!this.storeProduction(ready.id, true)) return false;
          if (this.s.region === "farm") this.toast(name + "把加工好的" + bundleText(out) + "搬进了仓库。");
          return true;
        },
      };
    }
    const drop = (this.s.drops || []).find((d) => d.region === "farm");
    if (drop)
      return {
        at: { x: drop.x, y: drop.y + 10 },
        status: "把散落的物资搬进仓库",
        run: () => {
          this.putStorage(drop.items);
          this.s.drops = this.s.drops.filter((d) => d !== drop);
          return true;
        },
      };
    const debris = this.s.debris[0];
    if (debris)
      return {
        at: { x: debris.x + 24, y: debris.y + 6 },
        status: "清走田里的" + (ITEMS[debris.type]?.name || "杂物") + "，搬进仓库",
        run: () => {
          let gain = { [debris.type]: 4 };
          if (this.v && this.scarceBundle) {
            const p = this.scarceBundle(gain);
            gain = p.out;
            this.v.remainder = p.next;
          }
          this.s.debris = this.s.debris.filter((d) => d !== debris);
          const plot = this.s.plots.find((p) => dist(p, debris) < 15);
          if (plot) plot.tilled = true;
          this.s.stats.cleared++;
          this.putStorage(gain);
          return true;
        },
      };
    return null;
  }
  helperHour(h) {
    const sc = this.sc,
      hour = Math.floor(this.s.minute / 60),
      name = this.helperName(h.id),
      camp = sc.camp || this.campSite() || { x: 830, y: 480 },
      rest = { x: camp.x + 64, y: camp.y + 20 };
    if (hour < 6 || hour >= 20) {
      Object.assign(h, { status: "在帐篷里休息", task: "rest", target: rest });
      return;
    }
    if (h.fedDay !== this.s.day) {
      if (this.helperEat()) h.fedDay = this.s.day;
      else if (h.hungryDay !== this.s.day) {
        h.hungryDay = this.s.day;
        this.toast("小柒：" + name + "今天还没吃上工作餐。仓库放 1 份干粮，他下个钟点就能吃上。", "warn");
      }
    }
    const fed = h.fedDay === this.s.day;
    if (fed && this.mealHour()) {
      const seat = this.diningSeat(this.c.residents.length) || rest;
      Object.assign(h, { status: hour === 12 ? "午饭时间" : "晚饭时间", task: "meal", target: seat });
      return;
    }
    if (!fed && hour % 2) {
      Object.assign(h, { status: "没吃上工作餐，干活慢了一半 · 仓库放 1 份干粮", task: "hungry", target: rest });
      return;
    }
    const job = this.helperJob(name);
    if (!job) {
      Object.assign(h, { status: "暂时没有要搬的东西，在营地整理工具", task: "idle", target: rest });
      return;
    }
    if (job.run()) {
      h.moved++;
      Object.assign(h, { status: job.status, task: "carry", target: job.at });
    }
  }
  seatDiners() {
    if (!this.mealHour() || (!this.sc.camp && this.projectStage("market") < 1)) return;
    const label = Math.floor(this.s.minute / 60) === 12 ? "午饭" : "晚饭";
    this.c.residents.forEach((r, i) => {
      if (!r.fed || !this.residentActive(r)) return;
      const seat = this.diningSeat(i);
      if (!seat) return;
      r.target = { x: seat.x, y: seat.y };
      r.status = (this.projectStage("market") >= 1 ? "在公共餐桌吃" : "在营火边吃") + label;
    });
  }
  workHour() {
    super.workHour();
    const sc = this.s.storyCampaign;
    if (!sc) return;
    for (const h of sc.helpers) this.helperHour(h);
    this.seatDiners();
    this.checkStory();
  }
  onNewDay() {
    super.onNewDay();
    const sc = this.s.storyCampaign;
    if (!sc?.flags.well || sc.wellDay === this.s.day) return;
    const n = this.troughWater();
    if (n && this.s.region === "farm") this.toast("清晨水槽放水：第一排" + n + "株作物已浇透。");
  }
  updateHelpers(dt) {
    if (this.s.region !== "farm") return;
    this._helperPaths ??= new Map();
    for (const h of this.sc.helpers) {
      const target = h.target;
      if (target && dist(h, target) > 8) {
        let path = this._helperPaths.get(h.id);
        const goal = target.x + "," + target.y;
        if (
          !path ||
          path.goal !== goal ||
          path.revision !== this.navRevision ||
          path.until < this.s.playSeconds
        ) {
          path = {
            goal,
            revision: this.navRevision,
            until: this.s.playSeconds + 2,
            points: this.pathTo(h, target),
          };
          this._helperPaths.set(h.id, path);
        }
        if (path.points[0] && dist(h, path.points[0]) < 18) path.points.shift();
        const next = this.lineClear(h, target) ? target : path.points[0];
        if (next) {
          const a = Math.atan2(next.y - h.y, next.x - h.x);
          h.facing = a;
          this.moveEntity(h, Math.cos(a) * 55 * dt, Math.sin(a) * 55 * dt);
          h.x = Math.max(0, Math.min(WORLD.w, h.x));
          h.y = Math.max(0, Math.min(WORLD.h, h.y));
        }
      }
      const o = this.objects.find((o) => o.type === "allianceHelper" && o.helper === h.id);
      if (o) {
        o.x = h.x;
        o.y = h.y;
      }
    }
  }
  update(dt, input = {}) {
    super.update(dt, input);
    if (this.paused || !this.s.storyCampaign) return;
    this.updateHelpers(dt);
    this._storyClock = (this._storyClock || 0) + dt;
    if (this._storyClock >= 0.5) {
      this._storyClock = 0;
      this.checkStory();
    }
  }
  static parse(text) {
    const raw = JSON.parse(text),
      s = GuidanceEngine.parse(text);
    if (raw.storyCampaign !== undefined) validateStory(raw.storyCampaign);
    return migrateState(s);
  }
}

function validateStory(sc) {
  const object = (x) => x && typeof x === "object" && !Array.isArray(x),
    int = (x) => Number.isInteger(x) && x >= 0 && x <= 1e9,
    pos = (p) =>
      object(p) &&
      Number.isFinite(p.x) &&
      Number.isFinite(p.y) &&
      p.x >= 0 &&
      p.x <= WORLD.w &&
      p.y >= 0 &&
      p.y <= WORLD.h,
    unique = (a) => new Set(a).size === a.length,
    bad = () => {
      throw Error("联盟故事存档异常，请从设置恢复有效备份；原存档会保留。");
    },
    d = defaults();
  if (!object(sc) || sc.schema !== STORY_SCHEMA || Object.keys(sc).some((k) => !Object.hasOwn(d, k))) bad();
  if (sc.act !== undefined && (!Number.isInteger(sc.act) || sc.act < 1 || sc.act > 3)) bad();
  if (
    sc.flags !== undefined &&
    (!object(sc.flags) ||
      Object.entries(sc.flags).some(([k, v]) => !Object.hasOwn(d.flags, k) || typeof v !== "boolean"))
  )
    bad();
  for (const k of ["site", "camp"]) if (sc[k] !== undefined && sc[k] !== null && !pos(sc[k])) bad();
  if (sc.choice !== undefined && sc.choice !== null && !SUPPLY[sc.choice]) bad();
  if (
    sc.claimed !== undefined &&
    (!Array.isArray(sc.claimed) || !sc.claimed.every((x) => STORY_IDS.includes(x)) || !unique(sc.claimed))
  )
    bad();
  if (
    sc.letters !== undefined &&
    (!Array.isArray(sc.letters) || !sc.letters.every((x) => LETTER_IDS.includes(x)) || !unique(sc.letters))
  )
    bad();
  for (const k of ["unread", "veteran"]) if (sc[k] !== undefined && typeof sc[k] !== "boolean") bad();
  for (const k of ["wellDay", "neighborDay", "neighborHelps"]) if (sc[k] !== undefined && !int(sc[k])) bad();
  if (
    sc.log !== undefined &&
    (!Array.isArray(sc.log) ||
      sc.log.length > 12 ||
      sc.log.some((l) => !object(l) || !int(l.day) || typeof l.text !== "string" || l.text.length > 200))
  )
    bad();
  if (sc.helpers !== undefined) {
    if (!Array.isArray(sc.helpers) || sc.helpers.length > 4 || !unique(sc.helpers.map((h) => h?.id))) bad();
    for (const h of sc.helpers)
      if (
        !object(h) ||
        Object.keys(h).some((k) => !HELPER_KEYS.includes(k)) ||
        !HELPERS[h.id] ||
        h.role !== HELPERS[h.id].role ||
        !pos(h) ||
        (h.facing !== undefined && !Number.isFinite(h.facing)) ||
        (h.target !== null && h.target !== undefined && !pos(h.target)) ||
        !int(h.fedDay) ||
        !int(h.hungryDay) ||
        !int(h.moved) ||
        typeof h.status !== "string" ||
        h.status.length > 80 ||
        !HELPER_TASKS.includes(h.task)
      )
        bad();
  }
  // 进度彼此一致：回信后才有第二段与援建队员，第二段完成后才有第三封信。
  const claimed = sc.claimed || [];
  if ((sc.act || 1) >= 2 !== claimed.includes("act1")) bad();
  if ((sc.act || 1) >= 3 !== claimed.includes("act2")) bad();
  if (!!sc.choice !== claimed.includes("supply")) bad();
  if (sc.flags?.camp && !sc.camp) bad();
}
