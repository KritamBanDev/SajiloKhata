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
