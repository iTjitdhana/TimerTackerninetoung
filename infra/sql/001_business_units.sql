-- Phase 1: Business Units (BNL + ROGANG placeholder)
-- Run against MNF_database411. Safe to re-run partial steps manually if needed.

START TRANSACTION;

-- 1. business_units master
CREATE TABLE IF NOT EXISTS business_units (
  id INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_bu_code (code),
  KEY idx_bu_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO business_units (id, code, name, is_active)
VALUES
  (1, 'BNL', 'BNL', 1),
  (2, 'ROGANG', 'โรงแกง', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  is_active = VALUES(is_active);

-- 2. work_plans.bu_id
SET @has_wp_bu := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'work_plans'
    AND COLUMN_NAME = 'bu_id'
);

SET @sql_wp_bu := IF(
  @has_wp_bu = 0,
  'ALTER TABLE work_plans ADD COLUMN bu_id INT NOT NULL DEFAULT 1 AFTER production_room_id',
  'SELECT 1'
);
PREPARE stmt_wp_bu FROM @sql_wp_bu;
EXECUTE stmt_wp_bu;
DEALLOCATE PREPARE stmt_wp_bu;

UPDATE work_plans SET bu_id = 1 WHERE bu_id IS NULL OR bu_id = 0;

SET @has_wp_fk := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'work_plans'
    AND CONSTRAINT_NAME = 'work_plans_ibfk_bu'
);

SET @sql_wp_fk := IF(
  @has_wp_fk = 0,
  'ALTER TABLE work_plans ADD CONSTRAINT work_plans_ibfk_bu FOREIGN KEY (bu_id) REFERENCES business_units(id) ON UPDATE NO ACTION',
  'SELECT 1'
);
PREPARE stmt_wp_fk FROM @sql_wp_fk;
EXECUTE stmt_wp_fk;
DEALLOCATE PREPARE stmt_wp_fk;

SET @has_wp_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'work_plans'
    AND INDEX_NAME = 'idx_work_plans_date_bu'
);

SET @sql_wp_idx := IF(
  @has_wp_idx = 0,
  'CREATE INDEX idx_work_plans_date_bu ON work_plans (production_date, bu_id)',
  'SELECT 1'
);
PREPARE stmt_wp_idx FROM @sql_wp_idx;
EXECUTE stmt_wp_idx;
DEALLOCATE PREPARE stmt_wp_idx;

-- 3. production_costs.bu_id + unique constraint
SET @has_pc_bu := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'production_costs'
    AND COLUMN_NAME = 'bu_id'
);

SET @sql_pc_bu := IF(
  @has_pc_bu = 0,
  'ALTER TABLE production_costs ADD COLUMN bu_id INT NULL AFTER work_plan_id',
  'SELECT 1'
);
PREPARE stmt_pc_bu FROM @sql_pc_bu;
EXECUTE stmt_pc_bu;
DEALLOCATE PREPARE stmt_pc_bu;

UPDATE production_costs pc
INNER JOIN work_plans wp ON pc.work_plan_id = wp.id
SET pc.bu_id = wp.bu_id
WHERE pc.bu_id IS NULL;

UPDATE production_costs SET bu_id = 1 WHERE bu_id IS NULL;

SET @has_old_uniq := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'production_costs'
    AND INDEX_NAME = 'uniq_cost_by_job_date'
);

SET @sql_drop_uniq := IF(
  @has_old_uniq > 0,
  'ALTER TABLE production_costs DROP INDEX uniq_cost_by_job_date',
  'SELECT 1'
);
PREPARE stmt_drop_uniq FROM @sql_drop_uniq;
EXECUTE stmt_drop_uniq;
DEALLOCATE PREPARE stmt_drop_uniq;

SET @has_new_uniq := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'production_costs'
    AND INDEX_NAME = 'uniq_cost_by_job_date_bu'
);

SET @sql_new_uniq := IF(
  @has_new_uniq = 0,
  'ALTER TABLE production_costs ADD UNIQUE KEY uniq_cost_by_job_date_bu (production_date, job_code, bu_id)',
  'SELECT 1'
);
PREPARE stmt_new_uniq FROM @sql_new_uniq;
EXECUTE stmt_new_uniq;
DEALLOCATE PREPARE stmt_new_uniq;

SET @has_pc_fk := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'production_costs'
    AND CONSTRAINT_NAME = 'production_costs_ibfk_bu'
);

SET @sql_pc_fk := IF(
  @has_pc_fk = 0,
  'ALTER TABLE production_costs ADD CONSTRAINT production_costs_ibfk_bu FOREIGN KEY (bu_id) REFERENCES business_units(id) ON UPDATE NO ACTION',
  'SELECT 1'
);
PREPARE stmt_pc_fk FROM @sql_pc_fk;
EXECUTE stmt_pc_fk;
DEALLOCATE PREPARE stmt_pc_fk;

COMMIT;
