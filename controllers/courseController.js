const mongoose = require('mongoose');
const Course = require('../models/Course');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const Attendance = require('../models/Attendance');
const Announcement = require('../models/Announcement');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const listCourses = asyncHandler(async (req, res) => {
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  const limit = req.query.limit === undefined ? 20 : Number(req.query.limit);
  const filter = {};
  if (req.query.department) filter.department = new RegExp(`^${String(req.query.department).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  if (req.query.search) {
    const term = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ code: new RegExp(term, 'i') }, { title: new RegExp(term, 'i') }];
  }
  const [courses, total] = await Promise.all([
    Course.find(filter).populate('faculty', 'name email department').sort({ code: 1 }).skip((page - 1) * limit).limit(limit),
    Course.countDocuments(filter)
  ]);
  res.json({ success: true, data: { courses, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
});

const getCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id).populate('faculty', 'name email department');
  if (!course) throw new AppError('Course not found', 404);
  res.json({ success: true, data: { course } });
});

const createCourse = asyncHandler(async (req, res) => {
  const { code, title, department, credits, sections } = req.body;
  const course = await Course.create({ code, title, department, credits, sections });
  res.status(201).json({ success: true, data: { course } });
});

const updateCourse = asyncHandler(async (req, res) => {
  const allowed = ['code', 'title', 'department', 'credits', 'sections'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  if (!Object.keys(updates).length) throw new AppError('No permitted course fields were provided', 400);
  const course = await Course.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!course) throw new AppError('Course not found', 404);
  res.json({ success: true, data: { course } });
});

const deleteCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) throw new AppError('Course not found', 404);
  await Promise.all([
    Enrollment.deleteMany({ course: course.id }),
    Attendance.deleteMany({ course: course.id }),
    Announcement.deleteMany({ course: course.id }),
    Course.deleteOne({ _id: course.id })
  ]);
  res.json({ success: true, message: 'Course deleted' });
});

const assignFaculty = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) throw new AppError('Course not found', 404);
  const faculty = await User.findOne({ _id: req.body.facultyId, role: 'faculty' });
  if (!faculty) throw new AppError('Faculty user not found', 404);
  if (req.body.section && !course.sections.includes(req.body.section)) course.sections.push(req.body.section);
  course.faculty = faculty.id;
  await course.save();
  res.json({ success: true, data: { course } });
});

const enrollStudent = asyncHandler(async (req, res) => {
  const [course, student] = await Promise.all([
    Course.findById(req.params.id),
    User.findOne({ _id: req.body.studentId, role: 'student' })
  ]);
  if (!course) throw new AppError('Course not found', 404);
  if (!student) throw new AppError('Student user not found', 404);
  if (!course.sections.includes(req.body.section)) throw new AppError('Section does not belong to this course', 400);
  const enrollment = await Enrollment.create({ student: student.id, course: course.id, section: req.body.section });
  res.status(201).json({ success: true, data: { enrollment } });
});

module.exports = { listCourses, getCourse, createCourse, updateCourse, deleteCourse, assignFaculty, enrollStudent };
