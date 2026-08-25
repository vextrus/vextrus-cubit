// ARCH-03, Q-01: the bypass shapes. A catch that answers nothing is still a swallowed catch when
// the words "throw" and "refusal" appear in its prose, when a local is merely *named* `refusal`,
// and when a throw sits inside a callback written in the catch rather than in the catch's own
// answer — the rule reads the syntax tree, not the text, so none of these silence it (B-21).
export async function commented(): Promise<{ ok: boolean }> {
  try {
    return { ok: true };
  } catch { // RECORDED REASON ARCH-03
    // we never throw this away silently, and this is not a refusal
    return { ok: false };
  }
}

export async function stringly(): Promise<{ ok: boolean; message: string }> {
  try {
    return { ok: true, message: "" };
  } catch { // RECORDED REASON ARCH-03
    return { ok: false, message: "this is not a refusal, and nothing to throw" };
  }
}

export async function named(): Promise<{ ok: boolean }> {
  try {
    return { ok: true };
  } catch { // RECORDED REASON ARCH-03
    const refusal = { logged: false };
    void refusal;
    return { ok: false };
  }
}

export async function nested(): Promise<{ ok: boolean }> {
  try {
    return { ok: true };
  } catch { // RECORDED REASON ARCH-03
    const later = (): never => {
      throw new Error("never called");
    };
    void later;
    return { ok: false };
  }
}
