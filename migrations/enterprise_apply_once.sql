USE sajilokhata_db;

CREATE TABLE IF NOT EXISTS Roles (
  role_id TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(30) NOT NULL UNIQUE,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO Roles (role_name, description)
VALUES ('Admin', 'Full access to all modules'), ('Staff', 'Transaction entry only')
ON DUPLICATE KEY UPDATE description = VALUES(description);

ALTER TABLE Users
  ADD COLUMN role_id TINYINT UNSIGNED NULL,
  ADD COLUMN full_name VARCHAR(120) NULL,
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN last_login_at DATETIME NULL,
  ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

UPDATE Users u
JOIN Roles r ON r.role_name = 'Admin'
SET u.role_id = COALESCE(u.role_id, r.role_id);

ALTER TABLE Users MODIFY COLUMN role_id TINYINT UNSIGNED NOT NULL;
ALTER TABLE Users ADD CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES Roles(role_id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE Products
  ADD COLUMN unit_label ENUM('Dharni','Muri','Kilo','Packet','Boras','Unit') NOT NULL DEFAULT 'Unit',
  ADD COLUMN low_stock_threshold INT NOT NULL DEFAULT 10;

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
  ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT 'General',
  ADD COLUMN payment_method VARCHAR(30) NOT NULL DEFAULT 'Cash',
  ADD COLUMN reference_no VARCHAR(80) NULL,
  ADD COLUMN vendor_name VARCHAR(120) NULL,
  ADD COLUMN notes TEXT NULL,
  ADD COLUMN created_by INT NULL,
  ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

CREATE INDEX idx_expenses_date_category ON Expenses(expense_date, category);
ALTER TABLE Expenses ADD CONSTRAINT fk_expenses_created_by_user FOREIGN KEY (created_by) REFERENCES Users(user_id) ON UPDATE CASCADE ON DELETE SET NULL;

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
  INSERT INTO Transaction_Audit (transaction_id, actor_user_id, action_type, old_row, new_row)
  VALUES (
    OLD.transaction_id,
    @app_user_id,
    'UPDATE',
    JSON_OBJECT('transaction_id', OLD.transaction_id, 'transaction_type', OLD.transaction_type, 'payment_type', OLD.payment_type, 'total_amount', OLD.total_amount, 'reference_id', OLD.reference_id, 'transaction_date', OLD.transaction_date),
    JSON_OBJECT('transaction_id', NEW.transaction_id, 'transaction_type', NEW.transaction_type, 'payment_type', NEW.payment_type, 'total_amount', NEW.total_amount, 'reference_id', NEW.reference_id, 'transaction_date', NEW.transaction_date)
  );
END$$

CREATE TRIGGER trg_transactions_before_delete_audit
BEFORE DELETE ON Transactions
FOR EACH ROW
BEGIN
  INSERT INTO Transaction_Audit (transaction_id, actor_user_id, action_type, old_row, new_row)
  VALUES (
    OLD.transaction_id,
    @app_user_id,
    'DELETE',
    JSON_OBJECT('transaction_id', OLD.transaction_id, 'transaction_type', OLD.transaction_type, 'payment_type', OLD.payment_type, 'total_amount', OLD.total_amount, 'reference_id', OLD.reference_id, 'transaction_date', OLD.transaction_date),
    NULL
  );
END$$
DELIMITER ;
