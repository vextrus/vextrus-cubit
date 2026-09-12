"""The Hershey simplex stroke font, embedded (W-03: the stroked PDF carries no font at all).

Dr A. V. Hershey's vector glyphs were published by the US National Bureau of Standards and are in
the public domain; the occidental simplex roman set is the one a CAD station draws when it has no
SHX and the one `rcc6-bnbc.shx.pdf` paints, so the file has geometry where a reader expects text
and `pypdfium2` extracts nothing from it.

Storage is the classic glyph record — `(left, right, path)` — with the coordinates in Hershey's own
21-unit system encoded one character per ordinate (`ord(c) - ord('R')`, y counted DOWNWARD from the
cap line), and `" R"` lifting the pen. `strokes()` hands back polylines in the painter's system
instead: x from 0, y UPWARD from the baseline, cap height `CAP` = 21, so a caller scaling by
`h / CAP` gets text whose capitals are exactly `h` tall.

Non-ASCII is not Hershey's: the few glyphs a Dhaka structural drawing needs (Ø ° ± ½ ¼ ¾ × ≥ ≤) are
drawn here in the same system, and anything else — a Bengali syllable, say — comes back as the
tofu box, which is what a station with no glyph draws. `covers()` tells a painter which it is.
"""

from __future__ import annotations

#: Hershey's cap height: the cap line is y = -12, the baseline y = 9.
CAP = 21.0
_BASE = 9.0

