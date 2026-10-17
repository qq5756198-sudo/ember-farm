// v0.33.0「盼头」的画面：农舍的东厢房和二楼、谷仓边的分拣棚和冷库、鸡舍边的鸡圈和羊圈；买下的稀罕货摆在农场上
// （屋顶的热水器、谷仓顶的鸽舍、后院的蜂箱和地窖门、麦穗的新窝、田边的温床和堆肥机、门廊的种子柜、广场的留声机、风车、拖拉机）；
// 二级电网田边多的几盏路灯；营门口的过路人、货郎的摊子、收购的人；废墟里被困的人、翻倒的物资车。
// 只是画出来，不挡路；风车和拖拉机按前后遮挡排（场景里的东西），其余画在地图上。“减少闪烁与震屏”下风车不转、鸽子不飞。
import { Renderer as RelightRenderer } from "./relight-renderer.js";

const HOME = { wing: { x: 404, y: 150 }, loft: { x: 290, y: 150 } };
const BARN = { shed: { x: 632, y: 160 }, cold: { x: 846, y: 158 } };
const SPOT = {
  boiler: { x: 332, y: 80 },
  dove: { x: 775, y: 62 },
  hive: [505, 532, 559].map((x) => ({ x, y: 128 })),
  cellar: { x: 600, y: 150 },
  kennel: { x: 520, y: 208 },
  hotbed: [
    { x: 248, y: 462 },
    { x: 248, y: 552 },
  ],
  composter: { x: 232, y: 640 },
  seedbox: { x: 393, y: 264 },
};
// 二级电网：田四个角多的路灯
export const FIELD_LAMPS = [
  { x: 258, y: 404 },
  { x: 708, y: 404 },
  { x: 258, y: 690 },
  { x: 708, y: 690 },
];
const isNight = (e) => e.s.minute >= 1110 || e.s.minute < 360;

