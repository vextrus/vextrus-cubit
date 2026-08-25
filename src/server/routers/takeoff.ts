// The takeoff lane's one home (ARCH-02): takeoff's procedures are added here, never at the
// composition root, so the root never changes hands (ARCH-01).
import { router } from "../trpc";

export const takeoffRouter = router({});
