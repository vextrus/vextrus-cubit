// FIXTURE: cubit/module-boundaries MUST NOT report on this file.
// Composition happens through each module's declared router surface.

import { takeoffRouter } from '@/modules/takeoff/router';
import { bidRouter } from '@/modules/bid/router';

export const mounted = { takeoff: takeoffRouter, bid: bidRouter };
