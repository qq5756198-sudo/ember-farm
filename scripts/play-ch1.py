# v0.50「落脚」：真键盘、真鼠标，从标题页玩完第一章。
# 开一个浏览器（1366×768），只按键、只点鼠标：新开一局、看开场、种地、做饭、回信、打退路口的感染者、
# 建围栏、选援建物资、选今天的事、出门翻柜子、接回阿禾、去集市买卖、备战、守第一场尸潮、看结尾的过场。
# 游戏里的数只读（window.__ember.snapshot()），用来决定往哪走、点哪里；不往游戏里写任何东西。
# 用法：python3 scripts/play-ch1.py [输出目录] [最多几分钟]
# 退出码：没做完第一章，或者页面上报了错，就是 1。
import asyncio, json, math, os, subprocess, sys, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "play-out")
LIMIT = float(sys.argv[2]) if len(sys.argv) > 2 else 110
PORT = 8791
ROAD = (1330, 400)
os.makedirs(OUT, exist_ok=True)
LOG = open(os.path.join(OUT, "play.log"), "w", encoding="utf8")
T0 = time.time()


TRAP_X = 1252  # 头一个陷阱摆在路上的哪儿（东边路口往里 180 步）
CROPS = ("radish", "potato", "bean", "tomato", "corn", "pumpkin", "cotton", "herb")


def log(*a):
    line = "[%5.1f 分] " % ((time.time() - T0) / 60) + " ".join(str(x) for x in a)
    print(line, flush=True)
    LOG.write(line + "\n")
    LOG.flush()


