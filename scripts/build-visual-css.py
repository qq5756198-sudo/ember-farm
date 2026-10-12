#!/usr/bin/env python3
"""生成 dist/visual-auto.css：新画面（body.vis-on）下的一份“颜色层”。

做法：按 index.html 里样式表的先后顺序，把每条规则里所有跟颜色有关的声明（背景、边框、描边、阴影、文字颜色……）
原样抄一遍，选择器前面加上 body.vis-on；其中“绿色系”的颜色换成调色板里的木头、锈铁、稻草色，
鲜艳的绿色（表示好、完成）换成调色板里的绿。

为什么要全抄而不是只抄绿色的：加了 body.vis-on 的规则都更“具体”，如果只抄一部分，
原来写在后面、更具体的状态样式（选中、危险、警告、当前……）就会被盖住。全抄一遍、顺序不变，
这些状态之间谁盖谁和原来完全一样。只改颜色，不改布局。手写的 visual.css 放在它后面。
用法：python3 scripts/build-visual-css.py
"""
import re, colorsys, pathlib

DIST = pathlib.Path(__file__).resolve().parent.parent / 'dist'
PROPS = re.compile(
    r'^(background|background-color|background-image'
    r'|border|border-top|border-right|border-bottom|border-left'
    r'|border-color|border-top-color|border-bottom-color|border-left-color|border-right-color'
    r'|outline|outline-color|box-shadow|text-shadow|fill|stroke|text-decoration-color'
    r'|color|caret-color|accent-color|scrollbar-color|column-rule-color)$')
TEXT_PROPS = {'color', 'caret-color'}
COLOR = re.compile(r'#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{4}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)')
# 暗到亮：深色木头、锈铁（背景、边框用）
WARM = ['#140f0b', '#1c140f', '#241a14', '#2a1f17', '#352a21', '#3a2a1f', '#4a3627', '#4a3c30', '#5a4030', '#625244', '#7d6a3a', '#a28a4e', '#c4ab68', '#ddc98c']
# 文字：从深到浅的木头和稻草色，按亮度对上，字和底的反差不变
TEXT = ['#18130f', '#251d17', '#352a21', '#4a3c30', '#625244', '#7d6a3a', '#a28a4e', '#c4ab68', '#ddc98c', '#e9dcc0', '#efe2b4', '#f1e3c2']
# 鲜艳的绿：表示好、已完成，换成调色板里的绿
GOOD = ['#26331d', '#364a24', '#4c632d', '#667d36', '#869843', '#aab258']
GOOD_TEXT = ['#667d36', '#869843', '#aab258']


def parse(c):
    c = c.strip()
    if c.startswith('#'):
        h = c[1:]
        if len(h) in (3, 4):
            h = ''.join(ch * 2 for ch in h)
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1
        return r, g, b, a
    nums = re.findall(r'[\d.]+%?', c)
    if len(nums) < 3:
        return None
    vals = [float(n[:-1]) * 2.55 if n.endswith('%') else float(n) for n in nums[:3]]
    a = float(nums[3]) if len(nums) > 3 and not nums[3].endswith('%') else (float(nums[3][:-1]) / 100 if len(nums) > 3 else 1)
    return int(vals[0]), int(vals[1]), int(vals[2]), a


def lum(r, g, b):
    return 0.299 * r + 0.587 * g + 0.114 * b


def hexlum(h):
    return lum(int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16))


def nearest_by_lum(ramp, L):
    return min(ramp, key=lambda h: abs(hexlum(h) - L))


# 带这些类名的规则是“好、完成”的状态：里面的淡绿也当鲜绿处理
STATE = re.compile(r'\.(done|ok|met|good|ready|complete|completed|success|pass|passed|unlocked|claimed|owned|healthy|safe)\b')


def remap(c, good=False, text=False):
    p = parse(c)
    if not p:
        return None
    r, g, b, a = p
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    hue = h * 360
    if not (70 <= hue <= 180) or s < 0.045:
        return None
    L = lum(r, g, b)
    vivid = (s > 0.32 and L > 95) or (good and s > 0.12)
    if text:
        new = nearest_by_lum(GOOD_TEXT, L) if vivid else nearest_by_lum(TEXT, L)
    elif vivid:
        new = nearest_by_lum(GOOD, L)
    else:
        new = nearest_by_lum(WARM, L * 0.95)
    if a >= 0.999:
        return new
    nr, ng, nb = int(new[1:3], 16), int(new[3:5], 16), int(new[5:7], 16)
    return f'rgba({nr},{ng},{nb},{round(a, 3)})'


