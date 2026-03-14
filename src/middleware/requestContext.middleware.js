'use strict';

const { randomUUID } = require('crypto');

const requestContext = (req, res, next) => {
  req.requestId = randomUUID();
  req.requestStartedAt = Date.now();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};

module.exports = { requestContext };
