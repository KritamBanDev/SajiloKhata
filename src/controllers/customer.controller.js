'use strict';

const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

const getAll = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM Customers ORDER BY customer_name ASC');
    res.apiSuccess({ message: 'Customers retrieved successfully.', data: rows });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM Customers WHERE customer_id = ?', [req.params.id]);
    if (rows.length === 0) return next(new AppError('Customer not found.', 404));
    res.apiSuccess({ message: 'Customer retrieved successfully.', data: rows[0] });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { customer_name, contact_number, address } = req.body;
    if (!customer_name) return next(new AppError('customer_name is required.', 400));
    const [result] = await db.query(
      'INSERT INTO Customers (customer_name, contact_number, address) VALUES (?, ?, ?)',
      [customer_name, contact_number || null, address || null]
    );
    res.apiSuccess({
      status: 201,
      message: 'Customer created.',
      data: { customer_id: result.insertId },
    });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const { customer_name, contact_number, address } = req.body;
    const [existing] = await db.query('SELECT customer_id FROM Customers WHERE customer_id = ?', [req.params.id]);
    if (existing.length === 0) return next(new AppError('Customer not found.', 404));
    await db.query(
      `UPDATE Customers SET
        customer_name  = COALESCE(?, customer_name),
        contact_number = COALESCE(?, contact_number),
        address        = COALESCE(?, address)
       WHERE customer_id = ?`,
      [customer_name || null, contact_number || null, address || null, req.params.id]
    );
    res.apiSuccess({ message: 'Customer updated.' });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const [result] = await db.query('DELETE FROM Customers WHERE customer_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return next(new AppError('Customer not found.', 404));
    res.apiSuccess({ message: 'Customer deleted.' });
  } catch (err) { next(err); }
};

module.exports = { getAll, getById, create, update, remove };