class Bot:
    def __init__(self, pg):
        self.pg = pg
        self.errs = []
        self.held = set()
        self.shots = 0
        self.last_trip = 0
        self.last_market = 0
        self.last_chore = -1
        self.deaths = 0
        self.seen_views = {}

    async def snap(self):
        return await self.pg.evaluate("()=>window.__ember.snapshot()")

    async def shot(self, name):
        self.shots += 1
        await self.pg.screenshot(path=os.path.join(OUT, "%02d-%s.png" % (self.shots, name)))

    async def wait(self, ms):
        await self.pg.wait_for_timeout(ms)

    async def keys(self, want):
        for k in list(self.held - want):
            await self.pg.keyboard.up(k)
            self.held.discard(k)
        for k in want - self.held:
            await self.pg.keyboard.down(k)
            self.held.add(k)

    async def tap(self, k, ms=60):
        await self.keys(set())
        await self.pg.keyboard.press(k)
        await self.wait(ms)

    async def click(self, sel, ms=180):
        el = await self.pg.query_selector(sel)
        if not el:
            return False
        try:
            await el.click(timeout=2000)
        except Exception:
            return False
        await self.wait(ms)
        return True

    async def to_screen(self, x, y, s=None):
        s = s or await self.snap()
        c = s["camera"]
        return (x - c["x"]) * c["scale"], (y - c["y"]) * c["scale"]

    async def click_world(self, x, y, s=None):
        sx, sy = await self.to_screen(x, y, s)
        sx = max(8, min(1358, sx))
        sy = max(64, min(660, sy))
        await self.pg.mouse.move(sx, sy)
        await self.pg.mouse.down()
        await self.wait(50)
        await self.pg.mouse.up()

    # ---- 开着的页面：按章法处理 ----
    async def handle_view(self, s):
        v = s["view"]
        if not v:
            return False
        key = v["kind"] + ":" + v["name"]
        self.seen_views[key] = self.seen_views.get(key, 0) + 1
        await self.keys(set())
        if v["kind"] == "scene":
            if self.seen_views[key] <= 2:
                await self.shot("scene-" + v["name"])
            if v["name"] == "cut":
                await self.tap(" ", 350)
            return True
        if v["kind"] == "card":
            if self.seen_views[key] <= 2:
                await self.shot("card-" + v["name"])
            if v["name"] == "death":
                self.deaths += 1
            opt = await self.pg.query_selector("#card .opt:not([disabled])")
            if opt:
                await opt.click()
                await self.wait(250)
                return True
            if await self.click("#card .btn.primary:not([disabled])"):
                return True
            await self.tap("Escape", 200)
            return True
        await self.tap("Escape", 200)
        return True

    # ---- 走路：照游戏自己的寻路点走 ----
    async def walk(self, x, y, r=34, timeout=40, fight=True):
        t0 = time.time()
        last = None
        stuck = 0
        while time.time() - t0 < timeout:
            s = await self.snap()
            if s["view"]:
                await self.handle_view(s)
                continue
            p = s["player"]
            d = math.hypot(x - p["x"], y - p["y"])
            if d <= r:
                break
            if fight and await self.fight(s, 150):
                continue
            path = await self.pg.evaluate("([x,y])=>window.__ember.path(x,y)", [x, y])
            tx, ty = (path[0]["x"], path[0]["y"]) if path and d > 60 else (x, y)
            if path and len(path) > 1 and math.hypot(tx - p["x"], ty - p["y"]) < 26:
                tx, ty = path[1]["x"], path[1]["y"]
            dx, dy = tx - p["x"], ty - p["y"]
            want = set()
            if abs(dx) > 7:
                want.add("d" if dx > 0 else "a")
            if abs(dy) > 7:
                want.add("s" if dy > 0 else "w")
            if last and abs(last[0] - p["x"]) + abs(last[1] - p["y"]) < 1.2:
                stuck += 1
                if stuck > 5:
                    want = [{"w"}, {"d"}, {"s"}, {"a"}, {"w", "d"}, {"s", "a"}][(stuck // 5) % 6]
                if stuck > 60:
                    break
            else:
                stuck = 0
            last = (p["x"], p["y"])
            await self.keys(want)
            await self.wait(90)
        await self.keys(set())
        s = await self.snap()
        return math.hypot(x - s["player"]["x"], y - s["player"]["y"])

    # ---- 打：拿木棍，鼠标点它 ----
    async def fight(self, s, rng=260):
        p = s["player"]
        zs = [z for z in s["enemies"] if not z["lying"]]
        if not zs or s["region"] == "market":
            return False
        z = min(zs, key=lambda q: math.hypot(q["x"] - p["x"], q["y"] - p["y"]))
        if math.hypot(z["x"] - p["x"], z["y"] - p["y"]) > rng:
            return False
        if s["slot"] != 3:
            await self.tap("4", 40)
        t0 = time.time()
        while time.time() - t0 < 25:
            s = await self.snap()
            if s["view"]:
                await self.handle_view(s)
                return True
            p = s["player"]
            zs = [q for q in s["enemies"] if not q["lying"]]
            if not zs:
                break
            z = min(zs, key=lambda q: math.hypot(q["x"] - p["x"], q["y"] - p["y"]))
            dx, dy = z["x"] - p["x"], z["y"] - p["y"]
            d = math.hypot(dx, dy)
            if d > rng + 80:
                break
            if p["hp"] < 45 and s["inventory"].get("bandage", 0) > 0:
                await self.tap("9", 40)
                await self.click_world(p["x"], p["y"] - 30, s)
                await self.tap("4", 40)
            if p["hp"] < 30 and s["region"] not in ("farm", "market"):
                await self.go_region("farm")
                return True
            if d > 56:
                want = set()
                if abs(dx) > 10:
                    want.add("d" if dx > 0 else "a")
                if abs(dy) > 10:
                    want.add("s" if dy > 0 else "w")
                await self.keys(want)
                await self.wait(70)
            else:
                # 挥一下，马上往后退一步（慢的追不上）；被围住先推开
                await self.keys(set())
                near = [q for q in zs if math.hypot(q["x"] - p["x"], q["y"] - p["y"]) < 64]
                if len(near) >= 2:
                    await self.pg.keyboard.press("x")
                await self.click_world(z["x"], z["y"] - 18, s)
                back = set()
                if abs(dx) > 10:
                    back.add("a" if dx > 0 else "d")
                if abs(dy) > 10:
                    back.add("w" if dy > 0 else "s")
                await self.keys(back)
                await self.wait(330)
                await self.keys(set())
        await self.keys(set())
        return True

    async def interact(self, ms=350):
        await self.tap("e", ms)

    async def go_region(self, region):
        s = await self.snap()
        if s["region"] == region:
            return True
        await self.keys(set())
        await self.tap("m", 350)
        if not await self.click('.place[data-id="%s"]' % region):
            await self.tap("Escape")
            return False
        ok = await self.click('[data-act="travel"]:not([disabled])', 900)
        if not ok:
            await self.tap("Escape")
        s = await self.snap()
        if s["view"]:
            await self.handle_view(s)
        return s["region"] == region

    async def open_page(self, key, tab=None):
        await self.keys(set())
        await self.tap(key, 300)
        if tab:
            await self.click('[data-act="tab"][data-id="%s"]' % tab, 200)

    async def eat(self, s):
        p = s["player"]
        if p["hunger"] < 40 and s["inventory"].get("bread", 0) > 0 and not s["view"]:
            await self.tap("8", 40)
            await self.click_world(p["x"], p["y"] - 30, s)
            await self.wait(150)
            return True
        return False

    # 在农场：身上带点干粮和绷带
    async def stock_up(self, s):
        if s["region"] != "farm":
            return
        need = [i for i, n in (("bread", 3), ("bandage", 2)) if s["inventory"].get(i, 0) < n and s["storage"].get(i, 0) > 0]
        if not need:
            return
        await self.open_page("i")
        for i in need:
            for _ in range(3):
                if not await self.click('.cell[data-id="%s"][data-a="box"]' % i, 120):
                    break
                await self.click('[data-act="take"][data-id="%s"]' % i, 120)
        await self.tap("Escape", 200)

    async def build(self, kind, tab, x, y):
        s = await self.snap()
        if s["region"] != "farm":
            return False
        before = len([b for b in s["buildings"] if b["type"] == kind])
        await self.walk(x - 90, y + 30, 60, 25)
        await self.tap("b", 300)
        await self.click('[data-act="btab"][data-id="%s"]' % tab, 200)
        await self.click('.bcard[data-id="%s"]' % kind, 200)
        if not await self.click('[data-act="bplace"]:not([disabled])', 300):
            await self.tap("Escape", 200)
            return False
        ok = False
        for i in range(14):
            ang = i * 0.9
            rad = 0 if i == 0 else 30 + 14 * i
            await self.click_world(x + math.cos(ang) * rad, y + math.sin(ang) * rad)
            await self.wait(220)
            s = await self.snap()
            if len([b for b in s["buildings"] if b["type"] == kind]) > before:
                ok = True
                break
            if not s["buildMode"]:
                break
        await self.pg.keyboard.press("Escape")
        await self.wait(150)
        s = await self.snap()
        if s["view"]:
            await self.tap("Escape", 150)
        return ok

    async def farm_chores(self):
        s = await self.snap()
        if s["region"] != "farm":
            return
        want = 6 + (6 if s["people"]["n"] > 1 else 0)
        tilled = len([p for p in s["plots"] if p["tilled"]])
        seeds = sum(s["inventory"].get(i, 0) for i in ("seedRadish", "seedPotato", "seedBean", "seedCorn", "seedTomato"))
        for p in s["plots"][:18]:
            s = await self.snap()
            if s["minute"] >= 21 * 60 or s["horde"]["phase"] in ("warning", "active"):
                break
            cur = next((q for q in s["plots"] if q["id"] == p["id"]), None)
            if not cur:
                continue
            work = (not cur["tilled"] and tilled < want and seeds > 0) or (cur["tilled"] and not cur["crop"] and seeds > 0) or cur["crop"]
            if not work:
                continue
            await self.walk(cur["x"], cur["y"] + 6, 26, 14)
            for _ in range(4):
                s = await self.snap()
                if s["view"]:
                    await self.handle_view(s)
                    continue
                hint = s["hint"] or ""
                if not any(w in hint for w in ("清理", "开垦", "选种", "浇水", "收获", "拔草", "捉虫")):
                    break
                if "浇水壶没水" in hint:
                    await self.walk(880, 318, 40, 14)
                    await self.interact()
                    await self.walk(cur["x"], cur["y"] + 6, 26, 14)
                    continue
                if "开垦" in hint or "清理" in hint:
                    tilled += 1
                if "选种" in hint:
                    seeds -= 1
                await self.interact(260)

    async def cook(self):
        s = await self.snap()
        if s["region"] != "farm":
            return
        inv = lambda i: s["inventory"].get(i, 0) + s["storage"].get(i, 0)
        ready = any(j["ready"] for j in s["production"])
        keep = 9 if (s["people"]["residents"] and not next((r["pass"] for r in s["tableReq"] if "集市" in r["label"]), True)) else 0
        days = s["food"]["days"] or 0
        need = (s["food"]["portions"] / days) if days > 0 else 3 + 2 * (s["people"]["n"] - 1)
        lack = max(20, math.ceil(need * 4)) - s["food"]["portions"] - 2 * len(s["production"])
        if not ready and (lack <= 0 or (inv("radish") < 3 + keep and inv("potato") < 2)):
            return
        await self.open_page("i", "make")
        await self.click('[data-act="collectall"]:not([disabled])', 200)
        await self.click('[data-act="station"][data-id="cook"]', 200)
        n = min((inv("radish") - keep) // 3, math.ceil(max(0, lack) / 2))
        for _ in range(min(4, max(0, n))):
            if not await self.click('[data-act="craft"][data-id="trailBread"]:not([disabled])', 140):
                break
            lack -= 2
        for _ in range(min(3, inv("potato") // 2, max(0, lack))):
            if not await self.click('[data-act="craft"][data-id="stew"]:not([disabled])', 140):
                break
        await self.tap("Escape", 200)

    # 手上的家伙用旧了：有武器工作台就走过去修；没有、又建得起，就建一座；都不行先削一根木矛顶着
    async def upkeep(self):
        s = await self.snap()
        if s["region"] != "farm" or s["view"]:
            return
        worn = [g for g in s["gear"].values() if g["left"] < 0.35]
        if not worn:
            return
        inv = lambda i: s["inventory"].get(i, 0) + s["storage"].get(i, 0)
        bench = next((b for b in s["buildings"] if b["type"] == "weaponbench"), None)
        if not bench and (s["act"] or 1) >= 3 and inv("wood") >= 12 and inv("scrap") >= 6 and inv("parts") >= 3:
            if await self.build("weaponbench", "live", 980, 640):
                log("  建了武器工作台")
                s = await self.snap()
                bench = next((b for b in s["buildings"] if b["type"] == "weaponbench"), None)
        if bench:
            await self.walk(bench["x"], bench["y"] + 34, 30, 25)
            await self.interact(450)
            s2 = await self.snap()
            if s2["view"]:
                n = 0
                for _ in range(8):
                    if not await self.click('[data-act="repairgear"]:not([disabled])', 200):
                        break
                    n += 1
                if n:
                    log("  在武器工作台修了 %d 件" % n)
                    await self.shot("repair")
                await self.tap("Escape", 200)
            return
        melee = s["gear"].get("melee")
        if melee and melee["left"] < 0.2 and melee["id"] != "spear" and inv("spear") == 0 and inv("wood") >= 3:
            await self.open_page("i", "make")
            await self.click('[data-act="station"][data-id="hand"]', 200)
            if await self.click('[data-act="craft"][data-id="spear"]:not([disabled])', 250):
                await self.click('[data-act="tab"][data-id="items"]', 200)
                await self.click('.cell[data-id="spear"][data-a="bag"]', 150)
                await self.click('[data-act="equip"][data-id="spear"]:not([disabled])', 200)
                log("  削了一根木矛拿上")
            await self.tap("Escape", 200)

    async def repair_broken(self):
        s = await self.snap()
        if s["region"] != "farm":
            return
        for a in await self.pg.query_selector_all(".alert"):
            txt = await a.inner_text()
            if "坏了" in txt and "修好" in txt:
                cook = next((b for b in s["buildings"] if b["type"] == "cook"), None)
                if cook:
                    await self.walk(cook["x"], cook["y"] + 34, 30, 20)
                    await self.interact(400)
                    await self.click('[data-act="repair"]:not([disabled])', 200)
                    await self.tap("Escape", 200)
                break

    async def market_run(self, buy):
        s = await self.snap()
        # 多的菜带上（地里收的都算：萝卜、土豆、豆子、番茄、玉米，连优质的）
        crops = [i for i in s["storage"] if i.split("_")[-1] in CROPS and s["storage"].get(i, 0) > 0]
        await self.open_page("i")
        for i in crops:
            if s["storage"].get(i, 0) > 0:
                await self.click('.cell[data-id="%s"][data-a="box"]' % i, 120)
                await self.pg.keyboard.down("Shift")
                await self.click('[data-act="take"][data-id="%s"]' % i, 150)
                await self.pg.keyboard.up("Shift")
        await self.tap("Escape", 200)
        if not await self.go_region("market"):
            return
        s = await self.snap()
        for trader, items in (("food", ["medkit", "seedRadish", "seedPotato", "bandage", "bread"]), ("mechanic", ["wood", "stone", "cloth", "scrap", "parts"])):
            o = next((o for o in s["objects"] if o["type"] == "trader" and (("粮食" in o["name"]) == (trader == "food"))), None)
            if not o:
                continue
            await self.walk(o["x"], o["y"] + 36, 34, 25, fight=False)
            await self.interact(450)
            s2 = await self.snap()
            if not s2["view"]:
                continue
            if trader == "food":
                await self.click('[data-act="tdir"][data-id="sell"]', 200)
                for i in [k for k in s2["inventory"] if k.split("_")[-1] in CROPS]:
                    n = s2["inventory"].get(i, 0) - {"radish": 12, "potato": 6}.get(i, 0)
                    row = await self.pg.query_selector('.item-row:has([data-act="trade"][data-id="%s"])' % i)
                    if n > 0 and row:
                        inp = await row.query_selector("input")
                        await inp.fill(str(n))
                        await self.click('[data-act="trade"][data-id="%s"]' % i, 200)
                await self.click('[data-act="tdir"][data-id="buy"]', 200)
            for i in items:
                n = buy.get(i, 0)
                row = await self.pg.query_selector('.item-row:has([data-act="trade"][data-id="%s"])' % i)
                # 钱不够买这么多：减半再试，直到买得起
                while n > 0 and row:
                    inp = await row.query_selector("input")
                    await inp.fill(str(n))
                    if await self.click('[data-act="trade"][data-id="%s"]:not([disabled])' % i, 200):
                        break
                    n //= 2
                    row = await self.pg.query_selector('.item-row:has([data-act="trade"][data-id="%s"])' % i)
            await self.tap("Escape", 250)
        await self.shot("market")
        await self.go_region("farm")

    async def loot_trip(self):
        if not await self.go_region("residential"):
            return
        await self.shot("residential")
        s = await self.snap()
        kinds = ("crate", "gearCrate", "salvage", "poi", "rebuildFind", "survivor", "animalRescue")
        tgt = ((s["goal"].get("step") or {}).get("target") or {}) if (s["goal"].get("step") or {}).get("id") == "farmer" else {}
        first = (lambda o: 0 if tgt.get("region") == "residential" and math.hypot(o["x"] - tgt["x"], o["y"] - tgt["y"]) < 90 else 1)
        targets = sorted([o for o in s["objects"] if o["type"] in kinds], key=lambda o: (first(o), o["x"]))
        for o in targets:
            s = await self.snap()
            if s["region"] != "residential" or s["player"]["hp"] < 40 or s["minute"] > 17 * 60:
                break
            await self.walk(o["x"], o["y"] + 16, 34, 40)
            for _ in range(3):
                s = await self.snap()
                if s["view"]:
                    await self.handle_view(s)
                    continue
                if s["region"] != "residential" or not s["hint"]:
                    break
                await self.interact(700)
        await self.go_region("farm")
        await self.open_page("i")
        await self.click('[data-act="putall"]:not([disabled])', 200)
        await self.tap("Escape", 200)

    async def sleep(self):
        # 走到农舍门口正前面（离旁边的床位、信箱远一点，E 才是“农舍”）
        for dy in (26, 14, 36):
            await self.walk(328, 307 + dy, 14, 30)
            await self.interact(400)
            s = await self.snap()
            if s["view"] and s["view"]["name"] == "home":
                if not await self.click('[data-act="sleep"]:not([disabled])', 900):
                    await self.tap("Escape", 200)
                    return False
                return True
            if s["view"]:
                await self.tap("Escape", 200)
        return False

    async def set_fast(self, on):
        s = await self.snap()
        if s["view"] or s["fast"] == on:
            return
        await self.click('[data-act="fast"]:not([disabled])', 60)


async def main():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=os.path.join(ROOT, "dist"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    done = False
    try:
        async with async_playwright() as pw:
            br = await pw.chromium.launch()
            ctx = await br.new_context(viewport={"width": 1366, "height": 768}, device_scale_factor=1)
            pg = await ctx.new_page()
            bot = Bot(pg)
            pg.on("pageerror", lambda e: bot.errs.append("PAGEERR " + str(e)))
            pg.on("console", lambda m: bot.errs.append("CONSOLE " + m.text) if m.type == "error" else None)
            await pg.goto("http://127.0.0.1:%d/index.html" % PORT)
            await pg.wait_for_selector("#loading", state="hidden", timeout=60000)
            await bot.wait(600)
            await bot.shot("title")
            await bot.click('[data-act="newgame"]')
            await bot.click('[data-act="origin"][data-id="farmer"]')
            await bot.shot("origin")
            await bot.click('[data-act="begin"]', 500)
            for _ in range(8):
                s = await bot.snap()
                if not (s["view"] and s["view"]["kind"] == "scene"):
                    break
                await bot.shot("intro")
                await bot.tap(" ", 400)
            await bot.shot("start")
            last_stage = ""
            last_step = ""
            last_day = 0
            idle_from = 0
            while (time.time() - T0) / 60 < LIMIT:
                s = await bot.snap()
                if s["view"]:
                    await bot.handle_view(s)
                    continue
                g = s["goal"]
                stage = g["stage"]
                if stage != last_stage:
                    log("新的一段", stage, g["title"], "第%d天 %02d:%02d" % (s["day"], s["minute"] // 60, s["minute"] % 60))
                    await bot.shot("stage-" + stage)
                    last_stage = stage
                st = g.get("step") or {}
                key = (st.get("id") or "") + ":" + (st.get("title") or "")
                if key != last_step:
                    log("  步", key)
                    last_step = key
                if s["day"] != last_day:
                    last_day = s["day"]
                    log("第%d天 金%d 粮%d(%.1f天) 人%d 血%d 倒下%d 报错%d" % (s["day"], s["money"], s["food"]["portions"], s["food"]["days"], s["people"]["n"], s["player"]["hp"], bot.deaths, len(bot.errs)))
                if stage == "done" or 1 in s["ch"]["done"]:
                    done = True
                    await bot.shot("done")
                    break
                if await bot.eat(s):
                    continue
                m = s["minute"]
                horde = s["horde"]["phase"]
                farm = s["region"] == "farm"
                if horde in ("warning", "active"):
                    if not farm:
                        await bot.go_region("farm")
                    await bot.set_fast(False)
                    s = await bot.snap()
                    if s["view"]:
                        continue
                    p = s["player"]
                    zs = [z for z in s["enemies"] if not z["lying"]]
                    near = min([math.hypot(z["x"] - p["x"], z["y"] - p["y"]) for z in zs] or [9999])
                    if near <= 140:
                        await bot.fight(s, 140)
                    elif horde == "active" and s["horde"]["remaining"] == 0 and zs:
                        await bot.fight(s, 1600)
                    else:
                        await bot.walk(TRAP_X - 110, 396, 30, 6, fight=False)
                        await bot.wait(300)
                    continue
                if farm and s["enemies"]:
                    if await bot.fight(s, 500):
                        continue
                tonight = s["ch"]["gate"]["state"] in ("omen", "tonight") and s["day"] >= s["ch"]["gate"]["day"] and m >= 12 * 60
                if (m >= 22 * 60 or m < 5 * 60) and farm:
                    if tonight:
                        await bot.walk(ROAD[0] - 90, ROAD[1] + 30, 80, 20)
                        await bot.wait(800)
                        continue
                    if await bot.sleep():
                        continue
                    await bot.wait(1500)
                    continue
                if not farm and m >= 18 * 60 + 30:
                    await bot.go_region("farm")
                    continue
                await bot.stock_up(s)
                await bot.repair_broken()
                slot = s["day"] * 2 + (1 if m >= 14 * 60 else 0)
                if farm and slot != bot.last_chore and m >= 6 * 60 + 30 and (s["act"] or 1) >= 2:
                    bot.last_chore = slot
                    await bot.set_fast(False)
                    await bot.farm_chores()
                    await bot.cook()
                    await bot.upkeep()
                    continue
                sid = st.get("id") or ""
                tgt = st.get("target")
                inv = lambda i: s["inventory"].get(i, 0) + s["storage"].get(i, 0)
                if sid == "harvest":
                    if tgt:
                        await bot.walk(tgt["x"], tgt["y"] + 6, 26, 20)
                        s2 = await bot.snap()
                        hint = s2["hint"] or ""
                        if "浇水壶没水" in hint:
                            await bot.walk(880, 318, 40, 20)
                            await bot.interact()
                        elif any(w in hint for w in ("清理", "开垦", "选种", "浇水", "收获", "拔草", "捉虫", "照看")):
                            await bot.interact(300)
                        else:
                            await bot.set_fast(True)
                            await bot.wait(1200)
                    else:
                        await bot.wait(1200)
                    continue
                if sid == "meal":
                    if "做出第一份干粮" in st.get("title", ""):
                        await bot.cook()
                        await bot.open_page("i", "make")
                        await bot.click('[data-act="station"][data-id="cook"]', 200)
                        await bot.click('[data-act="craft"][data-id="trailBread"]:not([disabled])', 200)
                        await bot.shot("cook")
                        await bot.tap("Escape", 200)
                    elif "收起来" in st.get("title", ""):
                        await bot.open_page("i", "make")
                        await bot.click('[data-act="collectall"]:not([disabled])', 200)
                        await bot.tap("Escape", 200)
                    else:
                        await bot.set_fast(True)
                        await bot.wait(1500)
                    continue
                if sid in ("well", "camp", "reply"):
                    await bot.walk(tgt["x"], tgt["y"] + (30 if sid == "reply" else 18), 34, 30)
                    await bot.interact(450)
                    continue
                if sid == "choice":
                    await bot.open_page("j")
                    await bot.click('[data-act="opensupply"]', 300)
                    continue
                if sid == "opening":
                    fences = len([b for b in s["buildings"] if b["type"] in ("fence", "gate")])
                    if "围栏" in st.get("title", ""):
                        if not await bot.build("fence", "guard", ROAD[0], ROAD[1] + 10):
                            await bot.wait(800)
                        else:
                            await bot.shot("fence")
                    else:
                        await bot.walk(ROAD[0] - 90, ROAD[1] + 20, 70, 20)
                        if not await bot.fight(await bot.snap(), 420):
                            await bot.set_fast(False)
                            await bot.wait(700)
                    continue
                if sid == "farmer":
                    if farm and (m > 15 * 60 or s["player"]["hp"] < 60):
                        await bot.set_fast(True)
                        await bot.wait(1500)
                        continue
                    bot.last_trip = s["day"]
                    await bot.loot_trip()
                    continue
                if sid == "farmerMeal":
                    await bot.cook()
                    await bot.open_page("j")
                    if not await bot.click('[data-act="feed"]:not([disabled])', 300):
                        await bot.tap("Escape", 200)
                        await bot.set_fast(True)
                        await bot.wait(2000)
                    else:
                        await bot.tap("Escape", 200)
                    continue
                need_buy = {}
                did = False
                if sid == "table":
                    req = next((r for r in s["tableReq"] if not r["pass"]), None)
                    if req and "集市" in req["label"]:
                        if inv("wood") >= 12 and inv("radish") >= 9:
                            await bot.open_page("j")
                            did = await bot.click('[data-act="project"]:not([disabled])', 300)
                            await bot.shot("table")
                            await bot.tap("Escape", 200)
                        elif inv("wood") < 12:
                            need_buy["wood"] = 30
                    elif req and "制作台" in req["label"]:
                        if inv("wood") >= 8 and inv("stone") >= 4:
                            did = await bot.build("workbench", "live", 1010, 600)
                        else:
                            need_buy.update({"wood": 20, "stone": 4})
                    elif req and "床位" in req["label"]:
                        if inv("wood") >= 8 and inv("cloth") >= 2:
                            did = await bot.build("bed", "live", 520, 300)
                        else:
                            need_buy.update({"wood": 12, "cloth": 2})
                elif sid.startswith("prep:"):
                    if sid == "prep:ready":
                        await bot.set_fast(True)
                        await bot.wait(2000)
                        continue
                    fences = len([b for b in s["buildings"] if b["type"] in ("fence", "gate")])
                    traps = len([b for b in s["buildings"] if b["type"] == "trap"])
                    # 备战五样一样一样看：手上的料够就做，不够的记到去集市要买的单子上（不卡在头一样上）
                    for line in [l for l in s.get("prep", []) if not l["done"]] or [{"id": sid[5:], "have": 0, "need": 4}]:
                        miss = line["id"]
                        if miss == "fence":
                            if inv("wood") >= 5:
                                did = await bot.build("fence", "guard", ROAD[0] - 30, ROAD[1] - 70 + 34 * (fences % 8))
                            else:
                                need_buy["wood"] = 30
                        elif miss == "trap":
                            if inv("wood") >= 4 and inv("scrap") >= 2:
                                # 陷阱摆在它们进来的路上，一个接一个
                                # 路口那一截是出口、放不了东西：摆在围栏里面的路上
                                did = await bot.build("trap", "guard", TRAP_X - 36 * traps, 396)
                            else:
                                need_buy.update({"wood": max(need_buy.get("wood", 0), 10), "scrap": 4})
                        elif miss == "breeder":
                            if inv("wood") >= 8 and inv("parts") >= 1:
                                did = await bot.build("breeder", "farm", 940, 600)
                            else:
                                need_buy.update({"wood": max(need_buy.get("wood", 0), 10), "parts": 1})
                        elif miss == "heal":
                            need_buy["bandage"] = max(1, line["need"] - line["have"])
                        elif miss == "food":
                            # 先拿地里收的做；菜不够做，就照警报说的“去集市换”：买干粮补到三天半
                            await bot.cook()
                            s3 = await bot.snap()
                            d3 = s3["food"]["days"] or 0
                            per = (s3["food"]["portions"] / d3) if d3 > 0 else 3 + 2 * (s3["people"]["n"] - 1)
                            lack = math.ceil(per * 3.5) - s3["food"]["portions"] - 2 * len(s3["production"])
                            if lack > 0:
                                need_buy["bread"] = min(20, lack)
                        if did:
                            break
                if did:
                    continue
                status = (await pg.inner_text("#status")) if await pg.query_selector("#status:not([hidden])") else ""
                if s.get("fever") or ("发烧" in status and "退烧" not in status):
                    if s["inventory"].get("medkit", 0) > 0:
                        await bot.open_page("i")
                        await bot.click('.cell[data-id="medkit"][data-a="bag"]', 150)
                        if await bot.click('[data-act="eat"][data-id="medkit"]', 200):
                            log("  吃了药包，睡一晚退烧")
                        await bot.tap("Escape", 200)
                    elif inv("medkit") == 0 and s["money"] >= 75:
                        need_buy["medkit"] = 1
                seeds = inv("seedRadish") + inv("seedPotato")
                keep = {"radish": 12, "potato": 6}
                spare = sum(max(0, inv(i) - keep.get(i, 0)) for i in set(list(s["inventory"]) + list(s["storage"])) if i.split("_")[-1] in CROPS)
                if farm and (need_buy or spare >= 18 or (seeds < 6 and spare > 12)) and s["day"] != bot.last_market and 7 * 60 <= m < 16 * 60 and (s["money"] >= 60 or spare >= 12):
                    bot.last_market = s["day"]
                    tilled = len([p for p in s["plots"] if p["tilled"]])
                    if seeds < max(8, tilled):
                        need_buy.update({"seedRadish": max(0, min(12, tilled) - inv("seedRadish")), "seedPotato": max(0, 3 - inv("seedPotato"))})
                    if (s["act"] or 1) >= 3:
                        bench = any(b["type"] == "weaponbench" for b in s["buildings"])
                        for i, want in (("wood", 30), ("scrap", 5 if bench else 11), ("parts", 1 if bench else 4), ("cloth", 2)):
                            if inv(i) < want:
                                need_buy[i] = max(need_buy.get(i, 0), want - inv(i))
                    elif spare >= 30 and inv("wood") < 20:
                        need_buy["wood"] = max(need_buy.get("wood", 0), 20 - inv("wood"))
                    log("  去集市", need_buy)
                    await bot.set_fast(False)
                    await bot.market_run(need_buy)
                    continue
                if farm and s["day"] != bot.last_trip and m < 13 * 60 and s["player"]["hp"] >= 60 and (s["act"] or 1) >= 2 and sid != "gate":
                    bot.last_trip = s["day"]
                    await bot.set_fast(False)
                    await bot.loot_trip()
                    continue
                await bot.set_fast(True)
                await bot.wait(1500)
            # 收尾：过场放完，看一眼手记
            for _ in range(12):
                s = await bot.snap()
                if not s["view"]:
                    break
                await bot.handle_view(s)
            await bot.tap("j", 400)
            await bot.shot("journal-end")
            await bot.tap("Escape", 200)
            s = await bot.snap()
            log("收尾：第%d天 %02d:%02d，第一章%s，倒下 %d 回，页面报错 %d 条" % (s["day"], s["minute"] // 60, s["minute"] % 60, "做完了" if done else "没做完", bot.deaths, len(bot.errs)))
            log("开过的页面", json.dumps(bot.seen_views, ensure_ascii=False))
            for e in bot.errs[:20]:
                log("  报错", e)
            ok = done and not bot.errs
            await br.close()
            return ok
    finally:
        srv.terminate()


ok = asyncio.run(main())
log("结果：", "通过" if ok else "没通过", "用时 %.1f 分钟" % ((time.time() - T0) / 60))
sys.exit(0 if ok else 1)
