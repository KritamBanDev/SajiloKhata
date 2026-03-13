'use strict';

const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

// GET /api/baki  (filter by ledger_type and/or status)
const getAll = async (req, res, next) => {
  try {
    const { type, status, entity_id } = req.query;
    const params = [];
    let sql = `
      SELECT bl.*,
             CASE bl.ledger_type
               WHEN 'Customer_Debit'  THEN c.customer_name
               WHEN 'Supplier_Credit' THEN s.supplier_name
             END AS entity_name
      FROM Baki_Ledger bl
      LEFT JOIN Customers c ON bl.ledger_type = 'Customer_Debit'  AND bl.entity_id = c.customer_id
      LEFT JOIN Suppliers s ON bl.ledger_type = 'Supplier_Credit' AND bl.entity_id = s.supplier_id
      WHERE 1=1
    `;
    if (type)      { sql += ' AND bl.ledger_type = ?'; params.push(type); }
    if (status)    { sql += ' AND bl.status = ?';      params.push(status); }
    if (entity_id) { sql += ' AND bl.entity_id = ?';   params.push(entity_id); }
    sql += ' ORDER BY bl.updated_at DESC';

    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// PATCH /api/baki/:id  — update payment status
const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['Unpaid', 'Paid', 'Partially Paid'].includes(status)) {
      return next(new AppError('status must be Unpaid, Paid, or Partially Paid.', 400));
    }
    const [existing] = await db.query('SELECT baki_id FROM Baki_Ledger WHERE baki_id = ?', [req.params.id]);
    if (existing.length === 0) return next(new AppError('Baki record not found.', 404));

    await db.query('UPDATE Baki_Ledger SET status = ? WHERE baki_id = ?', [status, req.params.id]);
    res.json({ success: true, message: 'Baki status updated.' });
  } catch (err) { next(err); }
};

// GET /api/baki/summary  — total outstanding by entity
const getSummary = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT
        bl.ledger_type,
        bl.entity_id,
        CASE bl.ledger_type
          WHEN 'Customer_Debit'  THEN c.customer_name
          WHEN 'Supplier_Credit' THEN s.supplier_name
        END AS entity_name,
        SUM(bl.amount) AS total_outstanding
      FROM Baki_Ledger bl
      LEFT JOIN Customers c ON bl.ledger_type = 'Customer_Debit'  AND bl.entity_id = c.customer_id
      LEFT JOIN Suppliers s ON bl.ledger_type = 'Supplier_Credit' AND bl.entity_id = s.supplier_id
      WHERE bl.status != 'Paid'
      GROUP BY bl.ledger_type, bl.entity_id, entity_name
      ORDER BY total_outstanding DESC
    `);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

module.exports = { getAll, updateStatus, getSummary };