def strip_comments(css):
    return re.sub(r'/\*.*?\*/', '', css, flags=re.S)


def blocks(css):
    """把样式表拆成 (前缀, 选择器, 声明)；@media、@supports 里面的规则带着前缀"""
    out = []

    def walk(text, prefix):
        j, m = 0, len(text)
        while j < m:
            k = text.find('{', j)
            if k < 0:
                break
            head = text[j:k].strip()
            depth, e = 1, k + 1
            while e < m and depth:
                if text[e] == '{':
                    depth += 1
                elif text[e] == '}':
                    depth -= 1
                e += 1
            body = text[k + 1:e - 1]
            if head.startswith('@media') or head.startswith('@supports'):
                walk(body, head if not prefix else prefix + ' ' + head)
            elif head.startswith('@'):
                pass  # 关键帧、字体：跳过
            else:
                out.append((prefix, head, body))
            j = e
    walk(css, None)
    return out


# 这些类名是加在 body 自己身上的（色弱配色、大字、安静模式、战斗中、标题页……），要和 vis-on 写在一起
BODY_CLASSES = ('a11y-text', 'a11y-color', 'a11y-calm', 'combat-mode', 'world-focus-mode', 'modal-open', 'title-screen')
BODY_START = re.compile(r'^\.(' + '|'.join(re.escape(c) for c in BODY_CLASSES) + r')(?=$|[\s.:\[>+~])')


def vis_selector(s):
    if s.startswith('body.') or s.startswith('body ') or s.startswith('body:') or s.startswith('body['):
        return 'body.vis-on' + s[4:]
    if s in (':root', 'html', 'body'):
        return 'body.vis-on'
    if BODY_START.match(s):
        return 'body.vis-on' + s
    return 'body.vis-on ' + s


def sheets():
    """index.html 里的样式表，按引用的先后顺序（不含新画面自己的三份）"""
    html = (DIST / 'index.html').read_text(encoding='utf-8')
    names = re.findall(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"', html)
    # gear.css（v0.22）、feel.css（v0.23）、undertow.css（v0.24）、longnight.css（v0.25）本来就是按新画面写的，不用再抄一层
    return [n for n in names if n not in ('visual.css', 'visual-auto.css', 'gear.css', 'feel.css', 'undertow.css', 'longnight.css') and (DIST / n).exists()]


def main():
    rules = []
    count = changed_decls = 0
    for name in sheets():
        css = strip_comments((DIST / name).read_text(encoding='utf-8'))
        for prefix, sel, body in blocks(css):
            good = bool(STATE.search(sel))
            decls = []
            for d in body.split(';'):
                if ':' not in d:
                    continue
                prop, val = d.split(':', 1)
                prop = prop.strip().lower()
                if not PROPS.match(prop):
                    continue
                text = prop in TEXT_PROPS
                hit = False

                def sub(m):
                    nonlocal hit
                    new = remap(m.group(0), good, text)
                    if new:
                        hit = True
                        return new
                    return m.group(0)
                nv = COLOR.sub(sub, val)
                changed_decls += hit
                decls.append(f'  {prop}: {" ".join(nv.split())};')
            if not decls:
                continue
            sels = [s.strip() for s in sel.split(',') if s.strip()]
            rule = ',\n'.join(vis_selector(s) for s in sels) + ' {\n' + '\n'.join(decls) + '\n}'
            if prefix:
                rule = prefix + ' {\n' + rule + '\n}'
            rules.append(f'/* {name} */\n' + rule)
            count += 1
    header = ('/* 自动生成（scripts/build-visual-css.py），不要手改。新画面下的颜色层：按原来样式表的顺序把所有颜色声明抄一遍，\n'
              '   绿色系换成调色板里的木头、锈铁和稻草色，选中、危险、警告这些状态之间谁盖谁和原来一样。 */\n')
    (DIST / 'visual-auto.css').write_text(header + '\n'.join(rules) + '\n', encoding='utf-8')
    print('rules', count, 'remapped declarations', changed_decls)


main()
