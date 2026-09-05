// R-SPINE-060: the job pattern's own table, serving both surfaces R-UI-024 names — the inline
// timeline and the global jobs tray. Copy fixed verbatim by docs/design/job-timeline.md § 4 and
// docs/design/shell-top-bar.md § 3; nothing here says a sentence about a refusal, which is the
// register's copy (R-SPINE-062), and no key names a process a person never asked for.
export const jobTimeline = {
  job_timeline_idle: "No job is running right now.",
  job_timeline_seconds: "{seconds} s",
  job_timeline_transport_lost: "Live progress stopped arriving. Reload the page to see where these jobs stand.",
  job_step_ingest: "Read the drawing",
  job_step_thumbnails: "Draw the sheet previews",
  job_step_probe: "Check that drawings can be read",
  job_status_queued: "Queued",
  job_status_running: "Running",
  job_status_succeeded: "Done",
  job_status_failed: "Failed",
  job_status_refused: "Refused",
  jobs_tray_label: "Jobs",
  jobs_tray_heading: "Jobs started in this tab",
  jobs_tray_empty: "No job has run in this tab yet. Add a drawing to a project and its progress appears here.",
} as const;

// R-SPINE-060's per-module convention is that a table file's DESIGNATED export is the one named for
// its basename, and this file's basename is not an identifier. The table is therefore published
// under both names: the identifier `index.ts` aggregates it by, and the basename the convention
// designates. One table, two names for it — never two tables.
export { jobTimeline as "job-timeline" };
