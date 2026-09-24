"use client";
/**
 * The condition chest (docs/design/s-measure.md § 2.6, § 3, I-374, I-573 … I-575): the drawer's
 * first group while the viewer measures. Each row is one of the project's conditions — its swatch
 * (colour and hatch, never colour alone), its name, its digit, and what the campaign has billed of it
 * — and a click on a row, or its digit, picks it and arms its tool. **New condition** opens the
 * authoring popover; a row's menu takes a condition out of the chest.
 *
 * Every R-UI-050 state is this region's own cell: three row bones while the chest is read, the
 * teaching empty state with its one action, the read's fault in place with a retry and the report id
 * (the sheet stays), and — without MEASURE — the chest read-only, with no New and no menu. A refusal
 * of an authoring is the one RefusalState, inside the popover that asked.
 *
 * It lives in the route beside the measure region because it reads what a module may not (ARCH-01):
 * the string table, the format seam, the roster and the primitives. Its three doors are the route's
 * server actions (`./measure-actions.ts`); a jsdom mount hands its own.
 */
import "./measure-chest.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import type { ElementType } from "@/core/catalogue/classes";
import type { Kind } from "@/core/catalogue/kinds";
import { REFUSALS, type RefusalCode } from "@/core/errors";
import { formatUserFigure } from "@/core/format";
import type { AuthorableCatalogue, AuthorableClass, ChestCondition, ConditionStatement } from "@/core/manual/conditions";
import { CONDITION_COLOURS, CONDITION_HATCHES, type ConditionColour, type ConditionHatch, type ManualGeometry } from "@/core/manual/law";
import type { MeasureTool } from "@/modules/takeoff/viewer-measure/gesture";
import { IconMoreHorizontal, IconPlus } from "@/ui/icons";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { humaniseEnum } from "@/ui/primitives/core/enum-label";
import { Button, Checkbox, EmptyState, IconButton, Input, Kbd, NumberInput, Select, Skeleton, Tooltip, UnitBadge } from "@/ui/primitives/core";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Popover, PopoverContent, PopoverTrigger } from "@/ui/primitives/overlay";
import { isTextField, matchesStep, shortcutById } from "@/ui/shell/shortcuts/roster";
import { fill, strings, type StringKey } from "@/ui/strings";
import { TESTIDS } from "@/ui/testids";
import { authorConditionInChest, readConditionChest, retireConditionFromChest, type AuthorAnswer, type ChestReadAnswer, type RetireAnswer } from "./measure-actions";

/** The three doors the chest is read and written through — the route's actions, or a mount's own. */
export type ChestDoors = {
  read: (request: { projectId: string }) => Promise<ChestReadAnswer>;
  author: (request: { projectId: string; condition: ConditionStatement }) => Promise<AuthorAnswer>;
  retire: (request: { projectId: string; conditionId: string }) => Promise<RetireAnswer>;
};

const ROUTE_DOORS: ChestDoors = { read: readConditionChest, author: authorConditionInChest, retire: retireConditionFromChest };

/** The chest's cell, as `data-state` publishes it (§ 9). */
export type ChestState = "loading" | "ready" | "empty" | "failed" | "readonly";

/** The tool a condition's geometry is traced with (I-374: Area for an area condition, and so on). */
export const TOOL_OF_GEOMETRY: Readonly<Record<ManualGeometry, MeasureTool>> = Object.freeze({ POLYGON: "area", POLYLINE: "linear", POINT_SET: "count" });

const GEOMETRY_COPY: Readonly<Record<ManualGeometry, StringKey>> = Object.freeze({
  POLYGON: "measure_condition_geometry_area",
  POLYLINE: "measure_condition_geometry_length",
  POINT_SET: "measure_condition_geometry_count",
});

const TOOL_COPY: Readonly<Record<MeasureTool, StringKey>> = Object.freeze({ linear: "viewer_tool_linear", area: "viewer_tool_area", count: "viewer_tool_count" });

