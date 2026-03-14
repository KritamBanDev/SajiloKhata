'use strict';

const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

const getAll = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM Suppliers ORDER BY supplier_name ASC');
    res.apiSuccess({ message: 'Suppliers retrieved successfully.', data: rows });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM Suppliers WHERE supplier_id = ?', [req.params.id]);
    if (rows.length === 0) return next(new AppError('Supplier not found.', 404));
    res.apiSuccess({ message: 'Supplier retrieved successfully.', data: rows[0] });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { supplier_name, contact_number, address } = req.body;
    if (!supplier_name) return next(new AppError('supplier_name is required.', 400));
    const [result] = await db.query(
      'INSERT INTO Suppliers (supplier_name, contact_number, address) VALUES (?, ?, ?)',
      [supplier_name, contact_number || null, address || null]
    );
    res.apiSuccess({
      status: 201,
      message: 'Supplier created.',
      data: { supplier_id: result.insertId },
    });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const { supplier_name, contact_number, address } = req.body;
    const [existing] = await db.query('SELECT supplier_id FROM Suppliers WHERE supplier_id = ?', [req.params.id]);
    if (existing.length === 0) return next(new AppError('Supplier not found.', 404));
    await db.query(
      `UPDATE Suppliers SET
        supplier_name  = COALESCE(?, supplier_name),
        contact_number = COALESCE(?, contact_number),
        address        = COALESCE(?, address)
       WHERE supplier_id = ?`,
      [supplier_name || null, contact_number || null, address || null, req.params.id]
    );
    res.apiSuccess({ message: 'Supplier updated.' });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const [result] = await db.query('DELETE FROM Suppliers WHERE supplier_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return next(new AppError('Supplier not found.', 404));
    res.apiSuccess({ message: 'Supplier deleted.' });
  } catch (err) { next(err); }
};

module.exports = { getAll, getById, create, update, remove };
