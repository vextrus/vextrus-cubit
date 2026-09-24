# Register JSON export

Schema version: 1.1

The JSON export of one project's register and its published lines, for integrations
(`R-TO-070`, `C-TO-EXPORT`: "JSON of the register (documented shape) for integrations").

The document is a pure function of the reading the register workspace itself is handed — the same
objects, the same lines, the same refusals, in the same order — so what an integration reads is what
a person reads on the screen. Nothing is computed a second time on the way out, nothing is minted and
no clock is read: the same register answers the same bytes every time.

- **Declared in** `src/modules/takeoff/export/register-json/schema.ts`, as the Zod schema
  `RegisterJsonDocument`. Every level is a strict object: a document carrying a property this page
  does not name is refused.
- **Produced by** `registerJsonOf(view)` and published as text by `serializeRegisterJson(document)`:
  object keys in code-unit order at every depth, lists in the register's own order, two-space
  indentation, one closing newline.
- **Held against drift by** `src/modules/takeoff/export/register-json/__tests__/fixtures/register-json.v1.schema.json`,
  the committed JSON Schema of the shape below, and by
  `.../fixtures/register-json.v1.example.json`, a whole document of the committed sample reading.

Two rules govern every figure in the document:

- **`lines[].value` is a decimal string at full precision and never a JSON number.** The register
  keeps quantities exactly (`L-QTY-07`); a JSON number is a float, and a float loses digits the
  register holds. Parse it with a decimal library, not with `Number`.
- **`lines[].value` is `null` exactly where `lines[].coverage` is not `COMPLETE`.** A line kept with
  incomplete coverage carries no quantity at all — never a zero, which would read as "measured, and
  it came to nothing" (`L-QTY-02`).

## The document

| Path | Type | Meaning |
| --- | --- | --- |
| `schemaVersion` | string | The version of this shape, always `"1.1"` for a document written under this page. |
| `tenantId` | string | The tenant whose register was read. |
| `projectId` | string | The project whose register was read. |
| `campaign` | object or null | The campaign the register was read under, or `null` where no campaign stands (`L-REG-07`). |
| `objects` | array | Every register object of the reading, as `objects[]` below. |
| `lines` | array | Every published quantity line of the reading, as `lines[]` below. |
| `refusals` | array | Every sighting that produced no line, as `refusals[]` below. |

There is nothing else at the top level. In particular the document carries **no timestamp** (it would
make two exports of one register differ) and **no `levelStacks`** (a proposed level stack is an offer
the register screen makes a person, not register content).

## `campaign`

| Path | Type | Meaning |
| --- | --- | --- |
| `campaign.campaignId` | string | The campaign the reading was taken under. |
| `campaign.setRevisionId` | string | The drawing-set revision that campaign pins — the citation list every figure stands on (`L-REG-06`). |

## `objects[]`

One register object: what was sighted, where it sits, and how its readings stand.

| Path | Type | Meaning |
| --- | --- | --- |
| `objects[].objectKey` | string | The object's content-derived key (`L-REG-04`); stable across a re-derivation of the same content. |
| `objects[].discipline` | string | The discipline authoritative for the object's drawing (`L-REG-03`). |
| `objects[].level` | string | The level the object was sighted on. |
| `objects[].class` | string | The object's class, e.g. `rcc.column`. |
| `objects[].mark` | string | The mark the drawing gives it, e.g. `C1`. |
| `objects[].basis` | string | The weakest quantity basis over the object's lines — one of `MEASURED`, `TRANSCRIBED`, `DERIVED`, `IMPORTED`, `ENTERED`, `INTERPRETED`, `DEFAULTED`. |
| `objects[].role` | string | The sighting standing the register recorded for the object. |
| `objects[].corroboration` | string | How the object's readings corroborate one another. |
| `objects[].sourceKey` | string | The source key the object was read at — the entity in the drawing (`L-CAD-03`). |
| `objects[].attributes` | array | The object's correctable attributes, as `objects[].attributes[]` below. |

## `objects[].attributes[]`

One correctable attribute of one object. A disagreement is declared, never resolved silently: a
suspended attribute carries no value at all, and every competing reading stays on the record
(`L-REG-03`).

| Path | Type | Meaning |
| --- | --- | --- |
| `objects[].attributes[].attribute` | string | The attribute's name, e.g. `width`. |
| `objects[].attributes[].standing` | string | How the attribute stands — e.g. `AGREED`, or `SUSPENDED` where readings disagree. |
| `objects[].attributes[].canonicalValue` | string or null | The value that stands, in the canon's unit, as a decimal string; `null` where none stands. |
| `objects[].attributes[].canonicalUnit` | string or null | The canonical unit of that value; `null` where none stands. |
| `objects[].attributes[].competing` | array | The readings competing for the attribute, as `objects[].attributes[].competing[]` below. |
| `objects[].attributes[].overruled` | array | The readings a higher precedence overruled, as `objects[].attributes[].overruled[]` below. |

