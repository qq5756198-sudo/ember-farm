// v0.37.0「扑火」的画面：后五凶（雕爷和看门的、黑潮、风口、末班车、扑火）按它在干什么换姿势；
// 有几只的那几凶：看门的和雕爷各画各的、中间一根铁链；风机画整面墙、四个肺跟着它画；车头和车厢各画各的；
// 扑火画一座山、四盏光嵌在身上；光全灭了只剩那颗心。
// 地上：油（黑亮的一滩）、着了的火、通电的铁轨；光照之后、字之前：烟、风刃、浪（和它的口子）、扔过来的瓶子和油桶、
// 从天上砸下来的手、扔过来的感染者、吸进去的灰、远处进站的那盏灯、每一只身上的小血条。
// 打赢扑火以后，纪念石旁边立一块十凶碑；打赢末班车以后，隧道每一层轨道顶上的灯都亮着。
// 只是画出来，挨不挨、挡不挡路都在引擎里算。
import { Renderer as TitanRenderer } from "./titan-renderer.js";
import { TITANS, TITAN_IDS, mainPart } from "./titan-data.js";
import { WORLD } from "./data.js";
import { flameArt } from "./pixel-props.js";
import { dogSprite, diaoSprite, tideSprite, anchorSprite, ventSprite, lungSprite, trainHeadSprite, trainCarSprite, mothSprite, heartSprite, drumSprite } from "./titan-sprites2.js";

