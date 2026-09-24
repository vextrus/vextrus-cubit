// The rooms stage's rosters, as law (s-takeoff I-643…d): what a closed region of a plan is, and the
// faces a room registers. They stand apart from the rooms module because the store's CHECK is written
// from them too, and the module reaches the seam — a roster the schema could not import would be a
// roster spelled twice (B-17, ARCH-02; the campaign statuses' precedent, `../campaigns/law.ts`).

/**
 * What a closed region of a plan IS, as the rooms stage reads it: a room it registered, a room label
 * standing in no closed region (L-MEA-03's SURFACE_NOT_CLOSED), a void nobody finishes (a lift, a stair,
 * a duct, a shaft), or a region listed and not registered for a named reason (L-MEA-01).
 */
export const ROOM_OUTLINE_STATUSES = ["CLOSED", "NOT_CLOSED", "VOID", "DROPPED"] as const;

/** One of the four. */
export type RoomOutlineStatus = (typeof ROOM_OUTLINE_STATUSES)[number];

/** The faces a room registers as surfaces (R-TO-036: "finish faces (floor, ceiling, wall faces)"). */
export const ROOM_FACES = ["FLOOR", "CEILING", "WALLS"] as const;

/** One of the three. */
export type RoomFace = (typeof ROOM_FACES)[number];

/**
 * How a confirmed room's type was read (viewer.md I-687): off its labels by the grammar, proposed
 * by the model, or given by the person confirming it where neither read one or they read it otherwise.
 * Here, beside the statuses, for their reason: the store's CHECK is written from it too.
 */
export const ROOM_TYPE_BASES = ["LABEL", "MODEL", "PERSON"] as const;

/** One of the three. */
export type RoomTypeBasis = (typeof ROOM_TYPE_BASES)[number];
