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
    res.apiSuccess({ message: 'Baki records retrieved successfully.', data: rows });
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
    res.apiSuccess({ message: 'Baki status updated.' });
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
    res.apiSuccess({ message: 'Baki summary retrieved successfully.', data: rows });
  } catch (err) { next(err); }
};

// GET /api/baki/risk-profile
const getRiskProfile = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT
        bl.entity_id,
        c.customer_name AS entity_name,
        ROUND(SUM(bl.amount), 2) AS total_outstanding,
        MAX(DATEDIFF(CURDATE(), COALESCE(bl.due_date, DATE(bl.updated_at)))) AS max_age_days,
        COUNT(*) AS open_entries,
        ROUND((SUM(bl.amount) * 0.65) + (MAX(DATEDIFF(CURDATE(), COALESCE(bl.due_date, DATE(bl.updated_at)))) * 0.35), 2) AS risk_score
      FROM Baki_Ledger bl
      INNER JOIN Customers c ON bl.entity_id = c.customer_id
      WHERE bl.ledger_type = 'Customer_Debit'
        AND bl.status <> 'Paid'
      GROUP BY bl.entity_id, c.customer_name
      ORDER BY risk_score DESC, total_outstanding DESC
    `);
    res.apiSuccess({ message: 'Baki risk profile retrieved successfully.', data: rows });
  } catch (err) { next(err); }
};

// GET /api/baki/reminder/:id
const getReminderLink = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT
        bl.baki_id,
        bl.amount,
        bl.status,
        bl.due_date,
        c.customer_name,
        c.contact_number
      FROM Baki_Ledger bl
      INNER JOIN Customers c ON bl.entity_id = c.customer_id
      WHERE bl.baki_id = ? AND bl.ledger_type = 'Customer_Debit'
    `, [req.params.id]);

    if (!rows.length) return next(new AppError('Baki reminder target not found.', 404));

    const row = rows[0];
    const cleanedPhone = String(row.contact_number || '').replace(/[^0-9]/g, '');
    const phone = cleanedPhone.startsWith('977') ? cleanedPhone : `977${cleanedPhone}`;
    const dueText = row.due_date ? ` due on ${row.due_date}` : '';
    const reminderText = `Namaste ${row.customer_name}, this is a reminder for your pending baki of Rs. ${Number(row.amount).toFixed(2)}${dueText}. Please clear it at your earliest convenience. - SajiloKhata`;
    const encodedMessage = encodeURIComponent(reminderText);

    res.apiSuccess({
      message: 'Baki reminder links generated successfully.',
      data: {
        baki_id: row.baki_id,
        customer_name: row.customer_name,
        contact_number: row.contact_number,
        message: reminderText,
        whatsapp_url: `https://wa.me/${phone}?text=${encodedMessage}`,
        sms_url: `sms:${row.contact_number}?body=${encodedMessage}`,
      },
    });
  } catch (err) { next(err); }
};

module.exports = { getAll, updateStatus, getSummary, getRiskProfile, getReminderLink };
