// ARCH-03, B-21: a server fault, an expired session and a wrong credential are three different
// answers — the fault seam records the first, a registry refusal answers the second, and a failure
// this layer cannot answer is rethrown for the seam above it.
import { reportFault } from "@/core/fault";

export async function save(): Promise<{ ok: boolean }> {
  try {
    return { ok: true };
  } catch (error) {
    reportFault(error);
    return { ok: false };
  }
}

export async function whoami(): Promise<{ refusal: string; remedy: string }> {
  try {
    return { refusal: "", remedy: "" };
  } catch {
    return { refusal: "SIGNED_OUT", remedy: "sign-in" };
  }
}

export async function passthrough(): Promise<string> {
  try {
    return "ok";
  } catch (error) {
    throw new Error("upstream unavailable", { cause: error });
  }
}
