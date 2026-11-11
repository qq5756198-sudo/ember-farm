#!/usr/bin/env python3
# v0.50「落脚」界面检查：真浏览器里把标题页、出身页、过场、常驻的七块、每一页、每张能开的卡开一遍，
# 在 1366×768 和 1920×1080 两个窗口里各量一遍：
#   1. 字号：界面上的字不小于 14px；
#   2. 不出画面：每一块、每个按钮都在窗口里（在能滚的列表里被裁掉的不算），整页不出滚动条；
#   3. 字不溢出自己的框；
#   4. 常驻的块互相不压；
#   5. 顶上每个资源数字点开都有“从哪来、到哪去”；
#   6. 看得见的字里没有开发用词，也没有 undefined、NaN；
#   7. 页面不报错。
# 用法：python3 scripts/check-ui.py <第一章做到“备战”那一段的存档.json> [尸潮那一夜的存档.json] [做完第一章的存档.json]
#       （存档用 SAVES=目录 node scripts/ch1-bot.mjs 1 生成：seed1-prep.json、seed1-gate.json、seed1-end.json）
# 退出码：有一条不合格就是 1。
import asyncio, json, math, os, re, subprocess, sys, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get("PORT", "8793"))
SHOTS = os.environ.get("SHOTS", "")
DEV = re.compile(r"机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|Joja|祝尼魔|星之果实")
SIZES = [(1366, 768), (1920, 1080)]

MEASURE = r"""
() => {
  const W = innerWidth, H = innerHeight, out = { small: [], off: [], spill: [], overlap: [], scroll: null, text: "" };
  const seen = (el) => el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : true;
  const name = (el) => (el.id ? "#" + el.id : el.className && typeof el.className === "string" ? el.tagName.toLowerCase() + "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : el.tagName.toLowerCase()) + " “" + (el.innerText || "").trim().replace(/\s+/g, " ").slice(0, 18) + "”";
  const clip = (el) => { let r = { l: -1e9, t: -1e9, r: 1e9, b: 1e9 }; for (let p = el.parentElement; p; p = p.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(cs.overflowX + " " + cs.overflowY)) { const q = p.getBoundingClientRect(); r = { l: Math.max(r.l, q.left), t: Math.max(r.t, q.top), r: Math.min(r.r, q.right), b: Math.min(r.b, q.bottom) }; } } return r; };
  const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--z")) || 1;
  for (const el of document.querySelectorAll(".ui *")) {
    if (!seen(el) || el.closest("[aria-hidden=true]")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el), c = clip(el);
    const L = Math.max(r.left, c.l), R = Math.min(r.right, c.r), T = Math.max(r.top, c.t), B = Math.min(r.bottom, c.b);
    if (R <= L || B <= T) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (own) {
      const px = parseFloat(cs.fontSize);
      if (px < 14) out.small.push(name(el) + " " + px + "px");
      // 字比框宽、比框高（框自己不裁的时候才算溢出；带省略号的是有意裁的）
      const inline = cs.display.startsWith("inline") && !/inline-(block|flex|grid)/.test(cs.display);
      if (!inline && cs.overflowX === "visible" && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) out.spill.push(name(el) + " 宽 " + el.scrollWidth + ">" + el.clientWidth);
      // 高：一行字的字形盒比行高高一点是字体自己的事（像素字体上下留得多），多出半行以上才算溢出
      if (!inline && cs.overflowY === "visible" && el.clientHeight > 0 && el.scrollHeight > el.clientHeight + Math.max(6, parseFloat(cs.fontSize) * 0.6) && !/^(SPAN|B|I|P)$/.test(el.tagName)) out.spill.push(name(el) + " 高 " + el.scrollHeight + ">" + el.clientHeight);
    }
    // 有边框或底色的一格（一行、一张卡、一个按钮）：里面的东西不许比这一格高、比这一格宽（压到旁边去）
    const boxed = parseFloat(cs.borderTopWidth) > 0 || !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor);
    if (boxed && !own && cs.overflowY === "visible" && el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 6) out.spill.push(name(el) + " 里面的东西高出这一格 " + el.scrollHeight + ">" + el.clientHeight);
    if (boxed && !own && cs.overflowX === "visible" && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 6) out.spill.push(name(el) + " 里面的东西宽出这一格 " + el.scrollWidth + ">" + el.clientWidth);
    if (L < -1 || T < -1 || R > W + 1 || B > H + 1) {
      if (el.closest("#toasts")) continue;
      out.off.push(name(el) + " [" + [L, T, R, B].map(Math.round).join(",") + "]");
    }
  }
  // 左上角的消息：整页、小卡、过场开着的时候它不在常驻那一层上（那几种由 scripts/check-toasts.py 量），只在画面上和常驻的块比
  const covered = ["#page", "#card", "#scene", "#drawer"].some((q) => { const el = document.querySelector(q); return el && !el.hidden; });
  const blocks = ["#topbar", "#alerts", "#goal", "#hands", "#dock", "#hint", "#bark", "#tip", "#banner", "#bossbar", "#coach", "#respop"].concat(covered ? [] : ["#toasts"]).map((s) => document.querySelector(s)).filter((el) => el && seen(el) && el.getBoundingClientRect().width > 0);
  for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
    const a = blocks[i].getBoundingClientRect(), b = blocks[j].getBoundingClientRect();
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (w > 2 && h > 2 && !(blocks[j].id === "respop")) out.overlap.push("#" + blocks[i].id + " 压着 #" + blocks[j].id + "（" + Math.round(w) + "×" + Math.round(h) + "）");
  }
  const de = document.documentElement;
  if (de.scrollWidth > W + 1 || de.scrollHeight > H + 1) out.scroll = de.scrollWidth + "×" + de.scrollHeight;
  out.text = [...document.querySelectorAll(".ui")].filter(seen).map((el) => el.innerText).join("\n");
  out.zoom = z;
  out.persistent = ["#res", "#clock", "#alerts", "#goal", "#hands", "#dock", "#hint"].filter((s) => { const el = document.querySelector(s); return el && seen(el); }).length;
  return out;
}
"""


