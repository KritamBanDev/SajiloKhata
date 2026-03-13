'use strict';

const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

/**
 * POST /api/transactions
 * Body: {
 *   transaction_type: 'Sale' | 'Purchase',
 *   payment_type:     'Cash' | 'Baki',
 *   reference_id:     customer_id (Sale) | supplier_id (Purchase),
 *   items: [{ product_id, quantity, unit_price }],
 *   due_date?: 'YYYY-MM-DD'  (required when payment_type = 'Baki')
 * }
 *
 * State machine:
 *  Sale    -> reduce stock  -> record Transaction -> if Baki: insert Baki_Ledger (Customer_Debit)
 *  Purchase-> increase stock-> record Transaction -> if Baki: insert Baki_Ledger (Supplier_Credit)
 *  All done atomically inside a single DB transaction.
 */
const createTransaction = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { transaction_type, payment_type, reference_id, items, due_date } = req.body;

    // ── Validation ─────────────────────────────────────────────
    if (!['Sale', 'Purchase'].includes(transaction_type)) {
      return next(new AppError('transaction_type must be Sale or Purchase.', 400));
    }
    if (!['Cash', 'Baki'].includes(payment_type)) {
      return next(new AppError('payment_type must be Cash or Baki.', 400));
    }
    if (!reference_id) {
      return next(new AppError('reference_id (customer/supplier id) is required.', 400));
    }
    if (!Array.isArray(items) || items.length === 0) {
      return next(new AppError('items array is required and cannot be empty.', 400));
    }
    if (payment_type === 'Baki' && !due_date) {
      return next(new AppError('due_date is required for Baki transactions.', 400));
    }

    // ── Validate reference entity exists ───────────────────────
    if (transaction_type === 'Sale') {
      const [cust] = await conn.query('SELECT customer_id FROM Customers WHERE customer_id = ?', [reference_id]);
      if (cust.length === 0) return next(new AppError('Customer not found.', 404));
    } else {
      const [supp] = await conn.query('SELECT supplier_id FROM Suppliers WHERE supplier_id = ?', [reference_id]);
      if (supp.length === 0) return next(new AppError('Supplier not found.', 404));
    }

    // ── Process each line item ─────────────────────────────────
    let total_amount = 0;

    for (const item of items) {
      const { product_id, quantity, unit_price } = item;
      if (!product_id || !quantity || quantity <= 0) {
        await conn.rollback();
        return next(new AppError('Each item must have a valid product_id and positive quantity.', 400));
      }

      const [prod] = await conn.query(
        'SELECT product_id, stock_quantity, unit_price FROM Products WHERE product_id = ? FOR UPDATE',
        [product_id]
      );
      if (prod.length === 0) {
        await conn.rollback();
        return next(new AppError(`Product ID ${product_id} not found.`, 404));
      }

      const product      = prod[0];
      const effectivePrice = unit_price ?? product.unit_price;

      if (transaction_type === 'Sale') {
        if (product.stock_quantity < quantity) {
          await conn.rollback();
          return next(new AppError(
            `Insufficient stock for product ID ${product_id}. Available: ${product.stock_quantity}.`, 400
          ));
        }
        await conn.query(
          'UPDATE Products SET stock_quantity = stock_quantity - ? WHERE product_id = ?',
          [quantity, product_id]
        );
      } else {
        await conn.query(
          'UPDATE Products SET stock_quantity = stock_quantity + ? WHERE product_id = ?',
          [quantity, product_id]
        );
      }

      total_amount += effectivePrice * quantity;
    }

    // ── Insert Transaction record ──────────────────────────────
    const [txResult] = await conn.query(
      'INSERT INTO Transactions (transaction_type, payment_type, total_amount, reference_id) VALUES (?, ?, ?, ?)',
      [transaction_type, payment_type, total_amount, reference_id]
    );
    const transaction_id = txResult.insertId;

    // ── If Baki: record in ledger ──────────────────────────────
    if (payment_type === 'Baki') {
      const ledger_type = transaction_type === 'Sale' ? 'Customer_Debit' : 'Supplier_Credit';
      await conn.query(
        'INSERT INTO Baki_Ledger (ledger_type, entity_id, transaction_id, amount, due_date) VALUES (?, ?, ?, ?, ?)',
        [ledger_type, reference_id, transaction_id, total_amount, due_date]
      );
    }

    await conn.commit();
    res.status(201).json({
      success: true,
      message: `${transaction_type} recorded successfully.`,
      transaction_id,
      total_amount,
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// GET /api/transactions
const getAllTransactions = async (req, res, next) => {
  try {
    const { type, payment, from, to, limit = 50, offset = 0 } = req.query;
    const params = [];
    let sql = 'SELECT * FROM Transactions WHERE 1=1';

    if (type)    { sql += ' AND transaction_type = ?'; params.push(type); }
    if (payment) { sql += ' AND payment_type = ?';     params.push(payment); }
    if (from)    { sql += ' AND transaction_date >= ?'; params.push(from); }
    if (to)      { sql += ' AND transaction_date <= ?'; params.push(to); }

    sql += ' ORDER BY transaction_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// GET /api/transactions/:id
const getTransactionById = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM Transactions WHERE transaction_id = ?', [req.params.id]);
    if (rows.length === 0) return next(new AppError('Transaction not found.', 404));
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

module.exports = { createTransaction, getAllTransactions, getTransactionById };
