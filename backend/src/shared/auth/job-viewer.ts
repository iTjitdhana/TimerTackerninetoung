import type { AuthenticatedRequestUser } from "./auth-user.types";

/**
 * บริบทผู้ดูงาน (viewer) สำหรับกรองงานให้เห็นเฉพาะที่ตัวเองได้รับมอบหมาย
 * - idCode = users.id_code (มาจาก JWT sub)
 * - name   = ชื่อแสดงผล (ใช้ fallback กับ work_plans.operators แบบ JSON เก่า)
 * - canReadAll = มีสิทธิ์ jobs.read_all (supervisor/elevated) เห็นงานผลิตทั้งหมด
 * - canReadAllWeighingJobs = เห็นงานตวงสูตรทั้งหมด (ไม่กรองตาม operator)
 */
export interface JobViewerContext {
  idCode: string;
  name: string;
  canReadAll: boolean;
  canReadAllWeighingJobs: boolean;
}

export function buildJobViewer(
  user: AuthenticatedRequestUser,
): JobViewerContext {
  const canReadAll = user.permissions.actions.includes("jobs.read_all");
  return {
    idCode: user.sub,
    name: user.name,
    canReadAll,
    canReadAllWeighingJobs:
      canReadAll ||
      user.permissions.actions.includes("formula_weighing.read_all_jobs"),
  };
}

/** ขยาย viewer สำหรับ API รายการ/รายละเอียดงานตวงสูตร */
export function withWeighingJobVisibility(
  viewer: JobViewerContext,
): JobViewerContext {
  return {
    ...viewer,
    canReadAll: viewer.canReadAll || viewer.canReadAllWeighingJobs,
  };
}
