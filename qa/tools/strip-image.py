"""Compose a field strip (unfocused | focused at day/night × 1440/390) for one route from field-strip.mjs output.
Run: python3 -I qa/tools/strip-image.py <fields dir> <route> <out.jpg>"""
import sys, json
from PIL import Image, ImageDraw
src, route, out = sys.argv[1], sys.argv[2], sys.argv[3]
r = [x for x in json.load(open(f"{src}/fields.json")) if x["route"] == route]
idx = sorted({int(x["id"].rsplit("-", 1)[1]) for x in r})
cols = [("light", 1440), ("dark", 1440), ("light", 390), ("dark", 390)]
H, CW = 52, 260; rows = []; npass = 0
for i in idx:
    cells, name, ok = [], None, True
    for sc, w in cols:
        x = next((y for y in r if y["scheme"] == sc and y["w"] == w and y["id"].endswith(f"-{i}")), None)
        for s in "uf":
            if x:
                im = Image.open(f"{src}/{x['id']}-{s}.png").convert("RGB"); im = im.resize((max(1, int(im.width * H / im.height)), H)).crop((0, 0, CW, H))
                name = name or f"{x['kind']} “{x['name'][:28]}”"; ok &= x["pass"]
            else:
                im = Image.new("RGB", (CW, H), "#eee")
            cells.append(im)
    npass += ok
    row = Image.new("RGB", (8 * (CW + 8) + 8, H + 18), "white"); d = ImageDraw.Draw(row)
    d.text((4, 2), f"#{i} {name}  {'PASS' if ok else 'FAIL'}", fill="green" if ok else "red")
    for k, c in enumerate(cells): row.paste(c, (8 + k * (CW + 8), 16))
    rows.append(row)
hdr = Image.new("RGB", (rows[0].width, 18), "white"); d = ImageDraw.Draw(hdr)
for k, (sc, w) in enumerate(cols): d.text((8 + k * 2 * (CW + 8), 3), f"{sc} {w}: unfocused | focused", fill="black")
o = Image.new("RGB", (rows[0].width, 18 + sum(x.height for x in rows)), "white"); o.paste(hdr, (0, 0)); y = 18
for x in rows: o.paste(x, (0, y)); y += x.height
o.save(out, quality=75); print(len(idx), "fields,", npass, "pass")
