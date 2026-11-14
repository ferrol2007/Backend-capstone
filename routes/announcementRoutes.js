const express = require('express');
const { createAnnouncement, listAnnouncements } = require('../controllers/announcementController');
const { protect } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');

const router = express.Router();
router.use(protect);
router.get('/', validate({ query: { limit: { type: 'number', min: 1, max: 100, integer: true } } }), listAnnouncements);
router.post('/', validate({
  body: {
    title: { required: true, type: 'string' },
    message: { required: true, type: 'string' },
    scope: { required: true, enum: ['university', 'course', 'section'] },
    course: { type: 'string', pattern: /^[a-f\d]{24}$/i },
    section: { type: 'string' }
  }
}), createAnnouncement);

module.exports = router;