const snap = (v) => Math.round(v / 2) * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${clamp(a, 0, 1).toFixed(3)})`;
const fadeOf = (Z) => (Z.t === Infinity ? 1 : clamp(Z.t / 0.8, 0, 1) * clamp((Z.max - Z.t) / 0.4, 0, 1));
const NEW5 = new Set(["diao", "tide", "vent", "train", "moth"]);
const FIRE = [255, 150, 70];
// 隧道轨道顶上的日光灯（美术像素）、房间里的应急灯：跟 tunnel-gen.js 的位置一样
const TRACK_LAMPS = Array.from({ length: 7 }, (_, i) => ({ x: (2 + i * 3) * 32 + 16, y: 7 * 32 + 4 }));

export class Renderer extends TitanRenderer {
  // ---------- 有几只的那几凶：找同一凶的另一只 ----------
  tSib(e, id, part) {
    return (e.enemies || []).find((z) => z.titan === id && z.part === part && !z.dead) || null;
  }
  tSibs(e, id, part) {
    return (e.enemies || []).filter((z) => z.titan === id && z.part === part && !z.dead);
  }
  tFrame(z, fps, moving = true) {
    return moving && !this.calm ? Math.floor(this.time * fps + (z.id || 0)) % 4 : 0;
  }

  // ================= 第六凶：雕爷和看门的 =================
  t_diao(z, e, o) {
    if (z.part === "boss") return this.tDiaoBoss(z, e, o);
    const boss = this.tSib(e, "diao", "boss"),
      A = z.act,
      k = A?.k,
      mine = this.tMine(e, z),
      held = e.tx?.hold?.src === z.id,
      moving = this.tMoving(z);
    let pose = "walk",
      fps = 5;
    if (k === "chargeWind") {
      pose = "charge";
      fps = 6;
    } else if (k === "charge") {
      pose = "charge";
      fps = 12;
    } else if (k === "stun" || k === "yank") pose = "stun";
    else if (z.stand > 0 || mine.some((S) => S.shape.k === "circle")) pose = "slam";
    else if (held || mine.some((S) => S.hit?.hold)) pose = "grab";
    const frame = pose === "walk" ? this.tFrame(z, fps, moving) : pose === "charge" ? this.tFrame(z, fps) : pose === "slam" ? (this.calm ? 0 : Math.floor(this.time * 4) % 2) : 0,
      cv = dogSprite(pose, frame, !boss);
    this.pxShadow(z.x, z.y, 76);
    this.tpx(cv, z.x, z.y + 6, { flip: o.flip, white: o.white });
    if (boss) this.tChain(z, boss, o.flip);
    return { top: pose === "slam" ? 180 : 150 };
  }
  tDiaoBoss(z, e, o) {
    const mine = this.tMine(e, z),
      moving = this.tMoving(z),
      tossed = (e.tx?.zones || []).some((Z) => Z.kind === "smoke" && Z.data?.of === "diao" && Z.max - Z.t < 0.45);
    let pose = "walk";
    if (mine.some((S) => S.shape.k === "circle") || tossed) pose = "throw";
    else if (z.act?.k === "aim" || mine.length) pose = "aim";
    const cv = diaoSprite(pose, pose === "walk" ? this.tFrame(z, 6, moving) : 0, !!z.coat);
    this.pxShadow(z.x, z.y, 34);
    this.tpx(cv, z.x, z.y + 4, { flip: o.flip, white: o.white });
    // 瞄你的那一下：枪口一点红光（大氅敞着）
    if (pose === "aim" && !this.calm && Math.floor(this.time * 10) % 2 === 0) {
      const c = this.ctx;
      c.fillStyle = "#ff6a4a";
      c.fillRect(snap(z.x + (o.flip ? -46 : 42)), snap(z.y - 78), 4, 4);
    }
    return { top: 142 };
  }
  // 铁链：从看门的脖子上的项圈拴到雕爷手里；离得近了垂下来，绷紧了拉直
  tChain(dog, boss, flip) {
    const c = this.ctx,
      ax = dog.x + (flip ? -46 : 46),
      ay = dog.y - 78,
      bx = boss.x + (Math.cos(boss.facing ?? 0) < 0 ? 12 : -12),
      by = boss.y - 62,
      d = Math.hypot(bx - ax, by - ay),
      len = TITANS.diao.chain,
      sag = dog.strain ? 3 : clamp((len - d) * 0.32, 4, 70) + 6,
      mx = (ax + bx) / 2,
      my = (ay + by) / 2 + sag,
      n = Math.max(6, Math.round(d / 9));
    c.save();
    for (let i = 0; i <= n; i++) {
      const t = i / n,
        x = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * mx + t * t * bx,
        y = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * my + t * t * by,
        wide = i % 2 === 0;
      c.fillStyle = "#1c140f";
      c.fillRect(snap(x) - 4, snap(y) - 3, wide ? 8 : 6, wide ? 6 : 6);
      c.fillStyle = wide ? "#62645d" : "#85857a";
      c.fillRect(snap(x) - 2, snap(y) - 1, wide ? 4 : 2, 2);
    }
    c.restore();
  }

  // ================= 第七凶：黑潮 =================
  t_tide(z, e, o) {
    const T = TITANS.tide,
      mine = this.tMine(e, z),
      moving = this.tMoving(z);
    let pose = "walk";
    if (z.act?.k === "spark" || mine.some((S) => S.col === "yellow")) pose = "spark";
    else if (mine.some((S) => S.shape.k === "line")) pose = "hook";
    else if (mine.some((S) => S.shape.k === "cone" && S.shape.r === T.anchor.r)) pose = "anchor";
    else if (mine.some((S) => S.shape.k === "cone")) pose = "spray";
    const stage = z.tp >= 2 ? 2 : z.tp >= 1 ? 1 : 0,
      frame = pose === "walk" ? this.tFrame(z, 4, moving) : pose === "spark" ? (this.calm ? 0 : Math.floor(this.time * 10) % 2) : 0,
      cv = tideSprite(pose, frame, stage),
      fl = o.flip ? -1 : 1;
    // 船锚：平时拖在身后，抡起来时举过头顶
    const anchor = anchorSprite();
    if (pose !== "anchor" && pose !== "hook") this.tpx(anchor, z.x - fl * 58, z.y + 4, { flip: o.flip });
    this.pxShadow(z.x, z.y, 58);
    this.tpx(cv, z.x, z.y + 6, { flip: o.flip, white: o.white });
    if (pose === "anchor") this.tpx(anchor, z.x, z.y - 176, { flip: o.flip });
    else if (pose === "hook") this.tpx(anchor, z.x + fl * 76, z.y - 120, { flip: o.flip });
    // 着火：身上一团团火苗（第三段整个烧着）
    if ((z.aflame > 0 && z.tp >= 1) || z.tp >= 2) this.tFlames(z.x, z.y, 56, 150, z.tp >= 2 ? 9 : 6, z.id);
    return { top: 196 };
  }
  // 一团火苗：在 (x, y) 往上一片里
  tFlames(x, y, w, h, n, seed = 0) {
    const t = this.calm ? 0 : this.time;
    for (let i = 0; i < n; i++) {
      const fx = x + Math.sin(i * 2.7 + seed) * w * 0.5,
        fy = y - 20 - ((i * 37 + seed * 13) % h),
        f = (Math.floor(t * 9) + i) % 3;
      this.px(flameArt(f, i % 3 !== 0), fx, fy + 14, { alpha: 0.95 });
    }
  }

  // ================= 第八凶：风口 =================
  t_vent(z, e, o) {
    if (z.part === "lung") return null;
    const A = z.act,
      mine = this.tMine(e, z),
      mode = A?.k === "suck" || A?.k === "suckWind" ? "suck" : mine.some((S) => S.shape.k === "cone") ? "blow" : "idle",
      step = Math.PI / 10,
      frame = this.calm ? 0 : ((Math.floor((z.spin || 0) / step) % 4) + 4) % 4,
      cv = ventSprite(mode, frame, z.tp >= 2);
    this.tpx(cv, z.x, z.y + 46, { white: o.white });
    // 墙上的肺：一张一缩（吐气的时候鼓到最大）；打破了的瘪下去
    const V = TITANS.vent,
      lungs = this.tSibs(e, "vent", "lung");
    V.lungs.forEach((L, i) => {
      const lz = lungs.find((q) => q.idx === i),
        x = z.x + L.dx,
        y = z.y + L.dy;
      if (!lz) {
        this.tpx(lungSprite(0, true), x, y + 2, { alpha: 0.35 });
        return;
      }
      const swell = lz.puff > 0 ? 3 : this.calm ? 1 : Math.floor((Math.sin((z.breath || 0) * 2.2 + i) + 1) * 1.6) % 4,
        white = lz.flash > 0 ? clamp(lz.flash / 0.12, 0, 1) * 0.75 : 0;
      this.tpx(lungSprite(swell, lz.hp < lz.maxHp * 0.5), x, y + 2, { white });
    });
    return { top: 150 };
  }

  // ================= 第九凶：末班车 =================
  t_train(z, e, o) {
    if (z.hidden) return null;
    const frame = this.calm ? 0 : Math.floor(this.time * 8 + (z.idx || 0)) % 4;
    if (z.part === "car") {
      const head = this.tSib(e, "train", "head"),
        open = head?.act?.k === "stop";
      this.pxShadow(z.x, z.y + 26, 110);
      this.tpx(trainCarSprite(z.idx || 0, frame, open), z.x + (z.swing > 0 && !this.calm ? Math.sin(this.time * 30) * 4 : 0), z.y + 30, { flip: o.flip, white: o.white });
      return { top: 96 };
    }
    const derail = z.tp >= 1;
    this.pxShadow(z.x, z.y + (derail ? 18 : 26), 120);
    this.tpx(trainHeadSprite(!!z.awake, frame, derail), z.x, z.y + (derail ? 20 : 30), { flip: o.flip, white: o.white });
    return { top: derail ? 96 : 104 };
  }

  // ================= 最后一凶：扑火 =================
  t_moth(z, e, o) {
    if (z.part === "light" || z.hidden) return null;
    const M = TITANS.moth;
    if (z.heart) {
      const frame = this.calm ? 0 : Math.floor(this.time * (z.tp >= 2 ? 8 : 4)) % 4;
      this.pxShadow(z.x, z.y, 70);
      this.tpx(heartSprite(frame, z.tp >= 2), z.x, z.y + 6, { flip: o.flip, white: o.white });
      return { top: 100 };
    }
    const moving = this.tMoving(z),
      frame = this.tFrame(z, 2, moving || !this.calm);
    this.pxShadow(z.x, z.y, 300);
    this.tpx(mothSprite("walk", frame), z.x, z.y + 10, { flip: o.flip, white: o.white });
    // 四盏光：亮着的一团火，暗下去的两秒缩成一点暗红；打灭了的地方一个焦黑的窟窿
    const lights = this.tSibs(e, "moth", "light"),
      c = this.ctx,
      t = this.calm ? 0 : this.time;
    M.lights.forEach((L, i) => {
      const lz = lights.find((q) => q.idx === i),
        x = snap(z.x + L.dx),
        y = snap(z.y + L.dy);
      c.save();
      if (!lz) {
        c.fillStyle = "#18130f";
        c.beginPath();
        c.ellipse(x, y, 18, 14, 0, 0, TAU);
        c.fill();
        c.fillStyle = "#5e2418";
        c.fillRect(x - 6, y - 2, 4, 2);
        c.fillRect(x + 4, y + 4, 2, 2);
        c.restore();
        return;
      }
      const dim = !!lz.dim,
        pulse = 1 + 0.08 * Math.sin(t * 7 + i),
        R = (dim ? 13 : 26) * pulse;
      c.fillStyle = "#1c140f";
      c.beginPath();
      c.ellipse(x, y + 2, R + 8, R * 0.85 + 6, 0, 0, TAU);
      c.fill();
      c.fillStyle = dim ? "#5e2418" : "#bf5a28";
      c.beginPath();
      c.arc(x, y, R, 0, TAU);
      c.fill();
      c.fillStyle = dim ? "#8e3a20" : "#f6b05a";
      c.beginPath();
      c.arc(x - R * 0.15, y - R * 0.15, R * 0.62, 0, TAU);
      c.fill();
      if (!dim) {
        c.fillStyle = "#ffdb8c";
        c.beginPath();
        c.arc(x - R * 0.2, y - R * 0.25, R * 0.3, 0, TAU);
        c.fill();
        this.px(flameArt(Math.floor(t * 9 + i) % 3, true), x, y - R + 10, { alpha: 0.95 });
      }
      if (lz.flash > 0) {
        c.globalAlpha = clamp(lz.flash / 0.12, 0, 1) * 0.8;
        c.fillStyle = "#fff6e0";
        c.beginPath();
        c.arc(x, y, R + 2, 0, TAU);
        c.fill();
      }
      c.restore();
    });
    return { top: 320 };
  }

  // ---------- 倒下 ----------
  tFall(f, k) {
    if (!NEW5.has(f.titan)) return super.tFall(f, k);
    const flip = Math.cos(f.facing ?? 0) < 0,
      alpha = 1 - k * k;
    let cv = null,
      y = f.y + 4,
      sink = k * 0.6;
    if (f.titan === "diao") cv = f.part === "boss" ? diaoSprite("walk", 0, false) : dogSprite("stun", 0, true);
    else if (f.titan === "tide") cv = tideSprite("walk", 0, 1);
    else if (f.titan === "vent") {
      // 墙不沉：风机慢慢停下来、那一大片淡下去；肺瘪下去
      cv = f.part === "lung" ? lungSprite(0, true) : ventSprite("idle", 0, false);
      y = f.y + (f.part === "lung" ? 2 : 46);
      sink = 0;
    } else if (f.titan === "train") {
      cv = f.part === "car" ? trainCarSprite(f.idx || 0, 0, true) : trainHeadSprite(false, 0, true);
      y = f.y + 26;
      sink = k * 0.3;
    } else if (f.titan === "moth") {
      if (f.part === "light") return;
      cv = heartSprite(0, false);
    }
    this.tpx(cv, f.x, y, { flip, alpha, sink });
  }

  // ---------- 地上那一层：油、着了的火、通电的铁轨 ----------
  tGround(e) {
    super.tGround(e);
    const c = this.ctx,
      t = this.calm ? 0 : this.time;
    c.save();
    for (const Z of e.tx.zones) {
      const fade = fadeOf(Z);
      if (Z.kind === "oil") {
        // 黑亮的一滩，边上一圈油光
        c.fillStyle = rgba([20, 22, 30], 0.82 * fade);
        c.beginPath();
        c.ellipse(Z.x, Z.y, Z.r, Z.r * 0.72, 0, 0, TAU);
        c.fill();
        c.fillStyle = rgba([51, 68, 106], 0.55 * fade);
        for (let i = 0; i < 5; i++) {
          const a = i * 1.9 + Z.x * 0.013,
            r = Z.r * (0.25 + ((i * 29) % 50) / 100);
          c.fillRect(snap(Z.x + Math.cos(a) * r), snap(Z.y + Math.sin(a) * r * 0.7), 10, 2);
        }
        c.fillStyle = rgba([86, 106, 150], 0.4 * fade);
        c.fillRect(snap(Z.x - Z.r * 0.4), snap(Z.y - Z.r * 0.3), 14, 2);
      } else if (Z.kind === "fire") {
        // 地上烧黑一片，红光一闪一闪
        const fl = 0.85 + 0.15 * Math.sin(t * 11 + Z.x);
        c.fillStyle = rgba([40, 22, 14], 0.7 * fade);
        c.beginPath();
        c.ellipse(Z.x, Z.y, Z.r, Z.r * 0.72, 0, 0, TAU);
        c.fill();
        c.fillStyle = rgba([191, 90, 40], 0.5 * fade * fl);
        c.beginPath();
        c.ellipse(Z.x, Z.y, Z.r * 0.82, Z.r * 0.58, 0, 0, TAU);
        c.fill();
        c.fillStyle = rgba([246, 176, 90], 0.45 * fade * fl);
        c.beginPath();
        c.ellipse(Z.x, Z.y, Z.r * 0.42, Z.r * 0.3, 0, 0, TAU);
        c.fill();
      } else if (Z.kind === "volt") {
        // 两条铁轨发蓝
        const fl = this.calm ? 1 : 0.7 + 0.3 * Math.abs(Math.sin(t * 17));
        c.fillStyle = rgba([96, 168, 228], 0.18 * fade);
        c.fillRect(Z.x, Z.y, Z.w, Z.h);
        c.fillStyle = rgba([160, 214, 255], 0.75 * fade * fl);
        for (const ry of [Z.y + Z.h * 0.38, Z.y + Z.h * 0.62]) c.fillRect(Z.x, snap(ry), Z.w, 4);
      }
    }
    c.restore();
  }

  // ---------- 光照之后、字之前 ----------
  tOverlay(e, view) {
    const tx = e.tx;
    if (!tx || e.s?.region == null) return;
    const F = e.titanFog?.();
    if (F) this.tFog(e, F, view);
    if (F?.white) this.tBlizzard(view);
    this.tSmoke(e);
    this.tFireTongues(e);
    this.tZoneMarks(e);
    this.tZoneMarks2(e);
    this.tPodRings(e);
    this.tWarmRings(e);
    this.tVolt(e);
    this.tBlades(e);
    this.tWaves(e);
    for (const S of tx.strikes) this.tStrike(S);
    this.tRings(tx.rings);
    this.tShots(tx.shots);
    this.tFx(tx.fx, e);
    this.tFx2(tx.fx, e);
    this.tHold(e);
    this.tPartBars(e);
  }
  // 雕爷的烟雾弹：一大团灰，慢慢散开
  tSmoke(e) {
    const c = this.ctx,
      t = this.calm ? 0 : this.time;
    for (const Z of e.tx.zones) {
      if (Z.kind !== "smoke") continue;
      const fade = fadeOf(Z),
        grow = Math.min(1, 0.55 + (Z.max - Z.t) / Math.max(0.1, Z.max) * 0.9),
        R = Z.r * grow;
      c.save();
      for (let i = 0; i < 9; i++) {
        const a = i * 0.7 + t * 0.25 * (i % 2 ? 1 : -1),
          r = R * (i ? 0.5 : 0.1),
          x = Z.x + Math.cos(a) * r,
          y = Z.y - 30 + Math.sin(a) * r * 0.6;
        c.fillStyle = rgba(i % 3 ? [150, 150, 140] : [190, 188, 176], 0.3 * fade);
        c.beginPath();
        c.arc(x, y, R * (0.4 + (i % 3) * 0.08), 0, TAU);
        c.fill();
      }
      c.strokeStyle = rgba([220, 216, 200], 0.5 * fade);
      c.lineWidth = 2;
      c.setLineDash([4, 8]);
      c.beginPath();
      c.ellipse(Z.x, Z.y, R, R * 0.72, 0, 0, TAU);
      c.stroke();
      c.restore();
    }
  }
  // 着了的油、燃烧瓶：一簇簇火苗（夜里也看得清哪儿在烧）
  tFireTongues(e) {
    const t = this.calm ? 0 : this.time;
    for (const Z of e.tx.zones) {
      if (Z.kind !== "fire") continue;
      const n = Math.max(3, Math.round(Z.r / 16)),
        fade = fadeOf(Z);
      if (fade <= 0.05) continue;
      for (let i = 0; i < n; i++) {
        const a = i * 2.39996 + Z.x * 0.01,
          r = Z.r * (0.15 + ((i * 37) % 70) / 100),
          x = Z.x + Math.cos(a) * r,
          y = Z.y + Math.sin(a) * r * 0.66;
        this.px(flameArt((Math.floor(t * 9) + i) % 3, i % 2 === 0), x, y + 4, { alpha: 0.9 * fade });
      }
    }
  }
  // 油、火、烟：夜里描一圈虚线看得出边
  tZoneMarks2(e) {
    const c = this.ctx;
    c.save();
    c.lineWidth = 2;
    c.setLineDash([6, 6]);
    for (const Z of e.tx.zones) {
      const fade = fadeOf(Z);
      if (Z.kind === "oil") c.strokeStyle = rgba([110, 130, 180], 0.6 * fade);
      else if (Z.kind === "fire") c.strokeStyle = rgba([255, 170, 90], 0.75 * fade);
      else continue;
      c.beginPath();
      c.ellipse(Z.x, Z.y, Z.r, Z.r * 0.72, 0, 0, TAU);
      c.stroke();
    }
    c.restore();
  }
  // 通电的铁轨：一道道电火花在铁轨上跳
  tVolt(e) {
    const c = this.ctx,
      t = this.calm ? 0 : this.time;
    for (const Z of e.tx.zones) {
      if (Z.kind !== "volt") continue;
      const fade = fadeOf(Z),
        seg = 22;
      c.save();
      c.strokeStyle = rgba([216, 240, 255], 0.9 * fade);
      c.lineWidth = 2;
      for (const ry of [Z.y + Z.h * 0.38, Z.y + Z.h * 0.62]) {
        c.beginPath();
        for (let x = Z.x; x <= Z.x + Z.w; x += seg) {
          const j = Math.sin(x * 0.37 + Math.floor(t * 20) * 1.7) * 7;
          if (x === Z.x) c.moveTo(x, ry + j);
          else c.lineTo(x, ry + j);
        }
        c.stroke();
      }
      c.restore();
    }
  }
  // 风口的风刃：从风口外一圈起，扫过墙外那一半（转着的两道刀光）
  tBlades(e) {
    const z = (e.enemies || []).find((q) => q.titan === "vent" && q.part === "fan" && !q.dead && q.tp >= 1);
    if (!z) return;
    const B = TITANS.vent.blades,
      n = B.n[Math.min(z.tp, B.n.length - 1)],
      c = this.ctx;
    c.save();
    for (let i = 0; i < n; i++) {
      const a = (z.bladeA || 0) + (i * TAU) / n;
      if (Math.sin(a) < 0.05) continue;
      const ux = Math.cos(a),
        uy = Math.sin(a),
        x0 = z.x + ux * B.r0,
        y0 = z.y + uy * B.r0,
        x1 = z.x + ux * B.len,
        y1 = z.y + uy * B.len,
        hw = B.w / 2;
      // 拖在后面的一道残影
      c.fillStyle = "rgba(214,70,52,0.18)";
      c.beginPath();
      c.moveTo(z.x, z.y);
      c.arc(z.x, z.y, B.len, a - 0.32, a);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(x0 - uy * hw, y0 + ux * hw);
      c.lineTo(x1 - uy * hw, y1 + ux * hw);
      c.lineTo(x1 + uy * hw, y1 - ux * hw);
      c.lineTo(x0 + uy * hw, y0 - ux * hw);
      c.closePath();
      c.fillStyle = "rgba(255,112,84,0.55)";
      c.fill();
      c.lineWidth = 5;
      c.strokeStyle = "rgba(28,20,15,0.75)";
      c.stroke();
      c.lineWidth = 2;
      c.strokeStyle = "#ffd0b8";
      c.stroke();
    }
    c.restore();
  }
  // 扑火塌下来的浪：从东往西卷过整张图，只留一条横着的口子；来之前那条口子先亮起来
  tWaves(e) {
    const L = e.tx.waves;
    if (!L?.length) return;
    const c = this.ctx,
      t = this.calm ? 0 : this.time,
      W = WORLD.w || 1536,
      H = WORLD.h || 1024;
    c.save();
    for (const w of L) {
      const wait = w.wait > 0,
        k = wait ? clamp(1 - w.wait / Math.max(0.01, w.max), 0, 1) : 1;
      // 口子：两道亮线，中间淡淡一层
      c.fillStyle = `rgba(255,226,120,${(wait ? 0.12 + 0.12 * k : 0.1).toFixed(3)})`;
      c.fillRect(0, w.gy0, W, w.gy1 - w.gy0);
      c.strokeStyle = wait && Math.floor(t * 8) % 2 === 0 ? "#fff6d0" : "#ffe08a";
      c.lineWidth = 3;
      c.setLineDash([12, 8]);
      c.beginPath();
      c.moveTo(0, w.gy0);
      c.lineTo(W, w.gy0);
      c.moveTo(0, w.gy1);
      c.lineTo(W, w.gy1);
      c.stroke();
      c.setLineDash([]);
      if (wait) {
        // 东边那一头先红起来（浪从那边来）
        c.fillStyle = `rgba(214,70,52,${(0.15 + 0.3 * k).toFixed(3)})`;
        c.fillRect(W - 120 - 200 * k, 0, 120 + 200 * k, w.gy0);
        c.fillRect(W - 120 - 200 * k, w.gy1, 120 + 200 * k, H - w.gy1);
        continue;
      }
      // 浪：一堵焦黑的墙，顶上一道火光，墙里伸出胳膊
      const x0 = w.x - w.w / 2,
        bands = [
          [0, w.gy0],
          [w.gy1, H],
        ];
      for (const [ya, yb] of bands) {
        if (yb - ya < 4) continue;
        c.fillStyle = "rgba(28,20,15,0.92)";
        c.fillRect(x0, ya, w.w, yb - ya);
        c.fillStyle = "rgba(85,53,34,0.95)";
        for (let y = ya; y < yb; y += 26) {
          const j = Math.sin(y * 0.13 + t * 6) * 10;
          c.fillRect(snap(x0 + 10 + j), snap(y), w.w * 0.45, 14);
        }
        c.fillStyle = "rgba(191,90,40,0.9)";
        for (let y = ya; y < yb; y += 18) c.fillRect(snap(x0 - 6 + Math.sin(y * 0.21 + t * 9) * 6), snap(y), 10, 10);
        c.fillStyle = "rgba(246,176,90,0.85)";
        for (let y = ya + 6; y < yb; y += 34) c.fillRect(snap(x0 - 10 + Math.sin(y * 0.3 + t * 7) * 8), snap(y), 6, 6);
        // 墙里伸出来的手
        c.fillStyle = "#7a4a36";
        for (let y = ya + 14; y < yb; y += 46) {
          const r = Math.sin(y * 0.7) * 6;
          c.fillRect(snap(x0 - 22 + r), snap(y), 22, 6);
          c.fillRect(snap(x0 - 26 + r), snap(y - 2), 4, 4);
          c.fillRect(snap(x0 - 26 + r), snap(y + 4), 4, 4);
        }
      }
    }
    c.restore();
  }
  // 扔过来的瓶子、油桶、感染者，砸下来的手，吸进去的灰，进站的那盏灯，炸开、塌下去、断开的铁链、掉下来的大氅
  tFx2(list, e) {
    const c = this.ctx,
      t = this.calm ? 0 : this.time;
    for (const f of list) {
      const k = clamp(1 - f.t / Math.max(0.01, f.max), 0, 1);
      c.save();
      if (f.kind === "bottle" || f.kind === "drum" || f.kind === "fling") {
        const lift = f.kind === "drum" ? 180 : f.kind === "fling" ? 220 : 140,
          x = f.x0 + (f.x - f.x0) * k,
          y = f.y0 + (f.y - f.y0) * k - Math.sin(k * Math.PI) * lift;
        c.fillStyle = "rgba(24,19,15,0.4)";
        c.beginPath();
        c.ellipse(f.x0 + (f.x - f.x0) * k, f.y0 + 80 + (f.y - f.y0 - 80) * k, f.kind === "fling" ? 22 : 12, 6, 0, 0, TAU);
        c.fill();
        if (f.kind === "drum") this.tpx(drumSprite(Math.floor(t * 8) % 2), x, y + 18);
        else if (f.kind === "bottle") {
          c.translate(snap(x), snap(y));
          c.rotate(this.calm ? 0 : k * 9);
          c.fillStyle = "#1c140f";
          c.fillRect(-5, -9, 10, 18);
          c.fillStyle = "#4c632d";
          c.fillRect(-3, -7, 6, 14);
          c.fillStyle = "#f6b05a";
          c.fillRect(-2, -13, 4, 5);
          c.fillStyle = "#ffdb8c";
          c.fillRect(-1, -15, 2, 3);
        } else {
          // 一具扯下来的身子，手脚乱甩
          c.translate(snap(x), snap(y));
          c.rotate(this.calm ? 0 : k * 6);
          c.fillStyle = "#1c140f";
          c.fillRect(-14, -9, 28, 18);
          c.fillStyle = "#4a3c30";
          c.fillRect(-12, -7, 24, 14);
          c.fillStyle = "#7a4a36";
          c.fillRect(-20, -5, 8, 4);
          c.fillRect(12, 2, 10, 4);
          c.fillRect(-6, 7, 4, 8);
          c.fillStyle = "#625244";
          c.fillRect(8, -11, 8, 8);
          c.fillStyle = "#e5823a";
          c.fillRect(12, -9, 2, 2);
        }
      } else if (f.kind === "hand") {
        // 巨手：地上的影子越来越大，最后从天上拍下来
        const w = f.warn || f.max,
          kw = clamp((f.max - f.t) / Math.max(0.01, w), 0, 1),
          R = f.r * (0.5 + 0.5 * kw);
        c.fillStyle = `rgba(16,12,9,${(0.25 + 0.45 * kw).toFixed(3)})`;
        c.beginPath();
        c.ellipse(f.x, f.y, R, R * 0.6, 0, 0, TAU);
        c.fill();
        const drop = kw < 1 ? (1 - kw) * 420 + 60 : 0,
          hy = f.y - 40 - drop,
          s = f.r / 60;
        c.globalAlpha = kw < 1 ? 0.35 + 0.65 * kw : 1 - clamp((f.max - f.t - w) / 0.35, 0, 1);
        c.fillStyle = "#1c140f";
        c.fillRect(snap(f.x - 44 * s), snap(hy - 30 * s), snap(88 * s), snap(56 * s));
        c.fillStyle = "#4a3c30";
        c.fillRect(snap(f.x - 40 * s), snap(hy - 26 * s), snap(80 * s), snap(48 * s));
        c.fillStyle = "#625244";
        for (let i = 0; i < 4; i++) c.fillRect(snap(f.x - 38 * s + i * 22 * s), snap(hy + 18 * s), snap(14 * s), snap(30 * s));
        c.fillRect(snap(f.x + 40 * s), snap(hy - 10 * s), snap(20 * s), snap(14 * s));
        c.fillStyle = "#bf5a28";
        c.fillRect(snap(f.x - 20 * s), snap(hy - 10 * s), snap(6 * s), 2);
        c.fillRect(snap(f.x + 10 * s), snap(hy), snap(8 * s), 2);
      } else if (f.kind === "suck") {
        // 地上的灰往风口卷（越近越快）
        const n = this.calm ? 10 : 34;
        c.fillStyle = "rgba(205,200,182,0.75)";
        for (let i = 0; i < n; i++) {
          const a = Math.PI * (0.08 + 0.84 * ((i * 0.61803) % 1)),
            ph = ((i * 0.37 + (this.calm ? 0 : t * 0.9)) % 1),
            r = f.r * (1 - ph),
            x = f.x + Math.cos(a) * r,
            y = f.y + Math.sin(a) * r * 0.8;
          c.globalAlpha = 0.25 + 0.6 * ph;
          c.fillRect(snap(x), snap(y), 10 - Math.round(ph * 6), 2);
        }
        c.globalAlpha = 1;
        c.strokeStyle = "rgba(205,200,182,0.45)";
        c.lineWidth = 2;
        c.setLineDash([6, 10]);
        c.beginPath();
        c.arc(f.x, f.y, f.r, 0, Math.PI);
        c.stroke();
        c.setLineDash([]);
      } else if (f.kind === "headlight") {
        // 远处那一头：一盏灯越来越亮、越来越近
        const R = 10 + 40 * k;
        c.fillStyle = `rgba(255,240,200,${(0.25 + 0.5 * k).toFixed(3)})`;
        c.beginPath();
        c.arc(f.x, f.y, R * 2.2, 0, TAU);
        c.fill();
        c.fillStyle = "#fff6e0";
        c.beginPath();
        c.arc(f.x, f.y, R * 0.6, 0, TAU);
        c.fill();
        c.fillStyle = `rgba(255,240,200,${(0.12 + 0.2 * k).toFixed(3)})`;
        c.beginPath();
        c.moveTo(f.x, f.y - R * 0.5);
        c.lineTo(f.x + f.dir * (300 + 700 * k), f.y - 70);
        c.lineTo(f.x + f.dir * (300 + 700 * k), f.y + 70);
        c.lineTo(f.x, f.y + R * 0.5);
        c.closePath();
        c.fill();
      } else if (f.kind === "burst") {
        // 炸开：一圈碎块（光灭了是火星，肺破了、车厢打掉是碎肉、碎铁）
        const cols = f.fire ? ["#ffdb8c", "#f6b05a", "#bf5a28"] : ["#a8433a", "#7a4a36", "#62645d"];
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * TAU + i,
            r = 10 + k * (60 + (i % 4) * 20),
            h = Math.sin(k * Math.PI) * 30 * (i % 3);
          c.globalAlpha = 1 - k;
          c.fillStyle = cols[i % 3];
          c.fillRect(snap(f.x + Math.cos(a) * r), snap(f.y + Math.sin(a) * r * 0.6 - h), i % 2 ? 6 : 4, i % 2 ? 6 : 4);
        }
      } else if (f.kind === "derail" || f.kind === "collapse") {
        // 翻下轨道、塌下来：一大团灰，火星
        if (f.kind === "collapse") this.tpx(mothSprite("collapse", 0), f.x, f.y + 10, { alpha: 1 - k, sink: k });
        const n = f.kind === "collapse" ? 26 : 16,
          span = f.kind === "collapse" ? 240 : 110;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU,
            r = 20 + k * span * (0.6 + (i % 3) * 0.2);
          c.globalAlpha = 0.7 * (1 - k);
          c.fillStyle = i % 4 === 0 ? "#f6b05a" : "#85857a";
          c.fillRect(snap(f.x + Math.cos(a) * r), snap(f.y - 20 + Math.sin(a) * r * 0.45 - Math.sin(k * Math.PI) * 30), i % 4 === 0 ? 4 : 10, i % 4 === 0 ? 4 : 6);
        }
      } else if (f.kind === "snap") {
        // 铁链断了：几节链环飞出去
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + 0.4,
            r = 14 + k * 90;
          c.globalAlpha = 1 - k;
          c.fillStyle = "#1c140f";
          c.fillRect(snap(f.x + Math.cos(a) * r) - 4, snap(f.y - 64 + Math.sin(a) * r * 0.6) - 3, 8, 6);
          c.fillStyle = "#85857a";
          c.fillRect(snap(f.x + Math.cos(a) * r) - 2, snap(f.y - 64 + Math.sin(a) * r * 0.6) - 1, 4, 2);
        }
      } else if (f.kind === "coat") {
        // 大氅从肩上滑下来，落在地上
        const y = f.y - 110 + 100 * Math.min(1, k * 1.6);
        c.globalAlpha = 1 - clamp((k - 0.7) / 0.3, 0, 1);
        c.fillStyle = "#1c140f";
        c.fillRect(snap(f.x - 24), snap(y - 4), 48, Math.max(6, snap(60 * (1 - k))));
        c.fillStyle = "#62645d";
        c.fillRect(snap(f.x - 22), snap(y - 2), 44, Math.max(4, snap(56 * (1 - k))));
        c.fillStyle = "#8d6340";
        c.fillRect(snap(f.x - 18), snap(y - 4), 36, 6);
      }
      c.restore();
    }
  }
  // 被抓住：黑潮是锚链拴着你，风口是墙里伸出来的手，看门的咬住时不画手
  tHold(e) {
    const H = e.tx.hold;
    if (!H) return;
    const z = (e.enemies || []).find((x) => x.id === H.src);
    if (!z || !NEW5.has(z.titan)) return super.tHold(e);
    const p = e.s.player,
      c = this.ctx,
      wig = this.calm ? 0 : Math.sin(this.time * 14) * 3;
    let sx = z.x,
      sy = z.y - 90,
      kind = "arm";
    if (z.titan === "tide") {
      sx = z.x + Math.cos(z.facing ?? 0) * 40;
      sy = z.y - 120;
      kind = "chain";
    } else if (z.titan === "vent") {
      const lungs = this.tSibs(e, "vent", "lung"),
        from = [z, ...lungs].sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      sx = from.x;
      sy = from.y - 20;
      kind = "flesh";
    } else if (z.titan === "diao" && z.part === "dog" && !this.tSib(e, "diao", "boss")) kind = "bite";
    else if (z.titan === "diao") {
      sx = z.x + Math.cos(z.facing ?? 0) * 70;
      sy = z.y - 110;
    }
    const ex = p.x,
      ey = p.y - 30;
    c.save();
    c.lineCap = "round";
    if (kind === "chain") {
      const n = Math.max(6, Math.round(Math.hypot(ex - sx, ey - sy) / 10));
      for (let i = 0; i <= n; i++) {
        const t = i / n,
          x = sx + (ex - sx) * t,
          y = sy + (ey - sy) * t - Math.sin(t * Math.PI) * 16 + wig * t;
        c.fillStyle = "#1c140f";
        c.fillRect(snap(x) - 4, snap(y) - 3, 8, 6);
        c.fillStyle = i % 2 ? "#85857a" : "#62645d";
        c.fillRect(snap(x) - 2, snap(y) - 1, 4, 2);
      }
      this.tpx(anchorSprite(), ex, ey + 30);
    } else if (kind !== "bite") {
      c.strokeStyle = "#1c140f";
      c.lineWidth = 14;
      c.beginPath();
      c.moveTo(sx, sy);
      c.quadraticCurveTo((sx + ex) / 2, (sy + ey) / 2 - 30 + wig, ex, ey);
      c.stroke();
      c.strokeStyle = kind === "flesh" ? "#7a4a36" : "#62645d";
      c.lineWidth = 9;
      c.stroke();
      c.strokeStyle = kind === "flesh" ? "#b0765a" : "#85857a";
      c.lineWidth = 3;
      c.stroke();
      c.fillStyle = kind === "flesh" ? "#7a4a36" : "#454847";
      c.fillRect(snap(ex - 10), snap(ey - 6), 20, 12);
    }
    const w = 60,
      X = snap(p.x - w / 2),
      Y = snap(p.y - 104);
    c.fillStyle = "#140f0b";
    c.fillRect(X - 2, Y - 2, w + 4, 10);
    c.fillStyle = "#4a3c30";
    c.fillRect(X, Y, w, 6);
    c.fillStyle = "#ffdb8c";
    c.fillRect(X, Y, snap(w * clamp(H.escape || 0, 0, 1)), 6);
    c.restore();
    this.text(kind === "bite" ? "被咬住了 · 推开 或 连按交互" : "被抓住了 · 推开 或 连按交互", p.x, p.y - 118, "#ffb3a0", 12);
  }
  // 每一只身上的小血条（肺、光、车厢、雕爷和看门的）：挨过打才画
  tPartBars(e) {
    const c = this.ctx;
    for (const z of e.enemies || []) {
      if (!z.part || z.dead || z.hidden || !z.awake || !NEW5.has(z.titan) || !(z.hp < z.maxHp)) continue;
      const main = z.part === mainPart(z.titan);
      if (main && z.titan !== "diao") continue;
      const lift = { lung: 64, light: 48, car: 92, boss: 152, dog: 188 }[z.part] ?? 100,
        w = z.part === "dog" ? 72 : z.part === "car" ? 64 : 44,
        X = snap(z.x - w / 2),
        Y = snap(z.y - lift);
      c.fillStyle = "#140f0b";
      c.fillRect(X - 2, Y - 2, w + 4, 8);
      c.fillStyle = "#4a3c30";
      c.fillRect(X, Y, w, 4);
      c.fillStyle = z.part === "light" ? (z.dim ? "#8e3a20" : "#f6b05a") : "#d2654c";
      c.fillRect(X, Y, snap((w * Math.max(0, z.hp)) / Math.max(1, z.maxHp)), 4);
    }
  }

  // ---------- 光 ----------
  // 风口长在墙上：盖住的那几扇窗户不亮（夜里的窗光画在最上面一层，会透过那一大片人）
  tCovered(e) {
    if (e?.s?.region !== TITANS.vent.region) return null;
    const f = (e.enemies || []).find((z) => z.titan === "vent" && z.part === "fan" && !z.dead);
    if (!f) return null;
    return { x0: (f.x - 168) / 2, x1: (f.x + 168) / 2, y0: (f.y + 46 - 190) / 2, y1: (f.y + 52) / 2 };
  }
  withCovered(e, fn) {
    const R = this.tCovered(e),
      art = this.art;
    if (!R || !Array.isArray(art?.lights)) return fn();
    const lights = art.lights;
    art.lights = lights.filter((l) => !(l.kind === "window" && l.x >= R.x0 && l.x <= R.x1 && l.y >= R.y0 && l.y <= R.y1));
    try {
      return fn();
    } finally {
      art.lights = lights;
    }
  }
  collectLights(e, night) {
    const L = this.withCovered(e, () => super.collectLights(e, night));
    if (!e?.tg || (night <= 0.15 && !this.indoor)) return L;
    const t = this.calm ? 0 : this.time;
    for (const Z of e.tx?.zones || []) {
      if (Z.kind === "fire") L.push({ x: Z.x, y: Z.y - 10, r: Z.r + 70, color: FIRE, power: 0.85 * fadeOf(Z) });
      else if (Z.kind === "volt") for (let x = Z.x + 80; x < Z.x + Z.w; x += 220) L.push({ x, y: Z.y + Z.h / 2, r: 80, color: [160, 214, 255], power: 0.55 * fadeOf(Z) * (0.7 + 0.3 * Math.abs(Math.sin(t * 17 + x))) });
    }
    for (const f of e.tx?.fx || []) {
      if (f.kind !== "headlight") continue;
      const k = clamp(1 - f.t / Math.max(0.01, f.max), 0, 1);
      L.push({ x: f.x, y: f.y, r: 90 + 260 * k, color: [255, 240, 200], power: 0.5 + 0.45 * k });
    }
    for (const z of e.enemies || []) {
      if (!z.titan || z.dead || z.hidden || !NEW5.has(z.titan)) continue;
      if (z.titan === "moth") {
        if (z.part === "light") L.push({ x: z.x, y: z.y, r: z.dim ? 110 : 210, color: [255, 176, 90], power: z.dim ? 0.45 : 0.95 });
        else if (z.heart) L.push({ x: z.x, y: z.y - 50, r: 250, color: [255, 120, 60], power: 0.9 });
        else L.push({ x: z.x, y: z.y - 120, r: 280, color: [200, 90, 40], power: 0.35 });
      } else if (z.titan === "train" && z.part === "head" && z.awake) {
        const dir = Math.cos(z.facing ?? 0) < 0 ? -1 : 1;
        L.push({ x: z.x + dir * 70, y: z.y - 20, r: z.tp >= 1 ? 120 : 230, color: [255, 240, 200], power: z.tp >= 1 ? 0.5 : 0.9 });
      } else if (z.titan === "vent" && z.part === "fan" && z.awake) L.push({ x: z.x, y: z.y - 46, r: 170, color: z.tp >= 2 ? [230, 90, 60] : [190, 200, 170], power: z.tp >= 2 ? 0.65 : 0.4 });
      else if (z.titan === "diao" && z.awake) L.push({ x: z.x, y: z.y - 70, r: 150, color: [230, 190, 150], power: 0.38 });
      else if (z.titan === "tide" && ((z.aflame > 0 && z.tp >= 1) || z.tp >= 2)) L.push({ x: z.x, y: z.y - 90, r: 210, color: FIRE, power: 0.8 });
    }
    // 打赢末班车以后：隧道每一层轨道顶上的灯都亮着
    this._tLamps = null;
    if (e.s?.region === "tunnel" && e.tg.perks?.train && this.art?.lights) {
      const have = this.art.lights.filter((l) => l.kind === "fluoro"),
        add = TRACK_LAMPS.filter((q) => !have.some((l) => Math.abs(l.x - q.x) < 10 && Math.abs(l.y - q.y) < 10));
      for (const q of add) L.push({ x: q.x * 2, y: q.y * 2, r: 150, color: [200, 225, 255], power: 0.8, flat: 0.7 });
      this._tLamps = add;
    }
    return L;
  }
  drawEmissive(e, night, view) {
    this.withCovered(e, () => super.drawEmissive(e, night, view));
    // 补上的日光灯管
    if (this._tLamps?.length && e.s?.region === "tunnel") {
      const c = this.ctx;
      for (const q of this._tLamps) {
        const x = q.x * 2,
          y = q.y * 2;
        c.fillStyle = "#454847";
        c.fillRect(snap(x - 16), snap(y - 2), 32, 6);
        c.fillStyle = "#e6ede9";
        c.fillRect(snap(x - 14), snap(y), 28, 2);
      }
    }
  }

  // ---------- 十凶碑：纪念石旁边，刻着十凶的名号，打赢过的那一格亮 ----------
  drawObject(o, e) {
    super.drawObject(o, e);
    if (o?.type === "seasonPlaza" && (e?.tg?.perks?.moth || e?.tg?.caseDone?.includes(10))) this.tStele(e, o);
  }
  tStele(e, o) {
    // 纪念石（广场西边 170、往上 24）的正下方那块空地
    const c = this.ctx,
      x = snap(o.x - 166),
      y = snap(o.y + 2);
    c.save();
    c.fillStyle = "rgba(20,14,10,0.35)";
    c.fillRect(x - 4, y + 52, 38, 6);
    c.fillStyle = "#2e3030";
    c.fillRect(x - 2, y - 2, 34, 58);
    c.fillStyle = "#62645d";
    c.fillRect(x, y, 30, 54);
    c.fillStyle = "#85857a";
    c.fillRect(x, y, 30, 4);
    c.fillRect(x + 4, y - 6, 22, 6);
    c.fillStyle = "#aaa797";
    c.fillRect(x + 8, y - 8, 14, 2);
    // 十格：两列五行，打赢过的那一凶亮一点余烬色
    TITAN_IDS.forEach((id, i) => {
      const cx = x + 5 + (i % 2) * 12,
        cy = y + 8 + Math.floor(i / 2) * 9;
      c.fillStyle = "#2e3030";
      c.fillRect(cx, cy, 8, 6);
      c.fillStyle = e.tg.first?.[id] ? (id === "moth" ? "#ffdb8c" : "#e5823a") : "#454847";
      c.fillRect(cx + 2, cy + 2, 4, 2);
    });
    c.restore();
    const p = e.s.player;
    if (Math.hypot(p.x - (x + 15), p.y - (y + 40)) < 110) this.label2?.("十凶碑", x + 15, y - 22, "#f1d98a", 11);
  }
}
