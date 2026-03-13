'use strict';

const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[ERROR]', err.stack || err.message);

  const status  = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'An unexpected server error occurred.';

  res.status(status).json({ success: false, message });
};

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode    = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { errorHandler, AppError };
