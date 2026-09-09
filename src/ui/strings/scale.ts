// R-SPINE-060: the registered word each rank of L-MEA-05's precedence is read by.
//
// A rank is a value of core's closed `SCALE_RANKS` roster, and the word a reader meets it under is
// the product's, not one screen's — so it stands in the one string table every surface reads. The
// scale panel itself lives in `src/modules/takeoff/scale-ui`, which may not import `src/ui` under
// ARCH-01, and carries these four lines again in its own `copy.ts`; docs/design/s-scale.md § 8
// records moving the panel's whole table here as the IOU that ends that, owned by the node that owns
// `src/ui/strings` and the import matrix.
export const scale = {
  scale_rank_QS_TWO_POINT: "Two-point calibration",
  scale_rank_GRID_SPACING: "Grid spacing",
  scale_rank_DIMENSION_RATIO: "Dimension ratio",
  scale_rank_FILE_UNITS: "File units header",
} as const;
