-- URBS — esquema inicial para MySQL / MariaDB.
-- Importe este arquivo uma vez no phpMyAdmin antes de abrir a aplicação.

CREATE DATABASE IF NOT EXISTS urbs
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE urbs;

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO categories (name, description) VALUES
  ('Pavimentação', 'Buracos, danos e desníveis no pavimento.'),
  ('Iluminação pública', 'Postes apagados, lâmpadas defeituosas e problemas de iluminação.'),
  ('Acessibilidade', 'Calçadas, rampas e travessias acessíveis.'),
  ('Descarte irregular de resíduos', 'Descarte inadequado de lixo, entulho ou móveis.'),
  ('Drenagem', 'Bueiros, galerias pluviais e acúmulo de água.'),
  ('Sinalização', 'Placas, faixas e semáforos danificados ou ausentes.'),
  ('Outro', 'Outros problemas relacionados à infraestrutura urbana.');

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('citizen', 'resolver', 'master') NOT NULL DEFAULT 'citizen',
  category_id INT NULL,
  company_name VARCHAR(150) NULL,
  cnpj VARCHAR(20) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_category FOREIGN KEY (category_id)
    REFERENCES categories(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS occurrences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  category_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  address VARCHAR(180) NOT NULL DEFAULT '',
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  status ENUM('pending', 'in_analysis', 'in_progress', 'resolved', 'rejected') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_occurrences_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_occurrences_category FOREIGN KEY (category_id)
    REFERENCES categories(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_occurrences_user (user_id),
  INDEX idx_occurrences_category (category_id),
  INDEX idx_occurrences_status (status),
  INDEX idx_occurrences_location (latitude, longitude),
  INDEX idx_occurrences_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS occurrence_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  occurrence_id INT NOT NULL,
  user_id INT NOT NULL,
  previous_status ENUM('pending', 'in_analysis', 'in_progress', 'resolved', 'rejected') NULL,
  new_status ENUM('pending', 'in_analysis', 'in_progress', 'resolved', 'rejected') NOT NULL,
  comment VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_history_occurrence FOREIGN KEY (occurrence_id)
    REFERENCES occurrences(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_history_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_history_occurrence (occurrence_id),
  INDEX idx_history_user (user_id),
  INDEX idx_history_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS partner_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  category_id INT NOT NULL,
  company_name VARCHAR(150) NOT NULL,
  cnpj VARCHAR(20) NOT NULL,
  justification TEXT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_partner_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_partner_category FOREIGN KEY (category_id)
    REFERENCES categories(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
