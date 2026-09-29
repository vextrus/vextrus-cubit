"""The owner's review page for the drafted keys (ticket 24s: "each sheet's image beside its drafted key,
a change written against a line").

    uv run --no-sync python -m tools.scorer.review --drafts .private/work/keys-draft \\
        --reference .private/reference

Reads each per-set draft at the top of the drafts folder (`<set>.json`, its set's drawings in
`<reference>/<set>/`), refuses the whole page when any draft does not key the files it names
(`tools/scorer/drafts.py`, naming the file, never a key's value), and writes `review/index.html` inside
the drafts folder: per sheet, its image beside its key's lines, each line numbered and with a box for the
owner's change, and a button that saves every change written, against its line, as a JSON file. It
never writes outside the drafts folder, whose contents `scripts/owner/keys-custody.sh` removes by name
once the keys are in the key user's custody.

A sheet's image is the draft's own: `image` (a picture the drafting agent rendered, a path inside the
drafts folder), or `pdf` and `page` (a Plot's page, a path inside the set's folder), shown in the page;
with neither, the sheet's file and layout are named, to open by hand. What the page holds is drawings and
keys: it stays under `.private/`.

Standard library only (it is in the scorer's folder).
"""

import argparse
import html
import json
import os
import shutil
import sys
from pathlib import Path
from typing import Any

from tools.scorer.drafts import problems

LINES = ("layout", "frame", "number", "title", "discipline", "storeys", "revision", "date")
VIEW_LINES = ("box", "title", "kind", "subject")


def write(drafts: Path, reference: Path) -> Path:
    """The review page, `drafts/review/index.html`; raises `Refused` naming each problem."""
    keys = []
    found = []
    for draft in sorted(drafts.glob("*.json")):
        try:
            key = json.loads(draft.read_bytes())
        except OSError, ValueError:
            found.append(f"{draft.name}: cannot be read as JSON")
            continue
        name = key.get("set") if isinstance(key, dict) else None
        if not isinstance(name, str) or not (reference / name).is_dir() or "/" in name:
            found.append(f"{draft.name}: names no set with a folder in the reference folder")
            continue
        found += [f"{draft.name}: {problem}" for problem in problems(key, reference / name)]
        keys.append((draft, key))
    if found:
        (drafts / "review" / "index.html").unlink(missing_ok=True)  # never a page of an older draft
        raise Refused(found)
    if not keys:
        raise Refused(["no draft (<set>.json) at the top of the drafts folder"])
    page = drafts / "review"
    (page / "img").mkdir(parents=True, exist_ok=True)
    sections = [_set(drafts, reference, page, draft, key) for draft, key in keys]
    index = page / "index.html"
    index.write_text(_PAGE.replace("<!--SETS-->", "\n".join(sections)), encoding="utf-8")
    return index


class Refused(Exception):
    def __init__(self, found: list[str]) -> None:
        super().__init__("; ".join(found))
        self.found = found


def _set(drafts: Path, reference: Path, page: Path, draft: Path, key: dict[str, Any]) -> str:
    name = key["set"]
    out = [f"<section><h2>{_e(name)} <small>({_e(draft.name)})</small></h2>"]
    for n, sheet in enumerate(key.get("sheets") or [], 1):
        if not isinstance(sheet, dict):
            continue
        where = f"{name}.S{n}"
        rows = [_row(f"{where}.L{i}", field, sheet.get(field)) for i, field in enumerate(LINES, 1)]
        for v, view in enumerate(sheet.get("views") or [], 1):
            if isinstance(view, dict):
                rows += [
                    _row(f"{where}.V{v}.L{i}", f"view {v} {field}", view.get(field))
                    for i, field in enumerate(VIEW_LINES, 1)
                ]
        out.append(
            f'<article id="{_e(where)}"><h3>Sheet {n} <small>{_e(sheet.get("file"))}</small></h3>'
            f'<div class="pair"><figure>{_image(drafts, reference / name, page, where, sheet)}</figure>'
            f"<table><tr><th>Line</th><th>Field</th><th>Drafted</th><th>Your change</th></tr>"
            f"{''.join(rows)}</table></div></article>"
        )
    out.append("</section>")
    return "\n".join(out)


