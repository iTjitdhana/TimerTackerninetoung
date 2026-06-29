-- ROGANG RG001 process steps (test schedule 05:00-09:00)
START TRANSACTION;

DELETE FROM process_templates WHERE product_code = 'RG001' AND version = 1;
INSERT INTO process_templates (
  product_code, version, process_number, process_description, estimated_duration_minutes, notes, is_active
) VALUES
  ('RG001', 1, 1, 'เตรียมอุปกรณ์และวัตถุดิบ', 45, 'ทดสอบระบบ', 1),
  ('RG001', 1, 2, 'ประกอบอาหาร', 120, NULL, 1),
  ('RG001', 1, 3, 'แพ็ค', 45, NULL, 1),
  ('RG001', 1, 4, 'เก็บล้างอุปกรณ์และพื้นที่', 30, NULL, 1);

DELETE FROM process_steps WHERE job_code = 'RG001';
INSERT INTO process_steps (
  job_code, job_name, date_recorded, process_number, process_description, worker_count
) VALUES
  ('RG001', 'กุ้งผัดผงกระหรี่ + หมูปั้น + ข้าวสวย', CURDATE(), 1, 'เตรียมอุปกรณ์และวัตถุดิบ', 1),
  ('RG001', 'กุ้งผัดผงกระหรี่ + หมูปั้น + ข้าวสวย', CURDATE(), 2, 'ประกอบอาหาร', 1),
  ('RG001', 'กุ้งผัดผงกระหรี่ + หมูปั้น + ข้าวสวย', CURDATE(), 3, 'แพ็ค', 1),
  ('RG001', 'กุ้งผัดผงกระหรี่ + หมูปั้น + ข้าวสวย', CURDATE(), 4, 'เก็บล้างอุปกรณ์และพื้นที่', 1);

INSERT INTO product_active_versions (product_code, active_version, note)
VALUES ('RG001', 1, 'ทดสอบระบบ')
ON DUPLICATE KEY UPDATE
  active_version = VALUES(active_version),
  note = VALUES(note),
  updated_at = CURRENT_TIMESTAMP;

UPDATE work_plans
SET start_time = '05:00:00', end_time = '09:00:00', notes = 'ทดสอบระบบ', updated_at = CURRENT_TIMESTAMP
WHERE job_code = 'RG001' AND bu_id = 2;

COMMIT;
