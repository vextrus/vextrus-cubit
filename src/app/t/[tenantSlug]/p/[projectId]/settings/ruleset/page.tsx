/**
 * `/t/{tenantSlug}/p/{projectId}/settings/ruleset` — the rule-set pin made visible
 * (R-SPINE-012, L-MEA-01, L-REG-07, J-003; docs/design/s-project-settings.md).
 *
 * A read-only pane, server-rendered whole: the edition the project pinned at creation, its
 * digest, the platform → workspace → project lineage, and the seventeen L-MEA-01 parameters
 * with their values and units. Nothing here writes — authoring a new edition is M3 and its own
 * permission (Interpretation 1) — so there is no client component, no form and no act.
 *
 * Nothing streams: there is no `loading.tsx` under `/t`, the guard answers before any byte, and
 * one seam read fills the page. A project of another workspace is not a row `readProjectPin`
 * can see, so it answers `null` and this page 404s — the same answer an unknown project id
 * gets, which is what keeps the pane from telling a stranger which ids exist (Interpretation 7).
 */
import { notFound, redirect } from 'next/navigation';
import './ruleset.css';
import { around, ten } from '../../../../../strings';
import type { TenantStringKey } from '../../../../../strings';
import { formatNumber } from '../../../../../../../core/format';
import { readProjectPin } from '../../../../../../../core/rulesets/pin';
import type { EditionView, ProjectPin } from '../../../../../../../core/rulesets/pin';
import type { EditionScope, RuleSetParameters } from '../../../../../../../core/rulesets/editions';
import { SIGN_IN_PATH, tenantContext } from '../../../../../../../server/session';

/** The lead names the project itself, because no crumb does yet (Interpretation 6). */
const NAME_SLOT = '{name}';

/** `scope` is not a structural attribute, so the header cells read theirs from here. */
const COLUMN = 'col';

/** The heading each landmark is labelled by (§5's table is named by its own h2). */
const PARAMS_HEADING = 'project-ruleset-params-heading';

/** §4: the scope of a lineage entry, in the words the design decided for it. */
const SCOPE_LABEL: Readonly<Record<EditionScope, TenantStringKey>> = Object.freeze({
  platform: 'project.ruleset.lineage.platform',
  tenant: 'project.ruleset.lineage.tenant',
  project: 'project.ruleset.lineage.project',
});

interface ParameterRow {
  readonly id: string;
  readonly label: TenantStringKey;
  readonly unit: TenantStringKey;
}

/**
 * §5: the seventeen rows, in the contract's own order.
 *
 * The roster is written down rather than read off the pinned edition because `jsonb` does not
 * keep the order a key was written in, and a reference table that reorders itself between two
 * reads is not a reference table (settled reading; design Interpretation 5).
 */
