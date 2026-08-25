// The assure lane's one home (ARCH-02): assure's procedures are added here, never at the
// composition root, so the root never changes hands (ARCH-01).
import { router } from "../trpc";

export const assureRouter = router({});
