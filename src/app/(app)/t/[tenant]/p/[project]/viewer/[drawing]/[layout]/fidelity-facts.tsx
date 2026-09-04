"use client";
/**
 * What the reading recorded, beside the refusal (Decision I-80): `IngestFacts` is a closed shape, so
 * its four facts are four labelled rows in English rather than a dump of field names. A reader whose
 * sheet cannot be drawn still learns what was recovered from the drawing — the units it declared,
 * the sheets it holds, the sheets that held nothing, and the limits the reading ran into (R-TO-001).
 *
 * Figures render through the figure seam and layout names render verbatim in mono, because both are
 * model data (R-SPINE-010, I-25).
 */
import { formatUserFigure } from "../../../../../../../../../core/format";
import type { IngestFacts } from "../../../../../../../../../modules/takeoff/ingest";
import { fill, strings } from "../../../../../../../../../ui/strings";

/** A figure as this screen renders one. */
const figure = (value: number): string => formatUserFigure(String(value));

/** One row: the label it is read under, the sentence it says, and the model values beside it. */
type Fact = { label: string; value: string; verbatim?: string[] };

/** The four facts, total over the shape the record carries — a fact cannot be left unrendered. */
const FACT_ROWS: Readonly<Record<keyof IngestFacts, (facts: IngestFacts) => Fact>> = {
  insunits: (facts) => ({
    label: strings.viewer_fact_units,
    value: facts.insunits.unit === null ? strings.viewer_fact_units_unmapped : "",
    verbatim: facts.insunits.unit === null ? [] : [facts.insunits.unit],
  }),
  layouts: (facts) => ({
    label: strings.viewer_fact_layouts,
    value: fill(strings.viewer_fact_layouts_value, {
      sheets: figure(facts.layouts.length),
      strays: figure(facts.layouts.reduce((sum, layout) => sum + layout.strays_rejected, 0)),
    }),
  }),
  dropped_layouts: (facts) => ({
    label: strings.viewer_fact_dropped,
    value: fill(strings.viewer_fact_dropped_value, { dropped: figure(facts.dropped_layouts.length) }),
    verbatim: facts.dropped_layouts,
  }),
  counters: (facts) => ({
    label: strings.viewer_fact_counters,
    value: fill(strings.viewer_fact_counters_value, {
      truncated: figure(facts.counters.filter((counter) => counter.explode_truncated).length),
      capped: figure(facts.counters.reduce((sum, counter) => sum + Object.values(counter.flatten_capped).reduce((held, count) => held + count, 0), 0)),
    }),
  }),
};

export function FidelityFacts({ facts }: { facts: IngestFacts }) {
  const names = Object.keys(FACT_ROWS) as (keyof IngestFacts)[];
  return (
    <section className="cx-viewer-facts-block">
      <h2 className="cx-viewer-facts-heading">{strings.viewer_fidelity_heading}</h2>
      <dl className="cx-viewer-facts" data-testid="viewer-fidelity-facts">
        {names.map((name) => {
          const fact = FACT_ROWS[name](facts);
          return (
            <div className="cx-viewer-fact" data-testid="viewer-fidelity-fact" data-fact={name} key={name}>
              <dt className="cx-viewer-fact-label">{fact.label}</dt>
              <dd className="cx-viewer-fact-value">
                {fact.value}
                {(fact.verbatim ?? []).map((value) => (
                  <span className="cx-viewer-fact-model" key={value}>
                    {value}
                  </span>
                ))}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