class Run:
    def __init__(self, pg, w, h):
        self.pg, self.w, self.h = pg, w, h
        self.bad, self.views, self.errs = [], 0, []
        self.minfont = 99

    async def snap(self):
        return await self.pg.evaluate("()=>window.__ember.snapshot()")

    async def measure(self, label):
        await self.pg.wait_for_timeout(220)
        m = await self.pg.evaluate(MEASURE)
        self.views += 1
        tag = "%d×%d %s" % (self.w, self.h, label)
        for k, what in (("small", "字小于 14px"), ("off", "出了画面"), ("spill", "字溢出框"), ("overlap", "两块压在一起")):
            for item in m[k][:6]:
                self.bad.append("%s：%s：%s" % (tag, what, item))
        if m["scroll"]:
            self.bad.append("%s：整页出了滚动条 %s" % (tag, m["scroll"]))
        hit = DEV.search(m["text"])
        if hit:
            i = hit.start()
            self.bad.append("%s：看得见的字里有“%s”：…%s…" % (tag, hit.group(0), m["text"][max(0, i - 16) : i + 20].replace("\n", " ")))
        if SHOTS:
            await self.pg.screenshot(path=os.path.join(SHOTS, "%dx%d-%02d-%s.png" % (self.w, self.h, self.views, re.sub(r"[^\w一-鿿]+", "-", label))))
        return m

    async def click(self, sel, ms=200):
        el = await self.pg.query_selector(sel)
        if not el:
            return False
        try:
            await el.click(timeout=2000)
        except Exception:
            return False
        await self.pg.wait_for_timeout(ms)
        return True

    async def key(self, k, ms=250):
        await self.pg.keyboard.press(k)
        await self.pg.wait_for_timeout(ms)

    async def close_all(self):
        for _ in range(4):
            s = await self.snap()
            if not s or not s["view"]:
                return
            if s["view"]["kind"] == "card" and await self.click("#card .btn.primary:not([disabled])"):
                continue
            await self.key("Escape")

    async def walk(self, x, y, r=30, timeout=25):
        t0 = time.time()
        held = set()

        async def keys(want):
            for k in list(held - want):
                await self.pg.keyboard.up(k)
                held.discard(k)
            for k in want - held:
                await self.pg.keyboard.down(k)
                held.add(k)

        while time.time() - t0 < timeout:
            s = await self.snap()
            if s["view"]:
                break
            p = s["player"]
            d = math.hypot(x - p["x"], y - p["y"])
            if d <= r:
                break
            path = await self.pg.evaluate("([x,y])=>window.__ember.path(x,y)", [x, y])
            tx, ty = (path[0]["x"], path[0]["y"]) if path and d > 60 else (x, y)
            if path and len(path) > 1 and math.hypot(tx - p["x"], ty - p["y"]) < 26:
                tx, ty = path[1]["x"], path[1]["y"]
            want = set()
            if abs(tx - p["x"]) > 7:
                want.add("d" if tx > p["x"] else "a")
            if abs(ty - p["y"]) > 7:
                want.add("s" if ty > p["y"] else "w")
            await keys(want)
            await self.pg.wait_for_timeout(90)
        await keys(set())


