"""Page trees a reader can lose itself in (hostile: engine/read/pdf, "The trust boundary").

- `loop`: the root's kids are a page, then an intermediate node whose kids are the root itself and a
  second page; so the tree loops back to its root.
- `deep`: `depth` nodes, each the only kid of the last, above one page.
- `many`: `pages` pages under the root, sharing one content stream.
"""

from engine.fixtures.pdf._writer import Pdf, dictionary, nums, ref, refs, strokes, text, truetype_font


def write(kind: str = "loop", depth: int = 5000, pages: int = 1001) -> bytes:
    pdf = Pdf()
    font = truetype_font(pdf)
    content = pdf.stream(strokes(5) + text(900, 60, "S-301", size=12), deflate=True)
    resources = dictionary({"Font": dictionary({"F1": ref(font)})})

    def page(parent: int) -> int:
        return pdf.add(
            dictionary(
                {
                    "Type": b"/Page",
                    "Parent": ref(parent),
                    "MediaBox": nums((0, 0, 1190.55, 841.89)),
                    "Resources": resources,
                    "Contents": ref(content),
                }
            )
        )

    root = pdf.reserve()
    if kind == "loop":
        middle = pdf.reserve()
        first, second = page(root), page(middle)
        pdf.put(
            middle,
            dictionary(
                {"Type": b"/Pages", "Parent": ref(root), "Kids": refs([root, second]), "Count": b"2"}
            ),
        )
        pdf.put(root, dictionary({"Type": b"/Pages", "Kids": refs([first, middle]), "Count": b"3"}))
    elif kind == "deep":
        parent = root
        for _ in range(depth):
            node = pdf.reserve()
            pdf.put(parent, dictionary({"Type": b"/Pages", "Kids": refs([node]), "Count": b"1"}))
            parent = node
        leaf = page(parent)
        pdf.put(parent, dictionary({"Type": b"/Pages", "Kids": refs([leaf]), "Count": b"1"}))
    elif kind == "many":
        kids = [page(root) for _ in range(pages)]
        pdf.put(root, dictionary({"Type": b"/Pages", "Kids": refs(kids), "Count": b"%d" % pages}))
    else:
        raise ValueError(f"page_tree: no such kind {kind!r}")
    catalog = pdf.add(dictionary({"Type": b"/Catalog", "Pages": ref(root)}))
    return pdf.write(catalog)
