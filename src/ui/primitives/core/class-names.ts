/**
 * Joining a primitive's own class names with the consumer's is one concern, so it has one home
 * (B-17) rather than a filtered `join` repeated in every primitive.
 */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter((part): part is string => typeof part === "string" && part !== "").join(" ");
}
