const express = require('express');
const { markAttendance, correctAttendance, getStudentAttendance } = require('../controllers/attendanceController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');

const router = express.Router();
router.use(protect);
router.post('/', authorizeRoles('faculty'), validate({
  body: {
    course: { required: true, type: 'string', pattern: /^[a-f\d]{24}$/i },
    section: { required: true, type: 'string' },
    date: { required: true, type: 'string' },
    records: { required: true, type: 'array' }
  }
}), markAttendance);
router.patch('/:id', authorizeRoles('faculty'), validate({
  params: { id: { required: true, type: 'string', pattern: /^[a-f\d]{24}$/i } },
  body: {
    reason: { required: true, type: 'string' },
    records: { required: true, type: 'array' }
  }
}), correctAttendance);
router.get('/student/:studentId', validate({
  params: { studentId: { required: true, type: 'string', pattern: /^[a-f\d]{24}$/i } }
}), getStudentAttendance);

module.exports = router;
