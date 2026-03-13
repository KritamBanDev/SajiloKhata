'use strict';

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

const SALT_ROUNDS = 12;

// POST /api/auth/signup
const signup = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return next(new AppError('Username and password are required.', 400));
    }
    if (username.length < 3 || username.length > 50) {
      return next(new AppError('Username must be 3-50 characters.', 400));
    }
    if (password.length < 8) {
      return next(new AppError('Password must be at least 8 characters.', 400));
    }

    const [existing] = await db.query('SELECT user_id FROM Users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return next(new AppError('Username already taken.', 409));
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await db.query(
      'INSERT INTO Users (username, password_hash) VALUES (?, ?)',
      [username, password_hash]
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user_id: result.insertId,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return next(new AppError('Username and password are required.', 400));
    }

    const [rows] = await db.query(
      'SELECT user_id, username, password_hash FROM Users WHERE username = ?',
      [username]
    );
    if (rows.length === 0) {
      return next(new AppError('Invalid credentials.', 401));
    }

    const user  = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return next(new AppError('Invalid credentials.', 401));
    }

    const token = jwt.sign(
      { user_id: user.user_id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: { user_id: user.user_id, username: user.username },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { signup, login };
