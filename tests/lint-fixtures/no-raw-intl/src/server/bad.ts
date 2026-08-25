// LAW-FMT: src/core/format.ts is the tree's sole caller of Intl, including Intl.Collator;
// toLocaleString and localeCompare are errors everywhere else, in every spelling (Q-01).
const method = "toLocaleString";

export const money = new Intl.NumberFormat("en-BD").format(1); // RECORDED REASON LAW-FMT
export const sorter = new Intl.Collator("en").compare; // RECORDED REASON LAW-FMT
export const global = globalThis.Intl; // RECORDED REASON LAW-FMT
export const computed = globalThis["Intl"]; // RECORDED REASON LAW-FMT
export const stamped = new Date().toLocaleString(); // RECORDED REASON LAW-FMT
export const hidden = (1)[method](); // RECORDED REASON LAW-FMT
export const order = "a".localeCompare("b"); // RECORDED REASON LAW-FMT
