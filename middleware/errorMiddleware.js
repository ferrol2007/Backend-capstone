const AppError = require('../utils/AppError');

function notFound(req, _res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

function errorHandler(err, _req, res, _next) {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal server error';
  let errors = err.errors || [];

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((item) => ({ field: item.path, message: item.message }));
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for ${err.path}`;
    errors = [{ field: err.path, value: err.value }];
  } else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern || {})[0] || 'record';
    message = `A record with this ${field} already exists`;
    errors = [{ field, value: err.keyValue && err.keyValue[field] }];
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Malformed JSON request body';
    errors = [];
  }

  if (statusCode >= 500) console.error(JSON.stringify({ level: 'error', event: 'request_failed', message, stack: err.stack }));
  res.status(statusCode).json({ success: false, message, errors });
}

module.exports = { notFound, errorHandler };
