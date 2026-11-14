const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

function createAccessToken(user) {
  return jwt.sign({ role: user.role }, process.env.JWT_ACCESS_SECRET, {
    subject: user.id,
    expiresIn: process.env.ACCESS_TOKEN_TTL || '15m',
    algorithm: 'HS256'
  });
}

function createRefreshToken(user) {
  return jwt.sign({}, process.env.JWT_REFRESH_SECRET, {
    subject: user.id,
    expiresIn: process.env.REFRESH_TOKEN_TTL || '7d',
    algorithm: 'HS256'
  });
}

function tokenDigest(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    enrollmentNo: user.enrollmentNo
  };
}

const register = asyncHandler(async (req, res) => {
  const requestedRole = req.body.role || 'student';
  if (req.user) {
    if (req.user.role !== 'admin') throw new AppError('Only admins may register non-student accounts', 403);
  } else if (requestedRole !== 'student') {
    throw new AppError('Open registration is limited to student accounts', 403);
  }

  const role = req.user ? requestedRole : 'student';
  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    role,
    department: req.body.department,
    enrollmentNo: role === 'student' ? req.body.enrollmentNo : undefined
  });
  res.status(201).json({ success: true, message: 'User registered', data: { user: safeUser(user) } });
});

const login = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: String(req.body.email || '').toLowerCase() }).select('+password +refreshToken');
  if (!user || !(await user.comparePassword(req.body.password || ''))) {
    throw new AppError('Invalid email or password', 401);
  }
  const refreshToken = createRefreshToken(user);
  user.refreshToken = tokenDigest(refreshToken);
  await user.save();
  res.json({
    success: true,
    data: { accessToken: createAccessToken(user), refreshToken, user: safeUser(user) }
  });
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AppError('refreshToken is required', 400);
  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
  } catch (_error) {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const user = await User.findById(payload.sub).select('+refreshToken');
  if (!user || !user.refreshToken || user.refreshToken !== tokenDigest(refreshToken)) {
    throw new AppError('Refresh token has been revoked', 401);
  }
  res.json({ success: true, data: { accessToken: createAccessToken(user) } });
});

const logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user.id, { $set: { refreshToken: null } });
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = { register, login, refresh, logout };
