'use strict';

const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { streamTransactionInvoicePdf } = require('../services/pdfInvoice.service');

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
    await conn.query('SET @app_user_id = ?', [req.user?.user_id || null]);

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
    const normalizedItems = [];

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
      normalizedItems.push({
        product_id,
        quantity,
        unit_price: Number(effectivePrice),
        line_total: Number((effectivePrice * quantity).toFixed(2)),
      });
    }

    // ── Insert Transaction record ──────────────────────────────
    const [txResult] = await conn.query(
      'INSERT INTO Transactions (transaction_type, payment_type, total_amount, reference_id) VALUES (?, ?, ?, ?)',
      [transaction_type, payment_type, total_amount, reference_id]
    );
    const transaction_id = txResult.insertId;

    for (const line of normalizedItems) {
      await conn.query(
        `INSERT INTO Transaction_Items
         (transaction_id, product_id, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?)`,
        [transaction_id, line.product_id, line.quantity, line.unit_price, line.line_total]
      );
    }

    // ── If Baki: record in ledger ──────────────────────────────
    if (payment_type === 'Baki') {
      const ledger_type = transaction_type === 'Sale' ? 'Customer_Debit' : 'Supplier_Credit';
      await conn.query(
        'INSERT INTO Baki_Ledger (ledger_type, entity_id, transaction_id, amount, due_date) VALUES (?, ?, ?, ?, ?)',
        [ledger_type, reference_id, transaction_id, total_amount, due_date]
      );
    }

    await conn.commit();

    // Best-effort generic audit log (table may not yet exist on old deployments)
    try {
      await db.query(
        `INSERT INTO Audit_Logs (actor_user_id, entity_name, entity_id, action_type, after_data)
         VALUES (?, 'Transactions', ?, 'CREATE', JSON_OBJECT('total_amount', ?, 'payment_type', ?, 'transaction_type', ?))`,
        [req.user?.user_id || null, transaction_id, total_amount, payment_type, transaction_type]
      );
    } catch (_) {
      // Ignore if audit table is not available in an older database snapshot.
    }

    res.apiSuccess({
      status: 201,
      message: `${transaction_type} recorded successfully.`,
      data: {
        transaction_id,
        total_amount,
      },
    });
  } catch (err) {
    await conn.rollback();
    if (err && (err.code === 'ER_NO_SUCH_TABLE' || err.errno === 1146)) {
      return next(new AppError('Transaction items table is missing. Please run enterprise schema migration.', 503));
    }
    next(err);
  } finally {
    conn.release();
  }
};

// GET /api/transactions
const getAllTransactions = async (req, res, next) => {
  try {
    const { type, payment, from, to, limit = 50, offset = 0 } = req.query;
    const parsedLimit = Number.parseInt(limit, 10);
    const parsedOffset = Number.parseInt(offset, 10);
    const safeLimit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : 50;
    const safeOffset = Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0;

    const params = [];
    let sql = 'SELECT * FROM Transactions WHERE 1=1';

    if (type)    { sql += ' AND transaction_type = ?'; params.push(type); }
    if (payment) { sql += ' AND payment_type = ?';     params.push(payment); }
    if (from)    { sql += ' AND transaction_date >= ?'; params.push(from); }
    if (to)      { sql += ' AND transaction_date <= ?'; params.push(to); }

    sql += ' ORDER BY transaction_date DESC LIMIT ? OFFSET ?';
    params.push(safeLimit, safeOffset);

    const [rows] = await db.query(sql, params);
    res.apiSuccess({
      message: 'Transactions retrieved successfully.',
      data: rows,
      meta: {
        limit: safeLimit,
        offset: safeOffset,
      },
    });
  } catch (err) { next(err); }
};

// GET /api/transactions/:id
const getTransactionById = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM Transactions WHERE transaction_id = ?', [req.params.id]);
    if (rows.length === 0) return next(new AppError('Transaction not found.', 404));

    const [items] = await db.query(`
      SELECT ti.*, p.product_name, p.unit_label
      FROM Transaction_Items ti
      LEFT JOIN Products p ON p.product_id = ti.product_id
      WHERE ti.transaction_id = ?
      ORDER BY ti.item_id ASC
    `, [req.params.id]);

    res.apiSuccess({
      message: 'Transaction retrieved successfully.',
      data: {
        transaction: rows[0],
        items,
      },
    });
  } catch (err) { next(err); }
};