#: char -> (left, right, path). Left/right are the glyph's side bearings; the advance is their
#: difference. The paths are the simplex roman set (Hershey's glyphs 699-728 and 501-526/601-626).
_GLYPHS: dict[str, tuple[str, str, str]] = {
    " ": ("J", "Z", ""),
    "!": ("M", "W", "RFRT RRYQZR[SZRY"),
    '"': ("J", "Z", "NFNM RVFVM"),
    "#": ("H", "]", "SBLb RYBRb RLOZO RKUYU"),
    "$": ("H", "\\", "RBR_ RUISGQFOFMGLILKMMNNONVQWRXTXWWYTZQZOYNX"),
    "%": ("F", "^", "[FI[ RNFPHPJOLMMKMIKIIJGLFNFPGSHVHYG[F RWTUUTWTYV[X[ZZ[X[VYTWT"),
    "&": ("E", "_", "\\O\\N[MZMYNXPVUTXRZP[L[JZIYHWHUISJRQNRMSKSIRGPFNGMIMKNNPQUXWZY[[[\\Z\\Y"),
    "'": ("M", "W", "RFRM"),
    "(": ("K", "Y", "VBTDRGPKOPOTPYR]T`Vb"),
    ")": ("K", "Y", "NBPDRGTKUPUTTYR]P`Nb"),
    "*": ("J", "Z", "RFRR RMIWO RWIMO"),
    "+": ("E", "_", "RIR[ RIR[R"),
    ",": ("N", "V", "SYRZQYRXSYS[R]Q^"),
    "-": ("E", "_", "IR[R"),
    ".": ("N", "V", "RYQZR[SZRY"),
    "/": ("G", "]", "[BIb"),
    "0": ("H", "\\", "QFNGLJKOKRLWNZQ[S[VZXWYRYOXJVGSFQF"),
    "1": ("H", "\\", "NJPISFS["),
    "2": ("H", "\\", "LKLJMHNGPFTFVGWHXJXLWNUQK[Y["),
    "3": ("H", "\\", "MFXFRNUNWOXPYSYUXXVZS[P[MZLYKW"),
    "4": ("H", "\\", "UFKTZT RUFU["),
    "5": ("H", "\\", "WFMFLOMNPMSMVNXPYSYUXXVZS[P[MZLYKW"),
    "6": ("H", "\\", "XIWGTFRFOGMJLOLTMXOZR[S[VZXXYUYTXQVOSNRNOOMQLT"),
    "7": ("H", "\\", "YFO[ RKFYF"),
    "8": ("H", "\\", "PFMGLILKMMONSOVPXRYTYWXYWZT[P[MZLYKWKTLRNPQOUNWMXKXIWGTFPF"),
    "9": ("H", "\\", "XMWPURRSQSNRLPKMKLLINGQFRFUGWIXMXRWWUZR[P[MZLX"),
    ":": ("N", "V", "RMQNROSNRM RRYQZR[SZRY"),
    ";": ("N", "V", "RMQNROSNRM RSYRZQYRXSYS[R]Q^"),
    "<": ("F", "^", "ZIJRZ["),
    "=": ("E", "_", "IO[O RIU[U"),
    ">": ("F", "^", "JIZRJ["),
    "?": ("I", "[", "LKLJMHNGPFTFVGWHXJXLWNVORQRT RRYQZR[SZRY"),
    "@": ("E", "_", "XYU[R[NZKWISIPKLNJRIVJYL[P[TZWXXVXUVUN RRNUSVRUURVOUNROORN"),
    "A": ("I", "[", "RFJ[ RRFZ[ RMTWT"),
    "B": ("G", "\\", "KFK[ RKFTFWGXHYJYLXNWOTP RKPTPWQXRYTYWXYWZT[K["),
    "C": ("H", "\\", "ZKYIWGUFQFOGMILKKNKSLVMXOZQ[U[WZYXZV"),
    "D": ("G", "\\", "KFK[ RKFRFUGWIXKYNYSXVWXUZR[K["),
    "E": ("H", "[", "LFL[ RLFYF RLPTP RL[Y["),
    "F": ("H", "Y", "LFL[ RLFYF RLPTP"),
    "G": ("H", "]", "ZKYIWGUFQFOGMILKKNKSLVMXOZQ[U[WZYXZVZS RUSZS"),
    "H": ("G", "]", "KFK[ RYFY[ RKPYP"),
    "I": ("N", "V", "RFR["),
    "J": ("K", "Y", "VFVVUYTZR[P[NZMYLVLT"),
    "K": ("G", "\\", "KFK[ RYFKT RPOY["),
    "L": ("H", "X", "LFL[ RL[W["),
    "M": ("F", "^", "JFJ[ RJFR[ RZFR[ RZFZ["),
    "N": ("G", "]", "KFK[ RKFY[ RYFY["),
    "O": ("G", "]", "PFNGLIKKJNJSKVLXNZP[T[VZXXYVZSZNYKXIVGTFPF"),
    "P": ("H", "\\", "LFL[ RLFUFWGXHYJYMXOWPUQLQ"),
    "Q": ("G", "]", "PFNGLIKKJNJSKVLXNZP[T[VZXXYVZSZNYKXIVGTFPF RSWY]"),
    "R": ("H", "\\", "LFL[ RLFUFWGXHYJYLXNWOUPLP RSPY["),
    "S": ("H", "\\", "XIVGSFOFLGJIJKKMLNNOTQVRWSXUXXVZS[O[LZJX"),
    "T": ("J", "Z", "RFR[ RKFYF"),
    "U": ("G", "]", "KFKULXNZQ[S[VZXXYUYF"),
    "V": ("I", "[", "JFR[ RZFR["),
    "W": ("F", "^", "HFM[ RRFM[ RRFW[ R\\FW["),
    "X": ("H", "\\", "KFY[ RYFK["),
    "Y": ("I", "[", "JFRQR[ RZFRQ"),
    "Z": ("H", "\\", "YFK[ RKFYF RK[Y["),
    "[": ("M", "W", "OBO^ RPBP^ ROBVB RO^V^"),
    "\\": ("K", "Y", "NBVb"),
    "]": ("M", "W", "TBT^ RUBU^ RNBUB RN^U^"),
    "^": ("K", "Y", "NPRLVP"),
    "_": ("I", "[", "I][]"),
    "`": ("N", "V", "SFRGQIQKRLSKRJ"),
    "a": ("I", "[", "XMX[ RXPVNTMQMONMPLSLUMXOZQ[T[VZXX"),
    "b": ("H", "[", "LFL[ RLPNNPMSMUNWPXSXUWXUZS[P[NZLX"),
    "c": ("I", "[", "XPVNTMQMONMPLSLUMXOZQ[T[VZXX"),
    "d": ("I", "[", "XFX[ RXPVNTMQMONMPLSLUMXOZQ[T[VZXX"),
    "e": ("I", "[", "LSXSXQWOVNTMQMONMPLSLUMXOZQ[T[VZXX"),
    "f": ("M", "X", "WFUFSGRJR[ RNMVM"),
    "g": ("I", "[", "XMX]W`U`RaO` RXPVNTMQMONMPLSLUMXOZQ[T[VZXX"),
    "h": ("H", "[", "LFL[ RLQONQMTMVNWQW["),
    "i": ("N", "V", "QFQGRGRFQF RQMQ["),
    "j": ("M", "V", "RFRGSGSFRF RSMS^RaPa"),
    "k": ("H", "Z", "LFL[ RVMLW RPSW["),
    "l": ("N", "V", "RFR["),
    "m": ("C", "a", "GMG[ RGQJNLMOMQNRQR[ RRQUNWMZM\\N]Q]["),
    "n": ("H", "[", "LML[ RLQONQMTMVNWQW["),
    "o": ("I", "\\", "QMONMPLSLUMXOZQ[T[VZXXYUYSXPVNTMQM"),
    "p": ("H", "[", "LMLb RLPNNPMSMUNWPXSXUWXUZS[P[NZLX"),
    "q": ("I", "\\", "XMXb RXPVNTMQMONMPLSLUMXOZQ[T[VZXX"),
    "r": ("L", "X", "OMO[ ROSPPRNTMWM"),
    "s": ("I", "[", "XPWNTMQMNNMPNRPSUTWUXWXXWZT[Q[NZMX"),
    "t": ("M", "X", "RFRWSZU[W[ RNMVM"),
    "u": ("H", "[", "LMLWMZO[R[TZWW RWMW["),
    "v": ("I", "[", "JMR[ RZMR["),
    "w": ("F", "^", "KMN[ RRMN[ RRMV[ RZMV["),
    "x": ("I", "[", "KMW[ RWMK["),
    "y": ("I", "[", "JMR[ RZMR[P_N`L`K_"),
    "z": ("I", "[", "WMK[ RKMWM RK[W["),
    "{": ("K", "Y", "TBRCQDPFPHQJRKSMSOQQ RRCQEQGRISJTLTNSPORSTTVTXSZR[Q]Q_Ra RQSSUSWRYQZP\\P^Q`RaTb"),
    "|": ("N", "V", "RBRb"),
    "}": ("K", "Y", "PBRCSDTFTHSJRKQMQOSQ RRCSESGRIQJPLPNQPURQTPVPXQZR[S]S_Ra RSSQUQWRYSZT\\T^S`RaPb"),
    "~": ("F", "^", "IUISJPLONOPPTSVTXTYSZQ RISJQLPNPPQTTVUXUYT[R"),
}