## `objects[].attributes[].competing[]` / `objects[].attributes[].overruled[]`

One reading of one attribute, as the ledger holds it. Both lists carry the same shape.

| Path | Type | Meaning |
| --- | --- | --- |
| `objects[].attributes[].competing[].observationId` | string | The observation this reading came from. |
| `objects[].attributes[].competing[].valueAsWritten` | string | The value exactly as the drawing wrote it, unconverted. |
| `objects[].attributes[].competing[].unitAsWritten` | string | The unit exactly as the drawing wrote it. |
| `objects[].attributes[].competing[].basis` | string | The basis of the reading, from the basis roster above. |
| `objects[].attributes[].competing[].precedence` | number | The reading's precedence; a lower number outranks a higher one. |
| `objects[].attributes[].competing[].sourceKey` | string | The source key the reading was taken at. |
| `objects[].attributes[].overruled[].observationId` | string | The observation the overruled reading came from. |
| `objects[].attributes[].overruled[].valueAsWritten` | string | The overruled value exactly as written. |
| `objects[].attributes[].overruled[].unitAsWritten` | string | The overruled unit exactly as written. |
| `objects[].attributes[].overruled[].basis` | string | The basis of the overruled reading. |
| `objects[].attributes[].overruled[].precedence` | number | The overruled reading's precedence. |
| `objects[].attributes[].overruled[].sourceKey` | string | The source key the overruled reading was taken at. |

## `lines[]`

One published quantity line: the figure, the formula that produced it, and the provenance it stands
on (`L-QTY-03`).

| Path | Type | Meaning |
| --- | --- | --- |
| `lines[].lineId` | string | The line's identity. |
| `lines[].objectKey` | string | The `objects[].objectKey` the line was measured from. |
| `lines[].kind` | string | The quantity kind billed, e.g. `rcc.concrete`. |
| `lines[].class` | string | The class of the object measured. |
| `lines[].level` | string | The level the line sits on. |
| `lines[].value` | string or null | The SI figure at full precision as a decimal string — never a JSON number; `null` exactly where `lines[].coverage` is not `COMPLETE`. |
| `lines[].unit` | string | The unit of that figure, e.g. `m3`. |
| `lines[].formula` | string | The human-auditable formula with named variables, e.g. `b × d × L`. |
| `lines[].variables` | object | The bindings of the formula's named variables, keyed by variable name, as `lines[].variables.<name>` below. |
| `lines[].quantityBasis` | string | The basis of the quantity: `MEASURED`, `TRANSCRIBED`, `DERIVED`, `IMPORTED`, `ENTERED`, `INTERPRETED` or `DEFAULTED`. |
| `lines[].selectionBasis` | string | The basis of the selection the quantity was taken over, from the same roster. |
| `lines[].coverage` | string | The coverage the line was published under — `COMPLETE`, or a declared shortfall such as `PARTIAL_DECLARED`. |
| `lines[].calibrationKeys` | array of string | The affirmed calibration references the line rests on; never empty for a measured line (`L-QTY-03`). |
| `lines[].engine` | string | The engine that read the drawing: `VECTOR` or `RASTER`, orthogonal to the basis. |
| `lines[].raster` | object or null | The trace a `RASTER` line was read off, as `lines[].raster` below; `null` under `VECTOR`. Since 1.1. |
| `lines[].agreedBy` | object or null | Who agreed the interpreted readings an `INTERPRETED` line stands on, as `lines[].agreedBy` below; `null` where no judgement entered. Since 1.1. |
| `lines[].sourceKey` | string | The source key the line was measured at. |
| `lines[].repudiated` | boolean | Whether a person has struck the object this line was measured from. A repudiated line is published and marked, never deleted. |
| `lines[].drawingId` | string or null | The sheet the line's evidence stands on; `null` where the reading resolves none. |
| `lines[].layoutName` | string or null | The layout of that drawing the line's evidence stands on. For a line measured off a placed member it is the sheet that shows the member; for any other line it is the sheet of the view the line was read in. It is resolved for each line over the drawing record the campaign's pinned revision measured, and spelled as that record's layout inventory spells it, model space included (I-421, I-422). `null` where that record cannot be read. |
| `lines[].sourceKeys` | array of string | Every source key the line cites: `lines[].sourceKey` first, then each `lines[].variables.<name>.source` in binding order, each key once. Calibration keys are not among them. |

