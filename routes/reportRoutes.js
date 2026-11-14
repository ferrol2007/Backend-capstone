const express = require('express');
const { lowAttendance, courseSummary } = require('../controllers/reportController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect, authorizeRoles('admin'));
router.get('/low-attendance', lowAttendance);
router.get('/course-summary', courseSummary);

module.exports = router;