#: Beyond ASCII: the handful a Dhaka structural drawing prints, drawn in the same 21-unit system.
_EXTRA: dict[str, tuple[str, str, str]] = {
    "\u00d8": ("G", "]", "PFNGLIKKJNJSKVLXNZP[T[VZXXYVZSZNYKXIVGTFPF RJ]ZG"),
    "\u2205": ("G", "]", "PFNGLIKKJNJSKVLXNZP[T[VZXXYVZSZNYKXIVGTFPF RJ]ZG"),
    "\u00b0": ("K", "Y", "PFOGNIOKQLSLUKVIUGSFPF"),
    "\u00b1": ("E", "_", "RKRU RIP[P RIX[X"),
    "\u00d7": ("H", "\\", "LLXX RXLLX"),
    "\u00b7": ("N", "V", "RQQRRSSRRQ"),
    "\u2265": ("E", "_", "IN[RIV RIZ[Z"),
    "\u2264": ("E", "_", "[NIR[V RIZ[Z"),
    "\u2212": ("E", "_", "IR[R"),
    "\u00b5": ("H", "[", "LMLb RLWMZO[R[TZWW RWMW["),
    # the notation a general-notes sheet writes its formulae in
    "\u03c0": ("H", "\\", "LMXM RNMM[ RVMV["),
    "\u221a": ("F", "^", "ITLXPHZH"),
    "\u03a3": ("H", "\\", "XFLFRPL[X["),
    "\u2192": ("E", "_", "IR[R RVN[R RVV[R"),
    "\u230a": ("K", "Y", "NFN[V["),
    "\u230b": ("K", "Y", "VFV[N["),
    "\u2308": ("K", "Y", "VFNFN["),
    "\u2309": ("K", "Y", "NFVFV["),
    "\u2026": ("F", "^", "LYKZL[MZLY RRYQZR[SZRY RXYWZX[YZXY"),
    # and the mojibake a Windows-1252 round trip leaves behind (T-NOT-MOJIBAKE)
    "\u00e2": ("I", "[", "XMX[ RXPVNTMQMONMPLSLUMXOZQ[T[VZXX RNJRGVJ"),
    "\u02c6": ("K", "Y", "NJRGVJ"),
}

