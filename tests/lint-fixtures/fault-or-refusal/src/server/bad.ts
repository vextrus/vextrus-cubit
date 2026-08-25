// ARCH-03: a server-side failure mapped with neither a refusal code nor a fault report is a lint
// error — a swallowed catch is how an outage becomes a shrug (B-21).
export async function save(): Promise<{ ok: boolean }> {
  try {
    return { ok: true };
  } catch { // RECORDED REASON ARCH-03
    return { ok: false };
  }
}

export async function load(): Promise<string> {
  try {
    return "ok";
  } catch { // RECORDED REASON ARCH-03
    return "something went wrong";
  }
}