const HATCH_COPY: Readonly<Record<ConditionHatch, StringKey>> = Object.freeze({
  solid: "measure_condition_hatch_solid",
  diagonal: "measure_condition_hatch_diagonal",
  cross: "measure_condition_hatch_cross",
  dots: "measure_condition_hatch_dots",
  horizontal: "measure_condition_hatch_horizontal",
  vertical: "measure_condition_hatch_vertical",
});

/** The words a reading's field is labelled by — its own name where the table holds none. */
const READING_COPY: Readonly<Record<string, StringKey>> = Object.freeze({ t: "measure_condition_reading_t" });

/** Three row bones while the chest is read (§ 3's loading cell). */
const BONES = [0, 1, 2];

/** A class and a kind in the QS's words: `pile_cap` → "Pile cap", `pcc.blinding` → "Blinding". */
const classWords = (elementClass: string): string => humaniseEnum(elementClass);
const kindWords = (kind: string): string => humaniseEnum(kind.slice(kind.lastIndexOf(".") + 1));

/** The swatch's paint: the element palette's own token (R-UI-001, no new token) and the hatch as data. */
function swatchStyle(colour: ConditionColour): CSSProperties {
  return { "--cx-swatch": `var(--element-${colour})` } as CSSProperties;
}

export function Swatch({ colour, hatch }: { colour: ConditionColour; hatch: ConditionHatch }) {
  return <span className="cx-measure-swatch" data-colour={colour} data-hatch={hatch} aria-hidden="true" style={swatchStyle(colour)} />;
}

export type MeasureChestOptions = {
  projectId: string;
  /** Read once the sheet is a manifest (R-UI-043): a chest beside nothing is read for nobody. */
  enabled: boolean;
  /** Arm a tool — the measure region's own door, which refuses a tool under a shape in progress (I-372). */
  onArm: (tool: MeasureTool) => void;
  /** Whether a shape is in progress: a pick then changes nothing, and the grammar says why (I-372). Asked
      at the pick, so the screen may compose the chest ahead of the region it arms. */
  isBusy: () => boolean;
  /** The tool the screen has armed, or null. A condition is picked only while its geometry's tool is
      the one armed (I-576): a Line never measures under an Area condition. */
  armed: MeasureTool | null;
  doors?: ChestDoors;
};

export type UseMeasureChest = {
  state: ChestState;
  /** The condition the armed tool measures under, or null: the one last picked, and only while the tool
      armed is its geometry's (I-576). */
  picked: ChestCondition | null;
  /** The drawer group. */
  panel: ReactNode;
  /** The digits 1–9, asked by the sheet's keyboard ahead of the grammar: true where the key was the chest's. */
  onKey: (event: ReactKeyboardEvent<HTMLCanvasElement>) => boolean;
};

