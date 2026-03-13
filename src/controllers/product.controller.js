'use strict';

const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

// GET /api/products
const getAllProducts = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM Products ORDER BY product_name ASC'
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// GET /api/products/:id
const getProductById = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM Products WHERE product_id = ?',
      [req.params.id]
    );
    if (rows.length === 0) return next(new AppError('Product not found.', 404));
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

// POST /api/products
const createProduct = async (req, res, next) => {
  try {
    const { product_name, description, unit_price, stock_quantity } = req.body;
    if (!product_name || unit_price === undefined) {
      return next(new AppError('product_name and unit_price are required.', 400));
    }
    if (isNaN(unit_price) || Number(unit_price) < 0) {
      return next(new AppError('unit_price must be a non-negative number.', 400));
    }

    const [result] = await db.query(
      'INSERT INTO Products (product_name, description, unit_price, stock_quantity) VALUES (?, ?, ?, ?)',
      [product_name, description || null, unit_price, stock_quantity || 0]
    );
    res.status(201).json({ success: true, message: 'Product created.', product_id: result.insertId });
  } catch (err) { next(err); }
};

// PUT /api/products/:id
const updateProduct = async (req, res, next) => {
  try {
    const { product_name, description, unit_price, stock_quantity } = req.body;
    const [existing] = await db.query('SELECT product_id FROM Products WHERE product_id = ?', [req.params.id]);
    if (existing.length === 0) return next(new AppError('Product not found.', 404));

    await db.query(
      `UPDATE Products SET
        product_name   = COALESCE(?, product_name),
        description    = COALESCE(?, description),
        unit_price     = COALESCE(?, unit_price),
        stock_quantity = COALESCE(?, stock_quantity)
       WHERE product_id = ?`,
      [product_name || null, description || null, unit_price ?? null, stock_quantity ?? null, req.params.id]
    );
    res.json({ success: true, message: 'Product updated.' });
  } catch (err) { next(err); }
};

// DELETE /api/products/:id
const deleteProduct = async (req, res, next) => {
  try {
    const [result] = await db.query('DELETE FROM Products WHERE product_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return next(new AppError('Product not found.', 404));
    res.json({ success: true, message: 'Product deleted.' });
  } catch (err) { next(err); }
};

module.exports = { getAllProducts, getProductById, createProduct, updateProduct, deleteProduct };
