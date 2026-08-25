// Q-08: a guardrail is never turned off in a change, and an intentionally-not-run assertion
// surfaces as a recorded skip with an unforgeable trigger — never as .skip or .only (C-06).
/* eslint-disable cubit/boundaries */ // RECORDED REASON Q-08
/* eslint-disable-next-line cubit/no-raw-intl */ // RECORDED REASON Q-08
/* @ts-ignore */ // RECORDED REASON Q-08
/* @ts-expect-error */ // RECORDED REASON Q-08
/* @ts-nocheck */ // RECORDED REASON Q-08

it.skip("does not run", () => {}); // RECORDED REASON Q-08
describe.only("runs alone", () => {}); // RECORDED REASON Q-08
test["skip"]("does not run either", () => {}); // RECORDED REASON Q-08
globalThis.test.skip("does not run through globalThis", () => {}); // RECORDED REASON Q-08
globalThis["describe"].only("runs alone through globalThis", () => {}); // RECORDED REASON Q-08

export const suppressed = true;
