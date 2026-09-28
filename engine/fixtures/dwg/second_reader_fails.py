"""A file LibreDWG reads and ACadSharp cannot: a MULTILEADER saved as an AutoCAD 2000 DWG (AC1015).

Invented; no office's convention. AutoCAD 2000 predates the MULTILEADER, yet the fixture writer
(ACadSharp) writes one into the file, and ACadSharp's own reader then stops on it (an
EndOfStreamException; 28 Sep 2026, ACadSharp 3.8.0), while LibreDWG 0.14 reads the file (a LINE and
the MULTILEADER). It is the
cross-check's evidence that a file one decoder cannot read is a failure, never agreement.
"""

from ezdxf.document import Drawing
from ezdxf.math import Vec2
from ezdxf.render.mleader import ConnectionSide

from engine.fixtures.dwg import new_drawing

VERSION = "AC1015"


def draw() -> Drawing:
    doc = new_drawing()
    model = doc.modelspace()
    model.add_line((0, 0), (10, 0))
    multileader = model.add_multileader_mtext("Standard")
    multileader.set_content("NOTE")
    multileader.add_leader_line(ConnectionSide.left, [Vec2(-5, -5)])
    multileader.build(insert=Vec2(0, 0))
    return doc
