'use strict';

const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

const SALT_ROUNDS = 12;
const TARGET_USERNAME = 'Jharna Shrestha';
const TARGET_PASSWORD = 'Jharna1234@#';
const TARGET_FULL_NAME = 'Jharna Shrestha';

const productSeeds = [
  ['Basmati Rice 25kg', 'Premium family rice pack', 2850, 'Boras', 96, 12],
  ['Mustard Oil 1L', 'Refined cooking oil bottle', 345, 'Packet', 180, 18],
  ['Sugar 5kg', 'Fine crystal sugar pack', 465, 'Packet', 140, 15],
  ['Salt 1kg', 'Iodized table salt', 28, 'Packet', 260, 20],
  ['Tea Dust 1kg', 'Strong CTC tea blend', 590, 'Packet', 110, 10],
  ['Lentils Masoor 1kg', 'Fresh red lentils', 175, 'Packet', 170, 15],
  ['Soap Bar', 'Laundry soap bar', 42, 'Unit', 320, 25],
  ['Shampoo Sachet', 'Daily use shampoo sachet', 3, 'Packet', 800, 80],
  ['Biscuits Family Pack', 'Tea-time biscuit pack', 95, 'Packet', 210, 18],
  ['Instant Noodles Carton', '30-pack noodle carton', 610, 'Packet', 85, 8],
  ['Drinking Water Jar', '20L reusable water jar', 130, 'Unit', 70, 6],
  ['Chicken Feed 50kg', 'Poultry feed sack', 2350, 'Boras', 52, 5],
  ['Cement Bag', 'OPC construction cement', 845, 'Boras', 64, 8],
  ['Paint Bucket 10L', 'Interior wall paint bucket', 2650, 'Unit', 36, 4],
];

const customerSeeds = [
  ['Aarati Traders', '9801000001', 'Birtamod, Jhapa'],
  ['Bikash Store', '9801000002', 'Damak, Jhapa'],
  ['Kusum Mart', '9801000003', 'Mechinagar, Jhapa'],
  ['Milan Pasal', '9801000004', 'Itahari, Sunsari'],
  ['Nawa Saugat Suppliers', '9801000005', 'Biratnagar, Morang'],
  ['Prerna Collection', '9801000006', 'Urlabari, Morang'],
  ['Rupak Kirana', '9801000007', 'Bhadrapur, Jhapa'],
  ['Shree Ganesh Retail', '9801000008', 'Dharan, Sunsari'],
  ['Sita Fancy Store', '9801000009', 'Ilam Bazaar, Ilam'],
  ['Tulsi Department', '9801000010', 'Phidim, Panchthar'],
  ['Ujjwal Agro', '9801000011', 'Gauradaha, Jhapa'],
  ['Vision Enterprises', '9801000012', 'Lahan, Siraha'],
  ['Yeti Family Shop', '9801000013', 'Janakpur, Dhanusha'],
  ['Zenith Retail Hub', '9801000014', 'Kathmandu, Bagmati'],
];

const supplierSeeds = [
  ['Annapurna Distributors', '9812000001', 'Kathmandu, Bagmati'],
  ['Bhojpur Wholesale', '9812000002', 'Biratnagar, Morang'],
  ['Cosmos FMCG Supply', '9812000003', 'Birgunj, Parsa'],
  ['Dhaulagiri Agro Link', '9812000004', 'Pokhara, Kaski'],
  ['Everest Trading House', '9812000005', 'Lalitpur, Bagmati'],
  ['Future Mart Supply', '9812000006', 'Dharan, Sunsari'],
  ['Gorkha Cement Depot', '9812000007', 'Hetauda, Makwanpur'],
  ['Himal Feed Center', '9812000008', 'Chitwan, Bagmati'],
  ['Indreni Paints', '9812000009', 'Butwal, Rupandehi'],
  ['Janaki Grains', '9812000010', 'Janakpur, Dhanusha'],
  ['Koshi Essentials', '9812000011', 'Itahari, Sunsari'],
  ['Lumbini Oil Agency', '9812000012', 'Nepalgunj, Banke'],
  ['Mithila Consumer Goods', '9812000013', 'Siraha, Madhesh'],
  ['Namaste Imports', '9812000014', 'Kathmandu, Bagmati'],
];

