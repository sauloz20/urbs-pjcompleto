-- Execute uma única vez se o banco URBS já foi criado com o esquema anterior.
-- Esta migração alinha categorias e estados com o formulário e o mapa da interface.

UPDATE categories SET name = 'Pavimentação' WHERE name = 'Buracos em vias públicas';
UPDATE categories SET name = 'Acessibilidade' WHERE name = 'Calçadas danificadas';
UPDATE categories SET name = 'Descarte irregular de resíduos' WHERE name = 'Descarte irregular de lixo';
UPDATE categories SET name = 'Sinalização' WHERE name = 'Sinalização danificada';
UPDATE categories SET name = 'Outro' WHERE name = 'Outros problemas';

INSERT IGNORE INTO categories (name, description) VALUES
  ('Drenagem', 'Bueiros, galerias pluviais e acúmulo de água.');

ALTER TABLE occurrences
  ADD COLUMN address VARCHAR(180) NOT NULL DEFAULT '' AFTER description,
  MODIFY COLUMN status ENUM('pending', 'in_analysis', 'in_progress', 'resolved', 'rejected') NOT NULL DEFAULT 'pending';

ALTER TABLE occurrence_history
  MODIFY COLUMN previous_status ENUM('pending', 'in_analysis', 'in_progress', 'resolved', 'rejected') NULL,
  MODIFY COLUMN new_status ENUM('pending', 'in_analysis', 'in_progress', 'resolved', 'rejected') NOT NULL;

ALTER TABLE users
  MODIFY COLUMN role ENUM('citizen', 'resolver', 'master') NOT NULL DEFAULT 'citizen';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS category_id INT NULL,
  ADD COLUMN IF NOT EXISTS company_name VARCHAR(150) NULL,
  ADD COLUMN IF NOT EXISTS cnpj VARCHAR(20) NULL;