const PARAMETERS: readonly ParameterRow[] = Object.freeze([
  {
    id: 'openingDeductionMinM2',
    label: 'project.ruleset.param.openingDeductionMinM2',
    unit: 'project.ruleset.unit.m2',
  },
  {
    id: 'memberEndNoDeductMaxCm2',
    label: 'project.ruleset.param.memberEndNoDeductMaxCm2',
    unit: 'project.ruleset.unit.cm2',
  },
  {
    id: 'embeddedDuctNoDeductMaxCm2',
    label: 'project.ruleset.param.embeddedDuctNoDeductMaxCm2',
    unit: 'project.ruleset.unit.cm2',
  },
  {
    id: 'finishOpeningDeductionMinM2',
    label: 'project.ruleset.param.finishOpeningDeductionMinM2',
    unit: 'project.ruleset.unit.m2',
  },
  {
    id: 'finishMinOutlineArea',
    label: 'project.ruleset.param.finishMinOutlineArea',
    unit: 'project.ruleset.unit.sft',
  },
  {
    id: 'finishMaxOutlineArea',
    label: 'project.ruleset.param.finishMaxOutlineArea',
    unit: 'project.ruleset.unit.sft',
  },
  {
    id: 'scaleVerificationTolerance',
    label: 'project.ruleset.param.scaleVerificationTolerance',
    unit: 'project.ruleset.unit.ratio',
  },
  {
    id: 'scaleAnisotropyTolerance',
    label: 'project.ruleset.param.scaleAnisotropyTolerance',
    unit: 'project.ruleset.unit.ratio',
  },
  {
    id: 'earthworkWorkingAllowance',
    label: 'project.ruleset.param.earthworkWorkingAllowance',
    unit: 'project.ruleset.unit.ft',
  },
  {
    id: 'earthworkDepthExtra',
    label: 'project.ruleset.param.earthworkDepthExtra',
    unit: 'project.ruleset.unit.ft',
  },
  {
    id: 'blindingProjection',
    label: 'project.ruleset.param.blindingProjection',
    unit: 'project.ruleset.unit.in',
  },
  {
    id: 'blindingThickness',
    label: 'project.ruleset.param.blindingThickness',
    unit: 'project.ruleset.unit.in',
  },
  {
    id: 'placementContainmentMerge',
    label: 'project.ruleset.param.placementContainmentMerge',
    unit: 'project.ruleset.unit.ratio',
  },
  {
    id: 'placementNearAnchor',
    label: 'project.ruleset.param.placementNearAnchor',
    unit: 'project.ruleset.unit.ratio',
  },
  {
    id: 'placementFootprintMin',
    label: 'project.ruleset.param.placementFootprintMin',
    unit: 'project.ruleset.unit.ratio',
  },
  {
    id: 'placementFootprintMax',
    label: 'project.ruleset.param.placementFootprintMax',
    unit: 'project.ruleset.unit.ratio',
  },
  {
    id: 'placementHumanSnap',
    label: 'project.ruleset.param.placementHumanSnap',
    unit: 'project.ruleset.unit.ratio',
  },
]);

/**
 * Interpretation 4: the canonical decimal string with en-IN grouping on its integer part.
 *
 * `formatNumber` renders 0 or 3 fraction digits and nothing between, so a free-precision value
 * like `0.08` cannot go through it whole without being rewritten. Splitting at the point sends
 * only the integer part through the format seam — the sole Intl caller, L-FMT-01 — and puts the
 * fraction back exactly as it was pinned. `20000` reads `20,000`; every other seed value is
 * unchanged by the rule, and no float exists anywhere on the path (B-07).
 */
function grouped(value: string): string {
  const point = value.indexOf('.');
  if (point === -1) return formatNumber(value, 'count');
  return `${formatNumber(value.slice(0, point), 'count')}.${value.slice(point + 1)}`;
}

/**
 * The pinned value of one parameter.
 *
 * An edition that carries no value for a parameter of its own rule set is a broken row, not an
 * empty cell: silence is never lawful, so the read throws into the shell's error boundary (§6)
 * rather than rendering a row that says nothing.
 */
function pinnedValue(parameters: RuleSetParameters, id: string): string {
  const value = parameters[id];
  if (value === undefined) {
    throw new Error(`the pinned rule-set edition carries no value for ${id}`);
  }
  return grouped(value);
}

/** §4: one edition of the fork chain — its scope, its key and its full digest. */
function LineageEntry({ edition }: { edition: EditionView }) {
  return (
    <li className="project-ruleset-lineage-item" data-testid={`ruleset-lineage-${edition.scope}`}>
      <span className="project-ruleset-lineage-head">
        <span className="project-ruleset-scope">{ten(SCOPE_LABEL[edition.scope])}</span>
        <span className="project-ruleset-key">{edition.key}</span>
      </span>
      <span className="project-ruleset-lineage-digest">{edition.digest}</span>
    </li>
  );
}

