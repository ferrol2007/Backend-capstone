const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
});

const updateMe = asyncHandler(async (req, res) => {
  const updates = {};
  for (const field of ['name', 'department']) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  if (Object.keys(updates).length === 0) throw new AppError('Provide name or department to update', 400);
  const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true, runValidators: true })
    .select('_id name email role department enrollmentNo createdAt updatedAt');
  res.json({ success: true, data: { user } });
});

const listUsers = asyncHandler(async (req, res) => {
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  const limit = req.query.limit === undefined ? 20 : Number(req.query.limit);
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  const [users, total] = await Promise.all([
    User.find(filter).select('_id name email role department enrollmentNo createdAt').sort({ createdAt: -1 })
      .skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter)
  ]);
  res.json({ success: true, data: { users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
});

const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, department, enrollmentNo } = req.body;
  const user = await User.create({ name, email, password, role, department, enrollmentNo });
  res.status(201).json({
    success: true,
    data: { user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department } }
  });
});

module.exports = { getMe, updateMe, listUsers, createUser };