def _row(line: str, field: str, value: Any) -> str:
    shown = "" if value is None else value if isinstance(value, str) else json.dumps(value)
    return (
        f'<tr><td class="line">{_e(line)}</td><td>{_e(field)}</td><td>{_e(shown)}</td>'
        f'<td><input data-line="{_e(line)}" data-field="{_e(field)}" data-now="{_e(shown)}"'
        f' aria-label="Change to {_e(line)}"></td></tr>'
    )


def _image(drafts: Path, folder: Path, page: Path, where: str, sheet: dict[str, Any]) -> str:
    image = _inside(drafts, sheet.get("image"))
    if image is not None:
        copy = page / "img" / f"{where}{image.suffix}"
        _link(image, copy)
        return f'<img src="img/{_e(copy.name)}" alt="Sheet {_e(where)} as drafted">'
    pdf, number = _inside(folder, sheet.get("pdf")), sheet.get("page")
    if pdf is not None and isinstance(number, int):
        copy = page / "img" / pdf.name
        if not copy.exists():
            _link(pdf, copy)
        return f'<iframe src="img/{_e(copy.name)}#page={number}" title="Sheet {_e(where)}"></iframe>'
    return (
        f'<p class="none">No image in the draft: open {_e(sheet.get("file"))}, layout'
        f" {_e(sheet.get('layout'))}.</p>"
    )


def _inside(root: Path, relative: Any) -> Path | None:
    """`root/relative` when it is a regular file inside `root` (never through `..` or a link)."""
    if not isinstance(relative, str) or not relative:
        return None
    path = root / relative
    real = path.resolve()
    if path.is_symlink() or not real.is_relative_to(root.resolve()) or not real.is_file():
        return None
    return real


def _link(source: Path, target: Path) -> None:
    target.unlink(missing_ok=True)
    try:
        os.link(source, target)
    except OSError:
        shutil.copyfile(source, target)


def _e(value: Any) -> str:
    return html.escape("" if value is None else str(value))


_PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Drafted keys: the owner's review</title>
<style>
body { font: 15px/1.45 system-ui, sans-serif; margin: 1.5rem; color: #1b1f24; }
.pair { display: flex; gap: 1rem; align-items: flex-start; }
figure { flex: 1 1 55%; margin: 0; }
figure img, figure iframe { inline-size: 100%; block-size: 70vh; object-fit: contain;
  border: 1px solid #c8ccd1; }
table { flex: 1 1 45%; border-collapse: collapse; }
td, th { border-block-end: 1px solid #e3e5e8; padding: 0.25rem 0.4rem; text-align: start; }
.line { font-family: ui-monospace, monospace; white-space: nowrap; }
input { inline-size: 100%; }
input:focus-visible, button:focus-visible { outline: 3px solid #0b57d0; outline-offset: 2px; }
header { position: sticky; inset-block-start: 0; background: #fff; padding-block: 0.5rem; }
.none { padding: 1rem; background: #f6f7f8; }
</style></head>
<body>
<header><h1>Drafted keys: your review</h1>
<p>Each sheet shows its image beside its drafted key. Write a change beside any line that is wrong,
then save your changes and give the file to the orchestrator. A line you leave empty is confirmed.</p>
<button type="button" id="save">Save my changes</button> <span id="said" role="status"></span></header>
<!--SETS-->
<script>
document.getElementById("save").addEventListener("click", () => {
  const changes = [...document.querySelectorAll("input[data-line]")]
    .filter((box) => box.value.trim() !== "")
    .map((box) => ({ line: box.dataset.line, field: box.dataset.field, drafted: box.dataset.now,
      change: box.value.trim() }));
  const file = new Blob([JSON.stringify({ changes }, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = "key-changes.json";
  link.click();
  document.getElementById("said").textContent =
    changes.length === 1 ? "1 change saved." : `${changes.length} changes saved.`;
});
</script>
</body></html>
"""


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="review", description=__doc__.split("\n\n")[0])
    parser.add_argument("--drafts", type=Path, required=True)
    parser.add_argument("--reference", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        index = write(args.drafts, args.reference)
    except Refused as refused:
        for line in refused.found:
            print(f"REFUSED: {line}", file=sys.stderr)
        print("REFUSED: no review page was written.", file=sys.stderr)
        return 1
    print(f"The review page: {index}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
