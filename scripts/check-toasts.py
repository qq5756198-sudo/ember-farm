# v0.50「落脚」：左上角的消息压不压别的东西。
# 真浏览器（1366×768、1920×1080）读一份存档，往消息那一栏摆上四条最长的，再把画面、五页、设置各开一遍：
#   画面上：消息不压顶上的资源、右边的警报、左下角的目标框；
#   整页开着：只留最新的一条，放在页头中间空着的那一段，不压页头左边的字、右边的“返回”、下面的正文；
#   小卡开着：消息收窄，停在卡的左边；
#   点开顶上哪个数字的明细：消息这一会儿不出。
# 平常走页面的时候正好没有消息在，scripts/check-ui.py 量不到这几条，所以单拿出来。
# 用法：python3 scripts/check-toasts.py <存档.json> [截图目录]
# 退出码：有一处压着就是 1。
import asyncio, json, os, subprocess, sys, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get("PORT", "8797"))
SAVE = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else ""
if OUT:
    os.makedirs(OUT, exist_ok=True)
LONG = ["修好了破布护手：耐久上限 12（第 2 次）", "破布头巾坏了：没有保护了，回农场修", "第1轮防守胜利 · 明天休整，下一轮3天后", "先让这片地长出口粮。左下角写着眼下要做的事，按 J 看手记。再长一点的一句话，看它折不折行、压不压到下面。"]

JS = """(texts) => {
  const t = document.querySelector('#toasts');
  t.innerHTML = texts.map((x, i) => `<div class="toast ${i % 2 ? 'warn' : 'gold'}">${x}</div>`).join('');
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return r.width && r.height ? [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] : null; };
  const vis = [...t.children].filter((c) => getComputedStyle(c).display !== 'none' && getComputedStyle(t).display !== 'none').map(box).filter(Boolean);
  const q = (s) => box(document.querySelector(s));
  const hit = (a, b) => a && b && a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  const page = !!document.querySelector('#page:not([hidden])'), card = !!document.querySelector('#card:not([hidden])');
  const others = page || card
    ? { left: q('#page:not([hidden]) .head .left'), esc: q('#page:not([hidden]) .head .esc'), body: q('#page:not([hidden]) .body'), card: q('#card:not([hidden])'), scene: q('#scene:not([hidden])') }
    : { topbar: q('#topbar'), alerts: q('#alerts'), goal: q('#goal'), hands: q('#hands'), dock: q('#dock'), respop: q('#respop:not([hidden])') };
  const over = [];
  for (const v of vis) for (const [k, b] of Object.entries(others)) if (hit(v, b)) over.push(k);
  return { n: vis.length, vis, others, over: [...new Set(over)], fs: vis.length ? getComputedStyle(t.children[t.children.length - 1]).fontSize : '' };
}"""


async def main():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=os.path.join(ROOT, "dist"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    bad = 0
    try:
        async with async_playwright() as pw:
            br = await pw.chromium.launch()
            for w, h in ((1366, 768), (1920, 1080)):
                ctx = await br.new_context(viewport={"width": w, "height": h}, device_scale_factor=1)
                text = open(SAVE, encoding="utf8").read()
                await ctx.add_init_script("if(!sessionStorage.getItem('__seeded')){sessionStorage.setItem('__seeded','1');localStorage.setItem('ember-farm-r1',%s)}" % json.dumps(text))
                pg = await ctx.new_page()
                errs = []
                pg.on("pageerror", lambda e: errs.append(str(e)))
                await pg.goto("http://127.0.0.1:%d/index.html" % PORT)
                await pg.wait_for_selector("#loading", state="hidden", timeout=90000)
                await pg.click('[data-act="continue"]')
                await pg.wait_for_timeout(700)
                for _ in range(6):
                    if not await pg.query_selector("#card:not([hidden]), #page:not([hidden]), #scene:not([hidden])"):
                        break
                    await pg.keyboard.press("Escape")
                    await pg.wait_for_timeout(250)

                async def look(name, want_none=False):
                    nonlocal bad
                    r = await pg.evaluate(JS, LONG)
                    ok = not r["over"] and (r["n"] == 0 if want_none else r["n"] > 0)
                    bad += 0 if ok else 1
                    print("%d×%d %s：出 %d 条 %s 字 %s %s" % (w, h, name, r["n"], r["vis"], r["fs"], "不压" if ok else ("该不出的出了" if want_none and r["n"] else "压到 " + ",".join(r["over"]) + " " + json.dumps(r["others"]))), flush=True)
                    if OUT:
                        await pg.screenshot(path=os.path.join(OUT, "%d-%s.png" % (w, name)))

                await look("画面")
                # 顶上的数字点开明细：消息这一会儿不出
                n = await pg.locator('#res [data-act="res"]').count()
                for i in range(n):
                    await pg.locator('#res [data-act="res"]').nth(i).click(timeout=4000)
                    await pg.wait_for_timeout(200)
                    await look("明细 %d" % (i + 1), want_none=True)
                    await pg.keyboard.press("Escape")
                    await pg.wait_for_timeout(150)
                for key, name in (("t", "队友"), ("i", "仓库"), ("m", "地图"), ("j", "手记"), ("Escape", "设置")):
                    await pg.keyboard.press(key)
                    await pg.wait_for_timeout(350)
                    await look(name)
                    await pg.keyboard.press("Escape")
                    await pg.wait_for_timeout(250)
                print("%d×%d 页面报错 %d 条" % (w, h, len(errs)), flush=True)
                bad += len(errs)
                await ctx.close()
            await br.close()
    finally:
        srv.terminate()
    print("不合格", bad)
    return bad


sys.exit(1 if asyncio.run(main()) else 0)
