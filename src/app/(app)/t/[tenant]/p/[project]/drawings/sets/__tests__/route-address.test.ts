/**
 * AC-6(a) — the sets addresses, beside the module that spells them.
 *
 * The header claims these are "the paths a commit revalidates". Nothing in this tree revalidates
 * them: the claim is a comment describing a mechanism that was never built, and a reader who takes
 * it at face value goes looking for a revalidation that does not exist. The addresses themselves do
 * not move — a route table is a contract — so this file pins what the two functions answer and asks
 * the file to stop claiming what it does not do.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { setRoute, setsRoute } from "../route-address";

const MODULE = join(process.cwd(), "src/app/(app)/t/[tenant]/p/[project]/drawings/sets/route-address.ts");

const TENANT = "3f1c2e10-8a44-4e2b-9f0a-1c2d3e4f5061";
const PROJECT = "9a7b6c5d-4e3f-4a2b-8c1d-0e9f8a7b6c5d";
const SET = "77777777-8888-4999-8aaa-bbbbbbbbbbbb";

test("AC-6(a): the file no longer claims a commit revalidates its paths", () => {
  // white-box: AC-6(a) — the defect IS a sentence in the file. A claim about a mechanism that does
  // not exist has no runtime observable to ask instead: the only place it can be judged is the text.
  const source = readFileSync(MODULE, "utf8");

  expect(/revalidat/i.test(source), "no revalidation happens here, so nothing in this file may say one does (B-19, Q-17)").toBe(false);
});

test("AC-6(a): the two addresses answer exactly what they answered before", () => {
  expect(setsRoute(TENANT, PROJECT), "the sets index address is unchanged — a route table is a contract").toBe(`/t/${TENANT}/p/${PROJECT}/drawings/sets`);
  expect(setRoute(TENANT, PROJECT, SET), "one set's address is the index's, with the set on the end").toBe(`${setsRoute(TENANT, PROJECT)}/${SET}`);
});
