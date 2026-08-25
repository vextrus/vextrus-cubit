// ARCH-01: src/app imports server, modules, core and ui — the worker is not on that list.
import "@/worker/queue"; // RECORDED REASON ARCH-01

export const contained = true;
