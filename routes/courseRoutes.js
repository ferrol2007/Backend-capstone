const express = require('express');
const {
  listCourses, getCourse, createCourse, updateCourse, deleteCourse, assignFaculty, enrollStudent
} = require('../controllers/courseController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');

const router = express.Router();
router.use(protect);
router.get('/', validate({
  query: {
    page: { type: 'number', min: 1, integer: true },
    limit: { type: 'number', min: 1, max: 100, integer: true },
    department: { type: 'string' },
    search: { type: 'string' }
  }
}), listCourses);
router.get('/:id', validate({ params: { id: { required: true, type: 'string', pattern: /^[a-f\d]{24}$/i } } }), getCourse);
router.post('/', authorizeRoles('admin'), validate({
  body: {
    code: { required: true, type: 'string' },
    title: { required: true, type: 'string' },
    department: { required: true, type: 'string' },
    credits: { required: true, type: 'number', min: 1 },
    sections: { type: 'array' }
  }
}), createCourse);
router.patch('/:id', authorizeRoles('admin'), validate({
  params: { id: { required: true, type: 'string', pattern: /^[a-f\d]{24}$/i } },
  body: {
    code: { type: 'string' },
    title: { type: 'string' },
    department: { type: 'string' },
    credits: { type: 'number', min: 1 },
    sections: { type: 'array' }
  }
}), updateCourse);
router.delete('/:id', authorizeRoles('admin'), validate({ params: { id: { required: true, type: 'string', pattern: /^[a-f\d]{24}$/i } } }), deleteCourse);
router.post('/:id/assign-faculty', authorizeRoles('admin'), validate({
  params: { id: { required: true, type: 'string', pattern: /^[a-f\d]{24}$/i } },
  body: {
    facultyId: { required: true, type: 'string', pattern: /^[a-f\d]{24}$/i },
    section: { required: true, type: 'string' }
  }
}), assignFaculty);
router.post('/:id/enroll', authorizeRoles('admin'), validate({
  params: { id: { required: true, type: 'string', pattern: /^[a-f\d]{24}$/i } },
  body: {
    studentId: { required: true, type: 'string', pattern: /^[a-f\d]{24}$/i },
    section: { required: true, type: 'string' }
  }
}), enrollStudent);

module.exports = router;
