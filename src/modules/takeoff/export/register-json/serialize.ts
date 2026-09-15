// The export itself: one project's register as a document, and that document as canonical text
// (R-TO-070, A-REGISTER-JSON).
//
// A pure function of the reading the register workspace already answers, so the export says exactly
// what the screen says — no second read of the rows, no figure computed a second time, no database
// (B-17, I-25). Nothing here reads a clock, mints an id or looks at the environment: the same
// reading answers the same bytes on every machine, which is what lets a committed example hold the
// shape against drift.
import { compareCanonical } from "@/core/identity";
import type { RegisterView, ViewBinding, ViewLine, ViewObject, ViewReading } from "@/modules/takeoff/register-ui/view";
import { REGISTER_JSON_SCHEMA_VERSION } from "./schema";
import type { RegisterJsonBinding, RegisterJsonDocument, RegisterJsonLine, RegisterJsonObject, RegisterJsonReading } from "./schema";

/** One attribute reading, carried out whole (`ViewReading` → `RegisterJsonReading`). */
function readingOf(reading: ViewReading): RegisterJsonReading {
  return {
    observationId: reading.observationId,
    valueAsWritten: reading.valueAsWritten,
    unitAsWritten: reading.unitAsWritten,
    basis: reading.basis,
    precedence: reading.precedence,
    sourceKey: reading.sourceKey,
  };
}

/** One named variable of a line's formula (`ViewBinding` → `RegisterJsonBinding`). */
function bindingOf(binding: ViewBinding): RegisterJsonBinding {
  return {
    value: binding.value,
    unit: binding.unit,
    basis: binding.basis,
    source: binding.source,
    canonical: { value: binding.canonical.value, unit: binding.canonical.unit },
  };
}

/** One register object with its attributes and every reading behind them (`ViewObject`). */
function objectOf(object: ViewObject): RegisterJsonObject {
  return {
    objectKey: object.objectKey,
    discipline: object.discipline,
    level: object.level,
    class: object.class,
    mark: object.mark,
    basis: object.basis,
    role: object.role,
    corroboration: object.corroboration,
    sourceKey: object.sourceKey,
    attributes: object.attributes.map((attribute) => ({
      attribute: attribute.attribute,
      standing: attribute.standing,
      canonicalValue: attribute.canonicalValue,
      canonicalUnit: attribute.canonicalUnit,
      competing: attribute.competing.map(readingOf),
      overruled: attribute.overruled.map(readingOf),
    })),
  };
}

/** One published line, mirroring the reading field for field (`ViewLine`). */
function lineOf(line: ViewLine): RegisterJsonLine {
  return {
    lineId: line.lineId,
    objectKey: line.objectKey,
    kind: line.kind,
    class: line.class,
    level: line.level,
    // The figure travels as the decimal string the register holds at full precision, or as null
    // where the row is kept with no quantity at all (L-QTY-02).
    value: line.value,
    unit: line.unit,
    formula: line.formula,
    variables: Object.fromEntries(Object.entries(line.variables).map(([name, binding]) => [name, bindingOf(binding)])),
    quantityBasis: line.quantityBasis,
    selectionBasis: line.selectionBasis,
    coverage: line.coverage,
    calibrationKeys: [...line.calibrationKeys],
    engine: line.engine,
    sourceKey: line.sourceKey,
    repudiated: line.repudiated,
    drawingId: line.drawingId,
    layoutName: line.layoutName,
    sourceKeys: [...line.sourceKeys],
  };
}

/**
 * The register of one project as the document integrations read: the reading's tenant, project and
 * campaign, every object, every published line and every sighting that produced none.
 *
 * `levelStacks` is left behind on purpose — a proposed level stack is an offer the register screen
 * makes a person, not something the register holds (R-UI-023).
 */
export function registerJsonOf(view: RegisterView): RegisterJsonDocument {
  return {
    schemaVersion: REGISTER_JSON_SCHEMA_VERSION,
    tenantId: view.tenantId,
    projectId: view.projectId,
    campaign: view.campaign === null ? null : { campaignId: view.campaign.campaignId, setRevisionId: view.campaign.setRevisionId },
    objects: view.objects.map(objectOf),
    lines: view.lines.map(lineOf),
    refusals: view.refusals.map((refusal) => ({ code: refusal.code, objectKey: refusal.objectKey, kind: refusal.kind })),
  };
}

/**
 * The same content with every object's keys in code-unit order, at every depth. Lists keep the
 * order the reading gave them: a register's rows are ordered evidence, and re-sorting them would
 * publish a different reading from the one the screen shows.
 *
 * The comparison is L-REG-05's one sort (`compareCanonical`); the ordering is done here rather than
 * through `canonicalSemantic`, which also normalises the order of lists — right for a semantic that
 * must survive a rebuild, wrong for a document whose row order is what it says.
 */
function inCanonicalOrder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(inCanonicalOrder);
  if (value !== null && typeof value === "object") {
    const ordered: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort(compareCanonical)) ordered[key] = inCanonicalOrder((value as Record<string, unknown>)[key]);
    return ordered;
  }
  return value;
}

/**
 * The document as the bytes it is published as: keys in code-unit order at every depth, two-space
 * indentation and one closing newline. Deterministic — two exports of one reading are the same
 * text, so a diff of two documents is a diff of two registers and never of two spellings.
 */
export function serializeRegisterJson(document: RegisterJsonDocument): string {
  return `${JSON.stringify(inCanonicalOrder(document), null, 2)}\n`;
}
