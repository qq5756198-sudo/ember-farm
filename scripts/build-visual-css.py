#!/usr/bin/env python3
"""生成 dist/visual-auto.css：把各个样式表里原来的“绿色系”背景、边框、阴影，
在新画面（body.vis-on）下换成调色板里的木头、锈铁颜色；鲜艳的绿色（表示好、完成）换成调色板里的绿。
只改颜色，不改布局。手写的 visual.css 放在它后面，优先级更高。
用法：python3 scripts/build-visual-css.py
"""
import re, colorsys, pathlib

DIST = pathlib.Path(__file__).resolve().parent.parent / 'dist'
SKIP = {'visual.css', 'visual-auto.css'}
PROPS = re.compile(r'^(background|background-color|background-image|border|border-top|border-right|border-bottom|border-left|border-color|border-top-color|border-bottom-color|border-left-color|border-right-color|outline|outline-color|box-shadow|fill|stroke|text-decoration-color)$')
COLOR = re.compile(r'#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{4}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)')
# 暗到亮：深色木头、锈铁（背景、边框用）
WARM = ['#140f0b', '#1c140f', '#241a14', '#2a1f17', '#352a21', '#3a2a1f', '#4a3627', '#4a3c30', '#5a4030', '#625244', '#7d6a3a', '#a28a4e', '#c4ab68', '#ddc98c']
# 鲜艳的绿：表示好、已完成，换成调色板里的绿
GOOD = ['#26331d', '#364a24', '#4c632d', '#667d36', '#869843', '#aab258']


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


STATE = re.compile(r'\.(done|ok|met|good|ready|complete|completed|success|pass|passed|unlocked|claimed|owned|healthy|safe)\b')


def remap(c, good=False):
    p = parse(c)
    if not p:
        return None
    r, g, b, a = p
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    hue = h * 360
    if not (70 <= hue <= 180) or s < 0.07:
        return None
    L = lum(r, g, b)
    if (s > 0.32 and L > 95) or (good and s > 0.12):
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
    """把样式表拆成 (前缀, 选择器, 声明) ；@media 里面的规则带着 @media 前缀"""
    i, n = 0, len(css)
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
                walk(body, head)
            elif head.startswith('@'):
                pass  # 关键帧、字体：跳过
            else:
                out.append((prefix, head, body))
            j = e
    walk(css, None)
    return out


def main():
    rules = []
    count = 0
    for path in sorted(DIST.glob('*.css')):
        if path.name in SKIP:
            continue
        css = strip_comments(path.read_text(encoding='utf-8'))
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
                changed = False

                def sub(m):
                    nonlocal changed
                    new = remap(m.group(0), good)
                    if new:
                        changed = True
                        return new
                    return m.group(0)
                nv = COLOR.sub(sub, val)
                if changed:
                    decls.append(f'  {prop}: {nv.strip()};')
            if not decls:
                continue
            sels = [s.strip() for s in sel.split(',') if s.strip()]
            vsel = []
            for s in sels:
                if s.startswith('body.') or s.startswith('body '):
                    rest = s[4:]
                    vsel.append('body.vis-on' + rest)
                elif s in (':root', 'html', 'body'):
                    vsel.append('body.vis-on')
                else:
                    vsel.append('body.vis-on ' + s)
            rule = ',\n'.join(vsel) + ' {\n' + '\n'.join(decls) + '\n}'
            if prefix:
                rule = prefix + ' {\n' + rule + '\n}'
            rules.append(f'/* {path.name} */\n' + rule)
            count += 1
    header = '/* 自动生成（scripts/build-visual-css.py）：新画面下把原来的绿色系换成调色板里的木头、锈铁颜色。不要手改。 */\n'
    (DIST / 'visual-auto.css').write_text(header + '\n'.join(rules) + '\n', encoding='utf-8')
    print('rules', count)


main()
