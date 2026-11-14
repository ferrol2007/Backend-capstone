const Announcement = require('../models/Announcement');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const campusEvents = require('../events/campusEvents');

const createAnnouncement = asyncHandler(async (req, res) => {
  const { scope, course: courseId, section } = req.body;
  if (scope === 'university') {
    if (req.user.role !== 'admin') throw new AppError('Only admins may post university-wide announcements', 403);
  } else {
    if (req.user.role !== 'faculty') throw new AppError('Only faculty may post course announcements', 403);
    const course = await Course.findById(courseId);
    if (!course) throw new AppError('Course not found', 404);
    if (!course.faculty || course.faculty.toString() !== req.user.id) {
      throw new AppError('You are not assigned to this course', 403);
    }
    if (scope === 'section' && !course.sections.includes(section)) {
      throw new AppError('Section does not belong to this course', 400);
    }
  }
  const announcement = await Announcement.create({
    title: req.body.title,
    message: req.body.message,
    scope,
    course: courseId,
    section,
    createdBy: req.user.id
  });
  campusEvents.emit('announcementCreated', announcement);
  res.status(201).json({ success: true, data: { announcement } });
});

const listAnnouncements = asyncHandler(async (req, res) => {
  let clauses = [{ scope: 'university' }];
  if (req.user.role === 'admin') {
    clauses = [{}];
  } else if (req.user.role === 'faculty') {
    const assigned = await Course.find({ faculty: req.user.id }).select('_id');
    const courseIds = assigned.map((course) => course.id);
    clauses.push({ scope: 'course', course: { $in: courseIds } });
    clauses.push({ scope: 'section', course: { $in: courseIds } });
  } else {
    const enrollments = await Enrollment.find({ student: req.user.id }).select('course section');
    const pairs = enrollments.map((entry) => ({ course: entry.course, section: entry.section }));
    const courseIds = [...new Set(pairs.map((entry) => String(entry.course)))];
    if (courseIds.length) clauses.push({ scope: 'course', course: { $in: courseIds } });
    if (pairs.length) clauses.push({ scope: 'section', $or: pairs.map((entry) => ({ course: entry.course, section: entry.section })) });
  }
  const filter = clauses.length === 1 && Object.keys(clauses[0]).length === 0 ? {} : { $or: clauses };
  const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
  const announcements = await Announcement.find(filter).populate('createdBy', 'name role').populate('course', 'code title')
    .sort({ createdAt: -1 }).limit(limit);
  res.json({ success: true, data: { announcements } });
});

module.exports = { createAnnouncement, listAnnouncements };