async def fresh(run):
    """没有存档：标题页、出身页、过场、第一天的画面"""
    await run.measure("标题页")
    await run.click('[data-act="newgame"]')
    await run.measure("出身页")
    for o in ("medic", "hunter", "mechanic", "veteran", "farmer"):
        await run.click('[data-act="origin"][data-id="%s"]' % o, 120)
    await run.measure("出身页·选了一个")
    await run.click('[data-act="begin"]', 500)
    for i in range(6):
        s = await run.snap()
        if not (s["view"] and s["view"]["kind"] == "scene"):
            break
        await run.measure("开场过场 %d" % (i + 1))
        await run.key(" ", 450)
    await run.measure("第 1 天的画面")
    await run.key("j")
    await run.measure("手记·第 1 天")
    await run.key("Escape")
    await run.key("Escape")
    await run.measure("设置")
    await run.key("Escape")


async def saved(run, label):
    """有存档：继续，常驻七块、资源明细、每一页、几张卡"""
    await run.measure(label + "·标题页（有存档）")
    await run.click('[data-act="continue"]', 700)
    await run.close_all()
    m = await run.measure(label + "·画面")
    if m["persistent"] > 7:
        run.bad.append("%s：常驻的块 %d 个，多于 7" % (label, m["persistent"]))
    # 队友说话的那一条、左上角的消息：平常走页面时正好不在。摆上最长的几句再量一遍
    # （说话的那一条由游戏自己每一帧摆位置：跟着左下角目标框的高矮走）
    await run.pg.evaluate("""() => {
      const b = document.querySelector('#bark');
      b.innerHTML = '<div style="width:40px;height:40px;flex:none"></div><p>铁锹：仓库见底了。我少吃一顿没事，阿禾不行。再长一点的一句，看它折成两行以后压不压下面的目标框。</p>';
      b.hidden = false;
      document.querySelector('#toasts').innerHTML = ['修好了破布护手：耐久上限 12（第 2 次）', '破布头巾坏了：没有保护了，回农场修', '第1轮防守胜利 · 明天休整，下一轮3天后', '先让这片地长出口粮。左下角写着眼下要做的事，按 J 看手记。'].map((x, i) => `<div class="toast ${i % 2 ? 'warn' : 'gold'}">${x}</div>`).join('');
    }""")
    await run.pg.wait_for_timeout(300)
    await run.measure(label + "·画面（队友说话、四条消息）")
    await run.pg.evaluate("() => { document.querySelector('#bark').hidden = true; document.querySelector('#toasts').innerHTML = ''; }")
    # 顶上每个资源：点开都有明细
    n = len(await run.pg.query_selector_all('#res [data-act="res"]'))
    for i in range(n):
        # 顶上那一条隔一会儿重画一遍：按位置现找现点，不拿着旧的那个
        await run.pg.locator('#res [data-act="res"]').nth(i).click(timeout=4000)
        await run.pg.wait_for_timeout(200)
        rows = await run.pg.query_selector_all("#respop .row, #respop tr, #respop li, #respop .kv")
        pop = await run.pg.query_selector("#respop:not([hidden])")
        txt = (await pop.inner_text()) if pop else ""
        if not pop or len(txt.strip().split("\n")) < 2:
            run.bad.append("%s：第 %d 个资源点开没有明细" % (label, i + 1))
        await run.measure(label + "·资源明细 %d" % (i + 1))
        await run.key("Escape", 150)
    # 建造抽屉：每一类
    await run.key("b")
    tabs = [await el.get_attribute("data-id") for el in await run.pg.query_selector_all('[data-act="btab"]:not([disabled])')]
    for tid in tabs:
        await run.click('[data-act="btab"][data-id="%s"]' % tid)
        n = await run.pg.locator("button.bcard").count()
        if n:
            await run.pg.locator("button.bcard").nth(min(1, n - 1)).click(timeout=4000)
        await run.measure(label + "·建造·" + (tid or ""))
    await run.key("Escape")
    await run.close_all()
    # 队友、仓库（三类）、地图、手记（两类）、设置
    await run.key("t")
    await run.measure(label + "·队友")
    for i in range(min(4, len(await run.pg.query_selector_all('[data-act="psel"]')))):
        if i < await run.pg.locator('[data-act="psel"]').count():
            await run.pg.locator('[data-act="psel"]').nth(i).click(timeout=4000)
            await run.pg.wait_for_timeout(120)
    await run.measure(label + "·队友·换一个人")
    await run.key("Escape")
    await run.key("i")
    await run.measure(label + "·仓库·东西")
    if await run.pg.locator(".cell[data-a]").count():
        await run.pg.locator(".cell[data-a]").first.click(timeout=4000)
        await run.measure(label + "·仓库·点了一样")
    # 用旧了的家伙：点开看耐久和“修好它”
    if await run.pg.locator('.cell[data-id="club"]').count():
        await run.pg.locator('.cell[data-id="club"]').first.click(timeout=4000)
        await run.measure(label + "·仓库·木棍的耐久")
    await run.click('[data-act="tab"][data-id="make"]')
    await run.measure(label + "·仓库·制作")
    stations = [await el.get_attribute("data-id") for el in await run.pg.query_selector_all('[data-act="station"]')]
    for sid in stations:
        await run.click('[data-act="station"][data-id="%s"]' % sid)
        await run.measure(label + "·仓库·制作·" + (sid or ""))
    await run.click('[data-act="tab"][data-id="trade"]')
    await run.measure(label + "·仓库·买卖")
    await run.key("Escape")
    await run.key("m")
    await run.measure(label + "·地图")
    places = [await el.get_attribute("data-id") for el in await run.pg.query_selector_all(".place")]
    for pid in places:
        await run.click('.place[data-id="%s"]' % pid, 150)
        await run.measure(label + "·地图·" + (pid or ""))
    await run.key("Escape")
    await run.key("j")
    await run.measure(label + "·手记·主线")
    await run.click('[data-act="tab"][data-id="log"]')
    await run.measure(label + "·手记·消息")
    await run.key("Escape")
    await run.key("Escape")
    await run.measure(label + "·设置")
    if await run.click('[data-act="asktitle"]'):
        await run.measure(label + "·设置·回标题确认")
        await run.key("Escape")
    await run.close_all()
    # 卡：农舍、最近的一块田、一样设施
    s = await run.snap()
    if s["region"] == "farm" and not s["enemies"]:
        await run.walk(328, 352, 44)
        await run.key("e", 400)
        if (await run.snap())["view"]:
            await run.measure(label + "·卡·农舍")
        await run.close_all()
        s = await run.snap()
        plot = next((p for p in s["plots"] if p["crop"]), None) or next((p for p in s["plots"] if p["tilled"]), None)
        if plot:
            await run.walk(plot["x"], plot["y"] + 6, 26)
            await run.key("e", 400)
            if (await run.snap())["view"]:
                await run.measure(label + "·卡·田")
            await run.close_all()
        b = next((b for b in s["buildings"] if b["type"] in ("cook", "workbench", "chest")), None)
        if b:
            await run.walk(b["x"], b["y"] + 34, 30)
            await run.key("e", 400)
            if (await run.snap())["view"]:
                await run.measure(label + "·设施·" + b["type"])
            await run.close_all()
        # 建造时地上的来路、顶上的那一行
        await run.walk(1250, 420, 40)
        await run.key("b")
        await run.click('[data-act="btab"][data-id="guard"]')
        await run.click('.bcard[data-id="fence"]')
        if await run.click('[data-act="bplace"]:not([disabled])', 300):
            await run.pg.mouse.move(run.w * 0.6, run.h * 0.5)
            await run.measure(label + "·摆围栏")
            await run.key("Escape")
        await run.close_all()


