// The bid lane. The lane owns this file from the spine's first increment so the increment that
// brings bid's procedures edits only here and never the composition root (ARCH-02).
import { router } from "../trpc";

export const bidRouter = router({});
