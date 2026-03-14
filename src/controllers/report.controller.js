'use strict';

const db = require('../config/db');

/**
 * Shared date-range helper — defaults to current month.
 */
const getRange = (query) => {
  const now = new Date();
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  const month = String(monthIndex + 1).padStart(2, '0');
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();

  const normalize = (value, suffix) => {
    if (!value) return null;
    if (String(value).includes(' ')) return value;
    return `${value} ${suffix}`;
  };

  const from = normalize(query.from, '00:00:00') || `${year}-${month}-01 00:00:00`;
  const to = normalize(query.to, '23:59:59') || `${year}-${month}-${String(lastDay).padStart(2, '0')} 23:59:59`;
  return { from, to };
};

// GET /api/reports/sales  — total sales, cash vs baki breakdown
const salesReport = async (req, res, next) => {
  try {
    const { from, to } = getRange(req.query);
    const [rows] = await db.query(`
      SELECT
        COUNT(*)                                             AS total_transactions,
        SUM(total_amount)                                    AS total_revenue,
        SUM(CASE WHEN payment_type = 'Cash' THEN total_amount ELSE 0 END) AS cash_revenue,
        SUM(CASE WHEN payment_type = 'Baki' THEN total_amount ELSE 0 END) AS baki_revenue,
        DATE(transaction_date)                               AS sale_date
      FROM Transactions
      WHERE transaction_type = 'Sale'
        AND transaction_date BETWEEN ? AND ?
      GROUP BY DATE(transaction_date)
      ORDER BY sale_date ASC
    `, [from, to]);
    res.apiSuccess({
      message: 'Sales report retrieved successfully.',
      data: rows,
      meta: { period: { from, to } },
    });
  } catch (err) { next(err); }
};

