export function isTimetrackerOwnAuthEnabled(): boolean {
  return process.env.TIMETRACKER_OWN_AUTH === "true";
}

export function getDefaultOrgRoleId(): number {
  const raw = process.env.TIMETRACKER_DEFAULT_ORG_ROLE_ID?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : 5;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}
