-- Per-ingredient note on formula weighing (batch_material_usage.note)
-- Run against MNF_database411. Safe to re-run (checks column existence).

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'batch_material_usage'
    AND COLUMN_NAME = 'note'
);

SET @ddl := IF(
  @col_exists = 0,
  'ALTER TABLE batch_material_usage ADD COLUMN note VARCHAR(500) NULL AFTER unit_price',
  'SELECT ''batch_material_usage.note already exists'' AS info'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