#: Fractions and superscripts are composed from the digits above rather than restated: a fraction
#: is a half-height numerator over the shoulder of a slash with a half-height denominator after it.
_FRACTIONS = {
    "\u00bd": ("1", "2"),
    "\u00bc": ("1", "4"),
    "\u00be": ("3", "4"),
    "\u215b": ("1", "8"),
    "\u215c": ("3", "8"),
    "\u215d": ("5", "8"),
    "\u215e": ("7", "8"),
    "\u2153": ("1", "3"),
    "\u2154": ("2", "3"),
}
_SUPERSCRIPTS = {"\u00b2": "2", "\u00b3": "3", "\u00b9": "1"}
#: The tofu box a station with no glyph draws (T-BENGALI never reaches a PDF: W-03).
_TOFU = ("J", "Z", "MFWF RWFW[ RW[M[ RM[MF")

_CACHE: dict[str, tuple[float, list[list[tuple[float, float]]]]] = {}


def _decode(record: tuple[str, str, str]) -> tuple[float, list[list[tuple[float, float]]]]:
    left, right, path = record
    x0 = ord(left) - ord("R")
    advance = float(ord(right) - ord("R") - x0)
    polylines: list[list[tuple[float, float]]] = []
    current: list[tuple[float, float]] = []
    index = 0
    while index + 1 < len(path):
        pair = path[index : index + 2]
        index += 2
        if pair == " R":
            if len(current) > 1:
                polylines.append(current)
            current = []
            continue
        x = ord(pair[0]) - ord("R") - x0
        y = _BASE - (ord(pair[1]) - ord("R"))
        current.append((float(x), float(y)))
    if len(current) > 1:
        polylines.append(current)
    return advance, polylines


def _place(
    polylines: list[list[tuple[float, float]]], k: float, dx: float, dy: float
) -> list[list[tuple[float, float]]]:
    return [[(x * k + dx, y * k + dy) for x, y in line] for line in polylines]


def _compose_fraction(numerator: str, denominator: str) -> tuple[float, list[list[tuple[float, float]]]]:
    half = 0.5
    top = _decode(_GLYPHS[numerator])
    bottom = _decode(_GLYPHS[denominator])
    a = top[0] * half
    lines = _place(top[1], half, 0.0, CAP - half * CAP)
    lines.append([(0.0, -2.0), (a + 4.0, CAP)])
    lines += _place(bottom[1], half, a + 5.0, 0.0)
    return a + 5.0 + bottom[0] * half + 2.0, lines


def _compose_superscript(digit: str) -> tuple[float, list[list[tuple[float, float]]]]:
    k = 0.6
    advance_of, lines = _decode(_GLYPHS[digit])
    return advance_of * k, _place(lines, k, 0.0, CAP - k * CAP)


def _record(ch: str) -> tuple[str, str, str] | None:
    return _GLYPHS.get(ch) or _EXTRA.get(ch)


def _glyph(ch: str) -> tuple[float, list[list[tuple[float, float]]]]:
    if ch not in _CACHE:
        if ch in _FRACTIONS:
            _CACHE[ch] = _compose_fraction(*_FRACTIONS[ch])
        elif ch in _SUPERSCRIPTS:
            _CACHE[ch] = _compose_superscript(_SUPERSCRIPTS[ch])
        else:
            _CACHE[ch] = _decode(_record(ch) or _TOFU)
    return _CACHE[ch]


def covers(ch: str) -> bool:
    """True when the table draws this character itself rather than the tofu box."""
    return _record(ch) is not None or ch in _FRACTIONS or ch in _SUPERSCRIPTS


def strokes(ch: str) -> list[list[tuple[float, float]]]:
    """The pen-down polylines of one character: x from 0, y up from the baseline, cap height CAP."""
    return _glyph(ch)[1]


def advance(ch: str) -> float:
    """How far the pen moves on for this character, in the same 21-unit system."""
    return _glyph(ch)[0]


def width(text: str) -> float:
    """The advance of a whole string (the stroked painter's `stringWidth`)."""
    return sum(advance(ch) for ch in text)


def text_strokes(text: str) -> list[list[tuple[float, float]]]:
    """Every polyline of a string, laid out left to right from (0, 0) on the baseline."""
    out: list[list[tuple[float, float]]] = []
    pen = 0.0
    for ch in text:
        for polyline in strokes(ch):
            out.append([(x + pen, y) for x, y in polyline])
        pen += advance(ch)
    return out
