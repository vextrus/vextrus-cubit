// FIXTURE: cubit/module-boundaries MUST report on this file.
// A module's insides are its own; only its declared surface crosses the line.

import { partitionInternals } from '@/modules/takeoff/internal/partition';
import { bracketInternals } from '../../../src/modules/bid/internal/bracket';

export const leak = [partitionInternals, bracketInternals];