async def ending(run, label):
    await run.click('[data-act="continue"]', 700)
    for i in range(10):
        s = await run.snap()
        if not s["view"]:
            break
        await run.measure(label + "·%s %d" % (s["view"]["name"], i + 1))
        if s["view"]["kind"] == "scene":
            await run.key(" ", 450)
        elif not await run.click("#card .btn.primary:not([disabled])"):
            await run.key("Escape")
    await run.measure(label + "·做完以后的画面")
    await run.key("j")
    await run.measure(label + "·手记")
    await run.key("Escape")


async def main():
    saves = sys.argv[1:]
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=os.path.join(ROOT, "dist"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    bad, views, errs = [], 0, []
    try:
        async with async_playwright() as pw:
            br = await pw.chromium.launch()
            for w, h in SIZES:
                jobs = [(None, "新开")] + [(p, ["备战", "尸潮那一夜", "做完第一章"][i] if i < 3 else "存档%d" % i) for i, p in enumerate(saves)]
                for path, label in jobs:
                    ctx = await br.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
                    if path:
                        text = open(path, encoding="utf8").read()
                        await ctx.add_init_script("if(!sessionStorage.getItem('__seeded')){sessionStorage.setItem('__seeded','1');localStorage.setItem('ember-farm-r1',%s)}" % json.dumps(text))
                    pg = await ctx.new_page()
                    run = Run(pg, w, h)
                    pg.on("pageerror", lambda e, run=run: run.errs.append("页面报错 " + str(e)))
                    pg.on("console", lambda m, run=run: run.errs.append("控制台 " + m.text) if m.type == "error" else None)
                    pg.on("requestfailed", lambda r, run=run: run.errs.append("没取到 " + r.url))
                    await pg.goto("http://127.0.0.1:%d/index.html" % PORT)
                    await pg.wait_for_selector("#loading", state="hidden", timeout=90000)
                    await pg.wait_for_timeout(500)
                    try:
                        if not path:
                            await fresh(run)
                        elif label == "做完第一章":
                            await ending(run, label)
                        else:
                            await saved(run, label)
                    except Exception as e:  # 走不下去也算一条
                        run.bad.append("%d×%d %s：走到一半停了：%s" % (w, h, label, str(e)[:160]))
                    bad += run.bad
                    errs += ["%d×%d %s：%s" % (w, h, label, e) for e in run.errs]
                    views += run.views
                    print("%d×%d %s：看了 %d 处，不合格 %d 条，报错 %d 条" % (w, h, label, run.views, len(run.bad), len(run.errs)), flush=True)
                    await ctx.close()
            await br.close()
    finally:
        srv.terminate()
    for b in bad[:60]:
        print("  ✗ " + b)
    for e in errs[:20]:
        print("  ✗ " + e)
    print("合计：两个窗口共看了 %d 处；不合格 %d 条；页面报错 %d 条。" % (views, len(bad), len(errs)))
    return 0 if not bad and not errs else 1


sys.exit(asyncio.run(main()))
