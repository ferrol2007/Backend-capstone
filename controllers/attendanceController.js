const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const campusEvents = require('../events/campusEvents');

function classDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AppError('date must be a valid date', 400);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function assertAssignedFaculty(courseId, section, userId) {
  const course = await Course.findById(courseId);
  if (!course) throw new AppError('Course not found', 404);
  if (!course.faculty || course.faculty.toString() !== userId.toString() || !course.sections.includes(section)) {
    throw new AppError('You are not assigned to teach this course section', 403);
  }
  return course;
}

const markAttendance = asyncHandler(async (req, res) => {
  const { course: courseId, section } = req.body;
  const course = await assertAssignedFaculty(courseId, section, req.user.id);
  if (!Array.isArray(req.body.records) || req.body.records.length === 0) throw new AppError('records must be a non-empty array', 400);
  const ids = req.body.records.map((record) => String(record.student));
  if (new Set(ids).size !== ids.length) throw new AppError('Each student may appear only once', 400);
  const enrollments = await Enrollment.find({ course: course.id, section, student: { $in: ids } }).select('student');
  if (enrollments.length !== ids.length) throw new AppError('Every attendance record must be for a student enrolled in this section', 400);
  const attendance = await Attendance.create({
    course: course.id,
    section,
    date: classDate(req.body.date),
    markedBy: req.user.id,
    records: req.body.records
  });
  campusEvents.emit('attendanceMarked', { attendance, course });
  res.status(201).json({ success: true, data: { attendance } });
});

const correctAttendance = asyncHandler(async (req, res) => {
  const attendance = await Attendance.findById(req.params.id);
  if (!attendance) throw new AppError('Attendance session not found', 404);
  const course = await assertAssignedFaculty(attendance.course, attendance.section, req.user.id);
  if (!req.body.reason || !req.body.reason.trim()) throw new AppError('A correction reason is required', 400);
  if (!Array.isArray(req.body.records) || req.body.records.length === 0) throw new AppError('records must be a non-empty array', 400);
  const existing = new Map(attendance.records.map((record) => [record.student.toString(), record]));
  for (const item of req.body.records) {
    const record = existing.get(String(item.student));
    if (!record) throw new AppError('Cannot update a student not present in this attendance session', 400);
    record.status = item.status;
  }
  attendance.auditLog.push({ updatedBy: req.user.id, updatedAt: new Date(), reason: req.body.reason.trim() });
  await attendance.save();
  campusEvents.emit('attendanceMarked', { attendance, course });
  res.json({ success: true, data: { attendance } });
});

const getStudentAttendance = asyncHandler(async (req, res) => {
  const studentId = req.params.studentId;
  if (req.user.role === 'student' && !new mongoose.Types.ObjectId(studentId).equals(req.user._id)) {
    throw new AppError('Students may only view their own attendance', 403);
  }
  const student = await User.findOne({ _id: studentId, role: 'student' }).select('_id');
  if (!student) throw new AppError('Student not found', 404);
  let visibleCourses;
  if (req.user.role === 'faculty') {
    const assignedCourses = await Course.find({ faculty: req.user.id }).distinct('_id');
    visibleCourses = await Enrollment.find({ course: { $in: assignedCourses }, student: studentId }).distinct('course');
    if (!visibleCourses.length) throw new AppError('You are not permitted to view this student attendance', 403);
  }
  const pipeline = [
    { $unwind: '$records' },
    {
      $match: {
        'records.student': new mongoose.Types.ObjectId(studentId),
        ...(visibleCourses ? { course: { $in: visibleCourses } } : {})
      }
    },
    {
      $group: {
        _id: '$course',
        totalClasses: { $sum: 1 },
        attendedClasses: { $sum: { $cond: [{ $eq: ['$records.status', 'present'] }, 1, 0] } }
      }
    },
    {
      $project: {
        _id: 0,
        course: '$_id',
        totalClasses: 1,
        attendedClasses: 1,
        attendancePercentage: {
          $round: [{ $multiply: [{ $divide: ['$attendedClasses', '$totalClasses'] }, 100] }, 2]
        }
      }
    },
    { $lookup: { from: 'courses', localField: 'course', foreignField: '_id', as: 'course' } },
    { $unwind: '$course' },
    { $project: { course: { _id: '$course._id', code: '$course.code', title: '$course.title' }, totalClasses: 1, attendedClasses: 1, attendancePercentage: 1 } },
    { $sort: { 'course.code': 1 } }
  ];
  const rows = await Attendance.aggregate(pipeline);
  res.json({ success: true, data: { studentId, courses: rows } });
});

module.exports = { markAttendance, correctAttendance, getStudentAttendance };
