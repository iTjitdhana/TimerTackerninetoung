const ROLE_ALIASES: Record<string, string> = {
  operator: "พนักงานผลิต",
  staff: "พนักงานผลิต",
  พนักงาน: "พนักงานผลิต",
  weighing_staff: "พนักงานตวงสูตร",
  weigher: "พนักงานตวงสูตร",
  ตวงสูตร: "พนักงานตวงสูตร",
  supervisor: "ผู้ดูแลระบบ",
  manager: "ผู้ดูแลระบบ",
  admin: "ผู้ดูแลระบบ",
  elevated: "ผู้ดูแลระบบ",
  หัวหน้า: "ผู้ดูแลระบบ",
}

export function getRoleLabel(role: string, roleDisplayName?: string): string {
  if (roleDisplayName?.trim()) return roleDisplayName.trim()
  return ROLE_ALIASES[role.trim().toLowerCase()] ?? role
}

export function getProfileSubtitle(
  role: string,
  roleDisplayName?: string,
  department?: string,
): string {
  const roleLabel = getRoleLabel(role, roleDisplayName)
  if (department?.trim()) {
    return `${roleLabel} · ${department.trim()}`
  }
  return roleLabel
}