export class Renderer extends RelightRenderer {
  hpRect(x, y, w, h, color) {
    const c = this.ctx;
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  hpTri(ax, ay, bx, by, cx, cy, color) {
    const c = this.ctx;
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(ax, ay);
    c.lineTo(bx, by);
    c.lineTo(cx, cy);
    c.closePath();
    c.fill();
  }
  hpDisc(x, y, r, color) {
    const c = this.ctx;
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }
  // 一个人：新画面用像素小人，原画面用原来的
  hpPerson(key, look, x, y, facing = Math.PI / 2, moving = false, scale = 1) {
    if (this.v && this.personFrame && this.kinPerson) return this.kinPerson(key, x, y, facing, moving, scale);
    if (this.personSimple) return this.personSimple(x, y, look, facing);
  }
  hpCalm() {
    return !!this.calm || !!this._uE?.s?.settings?.access?.calm;
  }

  // ================= 农场 =================
  drawFarm(e) {
    super.drawFarm(e);
    const h = e?.hp;
    if (!h) return;
    const night = isNight(e),
      t = this.time || 0;
    if ((h.expand?.home || 0) >= 1) this.drawWing(night);
    if ((h.expand?.home || 0) >= 2) this.drawLoft(night);
    if ((h.expand?.store || 0) >= 1) this.drawShed();
    if ((h.expand?.store || 0) >= 2) this.drawCold(t);
    const own = (id) => !!h.goods?.[id];
    if (own("boiler")) this.drawBoiler();
    if (own("dove")) this.drawDove(t);
    if (own("hive")) this.drawHives(t);
    if (own("cellar")) this.drawCellar();
    if (own("kennel")) this.drawKennel();
    if (own("hotbed")) for (const q of SPOT.hotbed) this.drawHotbed(q);
    if (own("composter")) this.drawComposter();
    if (own("seedbox")) this.drawSeedbox();
    if (h.wall2?.power && this.drawPowerLamps) this.drawPowerLamps(e, FIELD_LAMPS);
  }
  drawWing(night) {
    const { x, y } = HOME.wing,
      R = (a, b, w, hh, c) => this.hpRect(x + a, y + b, w, hh, c);
    R(0, 0, 74, 6, "#5a2e20");
    R(-2, 4, 78, 12, "#8d4a32");
    for (let k = 0; k < 78; k += 9) R(k - 2, 6, 2, 10, "#6e3624");
    R(2, 16, 70, 100, "#7a5838");
    for (let yy = 24; yy < 116; yy += 9) R(2, yy, 70, 1, "#5e4128");
    R(14, 36, 26, 22, "#c9a46a");
    R(17, 39, 20, 16, night ? "#ffd98a" : "#2b3a44");
    R(26, 39, 2, 16, "#c9a46a");
    R(48, 70, 18, 46, "#5e4128");
    R(50, 72, 14, 44, "#8d6340");
    R(61, 92, 2, 3, "#e9c05a");
    R(0, 114, 74, 6, "#4a3424");
  }
  drawLoft(night) {
    const { x, y } = HOME.loft;
    this.hpTri(x - 36, y - 36, x, y - 62, x + 36, y - 36, "#8d4a32");
    this.hpTri(x - 30, y - 38, x, y - 58, x + 30, y - 38, "#a65a3c");
    this.hpRect(x - 28, y - 38, 56, 34, "#7a5838");
    for (let yy = y - 30; yy < y - 4; yy += 8) this.hpRect(x - 28, yy, 56, 1, "#5e4128");
    for (const dx of [-20, 6]) {
      this.hpRect(x + dx, y - 30, 14, 14, "#c9a46a");
      this.hpRect(x + dx + 2, y - 28, 10, 10, night ? "#ffd98a" : "#2b3a44");
    }
    this.hpRect(x - 30, y - 5, 60, 4, "#5a2e20");
  }
  drawShed() {
    const { x, y } = BARN.shed;
    this.hpRect(x, y, 70, 9, "#6b6f73");
    for (let k = 0; k < 70; k += 7) this.hpRect(x + k, y, 3, 9, "#8a9094");
    this.hpRect(x + 3, y + 9, 4, 75, "#5a3f2a");
    this.hpRect(x + 62, y + 9, 4, 75, "#5a3f2a");
    for (const [dx, dy, col] of [
      [8, 60, "#e07a3a"],
      [32, 66, "#9fd16a"],
      [10, 40, "#d9b45a"],
    ]) {
      this.hpRect(x + dx, y + dy, 22, 18, "#8d754e");
      this.hpRect(x + dx, y + dy, 22, 3, "#c3a574");
      for (let k = 0; k < 4; k++) this.hpRect(x + dx + 3 + k * 5, y + dy + 4, 3, 3, col);
    }
  }
  drawCold(t) {
    const { x, y } = BARN.cold;
    this.hpRect(x + 2, y + 10, 44, 74, "#aab0aa");
    this.hpRect(x, y + 8, 44, 74, "#dfe3dc");
    for (let yy = y + 20; yy < y + 80; yy += 14) this.hpRect(x, yy, 44, 1, "#aab0aa");
    this.hpRect(x + 34, y + 40, 3, 12, "#6f777a");
    this.hpRect(x + 8, y - 4, 28, 12, "#6f777a");
    const a = this.hpCalm() ? 0 : t * 9;
    this.hpDisc(x + 22, y + 2, 5, "#3a3f42");
    this.hpRect(x + 22 + Math.cos(a) * 4 - 1, y + 2 + Math.sin(a) * 4 - 1, 2, 2, "#c9ced0");
  }
  drawBoiler() {
    const { x, y } = SPOT.boiler;
    this.hpRect(x, y, 42, 9, "#d9dcd2");
    this.hpRect(x, y + 6, 42, 3, "#a9ada3");
    this.hpRect(x + 2, y + 10, 38, 13, "#2f4f7a");
    for (let k = 1; k < 4; k++) this.hpRect(x + 2 + k * 9.5, y + 10, 1, 13, "#6f9bd0");
    this.hpRect(x + 2, y + 16, 38, 1, "#6f9bd0");
  }
  drawDove(t) {
    const { x, y } = SPOT.dove;
    this.hpRect(x - 2, y + 16, 4, 22, "#5a3f2a");
    this.hpRect(x - 13, y, 26, 18, "#e9e2cf");
    this.hpTri(x - 16, y + 1, x, y - 11, x + 16, y + 1, "#a0462e");
    this.hpRect(x - 8, y + 6, 5, 5, "#2a2420");
    this.hpRect(x + 3, y + 6, 5, 5, "#2a2420");
    this.hpRect(x - 13, y + 14, 26, 2, "#b8b0a0");
    const calm = this.hpCalm();
    for (let k = 0; k < 3; k++) {
      const a = calm ? k * 2.1 : t * 1.3 + k * 2.1,
        bx = x + Math.cos(a) * (22 + k * 4),
        by = y - 18 + Math.sin(a) * 7,
        flap = calm ? 0 : Math.floor(t * 8 + k) % 2;
      this.hpRect(bx - 3, by - flap, 3, 2, "#f4f1e8");
      this.hpRect(bx, by, 3, 2, "#f4f1e8");
      this.hpRect(bx + 3, by - flap, 3, 2, "#f4f1e8");
    }
  }
  drawHives(t) {
    const calm = this.hpCalm();
    for (const [i, q] of SPOT.hive.entries()) {
      this.hpRect(q.x - 10, q.y - 2, 20, 4, "rgba(20,14,10,0.3)");
      this.hpRect(q.x - 9, q.y - 17, 18, 16, "#d9b45a");
      this.hpRect(q.x - 9, q.y - 12, 18, 2, "#b08a3a");
      this.hpRect(q.x - 9, q.y - 7, 18, 2, "#b08a3a");
      this.hpRect(q.x - 11, q.y - 20, 22, 4, "#7a5838");
      this.hpRect(q.x - 3, q.y - 4, 6, 2, "#2a2420");
      if (!calm)
        for (let k = 0; k < 2; k++) {
          const a = t * 3 + i * 1.7 + k * 3.1;
          this.hpRect(q.x + Math.cos(a) * 12, q.y - 24 + Math.sin(a * 1.3) * 6, 2, 2, "#2a2420");
        }
    }
  }
  drawCellar() {
    const { x, y } = SPOT.cellar;
    this.hpRect(x - 18, y - 13, 36, 24, "#8f8a7a");
    this.hpRect(x - 15, y - 10, 30, 18, "#6b4e33");
    this.hpRect(x - 1, y - 10, 2, 18, "#3d2a1c");
    for (let yy = y - 6; yy < y + 8; yy += 5) this.hpRect(x - 15, yy, 30, 1, "#57402b");
    this.hpRect(x - 6, y - 2, 3, 3, "#c9a24a");
    this.hpRect(x + 3, y - 2, 3, 3, "#c9a24a");
  }
  drawKennel() {
    const { x, y } = SPOT.kennel;
    this.hpRect(x - 15, y - 2, 30, 4, "rgba(20,14,10,0.3)");
    this.hpRect(x - 13, y - 18, 26, 18, "#a0663c");
    this.hpTri(x - 16, y - 16, x, y - 30, x + 16, y - 16, "#7d3f2a");
    this.hpRect(x - 5, y - 12, 10, 12, "#2a1f18");
    this.hpRect(x - 7, y - 22, 14, 3, "#e9c05a");
  }
  drawHotbed(q) {
    this.hpRect(q.x - 20, q.y - 6, 40, 12, "#6b4e33");
    this.hpRect(q.x - 18, q.y - 15, 36, 10, "rgba(170,210,230,0.6)");
    this.hpRect(q.x - 16, q.y - 14, 10, 1, "rgba(255,255,255,0.7)");
    for (let k = 0; k < 5; k++) this.hpRect(q.x - 14 + k * 7, q.y - 9, 2, 3, "#7fbf5a");
  }
  drawComposter() {
    const { x, y } = SPOT.composter;
    this.hpRect(x - 12, y - 24, 24, 24, "#3e6b3a");
    this.hpRect(x - 13, y - 27, 26, 5, "#2f5530");
    this.hpRect(x - 6, y - 16, 12, 2, "#2f5530");
    this.hpRect(x - 6, y - 11, 12, 2, "#2f5530");
  }
  drawSeedbox() {
    const { x, y } = SPOT.seedbox;
    this.hpRect(x - 11, y - 20, 22, 20, "#8a5a34");
    for (let r = 0; r < 3; r++)
      for (let k = 0; k < 3; k++) {
        this.hpRect(x - 9 + k * 7, y - 18 + r * 6, 5, 4, "#6b4429");
        this.hpRect(x - 8 + k * 7, y - 17 + r * 6, 2, 2, ["#d9b45a", "#7fbf5a", "#e07a3a"][(r + k) % 3]);
      }
  }

  // ================= 鸡舍边：鸡圈、羊圈、孵蛋箱 =================
  drawBuilding(b, e) {
    super.drawBuilding(b, e);
    const h = e?.hp;
    if (!h || b?.type !== "coop" || b.hp <= 0 || e.s.region !== "farm") return;
    if (e.s.buildings.find((x) => x.type === "coop" && x.hp > 0) !== b) return;
    const t = this.time || 0,
      calm = this.hpCalm();
    if ((h.expand?.coop || 0) >= 1) {
      const x = b.x + 38,
        y = b.y - 24;
      this.hpRect(x, y, 58, 26, "#a08a5c");
      this.hpRect(x, y, 58, 2, "#8a8f8a");
      this.hpRect(x, y + 24, 58, 2, "#8a8f8a");
      for (let k = 0; k <= 58; k += 14.5) this.hpRect(x + k - 1, y - 6, 2, 32, "#6b4e33");
      for (let k = 0; k < 3; k++) {
        const cx = x + 10 + k * 18,
          bob = calm ? 0 : Math.floor(t * 3 + k * 1.3) % 2;
        this.hpRect(cx - 4, y + 10 + bob, 8, 6, "#f4f1e8");
        this.hpRect(cx + 3, y + 7 + bob, 3, 3, "#f4f1e8");
        this.hpRect(cx + 4, y + 6 + bob, 2, 1, "#d2453a");
        this.hpRect(cx + 6, y + 9 + bob, 1, 1, "#e9c05a");
      }
    }
    if ((h.expand?.coop || 0) >= 2) {
      const x = b.x - 104,
        y = b.y - 30;
      for (const dy of [0, 14, 28]) this.hpRect(x, y + dy, 60, 3, "#7a5838");
      for (let k = 0; k <= 60; k += 15) this.hpRect(x + k - 1, y - 4, 3, 36, "#5a3f2a");
      const gx = x + 26 + (calm ? 0 : Math.sin(t * 0.7) * 6),
        gy = y + 22;
      this.hpRect(gx - 9, gy - 8, 18, 9, "#e9e2cf");
      this.hpRect(gx + 7, gy - 13, 6, 6, "#e9e2cf");
      this.hpRect(gx + 9, gy - 15, 2, 3, "#8a7a5a");
      this.hpRect(gx - 7, gy + 1, 2, 5, "#8a7a5a");
      this.hpRect(gx + 4, gy + 1, 2, 5, "#8a7a5a");
    }
    if (h.goods?.incubator) {
      const x = b.x - 34,
        y = b.y + 2;
      this.hpRect(x - 8, y - 12, 16, 12, "#c9c2b0");
      this.hpRect(x - 5, y - 9, 10, 6, isNight(e) || Math.floor(t * 1.5) % 2 ? "#ffb060" : "#e8963f");
    }
  }

  // ================= 场景里的东西 =================
  drawObject(o, e) {
    if (e?.hp) {
      const p = e.s.player,
        near = Math.hypot(p.x - o.x, p.y - o.y) < 170,
        t = this.time || 0;
      if (o.type === "hpDeco") {
        if (o.kind === "mill") return this.drawMill(o, t);
        if (o.kind === "tractor") return this.drawTractor(o);
        return;
      }
      if (o.type === "hpTraveler") {
        this.hpRect(o.x + 16, o.y - 14, 18, 14, "#6b5a3a");
        this.hpRect(o.x + 16, o.y - 14, 18, 3, "#8d7a50");
        this.hpPerson(o.who, o.who, o.x, o.y, Math.PI);
        if (near) this.label2?.(o.name + " · 过路人", o.x, o.y - 80, "#cfe7a6", 11);
        return;
      }
      if (o.type === "hpPeddler") {
        const x = o.x,
          y = o.y;
        this.pxShadow?.(x, y, 40);
        this.hpRect(x - 36, y - 30, 64, 20, "#8d6340");
        this.hpRect(x - 36, y - 30, 64, 3, "#b08050");
        this.hpDisc(x - 26, y - 6, 7, "#3a2a1c");
        this.hpDisc(x + 18, y - 6, 7, "#3a2a1c");
        for (let k = 0; k < 8; k++) this.hpRect(x - 40 + k * 9, y - 64, 9, 10, k % 2 ? "#efe2c4" : "#c94f3a");
        this.hpRect(x - 38, y - 54, 3, 26, "#5a3f2a");
        this.hpRect(x + 24, y - 54, 3, 26, "#5a3f2a");
        for (let k = 0; k < 6; k++) this.hpRect(x - 30 + k * 9, y - 36, 6, 6, ["#d9b45a", "#7fbf5a", "#e07a3a", "#8fd0ff", "#e9e2cf", "#b05a8a"][k]);
        this.hpPerson("hpPeddler:" + o.who, typeof o.look === "number" ? o.look : 2, x + 44, y + 4, Math.PI);
        if (near) this.label2?.(o.name, x, y - 80, "#f1d98a", 11);
        return;
      }
      if (o.type === "hpBuyer") {
        this.hpRect(o.x + 14, o.y - 16, 20, 14, "#a07a44");
        this.hpRect(o.x + 14, o.y - 16, 20, 3, "#c69a5a");
        this.hpPerson("hpBuyer:" + o.who, typeof o.look === "number" ? o.look : 1, o.x, o.y, Math.PI / 2);
        if (near) this.label2?.(o.name, o.x, o.y - 80, "#f1d98a", 11);
        return;
      }
      if (o.type === "hpSurvivor") {
        const follow = !!e.hp.noon?.follow;
        this.hpPerson("hpSurvivor:" + o.name, 3, o.x, o.y, o.facing ?? Math.PI / 2, !!o.moving, follow ? 1 : 0.86);
        if (near || !follow) this.label2?.(follow ? o.name : "有人在喊救命", o.x, o.y - (follow ? 80 : 70), "#efd89a", 11);
        return;
      }
      if (o.type === "hpTruck") return this.drawTruck(o, near);
    }
    super.drawObject(o, e);
    // 广场上的留声机
    if (e?.hp?.goods?.gramophone && o.type === "seasonPlaza") this.drawGramophone(o.x + 64, o.y - 2, e);
  }
  drawMill(o, t) {
    const x = o.x,
      y = o.y;
    this.pxShadow?.(x, y, 26);
    const c = this.ctx;
    c.fillStyle = "#9b9b8e";
    c.beginPath();
    c.moveTo(x - 13, y - 14);
    c.lineTo(x - 6, y - 92);
    c.lineTo(x + 6, y - 92);
    c.lineTo(x + 13, y - 14);
    c.closePath();
    c.fill();
    for (let yy = y - 84; yy < y - 16; yy += 12) this.hpRect(x - 10 + (yy - y + 92) * 0.05, yy, 20 - (yy - y + 92) * 0.1, 1, "#76766a");
    this.hpRect(x - 15, y - 20, 30, 20, "#7a5838");
    this.hpRect(x - 4, y - 12, 8, 12, "#3d2a1c");
    const a = this.hpCalm() ? 0.4 : t * 1.4;
    c.save();
    c.translate(x, y - 92);
    c.rotate(a);
    for (let k = 0; k < 4; k++) {
      c.rotate(Math.PI / 2);
      c.fillStyle = "#6b6f73";
      c.fillRect(-1, 2, 3, 40);
      c.fillStyle = "#e9e2cf";
      c.fillRect(2, 10, 7, 30);
    }
    c.restore();
    this.hpDisc(x, y - 92, 4, "#3a3f42");
  }
  drawTractor(o) {
    const x = o.x,
      y = o.y;
    this.pxShadow?.(x, y, 34);
    this.hpRect(x - 22, y - 26, 36, 16, "#b8422e");
    this.hpRect(x + 6, y - 22, 20, 12, "#b8422e");
    this.hpRect(x + 6, y - 22, 20, 3, "#d8604a");
    this.hpRect(x - 20, y - 44, 18, 18, "#3a3f42");
    this.hpRect(x - 17, y - 41, 12, 9, "#9fc3d8");
    this.hpRect(x + 18, y - 34, 3, 12, "#3a3f42");
    this.hpDisc(x - 12, y - 8, 11, "#2a2420");
    this.hpDisc(x - 12, y - 8, 4, "#c9a24a");
    this.hpDisc(x + 20, y - 5, 6, "#2a2420");
    this.hpDisc(x + 20, y - 5, 2, "#c9a24a");
  }
  drawTruck(o, near) {
    const c = this.ctx,
      x = o.x,
      y = o.y;
    this.pxShadow?.(x, y + 6, 64);
    c.save();
    c.translate(x, y);
    c.rotate(-0.32);
    c.fillStyle = "#4f5a44";
    c.fillRect(-58, -40, 82, 42);
    c.fillStyle = "#6b7a58";
    c.fillRect(-58, -40, 82, 5);
    c.fillStyle = "#8a4a2a";
    c.fillRect(-40, -24, 14, 8);
    c.fillRect(-6, -16, 10, 6);
    c.fillStyle = "#7a3a2a";
    c.fillRect(24, -34, 30, 34);
    c.fillStyle = "#9fc3d8";
    c.fillRect(32, -30, 16, 12);
    c.fillStyle = "#2a2420";
    for (const wx of [-44, -14, 38]) {
      c.beginPath();
      c.arc(wx, 4, 9, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    for (let k = 0; k < 4; k++) this.hpRect(x - 70 + k * 13, y + 12 + (k % 2) * 4, 9, 6, "#8d754e");
    if (near) this.label2?.(o.name, x, y - 70, "#efd89a", 11);
  }
  drawGramophone(x, y, e) {
    this.hpRect(x - 9, y - 9, 18, 9, "#6b4e33");
    this.hpRect(x - 7, y - 12, 14, 3, "#2a2420");
    this.hpRect(x - 1, y - 14, 2, 3, "#c9a24a");
    this.hpTri(x + 1, y - 12, x + 14, y - 30, x + 20, y - 20, "#d9b45a");
    this.hpTri(x + 3, y - 13, x + 14, y - 27, x + 17, y - 21, "#f1d98a");
    const fest = e.festDay?.();
    if (fest && !this.hpCalm()) {
      const k = (this.time || 0) % 2;
      this.label2?.("♪", x + 18, y - 34 - k * 10, "#f1d98a", 12);
    }
  }

  // 夜里：田边的路灯、东厢房和二楼的窗、孵蛋箱
  collectLights(e, night) {
    const lights = super.collectLights(e, night);
    const h = e?.hp;
    if (!h || e.s.region !== "farm" || !(night > 0.05)) return lights;
    if (h.wall2?.power) for (const q of FIELD_LAMPS) lights.push({ x: q.x + 10, y: q.y - 38, r: 130, color: [255, 214, 140], power: 0.62 });
    if ((h.expand?.home || 0) >= 1) lights.push({ x: HOME.wing.x + 27, y: HOME.wing.y + 47, r: 46, color: [255, 210, 130], power: 0.55, small: true });
    if ((h.expand?.home || 0) >= 2) lights.push({ x: HOME.loft.x, y: HOME.loft.y - 23, r: 52, color: [255, 210, 130], power: 0.55, small: true });
    const coop = h.goods?.incubator && e.s.buildings.find((b) => b.type === "coop" && b.hp > 0);
    if (coop) lights.push({ x: coop.x - 34, y: coop.y - 6, r: 30, color: [255, 170, 90], power: 0.5, small: true });
    return lights;
  }
}