const expenseSeeds = [
  ['Shop Rent - Main Branch', 'Rent', 28000, 'Bank Transfer', 'RENT-0315', 'City Properties'],
  ['Electricity Bill', 'Utilities', 6200, 'eSewa', 'ELEC-0314', 'NEA'],
  ['Internet Subscription', 'Utilities', 2500, 'Cash', 'NET-0313', 'WorldLink'],
  ['Staff Tea and Snacks', 'Refreshment', 1450, 'Cash', 'SNK-0312', 'Local Cafe'],
  ['Delivery Fuel', 'Transport', 5100, 'Cash', 'FUEL-0311', 'Sharma Petrol Pump'],
  ['Printer Ink Refill', 'Office', 1800, 'Cash', 'OFF-0310', 'Print Hub'],
  ['Cleaning Supplies', 'Maintenance', 1350, 'Cash', 'MAIN-0309', 'Bhatta Stores'],
  ['Generator Diesel', 'Utilities', 4200, 'Cash', 'DSL-0308', 'Rijal Fuel'],
  ['Packaging Materials', 'Operations', 3600, 'Bank Transfer', 'PKG-0307', 'Pack Nepal'],
  ['Staff Allowance', 'Payroll', 9500, 'Bank Transfer', 'PAY-0306', 'Internal Payroll'],
  ['Vehicle Maintenance', 'Transport', 4700, 'Cash', 'VEH-0305', 'Auto Care'],
  ['Festival Promotion Banner', 'Marketing', 3200, 'Cash', 'MKT-0304', 'Creative Print'],
  ['Shop Repairs', 'Maintenance', 2750, 'Cash', 'RPR-0303', 'FixIt Services'],
  ['Software Subscription', 'Office', 1900, 'Card', 'SAS-0302', 'Digital Services'],
];

const inquirySeeds = [
  ['Nabin Rai', 'nabin@example.com', 'I want a demo for my grocery shop in Birtamod.'],
  ['Sushma Karki', 'sushma@example.com', 'Can SajiloKhata handle both cash and baki sales?'],
  ['Ramesh Khadka', 'ramesh@example.com', 'Please share pricing details for one branch.'],
  ['Anita Shahi', 'anita@example.com', 'Need help migrating old notebook records.'],
  ['Dipen Yadav', 'dipen@example.com', 'Do you support monthly report exports?'],
  ['Kabita Nepal', 'kabita@example.com', 'Interested in trying the inventory module.'],
  ['Manish Chaudhary', 'manish@example.com', 'Can staff have limited access?'],
  ['Puja Gurung', 'puja@example.com', 'Need support for supplier baki reminders.'],
  ['Saroj Thapa', 'saroj@example.com', 'Looking for a demo next week.'],
  ['Ganga Limbu', 'ganga@example.com', 'Can this work for agro supplies?'],
  ['Roshan Adhikari', 'roshan@example.com', 'I need a clean dashboard for daily sales.'],
  ['Mina Tamang', 'mina@example.com', 'Is it possible to print transaction invoices?'],
  ['Sanjay Oli', 'sanjay@example.com', 'We want to digitize our small department store.'],
  ['Laxmi Bista', 'laxmi@example.com', 'Please contact me about staff onboarding.'],
];

function dayOffset(daysAgo) {
  const now = new Date();
  now.setDate(now.getDate() - daysAgo);
  return now;
}

function sqlDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function sqlDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
  });

  const productState = [];

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    const tables = [
      'Transaction_Audit',
      'Audit_Logs',
      'ContactInquiries',
      'Baki_Ledger',
      'Transaction_Items',
      'Expenses',
      'Transactions',
      'Customers',
      'Suppliers',
      'Products',
      'Users',
    ];

    for (const table of tables) {
      await connection.query(`DELETE FROM ${table}`);
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    await connection.query(
      `INSERT INTO Roles (role_name, description)
       VALUES ('Admin', 'Full access to all modules'), ('Staff', 'Transaction entry only')
       ON DUPLICATE KEY UPDATE description = VALUES(description)`
    );

    const [roleRows] = await connection.query('SELECT role_id FROM Roles WHERE role_name = ? LIMIT 1', ['Admin']);
    const adminRoleId = roleRows[0].role_id;
    const passwordHash = await bcrypt.hash(TARGET_PASSWORD, SALT_ROUNDS);

    const [userResult] = await connection.query(
      `INSERT INTO Users (username, full_name, password_hash, role_id, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [TARGET_USERNAME, TARGET_FULL_NAME, passwordHash, adminRoleId]
    );
    const userId = userResult.insertId;

    const productIds = [];
    for (const [productName, description, unitPrice, unitLabel, stockQuantity, lowStockThreshold] of productSeeds) {
      const [result] = await connection.query(
        `INSERT INTO Products (product_name, description, unit_price, unit_label, stock_quantity, low_stock_threshold)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [productName, description, unitPrice, unitLabel, stockQuantity, lowStockThreshold]
      );
      productIds.push(result.insertId);
      productState.push({ product_id: result.insertId, unit_price: unitPrice, stock_quantity: stockQuantity });
    }

    const customerIds = [];
    for (const [name, phone, address] of customerSeeds) {
      const [result] = await connection.query(
        'INSERT INTO Customers (customer_name, contact_number, address) VALUES (?, ?, ?)',
        [name, phone, address]
      );
      customerIds.push(result.insertId);
    }

    const supplierIds = [];
    for (const [name, phone, address] of supplierSeeds) {
      const [result] = await connection.query(
        'INSERT INTO Suppliers (supplier_name, contact_number, address) VALUES (?, ?, ?)',
        [name, phone, address]
      );
      supplierIds.push(result.insertId);
    }

    for (let index = 0; index < expenseSeeds.length; index += 1) {
      const [description, category, amount, paymentMethod, referenceNo, vendorName] = expenseSeeds[index];
      await connection.query(
        `INSERT INTO Expenses
         (description, category, amount, payment_method, reference_no, vendor_name, notes, created_by, expense_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          description,
          category,
          amount,
          paymentMethod,
          referenceNo,
          vendorName,
          'Seeded sample expense data for dashboard testing.',
          userId,
          sqlDateTime(dayOffset(14 - index)),
        ]
      );
    }

    for (let index = 0; index < inquirySeeds.length; index += 1) {
      const [name, email, message] = inquirySeeds[index];
      await connection.query(
        'INSERT INTO ContactInquiries (name, email, message, created_at) VALUES (?, ?, ?, ?)',
        [name, email, message, sqlDateTime(dayOffset(14 - index))]
      );
    }

    const bakiStatuses = ['Unpaid', 'Partially Paid', 'Paid'];
    let bakiCount = 0;
    let transactionCount = 0;

    for (let index = 0; index < 14; index += 1) {
      const saleProductA = productState[index % productState.length];
      const saleProductB = productState[(index + 3) % productState.length];
      const saleQtyA = 2 + (index % 4);
      const saleQtyB = 1 + (index % 3);
      const saleItems = [
        {
          product_id: saleProductA.product_id,
          quantity: saleQtyA,
          unit_price: saleProductA.unit_price,
          line_total: Number((saleProductA.unit_price * saleQtyA).toFixed(2)),
        },
        {
          product_id: saleProductB.product_id,
          quantity: saleQtyB,
          unit_price: saleProductB.unit_price,
          line_total: Number((saleProductB.unit_price * saleQtyB).toFixed(2)),
        },
      ];
      const saleTotal = saleItems.reduce((sum, item) => sum + item.line_total, 0);
      const saleDate = dayOffset(13 - index);
      const salePaymentType = index < 7 ? 'Baki' : 'Cash';

      const [saleTx] = await connection.query(
        `INSERT INTO Transactions
         (transaction_type, payment_type, total_amount, reference_id, transaction_date)
         VALUES ('Sale', ?, ?, ?, ?)`,
        [salePaymentType, saleTotal, customerIds[index], sqlDateTime(saleDate)]
      );
      transactionCount += 1;

      for (const item of saleItems) {
        await connection.query(
          `INSERT INTO Transaction_Items
           (transaction_id, product_id, quantity, unit_price, line_total, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [saleTx.insertId, item.product_id, item.quantity, item.unit_price, item.line_total, sqlDateTime(saleDate)]
        );
        const stateItem = productState.find((product) => product.product_id === item.product_id);
        stateItem.stock_quantity -= item.quantity;
      }

      if (salePaymentType === 'Baki') {
        await connection.query(
          `INSERT INTO Baki_Ledger
           (ledger_type, entity_id, transaction_id, amount, status, due_date, updated_at)
           VALUES ('Customer_Debit', ?, ?, ?, ?, ?, ?)`,
          [
            customerIds[index],
            saleTx.insertId,
            saleTotal,
            bakiStatuses[index % bakiStatuses.length],
            sqlDate(dayOffset(-(index + 2))),
            sqlDateTime(saleDate),
          ]
        );
        bakiCount += 1;
      }

      const purchaseProductA = productState[(index + 1) % productState.length];
      const purchaseProductB = productState[(index + 6) % productState.length];
      const purchaseQtyA = 5 + (index % 4);
      const purchaseQtyB = 4 + (index % 3);
      const purchasePriceA = Number((purchaseProductA.unit_price * 0.78).toFixed(2));
      const purchasePriceB = Number((purchaseProductB.unit_price * 0.81).toFixed(2));
      const purchaseItems = [
        {
          product_id: purchaseProductA.product_id,
          quantity: purchaseQtyA,
          unit_price: purchasePriceA,
          line_total: Number((purchasePriceA * purchaseQtyA).toFixed(2)),
        },
        {
          product_id: purchaseProductB.product_id,
          quantity: purchaseQtyB,
          unit_price: purchasePriceB,
          line_total: Number((purchasePriceB * purchaseQtyB).toFixed(2)),
        },
      ];
      const purchaseTotal = purchaseItems.reduce((sum, item) => sum + item.line_total, 0);
      const purchaseDate = dayOffset(13 - index);
      const purchasePaymentType = index < 7 ? 'Baki' : 'Cash';

      const [purchaseTx] = await connection.query(
        `INSERT INTO Transactions
         (transaction_type, payment_type, total_amount, reference_id, transaction_date)
         VALUES ('Purchase', ?, ?, ?, ?)`,
        [purchasePaymentType, purchaseTotal, supplierIds[index], sqlDateTime(purchaseDate)]
      );
      transactionCount += 1;

      for (const item of purchaseItems) {
        await connection.query(
          `INSERT INTO Transaction_Items
           (transaction_id, product_id, quantity, unit_price, line_total, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [purchaseTx.insertId, item.product_id, item.quantity, item.unit_price, item.line_total, sqlDateTime(purchaseDate)]
        );
        const stateItem = productState.find((product) => product.product_id === item.product_id);
        stateItem.stock_quantity += item.quantity;
      }

      if (purchasePaymentType === 'Baki') {
        await connection.query(
          `INSERT INTO Baki_Ledger
           (ledger_type, entity_id, transaction_id, amount, status, due_date, updated_at)
           VALUES ('Supplier_Credit', ?, ?, ?, ?, ?, ?)`,
          [
            supplierIds[index],
            purchaseTx.insertId,
            purchaseTotal,
            bakiStatuses[(index + 1) % bakiStatuses.length],
            sqlDate(dayOffset(-(index + 4))),
            sqlDateTime(purchaseDate),
          ]
        );
        bakiCount += 1;
      }
    }

    for (const product of productState) {
      await connection.query(
        'UPDATE Products SET stock_quantity = ?, last_updated = CURRENT_TIMESTAMP WHERE product_id = ?',
        [product.stock_quantity, product.product_id]
      );
    }

    await connection.query(
      `INSERT INTO Audit_Logs (actor_user_id, entity_name, entity_id, action_type, after_data, source_ip, user_agent)
       VALUES (?, 'Users', ?, 'CREATE', JSON_OBJECT('username', ?, 'seeded', true), '127.0.0.1', 'reset-seed-script')`,
      [userId, userId, TARGET_USERNAME]
    );

    console.log('Database reset complete.');
    console.log(`Created admin user: ${TARGET_USERNAME}`);
    console.log('Seed counts:');
    console.log(`- Products: ${productSeeds.length}`);
    console.log(`- Customers: ${customerSeeds.length}`);
    console.log(`- Suppliers: ${supplierSeeds.length}`);
    console.log(`- Expenses: ${expenseSeeds.length}`);
    console.log(`- Contact inquiries: ${inquirySeeds.length}`);
    console.log(`- Transactions: ${transactionCount}`);
    console.log(`- Baki ledger: ${bakiCount}`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('Reset/seed failed:', error.message);
  process.exit(1);
});
