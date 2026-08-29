// I-34: the project form judges presentability locally, and the closed refusal taxonomy gains
// nothing for a value the door itself can judge (R-SPINE-062). The judgements are here, in one home,
// because the browser makes them before it calls the seam and the server action makes them again on
// what actually arrived — two doors to one question must be provably the same door (B-17, ARCH-02).
//
// Everything the judgements admit is stored as presented: case, spacing and length are the person's
// (s-auth I-14). A field left blank states nothing, so it is stored as an absence rather than as an
// empty string.
import { isBuildingType, type ProjectFields } from "../../../../../modules/spine/projects";
import { hasVisibleText } from "../../../../../ui/shell";

/** What a judgement refused, as the answer slot names its one sentence. */
export type ProjectJudgement = "name" | "buildingType" | "number";

/** The form's fields as a browser presents them: text, all of it, before anything is read into it. */
export interface PresentedProject {
  readonly name: string;
  readonly code: string;
  readonly client: string;
  readonly siteAddress: string;
  readonly district: string;
  readonly buildingType: string;
  readonly storeys: string;
  readonly gfaM2: string;
  readonly notes: string;
}

/** The draft the seam is handed, or the one judgement that stopped it from being called. */
export type JudgedProject = { readonly presentable: true; readonly fields: ProjectFields } | { readonly presentable: false; readonly refused: ProjectJudgement };

/** A count of floors: whole, and never fewer than none. */
const WHOLE_NUMBER = /^\d+$/;

/** A plain decimal area: digits, and at most one plain fraction. No sign, no grouping, no units. */
const PLAIN_DECIMAL = /^\d+(\.\d+)?$/;

/** Would this text be read as an area? The sft readout renders nothing until it would (I-39). */
export function isPlainDecimal(value: string): boolean {
  return PLAIN_DECIMAL.test(value);
}

export function judgeProject(presented: PresentedProject): JudgedProject {
  // "An entered name is a name with something visible in it" is judged in its one home, so a name of
  // zero-width characters is refused here exactly as a name of spaces is (the shell's I-22).
  if (!hasVisibleText(presented.name)) return { presentable: false, refused: "name" };
  if (!isBuildingType(presented.buildingType)) return { presentable: false, refused: "buildingType" };
  if (presented.storeys !== "" && !WHOLE_NUMBER.test(presented.storeys)) return { presentable: false, refused: "number" };
  if (presented.gfaM2 !== "" && !PLAIN_DECIMAL.test(presented.gfaM2)) return { presentable: false, refused: "number" };

  return {
    presentable: true,
    fields: {
      name: presented.name,
      code: stated(presented.code),
      client: stated(presented.client),
      siteAddress: stated(presented.siteAddress),
      district: stated(presented.district),
      buildingType: presented.buildingType,
      storeys: presented.storeys === "" ? null : Number(presented.storeys),
      targetGfaM2: stated(presented.gfaM2),
      notes: stated(presented.notes),
    },
  };
}

/** The fields as they arrive from a submitted form, every one of them read as the text it is. */
export function presentedProject(form: FormData): PresentedProject {
  const field = (key: string): string => String(form.get(key) ?? "");
  return {
    name: field("name"),
    code: field("code"),
    client: field("client"),
    siteAddress: field("siteAddress"),
    district: field("district"),
    buildingType: field("buildingType"),
    storeys: field("storeys"),
    gfaM2: field("gfaM2"),
    notes: field("notes"),
  };
}

/** A field left blank states nothing, and an unstated fact is an absence in the store. */
function stated(value: string): string | null {
  return value === "" ? null : value;
}
