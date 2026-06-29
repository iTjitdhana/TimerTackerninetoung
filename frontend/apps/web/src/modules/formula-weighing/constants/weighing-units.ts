/** หน่วยมาตรฐานในระบบตวงสูตร (ลำดับเริ่มต้นเมื่อยังไม่มีสถิติการใช้งาน) */
export const DEFAULT_WEIGHING_UNITS = [
  "กก.",
  "กรัม",
  "มก.",
  "แพ็ค",
  "ถุง",
  "ขวด",
  "กระป๋อง",
  "ลิตร",
  "มล.",
  "โหล",
  "ชิ้น",
  "อัน",
  "ตัน",
  "ปอนด์",
  "ลัง",
  "กล่อง",
] as const

export const WEIGHING_UNIT_USAGE_STORAGE_KEY = "formula-weighing-unit-usage"

/** แปลงชื่อหน่วยเก่า → ชื่อมาตรฐาน */
export const WEIGHING_UNIT_ALIASES: Record<string, string> = {
  "ก.": "กรัม",
}
