-- ============================================================
-- SajiloKhata Database Schema
-- Run: mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS sajilokhata_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sajilokhata_db;

-- -----------------------------------------------
-- Core Tables
-- -----------------------------------------------

CREATE TABLE IF NOT EXISTS Users (
  user_id       INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Products (
  product_id     INT AUTO_INCREMENT PRIMARY KEY,
  product_name   VARCHAR(100)   NOT NULL,
  description    TEXT,
  unit_price     DECIMAL(10,2)  NOT NULL,
  stock_quantity INT            DEFAULT 0,
  last_updated   TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Customers (
  customer_id    INT AUTO_INCREMENT PRIMARY KEY,
  customer_name  VARCHAR(100) NOT NULL,
  contact_number VARCHAR(15),
  address        VARCHAR(255),
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Suppliers (
  supplier_id    INT AUTO_INCREMENT PRIMARY KEY,
  supplier_name  VARCHAR(100) NOT NULL,
  contact_number VARCHAR(15),
  address        VARCHAR(255),
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Transactions (
  transaction_id   INT AUTO_INCREMENT PRIMARY KEY,
  transaction_type ENUM('Sale','Purchase') NOT NULL,
  payment_type     ENUM('Cash','Baki')     NOT NULL,
  total_amount     DECIMAL(10,2)           NOT NULL,
  reference_id     INT,                              -- Customer_id (Sale) | Supplier_id (Purchase)
  transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Expenses (
  expense_id   INT AUTO_INCREMENT PRIMARY KEY,
  description  VARCHAR(255)  NOT NULL,
  amount       DECIMAL(10,2) NOT NULL,
  expense_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Baki_Ledger (
  baki_id      INT AUTO_INCREMENT PRIMARY KEY,
  ledger_type  ENUM('Customer_Debit','Supplier_Credit') NOT NULL,
  entity_id    INT           NOT NULL,               -- Customer_id or Supplier_id
  transaction_id INT,
  amount       DECIMAL(10,2) NOT NULL,
  status       ENUM('Unpaid','Paid','Partially Paid') DEFAULT 'Unpaid',
  due_date     DATE,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ContactInquiries (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100)  NOT NULL,
  email      VARCHAR(150)  NOT NULL,
  message    TEXT          NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -----------------------------------------------
-- Foreign Keys
-- -----------------------------------------------

ALTER TABLE Baki_Ledger
  ADD CONSTRAINT fk_baki_transaction
    FOREIGN KEY (transaction_id)
    REFERENCES Transactions(transaction_id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;

-- -----------------------------------------------
-- Performance Indexes
-- -----------------------------------------------

CREATE INDEX idx_tx_type_date    ON Transactions (transaction_type, transaction_date);
CREATE INDEX idx_tx_payment      ON Transactions (payment_type);
CREATE INDEX idx_baki_entity     ON Baki_Ledger  (ledger_type, entity_id);
CREATE INDEX idx_baki_status     ON Baki_Ledger  (status);

-- -----------------------------------------------
-- Enterprise Extensions (RBAC, Audit, BI)
-- -----------------------------------------------

CREATE TABLE IF NOT EXISTS Roles (
  role_id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(30) NOT NULL UNIQUE,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO Roles (role_name, description)
VALUES
  ('Admin', 'Full access to all modules'),
  ('Staff', 'Transaction entry only')
ON DUPLICATE KEY UPDATE description = VALUES(description);

ALTER TABLE Users
  ADD COLUMN IF NOT EXISTS role_id TINYINT UNSIGNED NULL AFTER password_hash,
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(120) NULL AFTER username,
  ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER role_id,
  ADD COLUMN IF NOT EXISTS last_login_at DATETIME NULL AFTER is_active,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

UPDATE Users u
JOIN Roles r ON r.role_name = 'Admin'
SET u.role_id = COALESCE(u.role_id, r.role_id);

ALTER TABLE Users
  MODIFY COLUMN role_id TINYINT UNSIGNED NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_role_id ON Users(role_id);

SET @fk_users_role_exists = (
  SELECT COUNT(*)
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME = 'fk_users_role'
);

SET @sql_users_role_fk = IF(
  @fk_users_role_exists = 0,
  'ALTER TABLE Users ADD CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES Roles(role_id) ON UPDATE RESTRICT ON DELETE RESTRICT',
  'SELECT 1'
);

PREPARE stmt_users_role_fk FROM @sql_users_role_fk;
EXECUTE stmt_users_role_fk;
DEALLOCATE PREPARE stmt_users_role_fk;

ALTER TABLE Products
  ADD COLUMN IF NOT EXISTS unit_label ENUM('Dharni','Muri','Kilo','Packet','Boras','Unit') NOT NULL DEFAULT 'Unit' AFTER unit_price,
  ADD COLUMN IF NOT EXISTS low_stock_threshold INT NOT NULL DEFAULT 10 AFTER stock_quantity;

CREATE TABLE IF NOT EXISTS Transaction_Items (
  item_id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  line_total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tx_items_transaction (transaction_id),
  INDEX idx_tx_items_product (product_id),
  CONSTRAINT fk_tx_items_transaction FOREIGN KEY (transaction_id) REFERENCES Transactions(transaction_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_tx_items_product FOREIGN KEY (product_id) REFERENCES Products(product_id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

ALTER TABLE Expenses
  ADD COLUMN IF NOT EXISTS category VARCHAR(50) NOT NULL DEFAULT 'General' AFTER description,
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30) NOT NULL DEFAULT 'Cash' AFTER amount,
  ADD COLUMN IF NOT EXISTS reference_no VARCHAR(80) NULL AFTER payment_method,
  ADD COLUMN IF NOT EXISTS vendor_name VARCHAR(120) NULL AFTER reference_no,
  ADD COLUMN IF NOT EXISTS notes TEXT NULL AFTER vendor_name,
  ADD COLUMN IF NOT EXISTS created_by INT NULL AFTER notes,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER expense_date;

CREATE INDEX IF NOT EXISTS idx_expenses_date_category ON Expenses(expense_date, category);

SET @fk_expense_user_exists = (
  SELECT COUNT(*)
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME = 'fk_expenses_created_by_user'
);

SET @sql_expense_user_fk = IF(
  @fk_expense_user_exists = 0,
  'ALTER TABLE Expenses ADD CONSTRAINT fk_expenses_created_by_user FOREIGN KEY (created_by) REFERENCES Users(user_id) ON UPDATE CASCADE ON DELETE SET NULL',
  'SELECT 1'
);

PREPARE stmt_expense_user_fk FROM @sql_expense_user_fk;
EXECUTE stmt_expense_user_fk;
DEALLOCATE PREPARE stmt_expense_user_fk;

CREATE TABLE IF NOT EXISTS Audit_Logs (
  audit_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_user_id INT NULL,
  entity_name VARCHAR(50) NOT NULL,
  entity_id BIGINT NULL,
  action_type ENUM('CREATE','UPDATE','DELETE','LOGIN','LOGOUT') NOT NULL,
  before_data JSON NULL,
  after_data JSON NULL,
  source_ip VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_entity (entity_name, entity_id),
  INDEX idx_audit_actor_time (actor_user_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Transaction_Audit (
  tx_audit_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  transaction_id INT NOT NULL,
  actor_user_id INT NULL,
  action_type ENUM('UPDATE','DELETE') NOT NULL,
  old_row JSON NOT NULL,
  new_row JSON NULL,
  action_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tx_audit_tx (transaction_id, action_at),
  INDEX idx_tx_audit_actor (actor_user_id, action_at)
) ENGINE=InnoDB;

DROP TRIGGER IF EXISTS trg_transactions_before_update_audit;
DROP TRIGGER IF EXISTS trg_transactions_before_delete_audit;

DELIMITER $$

CREATE TRIGGER trg_transactions_before_update_audit
BEFORE UPDATE ON Transactions
FOR EACH ROW
BEGIN
  INSERT INTO Transaction_Audit (
    transaction_id,
    actor_user_id,
    action_type,
    old_row,
    new_row
  ) VALUES (
    OLD.transaction_id,
    @app_user_id,
    'UPDATE',
    JSON_OBJECT(
      'transaction_id', OLD.transaction_id,
      'transaction_type', OLD.transaction_type,
      'payment_type', OLD.payment_type,
      'total_amount', OLD.total_amount,
      'reference_id', OLD.reference_id,
      'transaction_date', OLD.transaction_date
    ),
    JSON_OBJECT(
      'transaction_id', NEW.transaction_id,
      'transaction_type', NEW.transaction_type,
      'payment_type', NEW.payment_type,
      'total_amount', NEW.total_amount,
      'reference_id', NEW.reference_id,
      'transaction_date', NEW.transaction_date
    )
  );
END$$

CREATE TRIGGER trg_transactions_before_delete_audit
BEFORE DELETE ON Transactions
FOR EACH ROW
BEGIN
  INSERT INTO Transaction_Audit (
    transaction_id,
    actor_user_id,
    action_type,
    old_row,
    new_row
  ) VALUES (
    OLD.transaction_id,
    @app_user_id,
    'DELETE',
    JSON_OBJECT(
      'transaction_id', OLD.transaction_id,
      'transaction_type', OLD.transaction_type,
      'payment_type', OLD.payment_type,
      'total_amount', OLD.total_amount,
      'reference_id', OLD.reference_id,
      'transaction_date', OLD.transaction_date
    ),
    NULL
  );
END$$

DELIMITER ;
