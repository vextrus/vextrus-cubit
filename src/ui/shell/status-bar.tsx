// The 24 px readout (Direction §1, §3.1): "one line of mono cells with fixed min-widths,
// `overflow: hidden`, ellipsis; it never wraps. Cells: sheet · scale · coords (drawing units | SI) ·
// snap · selection · layers · a job dot."
//
// The cells are a closed roster in one home (B-17): the class that fixes a cell's minimum measure,
// the name a reader hears and the order they stand in are one declaration, so a screen cannot add an
// eighth cell that pushes the line into a second row. A screen with no value for a cell says so with
// the em dash the Direction names — a blank cell reads as a broken line, not as an absence.
import { strings } from "../strings";
import { TESTIDS } from "@/ui/testids";

/** The seven cells §3.1 names, in the order it names them. */
export const STATUS_CELLS = ["sheet", "scale", "coords", "snap", "selection", "layers", "jobs"] as const;

export type StatusCellId = (typeof STATUS_CELLS)[number];

/** The dot's four answers — the job states the tray already speaks (job-timeline). */
export type StatusJobState = "idle" | "running" | "done" | "failed";

/** The name each cell wears for a reader; the value beside it is the screen's own (R-SPINE-060). */
const CELL_LABEL: Readonly<Record<StatusCellId, string>> = {
  sheet: strings.shell_status_sheet,
  scale: strings.shell_status_scale,
  coords: strings.shell_status_coords,
  snap: strings.shell_status_snap,
  selection: strings.shell_status_selection,
  layers: strings.shell_status_layers,
  jobs: strings.shell_status_jobs,
};

export interface StatusBarProps {
  /**
   * What the screen has to say in each cell. A cell the screen names nothing for shows the em dash:
   * the readout's seven cells always stand, because a line whose cells come and go is a line whose
   * numbers move under the eye (§3.1).
   */
  cells?: Partial<Readonly<Record<Exclude<StatusCellId, "jobs">, string>>>;
  /** The job dot's state; idle is the quiet dot, and the tray is where the detail lives. */
  jobs?: StatusJobState;
}

export function StatusBar({ cells, jobs = "idle" }: StatusBarProps) {
  return (
    <div className="cx-shell-status" data-testid={TESTIDS.shell.status} role="status" aria-label={strings.shell_status_label}>
      {STATUS_CELLS.map((id) =>
        id === "jobs" ? (
          <span className="cx-shell-status-cell cx-shell-status-jobs" data-cell={id} data-testid={TESTIDS.shell.statusJobs} key={id}>
            <span className="cx-shell-status-cell-label">{CELL_LABEL[id]}</span>
            {/* Meaning never rides on colour alone (R-UI-060): the dot carries the state as data, and
                the state's own word is the cell's accessible text beside it. */}
            <span className="cx-shell-status-dot" data-state={jobs} aria-hidden="true" />
          </span>
        ) : (
          <span className="cx-shell-status-cell" data-cell={id} key={id}>
            <span className="cx-shell-status-cell-label">{CELL_LABEL[id]}</span>
            <span className="cx-shell-status-cell-value cx-mono">{cells?.[id] ?? strings.shell_status_absent}</span>
          </span>
        ),
      )}
    </div>
  );
}
