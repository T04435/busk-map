"""Impeccable critique and audit sections for the living reports, built from the skill's own outputs.

Each page has two files in qa/impeccable/, written by the impeccable skill (v4.4.0) run at a closing commit:
  <page>-A.md  Assessment A: the isolated design-review sub-agent of `impeccable critique`
  <page>-B.md  Assessment B: the isolated detector-and-browser sub-agent (`impeccable detect --json` + detect.js overlay),
               which also ran `impeccable audit` (5 dimensions /20)
They are rendered as written. QA's synthesis (what was verified, what maps to which defect, what conflicts with a user's
call) is a separate block above them, so nothing QA wrote is passed off as the skill's output.
Usage from a parts file: SECTIONS += impeccable("brain", synthesis_html)."""
import html, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.join(HERE, "..", "impeccable")
META = os.path.join(DIR, "runs.txt")  # lines: page commit agentA agentB widths


def _inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"(?<![\w*])\*([^*\n]+)\*(?!\w)", r"<i>\1</i>", s)
    return s


def md(text):
    out, lines, i = [], text.split("\n"), 0
    while i < len(lines):
        ln = lines[i]
        if not ln.strip():
            i += 1; continue
        m = re.match(r"^(#{1,6})\s+(.*)", ln)
        if m:
            lvl = min(len(m.group(1)) + 2, 6)
            out.append(f"<h{lvl}>{_inline(m.group(2))}</h{lvl}>"); i += 1; continue
        if ln.lstrip().startswith("|"):
            rows = []
            while i < len(lines) and lines[i].lstrip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-{2,}:?", c) for c in cells if c):
                    rows.append(cells)
                i += 1
            head, body = rows[0], rows[1:]
            out.append("<table><thead><tr>" + "".join(f"<th>{_inline(c)}</th>" for c in head) + "</tr></thead><tbody>"
                       + "".join("<tr>" + "".join(f"<td>{_inline(c)}</td>" for c in r) + "</tr>" for r in body) + "</tbody></table>")
            continue
        if re.match(r"^\s*([-*]|\d+\.)\s+", ln):
            # nested lists by indent
            stack, buf = [], []
            while i < len(lines) and (re.match(r"^\s*([-*]|\d+\.)\s+", lines[i]) or (lines[i].startswith("  ") and lines[i].strip())):
                l = lines[i]
                m = re.match(r"^(\s*)([-*]|\d+\.)\s+(.*)", l)
                if not m:  # continuation line
                    buf[-1] = buf[-1][:-5] + " " + _inline(l.strip()) + "</li>"; i += 1; continue
                ind, tag = len(m.group(1)), ("ol" if m.group(2)[0].isdigit() else "ul")
                while stack and ind < stack[-1][0]:
                    buf.append(f"</{stack.pop()[1]}>")
                if not stack or ind > stack[-1][0]:
                    if stack and buf and buf[-1].endswith("</li>"):
                        buf[-1] = buf[-1][:-5]  # open the nested list inside the previous item
                        stack.append((ind, tag, True))
                    else:
                        stack.append((ind, tag, False))
                    buf.append(f"<{tag}>")
                buf.append(f"<li>{_inline(m.group(3))}</li>"); i += 1
            while stack:
                ind, tag, nested = stack.pop()
                buf.append(f"</{tag}>" + ("</li>" if nested else ""))
            out.append("".join(buf)); continue
        para = []
        while i < len(lines) and lines[i].strip() and not re.match(r"^(#{1,6}\s|\s*\||\s*([-*]|\d+\.)\s)", lines[i]):
            para.append(lines[i].strip()); i += 1
        out.append(f"<p>{_inline(' '.join(para))}</p>")
    return "\n".join(out)


def _meta(page):
    for l in open(META, encoding="utf8"):
        f = l.split()
        if f and f[0] == page:
            return {"commit": f[1], "a": f[2], "b": f[3], "widths": f[4]}
    raise KeyError(page)


def impeccable(page, synthesis):
    """Two sections: the critique (A + the B detector evidence, with QA's synthesis) and the audit."""
    m = _meta(page)
    a = open(os.path.join(DIR, f"{page}-A.md"), encoding="utf8").read()
    b = open(os.path.join(DIR, f"{page}-B.md"), encoding="utf8").read()
    prov = (f'<p class="prov"><b>How this was produced.</b> The impeccable skill v4.4.0 (<code>impeccable:impeccable</code>), '
            f'verb <code>{{verb}}</code>, run on design/honeycomb <code>{m["commit"]}</code> from QA\'s clean export, offline, at '
            f'{m["widths"].replace(",", ", ")} px. Method: dual-agent (A: <code>{m["a"]}</code> · B: <code>{m["b"]}</code>), each an '
            f'isolated sub-agent that did not read the QA report or the other assessment. A and B are reproduced as the skill wrote '
            f'them (<code>qa/impeccable/{page}-A.md</code>, <code>{page}-B.md</code>). The block marked “QA synthesis” is QA\'s, '
            f'not the skill\'s.</p>')
    crit = (prov.replace("{verb}", "critique") + f'<div class="synth"><h3>QA synthesis</h3>{synthesis}</div>'
            + f'<details open><summary>Assessment A · design review (as written)</summary>{md(a)}</details>')
    aud = (prov.replace("{verb}", "audit") + f'<details open><summary>Assessment B · detector, browser evidence and audit /20 (as written)</summary>{md(b)}</details>')
    return [("critique", "Impeccable critique", crit), ("audit", "Impeccable audit", aud)]
