-- Phase 2: ROGANG menu RG001
START TRANSACTION;

INSERT INTO material (Mat_Id, Mat_Name, Mat_Unit, price) VALUES
  ('RG101', 'ไข่เป็ด', 'ฟอง', 0.00),
  ('RG103', 'ต้นหอม', 'กรัม', 0.00),
  ('RG104', 'พริกชี้ฟ้าแดง', 'กรัม', 0.00),
  ('RG105', 'หมูปั้นก้อนนึ่ง 20 ชิ้น', 'ชิ้น', 0.00),
  ('RG106', 'กุ้ง', 'กก.', 0.00),
  ('RG107', 'ซอสผัดผงกระหรี่ 142 กรัม', 'แพ็ค', 0.00),
  ('RG108', 'ข้าวสวย(หุงแล้ว) 200 กรัม', 'กก.', 0.00)
ON DUPLICATE KEY UPDATE
  Mat_Name = VALUES(Mat_Name),
  Mat_Unit = VALUES(Mat_Unit);

INSERT INTO materials (material_code, material_name, unit, price) VALUES
  ('RG101', 'ไข่เป็ด', 'ฟอง', 0.00),
  ('RG103', 'ต้นหอม', 'กรัม', 0.00),
  ('RG104', 'พริกชี้ฟ้าแดง', 'กรัม', 0.00),
  ('RG105', 'หมูปั้นก้อนนึ่ง 20 ชิ้น', 'ชิ้น', 0.00),
  ('RG106', 'กุ้ง', 'กก.', 0.00),
  ('RG107', 'ซอสผัดผงกระหรี่ 142 กรัม', 'แพ็ค', 0.00),
  ('RG108', 'ข้าวสวย(หุงแล้ว) 200 กรัม', 'กก.', 0.00)
ON DUPLICATE KEY UPDATE
  material_name = VALUES(material_name),
  unit = VALUES(unit);

INSERT INTO fg (
  FG_Code, FG_Name, FG_Unit, FG_Size, base_unit, conversion_rate, conversion_description
) VALUES (
  'RG001',
  'กุ้งผัดผงกระหรี่ + หมูปั้น + ข้าวสวย',
  'กล่อง',
  '420 กรัม/กล่อง',
  'กก.',
  0.4200,
  '1 กล่อง = 0.42 กก. (420 กรัม)'
)
ON DUPLICATE KEY UPDATE
  FG_Name = VALUES(FG_Name),
  updated_at = CURRENT_TIMESTAMP;

DELETE FROM fg_bom WHERE FG_Code = 'RG001';

INSERT INTO fg_bom (FG_Code, Raw_Code, Raw_Qty, Raw_Unit) VALUES
  ('RG001', 'RG101', 54, 'ฟอง'),
  ('RG001', 'RG103', 200, 'กรัม'),
  ('RG001', 'RG104', 80, 'กรัม'),
  ('RG001', 'RG106', 1, 'กก.'),
  ('RG001', 'RG107', 18, 'แพ็ค'),
  ('RG001', 'RG105', 36, 'ชิ้น'),
  ('RG001', 'RG108', 7.2, 'กก.');

INSERT INTO products (product_code, product_name, product_type, unit, is_active) VALUES
  ('RG001', 'กุ้งผัดผงกระหรี่ + หมูปั้น + ข้าวสวย', 'FG', 'กล่อง', 1)
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO unit_conversions (
  from_unit, to_unit, conversion_rate, description, material_name, material_code
) VALUES
  (
    'ฟอง', 'กก.', 0.0700,
    '1 ฟอง = 0.07 กก. (70 กรัม)',
    'ไข่เป็ด', 'RG101'
  ),
  (
    'แพ็ค', 'กก.', 0.1420,
    '1 แพ็ค = 0.142 กก. (142 กรัม)',
    'ซอสผัดผงกระหรี่ 142 กรัม', 'RG107'
  ),
  (
    'ชิ้น', 'กก.', 0.0400,
    '1 ชิ้น = 0.04 กก. (40 กรัม)',
    'หมูปั้นก้อนนึ่ง 20 ชิ้น', 'RG105'
  )
ON DUPLICATE KEY UPDATE
  conversion_rate = VALUES(conversion_rate),
  description = VALUES(description),
  material_name = VALUES(material_name),
  updated_at = CURRENT_TIMESTAMP;

UPDATE work_plans
SET job_name = 'กุ้งผัดผงกระหรี่ + หมูปั้น + ข้าวสวย', updated_at = CURRENT_TIMESTAMP
WHERE job_code = 'RG001' AND bu_id = 2;

COMMIT;
