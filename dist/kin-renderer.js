// v0.30.0「人情」的画面：何大勺、老琴、回来的秦奶奶在营地里走动；收留的孩子跟着师父；门口等你答复的过路人和孩子；
// 灯火夜的六盏路灯（点亮了夜里有光）；尸潮前一天营门的沙袋；几处水边的钓鱼点和废墟里那处要翻的地方；
// 有话想说的人头上冒个“…”；钓鱼时的鱼线和浮漂；长夜里守在你身边的那个人；丰收评比摆上长桌的菜。
import { Renderer as AlmanacRenderer } from "./almanac-renderer.js";
import { lookFor } from "./pixel-sprites.js";
import { gearIcon } from "./gear-sprites.js";
import { cached } from "./pixel-kit.js";
import { LAMPS, WATERS, PARTNER, GATE } from "./kin-data.js";

const ROLE = { laoqin: "elder", qin: "elder", jiang: "elder" };
const iconCanvas = (id) => cached("kinicon:" + id, () => gearIcon(id).toCanvas());

export class Renderer extends AlmanacRenderer {
  // 一个人：新画面用固定长相的像素小人，老画面用原来的
  kinPerson(key, x, y, facing = Math.PI / 2, moving = false, scale = 1, role = null) {
    if (this.v && this.personFrame) {
      const f = this.personFrame(lookFor(key, role), "kin:" + key, facing, moving);
      const c = this.ctx;
      if (scale !== 1) {
        c.save();
        c.translate(x, y);
        c.scale(scale, scale);
        c.translate(-x, -y);
      }
      this.pxShadow(x, y, 18);
      this.px(f.canvas, x, y, { flip: f.flip, foot: 1 });
      if (scale !== 1) c.restore();
      return;
    }
    if (scale !== 1 && this.child) return this.child(x, y, NPC_LOOK(key), facing);
    this.personSimple?.(x, y, NPC_LOOK(key), facing);
  }
  hiddenByAlly(o, e) {
    const a = e?._kinAlly;
    if (!a || a.down || a.away) return false;
    return (o.type === "resident" && o.resident === a.id) || (o.type === "allianceHelper" && o.helper === a.id) || (o.type === "kinPerson" && o.who === a.id);
  }
  drawObject(o, e) {
    if (e?.kin) {
      if (this.hiddenByAlly(o, e)) return;
      const p = e.s.player,
        near = Math.hypot(p.x - o.x, p.y - o.y) < 160,
        c = this.ctx;
      if (o.type === "kinPerson") {
        this.kinPerson(o.who, o.x, o.y, o.facing ?? Math.PI / 2, !!o.moving, 1, ROLE[o.who] || null);
        if (near) this.label2?.(o.name, o.x, o.y - 78, "#f1d98a", 11);
        return;
      }
      if (o.type === "kinKid") {
        this.kinPerson("kid:" + o.name, o.x, o.y, Math.PI / 2, !!o.moving, 0.72);
        if (near) this.label2?.(o.name, o.x, o.y - 56, "#cfe7a6", 11);
        return;
      }
      if (o.type === "kinKidAsk") {
        this.kinPerson("ask:" + o.name, o.x, o.y, Math.PI / 2, false);
        this.kinPerson("kid:ask", o.x + 24, o.y + 6, Math.PI / 2, false, 0.72);
        if (Math.floor(this.time * 2) % 2) this.text?.("?", o.x + 8, o.y - 92, "#f1d98a", 16);
        if (near) this.label2?.(o.name, o.x, o.y - 78, "#f1d98a", 11);
        return;
      }
      if (o.type === "kinLamp") {
        const lit = e.kin.fest.lamps.includes(o.lamp);
        c.fillStyle = "#2a2420";
        c.fillRect(o.x - 2, o.y - 46, 4, 46);
        c.fillRect(o.x - 2, o.y - 46, 14, 3);
        c.fillStyle = lit ? "#ffd76a" : "#5b4a33";
        c.fillRect(o.x + 6, o.y - 43, 8, 10);
        c.fillStyle = "#1a1410";
        c.fillRect(o.x + 5, o.y - 44, 10, 2);
        if (lit) {
          c.fillStyle = "rgba(255,215,106,0.25)";
          c.beginPath();
          c.arc(o.x + 10, o.y - 38, 14 + Math.sin(this.time * 4 + o.lamp) * 2, 0, Math.PI * 2);
          c.fill();
        }
        if (near) this.label2?.(lit ? "路灯 · 亮了" : "路灯 · 按 E 点亮", o.x, o.y - 58, lit ? "#ffd76a" : "#d8cfb0", 11);
        return;
      }
      if (o.type === "kinWater") {
        c.fillStyle = "#6b4f3a";
        c.fillRect(o.x - 2, o.y - 30, 4, 30);
        c.strokeStyle = "#7a5a36";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(o.x, o.y - 30);
        c.lineTo(o.x + 22, o.y - 52);
        c.stroke();
        c.fillStyle = "#5f6a52";
        c.fillRect(o.x - 16, o.y - 10, 10, 10);
        if (near) this.label2?.(o.name, o.x, o.y - 62, "#bfe3e8", 11);
        return;
      }
      if (o.type === "kinCache") {
        c.fillStyle = "#4a3c30";
        c.fillRect(o.x - 14, o.y - 22, 28, 22);
        c.fillStyle = "#704a2f";
        c.fillRect(o.x - 12, o.y - 20, 24, 8);
        c.fillStyle = "#ad8258";
        c.fillRect(o.x - 2, o.y - 14, 4, 3);
        if (Math.floor(this.time * 2) % 2) {
          c.fillStyle = "#ffd76a";
          c.fillRect(o.x + 10, o.y - 34, 3, 8);
          c.fillRect(o.x + 10, o.y - 24, 3, 3);
        }
        if (near) this.label2?.(o.name, o.x, o.y - 44, "#f1d98a", 11);
        return;
      }
    }
    return super.drawObject(o, e);
  }
  // ---------- 田间那一层：营门的沙袋、长夜里守在你身边的人 ----------
  drawFarm(e) {
    super.drawFarm(e);
    if (!e?.kin || e.s.region !== "farm") return;
    const c = this.ctx;
    const sand = (e.sandbagDay?.() && e.s.minute >= 14 * 60) || ["warning", "active"].includes(e.s.horde?.phase);
    if (sand) {
      for (let i = 0; i < 7; i++) {
        const x = GATE.x - 64 + i * 20,
          y = GATE.y + 20 + (i % 2) * 6;
        c.fillStyle = "#8d7b58";
        c.fillRect(x, y, 18, 9);
        c.fillStyle = "#a8936a";
        c.fillRect(x + 2, y + 1, 14, 3);
      }
    }
    const a = e._kinAlly;
    if (a && !a.away && e.kin.partner) this.kinPerson(a.id, a.x, a.y, a.facing ?? Math.PI / 2, !a.down, 1, null);
  }
  // ---------- 夜里的光：亮着的路灯 ----------
  collectLights(e, night) {
    const lights = super.collectLights(e, night);
    if (!e?.kin || e.s.region !== "farm" || night <= 0.05 || !e.lampsOn?.()) return lights;
    for (const [i, p] of LAMPS.entries()) if (e.kin.fest.lamps.includes(i)) lights.push({ x: p.x + 10, y: p.y - 38, r: 120, color: [255, 214, 140], power: 0.6 });
    return lights;
  }
  // ---------- 光照之后：有话想说的“…”、鱼线和浮漂、守在你身边那个人的名字和血条 ----------
  drawNight(e) {
    super.drawNight(e);
    if (!e?.kin) return;
    const c = this.ctx;
    c.save();
    // 有话想说的人
    if (e.s.region === "farm" && Array.isArray(e.objects)) {
      const wait = new Set(e.heartWaiting?.() || []);
      if (wait.size)
        for (const o of e.objects) {
          const id = e.personOf?.(o);
          if (!id || !wait.has(id)) continue;
          const x = o.x,
            y = o.y - 96 + Math.sin(this.time * 3) * 2;
          c.fillStyle = "#f6f2e8";
          c.fillRect(x - 13, y - 9, 26, 15);
          c.fillRect(x - 3, y + 6, 6, 4);
          c.fillStyle = "#5b4a33";
          for (let k = 0; k < 3; k++) c.fillRect(x - 8 + k * 7, y - 2, 3, 3);
        }
    }
    // 鱼线：抛着竿、咬钩、收线
    const reel = e._reel,
      cast = e.kin.cast,
      w = WATERS[reel?.water || cast?.water];
    if (w && (reel || e.c?.fishing) && w.region === e.s.region) {
      const p = e.s.player,
        hx = p.x + 12,
        hy = p.y - 40,
        pull = reel && reel.pull > 0,
        bite = e.c?.fishing?.phase === "bite",
        jx = pull ? Math.sin(this.time * 40) * 3 : 0,
        bx = w.bob.x + jx,
        by = w.bob.y + (bite ? Math.sin(this.time * 30) * 3 : Math.sin(this.time * 2) * 2);
      c.strokeStyle = reel && reel.tense > 0.75 ? "#ff7a5a" : "#e8e4dccc";
      c.lineWidth = reel ? 2 : 1;
      c.beginPath();
      c.moveTo(hx, hy);
      c.quadraticCurveTo((hx + bx) / 2, Math.max(hy, by) + (reel ? 4 : 18), bx, by);
      c.stroke();
      c.fillStyle = "#d06a58";
      c.fillRect(bx - 3, by - 3, 6, 6);
      if (bite || pull || reel?.warn) {
        c.strokeStyle = reel?.warn && !pull ? "#9fd3e0" : "#f6f2e8";
        c.lineWidth = 2;
        const r = 8 + ((this.time * 30) % 10);
        c.beginPath();
        c.ellipse(bx, by + 2, r, r * 0.4, 0, 0, Math.PI * 2);
        c.stroke();
      }
    }
    // 守在你身边的那个人
    const a = e._kinAlly;
    if (a && !a.away && e.s.region === "farm") {
      // 挥一下：从他手上划向打的那一只
      if (a.swing > 0 && a.hitAt && !a.down) {
        const k = a.swing / 0.25,
          ang = a.facing ?? 0,
          hx = a.x + Math.cos(ang) * 10,
          hy = a.y - 30 + Math.sin(ang) * 6;
        c.strokeStyle = "rgba(255,226,160," + (0.35 + 0.5 * k).toFixed(2) + ")";
        c.lineWidth = 3;
        c.beginPath();
        c.arc(hx, hy, 22, ang - 0.9 + (1 - k) * 0.9, ang + 0.3 + (1 - k) * 0.9);
        c.stroke();
        c.fillStyle = "rgba(255,240,200," + (0.6 * k).toFixed(2) + ")";
        c.fillRect(a.hitAt.x - 3, a.hitAt.y - 34, 6, 6);
      }
      const wd = 34,
        left = Math.max(0, a.hp / PARTNER.ally.hp);
      c.fillStyle = "#1a1410";
      c.fillRect(a.x - wd / 2 - 1, a.y - 76, wd + 2, 6);
      c.fillStyle = a.down ? "#85857a" : left > 0.4 ? "#9fd38a" : "#d06a58";
      c.fillRect(a.x - wd / 2, a.y - 75, wd * left, 4);
      this.label2?.(e.kinName(a.id) + (a.down ? "（挂彩）" : a.back ? "（往回撤）" : ""), a.x, a.y - 84, a.down ? "#c9c3b0" : a.back ? "#ffb08a" : "#ffd76a", 11);
    }
    c.restore();
  }
  // ---------- 丰收评比：评过的菜摆在长桌上 ----------
  drawPlaza(o, e) {
    super.drawPlaza(o, e);
    if (!e?.kin || !this.v) return;
    const f = e.kin.fest;
    if (!f || f.day !== e.s.day || !f.table?.length) return;
    f.table.slice(0, 5).forEach((id, i) => {
      const cv = iconCanvas(id);
      if (cv) this.px(cv, o.x - 64 + i * 32, o.y + 4);
    });
  }
}
const NPC_LOOK = (key) => (["he", "qin", "laoqin", "jiang"].includes(key) ? key : 0);
