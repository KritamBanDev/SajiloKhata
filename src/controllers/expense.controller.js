'use strict';

const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

const ALLOWED_EXPENSE_CATEGORIES = ['Rent', 'Staff', 'Utilities', 'Transport', 'Maintenance', 'General'];

const getAll = async (req, res, next) => {
  try {
    const { from, to, category } = req.query;
    const params = [];
    let sql = 'SELECT * FROM Expenses WHERE 1=1';
    if (category) { sql += ' AND category = ?'; params.push(category); }
    if (from) { sql += ' AND expense_date >= ?'; params.push(from); }
    if (to)   { sql += ' AND expense_date <= ?'; params.push(to); }
    sql += ' ORDER BY expense_date DESC';
    const [rows] = await db.query(sql, params);
    res.apiSuccess({ message: 'Expenses retrieved successfully.', data: rows });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { description, amount, category, payment_method, reference_no, vendor_name, notes } = req.body;
    if (!description || amount === undefined) {
      return next(new AppError('description and amount are required.', 400));
    }
    if (isNaN(amount) || Number(amount) <= 0) {
      return next(new AppError('amount must be a positive number.', 400));
    }

    const resolvedCategory = category || 'General';
    if (!ALLOWED_EXPENSE_CATEGORIES.includes(resolvedCategory)) {
      return next(new AppError(`category must be one of: ${ALLOWED_EXPENSE_CATEGORIES.join(', ')}`, 400));
    }

    const [result] = await db.query(
      `INSERT INTO Expenses
       (description, category, amount, payment_method, reference_no, vendor_name, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        description,
        resolvedCategory,
        amount,
        payment_method || 'Cash',
        reference_no || null,
        vendor_name || null,
        notes || null,
        req.user?.user_id || null,
      ]
    );
    res.apiSuccess({
      status: 201,
      message: 'Expense recorded.',
      data: { expense_id: result.insertId },
    });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const [result] = await db.query('DELETE FROM Expenses WHERE expense_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return next(new AppError('Expense not found.', 404));
    res.apiSuccess({ message: 'Expense deleted.' });
  } catch (err) { next(err); }
};

module.exports = { getAll, create, remove };
