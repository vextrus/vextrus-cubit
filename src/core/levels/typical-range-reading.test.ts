// The typical-range port answers with what is registered, and a process with nothing registered is
// told so by a named fault rather than handed an empty reading (ARCH-03: an empty answer would leave
// every placeholder standing with no word said).
import { expect, test } from "vitest";
import { registerTypicalRangeReading, TYPICAL_RANGE_READING_UNREGISTERED, typicalRangeReading, type TypicalRangeReading } from "./typical-range-reading";

test("an unregistered typical-range reading is a named fault; a registered one is the answer", () => {
  const previous = registerTypicalRangeReading(null);
  try {
    let thrown: unknown = null;
    try {
      typicalRangeReading();
    } catch (failure) {
      thrown = failure;
    }
    expect((thrown as Error | null)?.name, "nothing registered is a fault named for what is missing").toBe(TYPICAL_RANGE_READING_UNREGISTERED);

    const reading: TypicalRangeReading = async () => [];
    expect(registerTypicalRangeReading(reading), "registering answers what it replaced").toBeNull();
    expect(typicalRangeReading(), "and the registered reading is the one asked").toBe(reading);
  } finally {
    registerTypicalRangeReading(previous);
  }
});
