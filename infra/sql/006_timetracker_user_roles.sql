-- TimeTracker-owned authorization table (does not replace shared role_configurations).
-- Run against MNF_database411. Safe to re-run (CREATE IF NOT EXISTS + idempotent backfill).

START TRANSACTION;

CREATE TABLE IF NOT EXISTS timetracker_user_roles (
  user_id INT NOT NULL,
  app_role VARCHAR(32) NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by_user_id INT NULL,
  PRIMARY KEY (user_id),
  KEY idx_tt_app_role (app_role),
  CONSTRAINT fk_tt_user_roles_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill mirrors mapLegacyRoleNameToAppRole() in permissions.constants.ts
INSERT INTO timetracker_user_roles (user_id, app_role)
SELECT
  u.id,
  CASE
    WHEN LOWER(TRIM(IFNULL(rc.role_name, ''))) IN (
      'operator', 'staff', 'employee', 'worker', 'viewer'
    ) THEN 'operator'
    WHEN LOWER(TRIM(IFNULL(rc.role_name, ''))) IN (
      'weighing_staff', 'weigher', 'weighing'
    ) THEN 'weighing_staff'
    WHEN LOWER(TRIM(IFNULL(rc.role_name, ''))) IN (
      'supervisor', 'lead'
    ) THEN 'supervisor'
    WHEN LOWER(TRIM(IFNULL(rc.role_name, ''))) IN (
      'manager', 'admin', 'administrator', 'elevated'
    ) THEN 'elevated'
    WHEN TRIM(IFNULL(rc.role_name, '')) IN (
      'พนักงาน', 'พนักงานผลิต'
    ) THEN 'operator'
    WHEN TRIM(IFNULL(rc.role_name, '')) IN (
      'ตวงสูตร', 'พนักงานตวงสูตร'
    ) THEN 'weighing_staff'
    WHEN TRIM(IFNULL(rc.role_name, '')) IN (
      'หัวหน้า', 'หัวหน้างาน'
    ) THEN 'supervisor'
    WHEN TRIM(IFNULL(rc.role_name, '')) IN (
      'ผู้ดูแล', 'ผู้ดูแลระบบ'
    ) THEN 'elevated'
    ELSE 'operator'
  END AS app_role
FROM users u
LEFT JOIN role_configurations rc ON rc.id = u.role_id
WHERE u.is_active = 1
ON DUPLICATE KEY UPDATE app_role = VALUES(app_role);

COMMIT;