// PUT /api/transactions/:id/meta
const updateTransactionMeta = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('SET @app_user_id = ?', [req.user?.user_id || null]);

    const { payment_type, reference_id, due_date } = req.body;
    const [txRows] = await conn.query('SELECT * FROM Transactions WHERE transaction_id = ? FOR UPDATE', [req.params.id]);
    if (!txRows.length) {
      await conn.rollback();
      return next(new AppError('Transaction not found.', 404));
    }

    const tx = txRows[0];
    const nextPayment = payment_type || tx.payment_type;
    const nextReference = reference_id || tx.reference_id;

    if (!['Cash', 'Baki'].includes(nextPayment)) {
      await conn.rollback();
      return next(new AppError('payment_type must be Cash or Baki.', 400));
    }

    await conn.query(
      'UPDATE Transactions SET payment_type = ?, reference_id = ? WHERE transaction_id = ?',
      [nextPayment, nextReference, req.params.id]
    );

    const [ledgerRows] = await conn.query('SELECT baki_id FROM Baki_Ledger WHERE transaction_id = ?', [req.params.id]);
    if (nextPayment === 'Baki') {
      const ledgerType = tx.transaction_type === 'Sale' ? 'Customer_Debit' : 'Supplier_Credit';
      if (!ledgerRows.length) {
        await conn.query(
          `INSERT INTO Baki_Ledger (ledger_type, entity_id, transaction_id, amount, due_date)
           VALUES (?, ?, ?, ?, ?)`,
          [ledgerType, nextReference, req.params.id, tx.total_amount, due_date || null]
        );
      } else {
        await conn.query(
          'UPDATE Baki_Ledger SET entity_id = ?, due_date = COALESCE(?, due_date) WHERE transaction_id = ?',
          [nextReference, due_date || null, req.params.id]
        );
      }
    } else if (ledgerRows.length) {
      await conn.query('DELETE FROM Baki_Ledger WHERE transaction_id = ?', [req.params.id]);
    }

    await conn.commit();
    res.apiSuccess({ message: 'Transaction metadata updated.' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// DELETE /api/transactions/:id
const deleteTransaction = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('SET @app_user_id = ?', [req.user?.user_id || null]);

    const [txRows] = await conn.query('SELECT * FROM Transactions WHERE transaction_id = ? FOR UPDATE', [req.params.id]);
    if (!txRows.length) {
      await conn.rollback();
      return next(new AppError('Transaction not found.', 404));
    }

    const tx = txRows[0];
    const [items] = await conn.query('SELECT * FROM Transaction_Items WHERE transaction_id = ? FOR UPDATE', [req.params.id]);

    for (const item of items) {
      if (tx.transaction_type === 'Sale') {
        await conn.query('UPDATE Products SET stock_quantity = stock_quantity + ? WHERE product_id = ?', [item.quantity, item.product_id]);
      } else {
        await conn.query('UPDATE Products SET stock_quantity = GREATEST(stock_quantity - ?, 0) WHERE product_id = ?', [item.quantity, item.product_id]);
      }
    }

    await conn.query('DELETE FROM Baki_Ledger WHERE transaction_id = ?', [req.params.id]);
    await conn.query('DELETE FROM Transaction_Items WHERE transaction_id = ?', [req.params.id]);
    await conn.query('DELETE FROM Transactions WHERE transaction_id = ?', [req.params.id]);

    await conn.commit();
    res.apiSuccess({ message: 'Transaction deleted and stock rolled back.' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// GET /api/transactions/:id/invoice
const downloadInvoice = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM Transactions WHERE transaction_id = ?', [req.params.id]);
    if (!rows.length) return next(new AppError('Transaction not found.', 404));

    const transaction = rows[0];
    const [items] = await db.query(
      `SELECT ti.*, p.product_name, p.unit_label
       FROM Transaction_Items ti
       LEFT JOIN Products p ON p.product_id = ti.product_id
       WHERE ti.transaction_id = ?
       ORDER BY ti.item_id ASC`,
      [req.params.id]
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${transaction.transaction_id}.pdf`);
    streamTransactionInvoicePdf(res, transaction, items);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createTransaction,
  getAllTransactions,
  getTransactionById,
  updateTransactionMeta,
  deleteTransaction,
  downloadInvoice,
};
