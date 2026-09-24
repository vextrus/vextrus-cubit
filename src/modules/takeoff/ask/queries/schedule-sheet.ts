// SCHEDULE_SHEET (§1.2): "Which sheet has the column schedule?" — the schedules the pinned revision's
// reading reconstructed (`schedulesViewOf`), each named by the title its caption states, whose words
// hold the words asked in order (`COLUMN SCHEDULE` holds `COLUMN SCHEDULE`; `PILE CAP SCHEDULE` does
// not hold `PILE SCHEDULE`). Each is placed by its CAPTION — the key the schedule's view is anchored
// at — on the sheet core's one resolver stands it on (`sheetOfKey`, through the windows of the paper
// sheets, SRCH-1's frames): the answer's sheet is an EvidenceLink selecting the caption there. A
// name no schedule answers to is refused with the schedules the sheets hold (I-676).
import { wordsOf } from "@/modules/takeoff/sheets/text-index";
import { ASK_REFUSAL_CODES, type AskPlace, type AskReading, type AskSchedule, type AskScheduleSheet, type AskSources } from "../law";
import { NO_RECORDS, placesFrom } from "./common";
import { notMeasured, type AskQuery } from "./registry-law";

/** Whether a schedule's title holds the words asked, whole, in order and adjacent (the index's spelling). */
export function titleAnswers(title: string, asked: string): boolean {
  const words = wordsOf(asked);
  return words.length > 0 && ` ${wordsOf(title).join(" ")} `.includes(` ${words.join(" ")} `);
}

/** The key a schedule's view is anchored at: its caption (`SCHEDULE:DXF_HANDLE:9C6` → `DXF_HANDLE:9C6`). */
export function captionKeyOf(viewKey: string): string {
  const cut = viewKey.indexOf(":");
  return cut < 0 ? viewKey : viewKey.slice(cut + 1);
}

/** One schedule, placed by its caption on the sheet core's resolver stands it on — or on none. */
function placed(schedule: AskSchedule, sources: Pick<AskSources, "entityAt">): AskScheduleSheet {
  const captionKey = captionKeyOf(schedule.viewKey);
  const entity = sources.entityAt(schedule.drawingId, captionKey);
  const place: AskPlace | null = entity === null || entity.layoutName === null ? null : { drawingId: entity.drawingId, layoutName: entity.layoutName, sheetLabel: entity.sheetLabel, keys: [captionKey] };
  return { scheduleKey: schedule.scheduleKey, title: schedule.title, drawingId: schedule.drawingId, captionKey, place };
}

export const SCHEDULE_SHEET_QUERY: AskQuery = {
  intent: "SCHEDULE_SHEET",
  basis: "SCHEDULES",
  needs: ["schedules", "entities"],
  answer(reading: AskReading, sources: AskSources) {
    if (sources.campaign === null) return notMeasured(reading);
    const asked = reading.text ?? "";
    const matched = sources.schedules.filter((schedule) => titleAnswers(schedule.title, asked));
    if (matched.length === 0) {
      const titles = [...new Set(sources.schedules.map((schedule) => schedule.title))];
      return { outcome: "REFUSED", code: ASK_REFUSAL_CODES.subjectUnknown, reading, held: { subject: "SCHEDULES", class: null, items: titles } };
    }
    const schedules = matched.map((schedule) => placed(schedule, sources));
    return {
      statement: { intent: "SCHEDULE_SHEET", schedules },
      partial: null,
      places: placesFrom(schedules.map((schedule) => schedule.place)),
      records: NO_RECORDS,
      basis: "SCHEDULES",
    };
  },
};
