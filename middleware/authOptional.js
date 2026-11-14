const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

module.exports = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header) return next();
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError('Invalid authorization header', 401);
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
  } catch (_error) {
    throw new AppError('Invalid or expired access token', 401);
  }
  const user = await User.findById(payload.sub).select('_id name email role department enrollmentNo');
  if (!user) throw new AppError('User account no longer exists', 401);
  req.user = user;
  next();
});
