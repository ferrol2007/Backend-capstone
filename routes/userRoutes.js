const express = require('express');
const { getMe, updateMe, listUsers, createUser } = require('../controllers/userController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');

const router = express.Router();
router.use(protect);
router.get('/me', getMe);
router.patch('/me', validate({ body: { name: { type: 'string' }, department: { type: 'string' } } }), updateMe);
router.get('/', authorizeRoles('admin'), validate({
  query: {
    role: { enum: ['admin', 'faculty', 'student'] },
    page: { type: 'number', min: 1, integer: true },
    limit: { type: 'number', min: 1, max: 100, integer: true }
  }
}), listUsers);
router.post('/', authorizeRoles('admin'), validate({
  body: {
    name: { required: true, type: 'string' },
    email: { required: true, type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    password: { required: true, type: 'string' },
    role: { required: true, enum: ['admin', 'faculty', 'student'] }
  }
}), createUser);

module.exports = router;
