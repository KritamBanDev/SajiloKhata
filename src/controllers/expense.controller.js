'use strict';

const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

const getAll = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const params = [];
    let sql = 'SELECT * FROM Expenses WHERE 1=1';
    if (from) { sql += ' AND expense_date >= ?'; params.push(from); }
    if (to)   { sql += ' AND expense_date <= ?'; params.push(to); }
    sql += ' ORDER BY expense_date DESC';
    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { description, amount } = req.body;
    if (!description || amount === undefined) {
      return next(new AppError('description and amount are required.', 400));
    }
    if (isNaN(amount) || Number(amount) <= 0) {
      return next(new AppError('amount must be a positive number.', 400));
    }
    const [result] = await db.query(
      'INSERT INTO Expenses (description, amount) VALUES (?, ?)',
      [description, amount]
    );
    res.status(201).json({ success: true, message: 'Expense recorded.', expense_id: result.insertId });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const [result] = await db.query('DELETE FROM Expenses WHERE expense_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return next(new AppError('Expense not found.', 404));
    res.json({ success: true, message: 'Expense deleted.' });
  } catch (err) { next(err); }
};

module.exports = { getAll, create, remove };
