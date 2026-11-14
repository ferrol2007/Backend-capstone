const express = require('express');
const { register, login, refresh, logout } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const optionalAuth = require('../middleware/authOptional');
const validate = require('../middleware/validate');

const router = express.Router();
const emailRule = { required: true, type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ };

router.post('/register', optionalAuth, validate({
  body: {
    name: { required: true, type: 'string' },
    email: emailRule,
    password: { required: true, type: 'string' },
    role: { enum: ['admin', 'faculty', 'student'] },
    enrollmentNo: { type: 'string' }
  }
}), register);
router.post('/login', validate({ body: { email: emailRule, password: { required: true, type: 'string' } } }), login);
router.post('/refresh', validate({ body: { refreshToken: { required: true, type: 'string' } } }), refresh);
router.post('/logout', protect, logout);

module.exports = router;