`lines[].sourceKeys` names what the line **cites**. It is not what the product's Trace selects when a
person follows the line to its drawing. For a line measured off a placed member (a column, a pile, a
cap), the Trace selects the member's outline and its mark. The line cites neither of those: it cites
the placement, the schedule cell and the level note it read. That selection belongs to the screen and
version 1.0 does not publish it. An earlier text of this row also called the cited keys "the selection
its trace address carries", which was true only while the screen selected what a line cites. The
keys this field carries have not changed (I-426).

`lines[].layoutName` has always meant the layout the line's evidence stands on. It used to be resolved
once per drawing, and a drawing recorded under no layout, or under more than one, reported `Model`,
a name no layout of the drawing need carry. It is now resolved once per line. The value is more
accurate, and the meaning is the same, so neither change moves the version.

## `lines[].raster`

The trace a line read off a scan was read from — `L-QTY-03`'s "vectoriser id + version + render DPI
where INTERPRETED". An `INTERPRETED` line always carries one: the gate refuses an offer read off a
scan that names no trace, or no resolution (`RASTER_IDENTITY_MISSING`).

| Path | Type | Meaning |
| --- | --- | --- |
| `lines[].raster.tool` | string | The vectoriser that traced the scan. |
| `lines[].raster.toolVersion` | string | Its version. |
| `lines[].raster.parameterSetHash` | string | The hash of the parameter set it traced under. |
| `lines[].raster.pageSha256` | string | The sha-256 of the page raster the reading was traced from. |
| `lines[].raster.dpi` | string or null | The resolution the page was read at, as a decimal string; `null` exactly where `dpiSource` is `unstated`. |
| `lines[].raster.dpiSource` | string | Where that resolution was stated: `file`, `placement` or `unstated`. |

## `lines[].agreedBy`

An interpreted figure reaches a bill only as agreed (`L-QTY-04`): a person restated what the scan was
read as, and the act that did so resolved the line's queue item. This names that act and its actor —
derived from the act log, never stamped on the line.

| Path | Type | Meaning |
| --- | --- | --- |
| `lines[].agreedBy.actId` | string | The act that agreed the last of the line's interpreted readings. |
| `lines[].agreedBy.actorId` | string | The person who performed it. |

## `lines[].variables.<name>`

`lines[].variables` is keyed by the variable's own name as the formula spells it (`b`, `d`, `L`, `A`,
`t`, …); `<name>` below stands for any one of those keys. Each binding says what the variable was
read as and what it became in the canon's unit, so the formula can be re-checked by hand.

| Path | Type | Meaning |
| --- | --- | --- |
| `lines[].variables.<name>.value` | string | The value as read, as a decimal string. |
| `lines[].variables.<name>.unit` | string | The unit as read, e.g. `mm`. |
| `lines[].variables.<name>.basis` | string | The basis of that reading, from the basis roster above. |
| `lines[].variables.<name>.source` | string | The source key the reading was taken at. |
| `lines[].variables.<name>.canonical` | object | The same figure in the canon's unit, as below. |
| `lines[].variables.<name>.canonical.value` | string | The canonical value as a decimal string. |
| `lines[].variables.<name>.canonical.unit` | string | The canonical unit, e.g. `m`. |

## `refusals[]`

One sighting that produced no line — a refused sighting or a queue item's cause. A refusal is
published beside the lines rather than dropped: what was not measured is part of the reading.

| Path | Type | Meaning |
| --- | --- | --- |
| `refusals[].code` | string | The registered refusal code, e.g. `INTERPRETED_UNCORROBORATED`. |
| `refusals[].objectKey` | string | The object the refusal is about. |
| `refusals[].kind` | string or null | The quantity kind refused; `null` where the refusal is not about one kind. |

## Versioning

`schemaVersion` states the shape a document was written under.

- The version string moves with every change to the shape, and which half of it moves says what the
  change was. A **breaking** change — a property removed, a property retyped, or a meaning changed
  under an unchanged name — moves the major version (`1.0` → `2.0`), and only a breaking change ever
  does.
- An **additive** field bumps the minor version (`1.0` → `1.1`). A reader that ignores properties it
  does not know keeps working across a minor bump; a reader that refuses unknown properties does not.
- The committed JSON Schema fixture is regenerated from the live schema on every unit run, so the
  published shape cannot move without a deliberate re-baseline saying so.

## What version 1.1 added, and what it does not carry

Version 1.1 added `lines[].raster` and `lines[].agreedBy`, together, when the reading came to carry
them with the gate's way out for interpreted geometry. A 1.0 document is a 1.1 document without the
two properties.

The export publishes what the register's reading carries, and no more. `L-QTY-03` also names the rule
id and version a derived figure was computed under. The reading this document is a function of does
not carry them today, so version 1.1 does not publish them; they enter as an additive minor version
once it does.
