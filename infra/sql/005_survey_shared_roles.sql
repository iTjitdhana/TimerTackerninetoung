-- Read-only survey: shared role tables used by multiple systems.
-- Run against MNF_database411. Does NOT modify any data.

-- 1. Role configurations and active user counts
SELECT
  rc.id,
  rc.role_name,
  rc.display_name,
  rc.url_prefix,
  COUNT(u.id) AS user_count
FROM role_configurations rc
LEFT JOIN users u ON u.role_id = rc.id AND u.is_active = 1
GROUP BY rc.id, rc.role_name, rc.display_name, rc.url_prefix
ORDER BY rc.id;

-- 2. Role menu permissions (shared)
SELECT
  role_id,
  menu_key,
  can_view
FROM role_menu_permissions
ORDER BY role_id, menu_key;

-- 3. Users without role or with unknown role_id
SELECT
  u.id,
  u.id_code,
  u.name,
  u.role_id,
  rc.role_name
FROM users u
LEFT JOIN role_configurations rc ON rc.id = u.role_id
WHERE u.is_active = 1
  AND (u.role_id IS NULL OR rc.id IS NULL)
ORDER BY u.id;
