/**
 * The address reading the frame's selection rests on (R-UI-031): which workspace an address names,
 * whether it is an area's own home, and the one home an area's words come from (B-17).
 */
import { describe, expect, test } from "vitest";
import { strings } from "../strings";
import * as barrel from "./index";
import { SHELL_AREAS, areaLabel, isAreaHome, workspaceLabel, workspaceOf } from "./routes";

describe("workspaceOf", () => {
  test("answers the segment a workspace address names, and null where none is named", () => {
    expect(workspaceOf("/t/A")).toBe("A");
    expect(workspaceOf("/t/A/books")).toBe("A");
    expect(workspaceOf("/t/A/books/")).toBe("A");
    expect(workspaceOf("/t/A/p/x/settings")).toBe("A");
    expect(workspaceOf("/sessions")).toBeNull();
    expect(workspaceOf("/")).toBeNull();
    expect(workspaceOf(null)).toBeNull();
  });
});

describe("isAreaHome", () => {
  test("an address inside the named workspace answers its own home", () => {
    expect(isAreaHome("/t/A", "A")).toBe(true);
    expect(isAreaHome("/t/A/books", "A")).toBe(true);
    expect(isAreaHome("/t/A/books/", "A")).toBe(true);
    expect(isAreaHome("/t/A/p/x/settings", "A")).toBe(false);
  });

  test("an address in another workspace is never this workspace's area home", () => {
    expect(isAreaHome("/t/B", "A")).toBe(false);
    expect(isAreaHome("/t/B/books", "A")).toBe(false);
    expect(isAreaHome("/sessions", "A")).toBe(false);
    expect(isAreaHome(null, "A")).toBe(false);
  });
});

describe("the labels the frame names things by", () => {
  test("every area's label is the string table's own words", () => {
    for (const area of SHELL_AREAS) expect(areaLabel(area)).toBe(strings[`shell_nav_${area}`]);
  });

  test("the barrel publishes the same functions, not second copies", () => {
    expect(barrel.areaLabel).toBe(areaLabel);
    expect(barrel.workspaceOf).toBe(workspaceOf);
    expect(barrel.workspaceLabel).toBe(workspaceLabel);
  });
});