/** §5: the parameter table, seventeen flat rows on the list-card surface. */
function ParameterTable({ parameters }: { parameters: RuleSetParameters }) {
  return (
    <table
      className="project-ruleset-params datum-focus-ring"
      aria-labelledby={PARAMS_HEADING}
      // The pane mints no act and carries no control (Interpretation 1), so without this the
      // shell's scrolling main region holds nothing a keyboard can reach and a keyboard reader
      // cannot scroll the page at all — axe's `scrollable-region-focusable`, and the lane
      // filters no violation. The table is the thing worth reaching, and focusing it announces
      // its own name; it is a stop on the tab ring, not a control (nothing here writes).
      tabIndex={0}
      data-testid="ruleset-params"
    >
      <thead>
        <tr>
          <th className="project-ruleset-params-head" scope={COLUMN}>
            {ten('project.ruleset.params.parameter')}
          </th>
          <th
            className="project-ruleset-params-head project-ruleset-params-head-value"
            scope={COLUMN}
          >
            {ten('project.ruleset.params.value')}
          </th>
          <th
            className="project-ruleset-params-head project-ruleset-params-head-unit"
            scope={COLUMN}
          >
            {ten('project.ruleset.params.unit')}
          </th>
        </tr>
      </thead>
      <tbody>
        {PARAMETERS.map((parameter) => (
          <tr
            className="project-ruleset-param"
            key={parameter.id}
            data-testid={`ruleset-param-${parameter.id}`}
          >
            <td className="project-ruleset-param-cell">
              <span className="project-ruleset-param-name">
                <span className="project-ruleset-param-label">{ten(parameter.label)}</span>
                <span className="project-ruleset-param-id">{parameter.id}</span>
              </span>
            </td>
            <td className="project-ruleset-param-cell project-ruleset-param-value numeric">
              {pinnedValue(parameters, parameter.id)}
            </td>
            <td className="project-ruleset-param-cell project-ruleset-param-unit">
              {ten(parameter.unit)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The pane itself, once the guard and the seam have both answered. */
function RulesetPane({ pin }: { pin: ProjectPin }) {
  const [opening, closing] = around('project.ruleset.lead', 'code');
  return (
    <div data-testid="project-ruleset">
      <h1 className="tenant-title">{ten('project.ruleset.title')}</h1>
      <p className="tenant-lead">
        {opening.split(NAME_SLOT).join(pin.project.name)}
        <span className="project-ruleset-code">{pin.project.code}</span>
        {closing}
      </p>

      {/* §3: the pin card — the edition, its digest, and the methods in force. Three
          definition rows, so a reader who hears the card hears each label with its own value
          rather than one run of text. */}
      <dl className="project-ruleset-card project-ruleset-pin">
        <div className="project-ruleset-pin-row">
          <dt className="project-ruleset-pin-label">{ten('project.ruleset.edition')}</dt>
          <dd className="project-ruleset-pin-value project-ruleset-edition" data-testid="ruleset-edition">
            {pin.edition.key}
          </dd>
        </div>
        <div className="project-ruleset-pin-row">
          <dt className="project-ruleset-pin-label">{ten('project.ruleset.digest')}</dt>
          <dd className="project-ruleset-pin-value project-ruleset-digest" data-testid="ruleset-digest">
            {pin.edition.digest}
          </dd>
        </div>
        <div className="project-ruleset-pin-row">
          <dt className="project-ruleset-pin-label">{ten('project.ruleset.methods')}</dt>
          <dd className="project-ruleset-pin-value project-ruleset-methods">
            {ten('project.ruleset.methodsNone')}
          </dd>
        </div>
      </dl>

      {/* §4: the fork chain, platform first. */}
      <section className="project-ruleset-section">
        <h2 className="project-ruleset-heading">{ten('project.ruleset.lineage.title')}</h2>
        <p className="project-ruleset-lineage-lead">{ten('project.ruleset.lineage.lead')}</p>
        <ol className="project-ruleset-card" data-testid="ruleset-lineage">
          {pin.lineage.map((edition) => (
            <LineageEntry edition={edition} key={edition.id} />
          ))}
        </ol>
      </section>

      {/* §5: the seventeen parameters this project measures by. */}
      <section className="project-ruleset-section">
        <h2 className="project-ruleset-heading" id={PARAMS_HEADING}>
          {ten('project.ruleset.params.title')}
        </h2>
        <ParameterTable parameters={pin.edition.parameters} />
      </section>
    </div>
  );
}

export default async function ProjectRulesetPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; projectId: string }>;
}) {
  const { tenantSlug, projectId } = await params;
  const context = await tenantContext(tenantSlug);
  if (context === 'signed-out') redirect(SIGN_IN_PATH);
  if (context === 'not-found') notFound();

  const pin = await readProjectPin({ tenantId: context.tenantId, projectId });
  if (pin === null) notFound();

  return <RulesetPane pin={pin} />;
}