export function useMeasureChest({ projectId, enabled, onArm, isBusy, armed, doors = ROUTE_DOORS }: MeasureChestOptions): UseMeasureChest {
  const [phase, setPhase] = useState<"loading" | "ready" | "failed">("loading");
  const [chest, setChest] = useState<{ conditions: readonly ChestCondition[]; catalogue: AuthorableCatalogue; canAuthor: boolean } | null>(null);
  const [readRefusal, setReadRefusal] = useState<RefusalCode | null>(null);
  const [faultId, setFaultId] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [asked, setAsked] = useState(0);

  const reread = useCallback((): void => setAsked((count) => count + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const open = async (): Promise<void> => {
      setPhase("loading");
      setFaultId(null);
      const answer = await doors.read({ projectId });
      if (!live) return;
      if (!answer.read) {
        setReadRefusal(answer.refusal);
        setPhase("ready");
        return;
      }
      setReadRefusal(null);
      setChest({ conditions: answer.conditions, catalogue: answer.catalogue, canAuthor: answer.canAuthor });
      setPhase("ready");
    };
    // A chest that cannot be read costs the reader this group, never the sheet (§ 3's error cell).
    void open().catch((thrown: unknown) => {
      if (!live) return;
      const digest = (thrown as { digest?: unknown } | null)?.digest;
      setFaultId(typeof digest === "string" ? digest : null);
      setPhase("failed");
    });
    return () => {
      live = false;
    };
  }, [asked, doors, enabled, projectId]);

  const conditions = useMemo(() => chest?.conditions ?? [], [chest]);
  // The last pick is remembered, and stands only while its geometry's tool is armed (I-576): switching
  // to Line or Count leaves the Area condition behind, and arming Area again finds it where it was.
  const remembered = conditions.find((condition) => condition.conditionId === pickedId) ?? null;
  const picked = remembered !== null && TOOL_OF_GEOMETRY[remembered.geometry] === armed ? remembered : null;
  // A refused read (a reader on no role of the project) is the chest read-only with nothing in it:
  // the sheet's own feed says the refusal where the reader can act on it.
  const canAuthor = chest?.canAuthor === true && readRefusal === null;
  const state: ChestState = phase === "failed" ? "failed" : phase === "loading" ? "loading" : !canAuthor ? "readonly" : conditions.length === 0 ? "empty" : "ready";

  const pick = useCallback(
    (condition: ChestCondition): void => {
      // Under a shape in progress the tool never changes: the measure region says "finish or discard first" (I-372).
      // Without MEASURE nothing arms, so nothing is picked either: the chest is read-only (§ 3).
      if (!canAuthor) return;
      if (!isBusy()) setPickedId(condition.conditionId);
      onArm(TOOL_OF_GEOMETRY[condition.geometry]);
    },
    [canAuthor, isBusy, onArm],
  );

  const onKey = useCallback(
    (event: ReactKeyboardEvent<HTMLCanvasElement>): boolean => {
      // A read-only chest picks nothing, so its digits are not its own: the keystroke goes on its way (§ 3).
      if (!canAuthor || isTextField(event.target)) return false;
      if (!shortcutById("viewer-condition").keys.some((step) => matchesStep(event, step))) return false;
      const condition = conditions.find((candidate) => candidate.hotkey === Number(event.key));
      if (condition === undefined) return false;
      event.preventDefault();
      pick(condition);
      return true;
    },
    [canAuthor, conditions, pick],
  );

  // A condition just saved is picked and its tool armed: the QS authored it to measure with it (§ 2.6).
  const onAuthored = useCallback(
    (conditionId: string, geometry: ManualGeometry): void => {
      if (!isBusy()) setPickedId(conditionId);
      onArm(TOOL_OF_GEOMETRY[geometry]);
      reread();
    },
    [isBusy, onArm, reread],
  );

  const onRetire = useCallback(
    async (condition: ChestCondition): Promise<void> => {
      const answer = await doors.retire({ projectId, conditionId: condition.conditionId });
      if (answer.retired && pickedId === condition.conditionId) setPickedId(null);
      reread();
    },
    [doors, pickedId, projectId, reread],
  );

  const panel = (
    <ChestPanel
      state={state}
      conditions={conditions}
      catalogue={chest?.catalogue ?? []}
      pickedId={picked?.conditionId ?? null}
      faultId={faultId}
      projectId={projectId}
      doors={doors}
      onPick={pick}
      onRetry={reread}
      onAuthored={onAuthored}
      onRetire={onRetire}
    />
  );

  return { state, picked, panel, onKey };
}

type ChestPanelProps = {
  state: ChestState;
  conditions: readonly ChestCondition[];
  catalogue: AuthorableCatalogue;
  pickedId: string | null;
  faultId: string | null;
  projectId: string;
  doors: ChestDoors;
  onPick: (condition: ChestCondition) => void;
  onRetry: () => void;
  onAuthored: (conditionId: string, geometry: ManualGeometry) => void;
  onRetire: (condition: ChestCondition) => Promise<void>;
};

