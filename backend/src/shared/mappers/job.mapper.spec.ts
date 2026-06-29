import { describe, expect, it } from "vitest";
import {
  extractOperatorProfiles,
  extractOperators,
  isWorkPlanVisibleToViewer,
} from "./job.mapper";

const viewer = { idCode: "EMP002", name: "สาม" };

// helper สำหรับ cast object บางส่วนให้เป็น work plan shape ที่ฟังก์ชันต้องการ
function plan(partial: Record<string, unknown>) {
  return partial as never;
}

describe("isWorkPlanVisibleToViewer", () => {
  it("matches by work_plan_operators id_code", () => {
    expect(
      isWorkPlanVisibleToViewer(
        plan({
          work_plan_operators: [{ id_code: "EMP002", users: null }],
          operators: null,
        }),
        viewer,
      ),
    ).toBe(true);
  });

  it("matches by users.id_code relation (user_id based row)", () => {
    expect(
      isWorkPlanVisibleToViewer(
        plan({
          work_plan_operators: [
            { id_code: null, users: { name: "สาม", id_code: "EMP002" } },
          ],
          operators: null,
        }),
        viewer,
      ),
    ).toBe(true);
  });

  it("excludes when relational operators do not include the viewer", () => {
    expect(
      isWorkPlanVisibleToViewer(
        plan({
          work_plan_operators: [
            { id_code: "EMP999", users: { name: "อื่น", id_code: "EMP999" } },
          ],
          operators: ["สาม"],
        }),
        viewer,
      ),
    ).toBe(false);
  });

  it("falls back to operators JSON names when no relations", () => {
    expect(
      isWorkPlanVisibleToViewer(
        plan({ work_plan_operators: [], operators: ["ภา", "สาม"] }),
        viewer,
      ),
    ).toBe(true);
    expect(
      isWorkPlanVisibleToViewer(
        plan({ work_plan_operators: [], operators: ["ภา", "เอ"] }),
        viewer,
      ),
    ).toBe(false);
  });

  it("returns false when there are no operators at all", () => {
    expect(
      isWorkPlanVisibleToViewer(
        plan({ work_plan_operators: [], operators: null }),
        viewer,
      ),
    ).toBe(false);
  });
});

describe("extractOperatorProfiles", () => {
  it("prefers users.name from the relation", () => {
    expect(
      extractOperatorProfiles(
        plan({
          work_plan_operators: [
            {
              id_code: "admin21133",
              users: { name: "Admin User", id_code: "admin21133" },
            },
          ],
          operators: null,
        }),
      ),
    ).toEqual([
      { name: "Admin User", employeeId: "admin21133" },
    ]);
  });

  it("resolves display name from id_code lookup map", () => {
    const nameByIdCode = new Map([["admin21133", "Admin User"]]);

    expect(
      extractOperatorProfiles(
        plan({
          work_plan_operators: [{ id_code: "admin21133", users: null }],
          operators: null,
        }),
        nameByIdCode,
      ),
    ).toEqual([
      { name: "Admin User", employeeId: "admin21133" },
    ]);
  });

  it("falls back to id_code when no name is available", () => {
    expect(
      extractOperatorProfiles(
        plan({
          work_plan_operators: [{ id_code: "unknown-code", users: null }],
          operators: null,
        }),
      ),
    ).toEqual([{ name: "unknown-code", employeeId: "unknown-code" }]);
  });
});

describe("extractOperators", () => {
  it("returns operator names only", () => {
    expect(
      extractOperators(
        plan({
          work_plan_operators: [
            { id_code: "admin21133", users: { name: "Admin User" } },
          ],
          operators: null,
        }),
      ),
    ).toEqual(["Admin User"]);
  });
});
