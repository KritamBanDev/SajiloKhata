'use strict';

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

const SALT_ROUNDS = 12;

const getAuthSchemaSupport = async () => {
  const [tableRows] = await db.query(
    `SELECT COUNT(*) AS total
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = 'Roles'`
  );

  const [columnRows] = await db.query(
    `SELECT COUNT(*) AS total
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'Users' AND column_name = 'role_id'`
  );

  return {
    hasRolesTable: Number(tableRows[0]?.total || 0) > 0,
    hasUserRoleIdColumn: Number(columnRows[0]?.total || 0) > 0,
  };
};

const resolveDefaultRoleId = async () => {
  const [[countRow]] = await db.query('SELECT COUNT(*) AS total FROM Users');
  const bootstrapRole = Number(countRow.total) === 0 ? 'Admin' : 'Staff';
  const [roles] = await db.query('SELECT role_id FROM Roles WHERE role_name = ? LIMIT 1', [bootstrapRole]);
  if (!roles.length) {
    throw new AppError('Role configuration missing. Please run database migration.', 500);
  }
  return roles[0].role_id;
};

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
    const { hasRolesTable, hasUserRoleIdColumn } = await getAuthSchemaSupport();

    let result;
    if (hasRolesTable && hasUserRoleIdColumn) {
      const role_id = await resolveDefaultRoleId();
      const [insertResult] = await db.query(
        'INSERT INTO Users (username, password_hash, role_id) VALUES (?, ?, ?)',
        [username, password_hash, role_id]
      );
      result = insertResult;
    } else {
      // Backward-compatible fallback for pre-enterprise schema.
      const [insertResult] = await db.query(
        'INSERT INTO Users (username, password_hash) VALUES (?, ?)',
        [username, password_hash]
      );
      result = insertResult;
    }

    res.apiSuccess({
      status: 201,
      message: 'Account created successfully.',
      data: { user_id: result.insertId },
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

    const { hasRolesTable, hasUserRoleIdColumn } = await getAuthSchemaSupport();
    const [rows] = hasRolesTable && hasUserRoleIdColumn
      ? await db.query(
        `SELECT u.user_id, u.username, u.password_hash, r.role_name
         FROM Users u
         LEFT JOIN Roles r ON u.role_id = r.role_id
         WHERE u.username = ?`,
        [username]
      )
      : await db.query(
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
      { user_id: user.user_id, username: user.username, role: user.role_name || 'Staff' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.apiSuccess({
      message: 'Login successful.',
      data: {
        token,
        user: { user_id: user.user_id, username: user.username, role: user.role_name || 'Staff' },
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { signup, login };