// GET /api/reports/inventory  — current stock levels with valuation
const inventoryReport = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT
        product_id,
        product_name,
        description,
        unit_price,
        stock_quantity,
        ROUND(unit_price * stock_quantity, 2) AS stock_value,
        last_updated
      FROM Products
      ORDER BY stock_quantity ASC
    `);
    const [summary] = await db.query(`
      SELECT
        COUNT(*)                               AS total_products,
        SUM(stock_quantity)                    AS total_units,
        ROUND(SUM(unit_price * stock_quantity), 2) AS total_stock_value
      FROM Products
    `);
    res.apiSuccess({
      message: 'Inventory report retrieved successfully.',
      data: rows,
      meta: { summary: summary[0] },
    });
  } catch (err) { next(err); }
};

// GET /api/reports/profit-loss
const profitLossReport = async (req, res, next) => {
  try {
    const { from, to } = getRange(req.query);

    const [[sales]] = await db.query(`
      SELECT COALESCE(SUM(total_amount), 0) AS total_sales
      FROM Transactions
      WHERE transaction_type = 'Sale' AND transaction_date BETWEEN ? AND ?
    `, [from, to]);

    const [[purchases]] = await db.query(`
      SELECT COALESCE(SUM(total_amount), 0) AS total_purchases
      FROM Transactions
      WHERE transaction_type = 'Purchase' AND transaction_date BETWEEN ? AND ?
    `, [from, to]);

    const [[expenses]] = await db.query(`
      SELECT COALESCE(SUM(amount), 0) AS total_expenses
      FROM Expenses
      WHERE expense_date BETWEEN ? AND ?
    `, [from, to]);

    const gross_revenue = Number(sales.total_sales);
    const cogs = Number(purchases.total_purchases);
    const operating_expenses = Number(expenses.total_expenses);
    const gross_profit = gross_revenue - cogs;
    const net_profit   = gross_profit - operating_expenses;

    res.apiSuccess({
      message: 'Profit and loss report retrieved successfully.',
      data: {
        total_sales:      Number(sales.total_sales),
        total_purchases:  Number(purchases.total_purchases),
        total_expenses:   Number(expenses.total_expenses),
        gross_revenue,
        cogs,
        operating_expenses,
        gross_profit:     Number(gross_profit.toFixed(2)),
        net_profit:       Number(net_profit.toFixed(2)),
      },
      meta: { period: { from, to } },
    });
  } catch (err) { next(err); }
};

// GET /api/reports/cash-flow
const cashFlowReport = async (req, res, next) => {
  try {
    const { from, to } = getRange(req.query);

    const [rows] = await db.query(`
      SELECT
        DATE(transaction_date)  AS flow_date,
        SUM(CASE WHEN transaction_type = 'Sale'     AND payment_type = 'Cash' THEN  total_amount ELSE 0 END) AS cash_in,
        SUM(CASE WHEN transaction_type = 'Purchase' AND payment_type = 'Cash' THEN  total_amount ELSE 0 END) AS cash_out_purchases
      FROM Transactions
      WHERE transaction_date BETWEEN ? AND ?
        AND payment_type = 'Cash'
      GROUP BY DATE(transaction_date)
      ORDER BY flow_date ASC
    `, [from, to]);

    const [expenses] = await db.query(`
      SELECT DATE(expense_date) AS flow_date, SUM(amount) AS cash_out_expenses
      FROM Expenses
      WHERE expense_date BETWEEN ? AND ?
      GROUP BY DATE(expense_date)
    `, [from, to]);

    res.apiSuccess({
      message: 'Cash flow report retrieved successfully.',
      data: {
        transactions: rows,
        expenses,
      },
      meta: { period: { from, to } },
    });
  } catch (err) { next(err); }
};

// GET /api/reports/ledger  — full transaction + baki ledger
const ledgerReport = async (req, res, next) => {
  try {
    const { from, to } = getRange(req.query);

    const [rows] = await db.query(`
      SELECT
        t.transaction_id,
        t.transaction_type,
        t.payment_type,
        t.total_amount,
        t.reference_id,
        t.transaction_date,
        bl.baki_id,
        bl.ledger_type,
        bl.status   AS baki_status,
        bl.due_date,
        CASE bl.ledger_type
          WHEN 'Customer_Debit'  THEN c.customer_name
          WHEN 'Supplier_Credit' THEN s.supplier_name
          ELSE NULL
        END AS entity_name
      FROM Transactions t
      LEFT JOIN Baki_Ledger bl ON t.transaction_id = bl.transaction_id
      LEFT JOIN Customers   c  ON bl.ledger_type = 'Customer_Debit'  AND bl.entity_id = c.customer_id
      LEFT JOIN Suppliers   s  ON bl.ledger_type = 'Supplier_Credit' AND bl.entity_id = s.supplier_id
      WHERE t.transaction_date BETWEEN ? AND ?
      ORDER BY t.transaction_date DESC
    `, [from, to]);

    res.apiSuccess({
      message: 'Ledger report retrieved successfully.',
      data: rows,
      meta: { period: { from, to } },
    });
  } catch (err) { next(err); }
};

// GET /api/reports/sales-trend
const salesTrend7Day = async (_req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT
        DATE(transaction_date) AS sale_date,
        ROUND(SUM(total_amount), 2) AS total_sales
      FROM Transactions
      WHERE transaction_type = 'Sale'
        AND transaction_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
      GROUP BY DATE(transaction_date)
      ORDER BY sale_date ASC
    `);
    res.apiSuccess({ message: 'Sales trend report retrieved successfully.', data: rows });
  } catch (err) { next(err); }
};

// GET /api/reports/stock-value-pie
const stockValuePie = async (_req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT
        product_name,
        ROUND(unit_price * stock_quantity, 2) AS stock_value
      FROM Products
      WHERE stock_quantity > 0
      ORDER BY stock_value DESC
      LIMIT 10
    `);
    res.apiSuccess({ message: 'Stock value distribution report retrieved successfully.', data: rows });
  } catch (err) { next(err); }
};

// GET /api/reports/customer-risk
const customerRiskProfile = async (_req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT
        bl.entity_id AS customer_id,
        c.customer_name,
        ROUND(SUM(bl.amount), 2) AS total_outstanding,
        MAX(DATEDIFF(CURDATE(), COALESCE(bl.due_date, DATE(bl.updated_at)))) AS max_age_days,
        COUNT(*) AS open_entries,
        ROUND((SUM(bl.amount) * 0.6) + (MAX(DATEDIFF(CURDATE(), COALESCE(bl.due_date, DATE(bl.updated_at)))) * 0.4), 2) AS risk_score
      FROM Baki_Ledger bl
      INNER JOIN Customers c ON c.customer_id = bl.entity_id
      WHERE bl.ledger_type = 'Customer_Debit'
        AND bl.status <> 'Paid'
      GROUP BY bl.entity_id, c.customer_name
      ORDER BY risk_score DESC, total_outstanding DESC
    `);
    res.apiSuccess({ message: 'Customer risk profile report retrieved successfully.', data: rows });
  } catch (err) { next(err); }
};

module.exports = {
  salesReport,
  inventoryReport,
  profitLossReport,
  cashFlowReport,
  ledgerReport,
  salesTrend7Day,
  stockValuePie,
  customerRiskProfile,
};
