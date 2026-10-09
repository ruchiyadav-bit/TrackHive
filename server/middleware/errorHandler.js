const { recordError } = require('../utils/serverMetrics');

const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  // Also keep it in memory for System Health — the PM2 log is the full record,
  // but nobody opens it, and "5 server errors in the last hour" is useless
  // without being able to see what they were.
  recordError(err, req);

  // Zod validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  // Mongoose CastError (invalid ObjectId etc.)
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: [{ field: err.path, message: `Invalid value for ${err.path}` }],
    });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({ error: `Duplicate value for ${field}` });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' });
  }

  // Default
  const statusCode = err.status || err.statusCode || 500;
  if (process.env.NODE_ENV === 'production') {
    res.status(statusCode).json({ error: 'Something went wrong' });
  } else {
    res.status(statusCode).json({ error: err.message, stack: err.stack });
  }
};

module.exports = errorHandler;
