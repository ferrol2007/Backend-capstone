const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError('Authentication required', 401);

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

function authorizeRoles(...roles) {
  return function checkRole(req, _res, next) {
    if (!req.user) return next(new AppError('Authentication required', 401));
    if (!roles.includes(req.user.role)) return next(new AppError('You are not allowed to perform this action', 403));
    next();
  };
}

module.exports = { protect, authorizeRoles };
