// R-SPINE-006's origin rule, read at the addresses a journey actually runs at.
//
// The rule's comparator is the deployment's own statement of where it answers, because it is the one
// fact of the three that no caller writes (R-SPINE-001). Beside it stands the address the request
// arrived at, admitted when — and only when — that address names the machine the process is itself
// running on: a browser composes `Host` from the address it dialled, so a browser that reached a
// deployment over a network cannot make the arrival address loopback, and the cross-site request
// R-SPINE-006 legislates against is refused whatever it states.
//
// One machine wears several names, though, and a served deployment states exactly one of them. A
// journey lane serves the built product at a loopback address and drives it from the same machine
// (V-E2E), so `localhost` and `127.0.0.1` — and one served port beside another — are routinely two
// spellings of the place the request genuinely arrived at. Admitting the arrival address for a
// deployment that answers on a network name while refusing it for one that answers on loopback
// inverts the rule: the more trusted of the two configurations becomes the stricter one, and every
// cookie-authenticated mutation J-000 walks through is answered ORIGIN_NOT_VERIFIED by a page the
// deployment is in fact serving.
//
// The rule has one home (ARCH-02, B-17) and this reads it there; the tenancy barrel re-exports the
// same function, so a transport asking the question asks this one.
import { describe, expect, test } from "vitest";
import { refusalOf } from "../../../../core/errors";
import { refusalCodeOf } from "../../../../core/faults/refusal-marker";
import { verifyStatedOrigin } from "../guard/origin";

/** What a served loopback deployment states about itself (V-E2E: it states its own address). */
const SERVED = "http://127.0.0.1:3211";

/** The refusal a stated origin this deployment does not answer at is owed. */
const NOT_VERIFIED = refusalOf("ORIGIN_NOT_VERIFIED").code;

/** The registered code a claim was refused with, or null when it was admitted. */
function refusalFor(claim: { statedOrigin: string | null; requestOrigin: string; configuredOrigin: string }): string | null {
  try {
    verifyStatedOrigin(claim);
    return null;
  } catch (thrown) {
    // A refusal is an answer and carries its registered code; anything else is a fault, and a fault
    // is not this reader's to turn into an answer — it goes on up (ARCH-03, B-21). The marker has one
    // reader (ARCH-02) and this asks it rather than re-reading the property.
    const code = refusalCodeOf(thrown);
    if (code === null) throw thrown;
    return code;
  }
}

describe("R-SPINE-006: a page the deployment is serving is admitted at every name its own machine wears", () => {
  test("the address the deployment states it answers at is admitted", () => {
    expect(refusalFor({ statedOrigin: SERVED, requestOrigin: SERVED, configuredOrigin: SERVED })).toBeNull();
  });

  test("a loopback deployment admits the request that arrived under this machine's other spelling", () => {
    // `localhost` and `127.0.0.1` are one machine under two names. The request arrived here, so the
    // page that stated this origin is the one this deployment is serving.
    const dialled = "http://localhost:3211";
    expect(
      refusalFor({ statedOrigin: dialled, requestOrigin: dialled, configuredOrigin: SERVED }),
      "a browser that dialled localhost reached the deployment served on 127.0.0.1; refusing it refuses the deployment's own page",
    ).toBeNull();
  });

  test("a loopback deployment admits a request that arrived at another port of the same machine", () => {
    // A second served port on this machine is a caller inside the process driving the shipped
    // handler, which composes the URL itself — not a page on a network.
    const beside = "http://127.0.0.1:3210";
    expect(refusalFor({ statedOrigin: beside, requestOrigin: beside, configuredOrigin: SERVED })).toBeNull();
  });

  test("a deployment answering on a network name still admits a request that arrived at this machine", () => {
    const arrived = "http://127.0.0.1:3210";
    expect(refusalFor({ statedOrigin: arrived, requestOrigin: arrived, configuredOrigin: "https://cubit.example" })).toBeNull();
    expect(
      refusalFor({ statedOrigin: "https://cubit.example", requestOrigin: arrived, configuredOrigin: "https://cubit.example" }),
      "the deployment's own stated address is admitted whatever the request arrived at",
    ).toBeNull();
  });

  test("an unconfigured deployment reached on loopback admits the page it is serving", () => {
    const dialled = "http://127.0.0.1:3000";
    expect(refusalFor({ statedOrigin: dialled, requestOrigin: dialled, configuredOrigin: "" })).toBeNull();
  });

  test("a request that stated no origin is not a page claiming a foreign one", () => {
    expect(refusalFor({ statedOrigin: null, requestOrigin: SERVED, configuredOrigin: SERVED })).toBeNull();
  });
});

describe("R-SPINE-006: the widening admits no page on a network, and no caller's own word", () => {
  test("a foreign page is refused, whatever the deployment answers at", () => {
    expect(refusalFor({ statedOrigin: "https://attacker.example", requestOrigin: SERVED, configuredOrigin: SERVED })).toBe(NOT_VERIFIED);
  });

  test("a forged Host does not make a foreign page's origin one this deployment answers at", () => {
    // Everything the caller writes says the same thing twice. The arrival address is admitted for
    // naming this machine, never for matching what was stated, so saying it twice buys nothing.
    const forged = "https://attacker.example";
    expect(refusalFor({ statedOrigin: forged, requestOrigin: forged, configuredOrigin: SERVED })).toBe(NOT_VERIFIED);
    expect(refusalFor({ statedOrigin: forged, requestOrigin: forged, configuredOrigin: "" })).toBe(NOT_VERIFIED);
  });

  test("a network arrival admits nothing but the configured address, however it is spelled", () => {
    // The deployment answers over a network: the request's arrival address is then the deployment's
    // own as far as a browser is concerned, and a claim matching neither is somebody else's page.
    expect(
      refusalFor({ statedOrigin: "https://elsewhere.example", requestOrigin: "https://cubit.example", configuredOrigin: "https://cubit.example" }),
      "R-SPINE-001: nothing a caller wrote decides this",
    ).toBe(NOT_VERIFIED);
  });

  test("a loopback name is not admitted for a deployment a browser reached over a network", () => {
    expect(refusalFor({ statedOrigin: "http://localhost:3211", requestOrigin: "https://cubit.example", configuredOrigin: "https://cubit.example" })).toBe(NOT_VERIFIED);
  });

  test("a stated origin that parses to nothing is refused rather than matched", () => {
    expect(refusalFor({ statedOrigin: "   ", requestOrigin: SERVED, configuredOrigin: SERVED })).toBe(NOT_VERIFIED);
  });
});
