// The sentences the rooms panel says, mirrored from their home in the registry (viewer.md Part 7).
//
// `src/modules` imports core and its own module only (ARCH-01), and the string registry is
// `src/ui/strings` — so a panel that lives in this module cannot read its copy from the table that owns
// it. The tree's answer to that boundary is a mirror pinned by a test, exactly as
// `viewer-partition-overlay/copy.ts` and `levels-ui/copy.ts` mirror theirs (B-17, C-13). Every value
// below is `src/ui/strings/rooms.ts` verbatim; tests/takeoff/rooms-ui/copy-mirror.test.ts reads both.

/** The keys of the registry this panel renders. */
export type RoomsCopyKey = keyof typeof ROOMS_COPY;

export const ROOMS_COPY = Object.freeze({
  rooms_heading: "Rooms",
  rooms_loading: "Reading the rooms.",
  rooms_unread: "This drawing has not been read yet, so no room stands on it.",
  rooms_empty: "The plans of this drawing enclose no room the product could read.",
  rooms_failed: "The rooms could not be read.",
  rooms_retry: "Read again",
  rooms_plan_counts: "{rooms} rooms · {confirmed} confirmed · {untyped} to type",
  rooms_group_label: "Rooms on {caption}",
  rooms_group_count_one: "1 room, named and typed from its label",
  rooms_group_count_many: "{count} rooms, named and typed from their labels",
  rooms_basis_label: "From its label",
  rooms_basis_model: "Proposed by Jev, {confidence} % sure",
  rooms_basis_model_unsure: "Proposed by Jev",
  rooms_basis_person: "Typed by a person",
  rooms_confirmed: "Confirmed",
  rooms_untyped_unasked: "No type read from its label; Jev has not answered yet",
  rooms_untyped_none: "Jev read no type in its label",
  rooms_type_field: "Type for {name}",
  rooms_type_placeholder: "Choose a type",
  rooms_type_confirm: "Preview",
  rooms_refused_heading: "Not rooms a finish is measured in",
  rooms_area: "{area} m²",
  rooms_unnamed: "Unnamed region",
  rooms_asking: "Asking Jev about {count} rooms whose labels name no type.",
  rooms_offline: "Nothing was previewed: the connection to the product is gone.",
  rooms_denied_permission: "Confirming rooms needs the MEASURE permission on this project, and your account does not hold it.",
  rooms_denied_holder: "This project's principals and measurers hold it; a principal grants it on the participants screen.",
});

/** A mirrored sentence with its named slots filled; a slot with no value stands as itself (R-SPINE-060). */
export function fillRoomsCopy(key: RoomsCopyKey, values: Readonly<Record<string, string>>): string {
  return ROOMS_COPY[key].replace(/\{(\w+)\}/g, (slot, name: string) => values[name] ?? slot);
}