/** The drawer group itself (§ 2.6): heading, count and New; then the rows, or the state's own cell. */
export function ChestPanel({ state, conditions, catalogue, pickedId, faultId, projectId, doors, onPick, onRetry, onAuthored, onRetire }: ChestPanelProps) {
  const [authoring, setAuthoring] = useState(false);
  const writable = state === "ready" || state === "empty";
  const nextHotkey = conditions.length < 9 ? conditions.length + 1 : null;

  const newButton = (label: string, trigger: ReactNode): ReactNode => (
    <Popover open={authoring} onOpenChange={setAuthoring}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="cx-measure-condition-popover" aria-label={label} side="right" align="start">
        <ConditionForm
          catalogue={catalogue}
          projectId={projectId}
          doors={doors}
          nextHotkey={nextHotkey}
          onCancel={() => setAuthoring(false)}
          onAuthored={(conditionId, geometry) => {
            setAuthoring(false);
            onAuthored(conditionId, geometry);
          }}
        />
      </PopoverContent>
    </Popover>
  );

  return (
    <section id="measure-chest" className="cx-measure-chest" data-testid={TESTIDS.measure.chest} data-state={state} aria-label={strings.measure_chest_heading}>
      <header className="cx-measure-chest-head">
        <h2 className="cx-measure-chest-heading">
          {strings.measure_chest_heading}
          {state === "loading" || state === "failed" ? null : <span className="cx-measure-chest-count">{formatUserFigure(String(conditions.length))}</span>}
        </h2>
        {writable && state === "ready"
          ? newButton(strings.measure_chest_new, <IconButton icon={<IconPlus />} label={strings.measure_chest_new} className="cx-measure-chest-new" data-testid={TESTIDS.measure.chestNew} />)
          : null}
      </header>

      {state === "loading" ? (
        <ol className="cx-measure-chest-list" aria-busy="true">
          {BONES.map((bone) => (
            <li key={bone} className="cx-measure-chest-bone">
              <Skeleton className="cx-measure-chest-bone-swatch" />
              <Skeleton className="cx-measure-chest-bone-name" />
            </li>
          ))}
        </ol>
      ) : state === "failed" ? (
        <div className="cx-measure-chest-failed" role="alert">
          <p className="cx-measure-chest-failed-line">{strings.measure_chest_read_failed}</p>
          <Button variant="secondary" data-testid={TESTIDS.measure.chestRetry} onClick={onRetry}>
            {strings.measure_retry}
          </Button>
          {faultId === null ? null : <p className="cx-measure-chest-report">{fill(strings.measure_read_report, { id: faultId })}</p>}
        </div>
      ) : state === "empty" ? (
        <EmptyState heading={strings.measure_chest_empty_title} body={strings.measure_chest_empty_body} className="cx-measure-chest-empty">
          {newButton(
            strings.measure_chest_empty_action,
            <Button variant="secondary" data-testid={TESTIDS.measure.chestNew}>
              {strings.measure_chest_empty_action}
            </Button>,
          )}
        </EmptyState>
      ) : (
        <>
          {state === "readonly" ? <p className="cx-measure-chest-readonly">{strings.measure_chest_readonly}</p> : null}
          <ol className="cx-measure-chest-list">
            {conditions.map((condition) => (
              <ChestRow key={condition.conditionId} condition={condition} selected={condition.conditionId === pickedId} writable={state === "ready"} onPick={onPick} onRetire={onRetire} />
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

/** A kind's total in the campaign, through the format seam — the unit beside it, muted. */
function totalWords(condition: ChestCondition): ReactNode {
  if (condition.totals.length === 0) return strings.measure_chest_total_none;
  return condition.totals.map((total) => (
    <span key={`${total.kind}:${total.unit}`} className="cx-measure-chest-figure">
      {formatUserFigure(total.value)}
      <UnitBadge unit={total.unit} />
    </span>
  ));
}

function ChestRow({ condition, selected, writable, onPick, onRetire }: { condition: ChestCondition; selected: boolean; writable: boolean; onPick: (condition: ChestCondition) => void; onRetire: (condition: ChestCondition) => Promise<void> }) {
  const tool = strings[TOOL_COPY[TOOL_OF_GEOMETRY[condition.geometry]]];
  const totals = fill(strings.measure_chest_total_label, { measured: formatUserFigure(String(condition.measured)), billed: formatUserFigure(String(condition.billed)) });
  return (
    <li
      className="cx-measure-chest-row"
      data-testid={TESTIDS.measure.chestCondition}
      data-condition={condition.conditionId}
      data-selected={String(selected)}
      data-geometry={condition.geometry}
      data-hotkey={condition.hotkey === null ? "" : String(condition.hotkey)}
    >
      <button type="button" className="cx-measure-chest-pick cx-reticle" aria-pressed={selected} aria-label={fill(strings.measure_chest_row_label, { condition: condition.name, tool })} onClick={() => onPick(condition)}>
        <Swatch colour={condition.colour} hatch={condition.hatch} />
        <Tooltip content={condition.name}>
          <span className="cx-measure-chest-name">{condition.name}</span>
        </Tooltip>
        {condition.hotkey === null ? null : <Kbd>{String(condition.hotkey)}</Kbd>}
        <span className="cx-measure-chest-total" title={totals} data-measured={String(condition.measured)} data-billed={String(condition.billed)}>
          {totalWords(condition)}
        </span>
      </button>
      {writable ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="cx-measure-chest-menu cx-reticle" aria-label={fill(strings.measure_chest_row_menu, { condition: condition.name })} data-testid={TESTIDS.measure.chestRowMenu}>
            <IconMoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent aria-label={fill(strings.measure_chest_row_menu, { condition: condition.name })}>
            <DropdownMenuItem data-testid={TESTIDS.measure.chestRetire} onSelect={() => void onRetire(condition)}>
              {strings.measure_condition_retire}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </li>
  );
}

type FormProps = {
  catalogue: AuthorableCatalogue;
  projectId: string;
  doors: ChestDoors;
  nextHotkey: number | null;
  onCancel: () => void;
  onAuthored: (conditionId: string, geometry: ManualGeometry) => void;
};

/** The geometries the form offers (§ 2.6: Area · Length · Count), in that order. */
const GEOMETRIES: readonly ManualGeometry[] = ["POLYGON", "POLYLINE", "POINT_SET"];

/** What the form holds for one owed reading: the figure as typed and its unit. */
type ReadingDraft = { value: string; unit: string };

/** The classes a geometry is offered with, from the catalogue the chest was read with. */
function classesOf(catalogue: AuthorableCatalogue, geometry: ManualGeometry): readonly AuthorableClass[] {
  return catalogue.find((entry) => entry.geometry === geometry)?.classes ?? [];
}

/** The readings a draft's kinds owe, once each, in the order the kinds owe them. */
function owedOf(klass: AuthorableClass | undefined, kinds: ReadonlySet<Kind>) {
  const owed = new Map<string, { attribute: string; units: readonly string[] }>();
  for (const entry of klass?.kinds ?? []) if (kinds.has(entry.kind)) for (const reading of entry.readings) owed.set(reading.attribute, reading);
  return [...owed.values()];
}

/** The unit a reading opens at: millimetres for a length where they are offered, as a QS states a thickness. */
const openingUnit = (units: readonly string[]): string => (units.includes("mm") ? "mm" : (units[0] ?? ""));

export function ConditionForm({ catalogue, projectId, doors, nextHotkey, onCancel, onAuthored }: FormProps) {
  const firstGeometry = GEOMETRIES.find((geometry) => classesOf(catalogue, geometry).length > 0) ?? "POLYGON";
  const [name, setName] = useState("");
  const [geometry, setGeometry] = useState<ManualGeometry>(firstGeometry);
  const [elementClass, setElementClass] = useState<ElementType | null>(classesOf(catalogue, firstGeometry)[0]?.elementClass ?? null);
  const [kinds, setKinds] = useState<ReadonlySet<Kind>>(() => new Set(classesOf(catalogue, firstGeometry)[0]?.kinds.slice(0, 1).map((entry) => entry.kind) ?? []));
  const [readings, setReadings] = useState<Readonly<Record<string, ReadingDraft>>>({});
  const [colour, setColour] = useState<ConditionColour>(classesOf(catalogue, firstGeometry)[0]?.colour ?? "generic");
  const [hatch, setHatch] = useState<ConditionHatch>("solid");
  const [refusal, setRefusal] = useState<RefusalCode | null>(null);
  const [saving, setSaving] = useState(false);

  const classes = classesOf(catalogue, geometry);
  const klass = classes.find((entry) => entry.elementClass === elementClass);
  const owed = owedOf(klass, kinds);

  const chooseClass = (chosen: AuthorableClass | undefined): void => {
    setElementClass(chosen?.elementClass ?? null);
    setKinds(new Set(chosen?.kinds.slice(0, 1).map((entry) => entry.kind) ?? []));
    setColour(chosen?.colour ?? "generic");
  };

  const readingOf = (attribute: string, units: readonly string[]): ReadingDraft => readings[attribute] ?? { value: "", unit: openingUnit(units) };
  const complete = name.trim() !== "" && klass !== undefined && kinds.size > 0 && owed.every((reading) => readingOf(reading.attribute, reading.units).value.trim() !== "");

  const save = async (): Promise<void> => {
    if (!complete || elementClass === null) return;
    setSaving(true);
    setRefusal(null);
    try {
      const answer = await doors.author({
        projectId,
        condition: {
          name,
          geometry,
          elementClass,
          kinds: [...kinds],
          readings: owed.map((reading) => ({ attribute: reading.attribute, valueAsWritten: readingOf(reading.attribute, reading.units).value, unitAsWritten: readingOf(reading.attribute, reading.units).unit })),
          colour,
          hatch,
        },
      });
      if (answer.authored) onAuthored(answer.conditionId, geometry);
      else setRefusal(answer.refusal);
    } finally {
      setSaving(false);
    }
  };

  const field = (id: string, label: string, control: ReactNode): ReactNode => (
    <div className="cx-measure-condition-field">
      <label className="cx-measure-condition-label" id={`${id}-label`} htmlFor={id}>
        {label}
      </label>
      {control}
    </div>
  );

  return (
    <form
      className="cx-measure-condition-form"
      data-testid={TESTIDS.measure.conditionForm}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {field("measure-condition-name", strings.measure_condition_name, <Input id="measure-condition-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />)}
      {field(
        "measure-condition-geometry",
        strings.measure_condition_geometry,
        <Select
          id="measure-condition-geometry"
          aria-labelledby="measure-condition-geometry-label"
          options={GEOMETRIES.map((value) => ({ value, label: strings[GEOMETRY_COPY[value]] }))}
          value={geometry}
          onChange={(value) => {
            const chosen = value as ManualGeometry;
            setGeometry(chosen);
            chooseClass(classesOf(catalogue, chosen)[0]);
          }}
        />,
      )}
      {classes.length === 0 ? (
        <p className="cx-measure-condition-none">{strings.measure_condition_none_offered}</p>
      ) : (
        <>
          {field(
            "measure-condition-class",
            strings.measure_condition_class,
            <Select
              id="measure-condition-class"
              aria-labelledby="measure-condition-class-label"
              options={classes.map((entry) => ({ value: entry.elementClass, label: classWords(entry.elementClass) }))}
              value={elementClass ?? ""}
              onChange={(value) => chooseClass(classes.find((entry) => entry.elementClass === value))}
            />,
          )}
          <fieldset className="cx-measure-condition-group">
            <legend className="cx-measure-condition-label">{strings.measure_condition_kinds}</legend>
            {(klass?.kinds ?? []).map((entry) => (
              <Checkbox
                key={entry.kind}
                label={kindWords(entry.kind)}
                checked={kinds.has(entry.kind)}
                onChange={(checked) => {
                  const next = new Set(kinds);
                  if (checked) next.add(entry.kind);
                  else next.delete(entry.kind);
                  setKinds(next);
                }}
              />
            ))}
          </fieldset>
          {owed.map((reading) => {
            const draft = readingOf(reading.attribute, reading.units);
            const label = READING_COPY[reading.attribute] === undefined ? reading.attribute : strings[READING_COPY[reading.attribute] as StringKey];
            const id = `measure-condition-reading-${reading.attribute}`;
            return (
              <div className="cx-measure-condition-field" key={reading.attribute}>
                <label className="cx-measure-condition-label" id={`${id}-label`} htmlFor={id}>
                  {label}
                </label>
                <div className="cx-measure-condition-reading">
                  <NumberInput id={id} aria-labelledby={`${id}-label`} value={draft.value} min={0} onChange={(value) => setReadings({ ...readings, [reading.attribute]: { ...draft, value } })} />
                  <Select
                    aria-label={fill(strings.measure_condition_reading_unit, { reading: label })}
                    options={reading.units.map((unit) => ({ value: unit, label: unit }))}
                    value={draft.unit}
                    onChange={(unit) => setReadings({ ...readings, [reading.attribute]: { ...draft, unit } })}
                  />
                </div>
              </div>
            );
          })}
        </>
      )}
      <fieldset className="cx-measure-condition-group">
        <legend className="cx-measure-condition-label">{strings.measure_condition_colour}</legend>
        <div className="cx-measure-condition-swatches" role="radiogroup" aria-label={strings.measure_condition_colour}>
          {CONDITION_COLOURS.map((option) => (
            <button key={option} type="button" role="radio" aria-checked={colour === option} aria-label={humaniseEnum(option)} className="cx-measure-condition-choice cx-reticle" onClick={() => setColour(option)}>
              <Swatch colour={option} hatch="solid" />
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="cx-measure-condition-group">
        <legend className="cx-measure-condition-label">{strings.measure_condition_hatch}</legend>
        <div className="cx-measure-condition-swatches" role="radiogroup" aria-label={strings.measure_condition_hatch}>
          {CONDITION_HATCHES.map((option) => (
            <button key={option} type="button" role="radio" aria-checked={hatch === option} aria-label={strings[HATCH_COPY[option]]} className="cx-measure-condition-choice cx-reticle" onClick={() => setHatch(option)}>
              <Swatch colour={colour} hatch={option} />
            </button>
          ))}
        </div>
      </fieldset>
      <p className="cx-measure-condition-hotkey">
        <span className="cx-measure-condition-label">{strings.measure_condition_hotkey}</span>
        {nextHotkey === null ? <span>{strings.measure_condition_hotkey_none}</span> : <Kbd>{String(nextHotkey)}</Kbd>}
      </p>
      {refusal === null ? null : <RefusalState refusal={REFUSALS[refusal]} evidence={{ href: "#measure-chest", label: strings.measure_chest_heading }} />}
      <div className="cx-measure-condition-foot">
        <Button variant="ghost" onClick={onCancel}>
          {strings.measure_condition_cancel}
        </Button>
        <Button type="submit" variant="primary" disabled={!complete || saving} data-testid={TESTIDS.measure.conditionSave}>
          {strings.measure_condition_save}
        </Button>
      </div>
    </form>
  );
}
