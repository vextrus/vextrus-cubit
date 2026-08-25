// ARCH-01: cycles at file or layer grain are lint errors. The import that closes the ring is the
// one reported, whether the ring is one file long or two.
import "./bad"; // RECORDED REASON ARCH-01
import "../../tests/lint-fixtures/no-cycle/src/core/bad2"; // RECORDED REASON ARCH-01

export const ring = true;
