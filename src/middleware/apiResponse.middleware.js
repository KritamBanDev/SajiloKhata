'use strict';

const apiResponse = (req, res, next) => {
  res.apiSuccess = ({
    message = 'OK',
    data = null,
    status = 200,
    meta = {},
  } = {}) => {
    const baseMeta = {
      request_id: req.requestId,
      timestamp: new Date().toISOString(),
    };

    return res.status(status).json({
      success: true,
      message,
      data,
      meta: { ...baseMeta, ...meta },
    });
  };

  next();
};

module.exports = { apiResponse };
