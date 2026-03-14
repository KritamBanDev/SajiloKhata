'use strict';

const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const createInquiry = async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return next(new AppError('Name, email, subject, and message are required.', 400));
    }

    const trimmedName = String(name).trim();
    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedSubject = String(subject).trim();
    const trimmedMessage = String(message).trim();

    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return next(new AppError('Name must be between 2 and 100 characters.', 400));
    }

    if (!emailRegex.test(trimmedEmail)) {
      return next(new AppError('Please provide a valid email address.', 400));
    }

    if (trimmedSubject.length < 3 || trimmedSubject.length > 150) {
      return next(new AppError('Subject must be between 3 and 150 characters.', 400));
    }

    if (trimmedMessage.length < 10 || trimmedMessage.length > 5000) {
      return next(new AppError('Message must be between 10 and 5000 characters.', 400));
    }

    const storedMessage = 'Subject: ' + trimmedSubject + '\n\n' + trimmedMessage;
    let result;
    try {
      const [insertResult] = await db.query(
        'INSERT INTO ContactInquiries (name, email, message) VALUES (?, ?, ?)',
        [trimmedName, trimmedEmail, storedMessage]
      );
      result = insertResult;
    } catch (dbErr) {
      if (dbErr && (dbErr.code === 'ER_NO_SUCH_TABLE' || dbErr.errno === 1146)) {
        return next(new AppError('Contact service is not initialized yet. Please apply the latest database schema migration.', 503));
      }
      throw dbErr;
    }

    res.apiSuccess({
      status: 201,
      message: 'Thank you. Your inquiry has been submitted successfully.',
      data: { inquiry_id: result.insertId },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { createInquiry };
