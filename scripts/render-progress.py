"""Render this project's simple, authored progress ledger into a static Site page."""
from pathlib import Path
from html import escape
import re

root = Path(__file__).resolve().parents[1]
lines = (root / 'docs/ITERATION-LEDGER.md').read_text().splitlines()

def inline(text):
    text = escape(text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    return re.sub(r'\[([^]]+)\]\((https://[^)]+)\)', r'<a href="\2" target="_blank" rel="noopener">\1</a>', text)

out = []
i = 0
while i < len(lines):
    line = lines[i]
    if line.startswith('|'):
        rows = []
        while i < len(lines) and lines[i].startswith('|'):
            cells = [cell.strip() for cell in lines[i].strip('|').split('|')]
            if not all(re.fullmatch(r':?-+:?', c) for c in cells):
                rows.append(cells)
            i += 1
        out.append('<div class="table-scroll" tabindex="0"><table><thead><tr>' + ''.join('<th scope="col">'+inline(c)+'</th>' for c in rows[0]) + '</tr></thead><tbody>' + ''.join('<tr>'+''.join('<td>'+inline(c)+'</td>' for c in row)+'</tr>' for row in rows[1:]) + '</tbody></table></div>')
        continue
    if line.startswith('#'):
        level = len(line) - len(line.lstrip('#'))
        out.append(f'<h{level}>{inline(line[level:].strip())}</h{level}>')
    elif line:
        out.append('<p>'+inline(line)+'</p>')
    i += 1

page = '''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>余烬农场 v0.8.0 · 更新与完善清单</title><style>
*{box-sizing:border-box}body{margin:0;background:#192820;color:#e5e2cc;font:16px/1.8 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1180px;padding:28px;margin:auto}h1,h2{color:#edce83;line-height:1.5}h1{font-size:28px}h2{font-size:21px;margin-top:40px;border-bottom:1px solid #596249;padding-bottom:10px}p{max-width:980px}a{color:#c3da95;text-underline-offset:4px}nav{margin-bottom:24px}nav a{display:inline-block;padding:10px 18px;border:1px solid #7f8a67;border-radius:7px;min-height:44px}.table-scroll{overflow:auto;border:1px solid #526047;border-radius:6px}table{border-collapse:collapse;font-size:14px;min-width:750px;width:100%}th,td{padding:12px;vertical-align:top;text-align:left;border-bottom:1px solid #485540}th{background:#30412f;color:#e8d595}td:first-child{min-width:78px}tr:nth-child(even){background:#25352a}strong{color:#f3d791}@media(max-width:650px){main{padding:18px}h1{font-size:24px}}@media print{body{background:white;color:black}a{color:inherit}h1,h2,strong{color:black}nav{display:none}.table-scroll{overflow:visible}table{min-width:0;font-size:9px}}
</style></head><body><main><nav><a href="./">返回余烬农场</a></nav>'''+''.join(out)+'''</main></body></html>'''
(root / 'dist/progress.html').write_text(page)
print('Rendered dist/progress.html from the maintained iteration ledger.')
