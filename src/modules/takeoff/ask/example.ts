// The one example question S-Ask's empty state offers, built from this project's own register
// (docs/design/s-ask.md §2 Empty): a count over the first object standing on a level of the stack, in
// the register's own order — level from the ground up, then class in the catalogue's order, then mark
// as a QS counts them. Pure, so the choice is proved without a database.
//
// An object stands on a level of the stack by its level's SURROGATE ID (L-REG: a level is a surrogate
// id; label, ordinal and height never key). The register's `level_label` holds only a label no level
// was registered for, and `level_slot` a slot still unresolved — neither stands on the stack, so
// neither can be counted "on" a level and neither is offered.
import { ELEMENT_TYPES, isElementType, type ElementType } from "@/core/catalogue/classes";
import { markOrder } from "@/modules/takeoff/register-ui/order";

/** The question the empty state offers, in the register's own subjects (§2 Empty). */
export type AskExample = { readonly class: ElementType; readonly mark: string; readonly level: string };

/** A register object, as far as the example reads it. */
export type ExampleObject = { readonly elementType: string; readonly mark: string; readonly levelId: string | null };

/** A live level of the stack, as far as the example reads it. */
export type ExampleLevel = { readonly levelId: string; readonly label: string; readonly ordinal: number };

/** The first registered object standing on a live level, or null where none does. */
export function exampleOf(objects: readonly ExampleObject[], stack: readonly ExampleLevel[]): AskExample | null {
  const live = new Map(stack.map((level) => [level.levelId, level]));
  const standing = objects.flatMap((object) => {
    const level = object.levelId === null ? undefined : live.get(object.levelId);
    return level !== undefined && isElementType(object.elementType) && object.mark.trim() !== "" ? [{ object, level, type: object.elementType }] : [];
  });
  standing.sort(
    (left, right) =>
      left.level.ordinal - right.level.ordinal ||
      ELEMENT_TYPES.indexOf(left.type) - ELEMENT_TYPES.indexOf(right.type) ||
      markOrder(left.object.mark, right.object.mark),
  );
  const first = standing[0];
  return first === undefined ? null : { class: first.type, mark: first.object.mark, level: first.level.label };
}
