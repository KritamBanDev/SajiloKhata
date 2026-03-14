USE sajilokhata_db;

SELECT COUNT(*) AS roles_total FROM Roles;
SELECT COUNT(*) AS users_with_role FROM Users WHERE role_id IS NOT NULL;
SHOW COLUMNS FROM Products;
SHOW COLUMNS FROM Expenses;
SHOW TABLES LIKE 'Transaction_Items';
SHOW TABLES LIKE 'Audit_Logs';
SHOW TABLES LIKE 'Transaction_Audit';
SHOW TRIGGERS LIKE 'Transactions';
