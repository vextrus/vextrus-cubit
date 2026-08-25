// The ai lane's one home (ARCH-02): ai's procedures are added here, never at the
// composition root, so the root never changes hands (ARCH-01).
import { router } from "../trpc";

export const aiRouter = router({});
