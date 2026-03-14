'use strict';

const PDFDocument = require('pdfkit');

const money = (n) => `Rs. ${Number(n || 0).toFixed(2)}`;

const streamTransactionInvoicePdf = (outputStream, transaction, items) => {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(outputStream);

  doc
    .fontSize(20)
    .fillColor('#1E40AF')
    .text('SajiloKhata Invoice', { align: 'left' });

  doc
    .fontSize(10)
    .fillColor('#334155')
    .text(`Invoice #: INV-${transaction.transaction_id}`)
    .text(`Transaction Type: ${transaction.transaction_type}`)
    .text(`Payment Type: ${transaction.payment_type}`)
    .text(`Date: ${new Date(transaction.transaction_date).toLocaleString('en-GB')}`)
    .moveDown();

  doc
    .fontSize(12)
    .fillColor('#0f172a')
    .text('Items', { underline: true })
    .moveDown(0.6);

  const tableTop = doc.y;
  const cols = { item: 45, qty: 285, price: 355, total: 465 };

  doc.fontSize(10).fillColor('#334155')
    .text('Item', cols.item, tableTop)
    .text('Qty', cols.qty, tableTop)
    .text('Unit Price', cols.price, tableTop)
    .text('Line Total', cols.total, tableTop);

  let y = tableTop + 18;
  doc.moveTo(40, y - 5).lineTo(555, y - 5).strokeColor('#cbd5e1').stroke();

  items.forEach((row) => {
    const qtyText = `${row.quantity} ${row.unit_label || 'Unit'}`;
    doc.fillColor('#0f172a')
      .text(row.product_name || `Product #${row.product_id}`, cols.item, y, { width: 220 })
      .text(qtyText, cols.qty, y)
      .text(money(row.unit_price), cols.price, y)
      .text(money(row.line_total), cols.total, y);
    y += 22;
  });

  y += 8;
  doc.moveTo(40, y).lineTo(555, y).strokeColor('#cbd5e1').stroke();

  y += 12;
  doc.fontSize(12).fillColor('#1E40AF').text(`Total: ${money(transaction.total_amount)}`, 390, y);

  y += 30;
  doc.fontSize(9).fillColor('#64748b')
    .text('Thank you for doing business with SajiloKhata.', 40, y)
    .text('This is a system-generated invoice.', 40, y + 14);

  doc.end();
};

module.exports = { streamTransactionInvoicePdf };
