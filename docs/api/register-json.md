# Register JSON export

Schema version: 1.0

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
| `schemaVersion` | string | The version of this shape, always `"1.0"` for a document written under this page. |
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
| `lines[].sourceKey` | string | The source key the line was measured at. |
| `lines[].repudiated` | boolean | Whether a person has struck the object this line was measured from. A repudiated line is published and marked, never deleted. |
| `lines[].drawingId` | string or null | The sheet the line's evidence stands on; `null` where the reading resolves none. |
| `lines[].layoutName` | string or null | The layout within that sheet; `null` where the reading resolves none. |
| `lines[].sourceKeys` | array of string | Every source key the line cites — the selection its trace address carries. |

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

## What version 1.0 does not carry

The export publishes what the register's reading carries, and no more. `L-QTY-03` also names the rule
id and version a derived figure was computed under, the vectoriser's id, version and render DPI
behind an interpreted one, and the actor behind each line. The reading this document is a function of
does not carry them today, so version 1.0 does not publish them; they enter as an additive minor
version once it does.
