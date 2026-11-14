const Attendance = require('../models/Attendance');
const Course = require('../models/Course');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const campusEvents = require('../events/campusEvents');

const lowAttendance = asyncHandler(async (req, res) => {
  const threshold = req.query.threshold === undefined ? 75 : Number(req.query.threshold);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
    throw new AppError('threshold must be a number between 0 and 100', 400);
  }
  const results = await Attendance.aggregate([
    { $unwind: '$records' },
    {
      $group: {
        _id: { student: '$records.student', course: '$course' },
        totalClasses: { $sum: 1 },
        attendedClasses: { $sum: { $cond: [{ $eq: ['$records.status', 'present'] }, 1, 0] } }
      }
    },
    {
      $project: {
        _id: 0,
        studentId: '$_id.student',
        courseId: '$_id.course',
        totalClasses: 1,
        attendedClasses: 1,
        attendancePercentage: {
          $round: [{ $multiply: [{ $divide: ['$attendedClasses', '$totalClasses'] }, 100] }, 2]
        }
      }
    },
    { $match: { attendancePercentage: { $lt: threshold } } },
    { $lookup: { from: 'users', localField: 'studentId', foreignField: '_id', as: 'student' } },
    { $unwind: '$student' },
    { $lookup: { from: 'courses', localField: 'courseId', foreignField: '_id', as: 'course' } },
    { $unwind: '$course' },
    {
      $project: {
        _id: 0,
        student: { _id: '$student._id', name: '$student.name', email: '$student.email', enrollmentNo: '$student.enrollmentNo' },
        course: { _id: '$course._id', code: '$course.code', title: '$course.title' },
        totalClasses: 1,
        attendedClasses: 1,
        attendancePercentage: 1
      }
    },
    { $sort: { attendancePercentage: 1, 'student.name': 1 } }
  ]);
  for (const result of results) campusEvents.emit('lowAttendanceAlert', { ...result, threshold });
  res.json({ success: true, data: { threshold, students: results } });
});

const courseSummary = asyncHandler(async (_req, res) => {
  const summary = await Course.aggregate([
    { $unwind: { path: '$sections', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'enrollments',
        let: { courseId: '$_id', section: '$sections' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$course', '$$courseId'] },
                  { $eq: ['$section', '$$section'] }
                ]
              }
            }
          },
          { $count: 'totalEnrolled' }
        ],
        as: 'sectionEnrollment'
      }
    },
    {
      $set: {
        sectionCount: { $ifNull: [{ $arrayElemAt: ['$sectionEnrollment.totalEnrolled', 0] }, 0] }
      }
    },
    { $lookup: { from: 'users', localField: 'faculty', foreignField: '_id', as: 'facultyDetails' } },
    { $unwind: { path: '$facultyDetails', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$_id',
        code: { $first: '$code' },
        title: { $first: '$title' },
        department: { $first: '$department' },
        faculty: {
          $first: {
            $cond: [
              { $ifNull: ['$facultyDetails._id', false] },
              { _id: '$facultyDetails._id', name: '$facultyDetails.name', email: '$facultyDetails.email' },
              null
            ]
          }
        },
        sections: {
          $push: {
            section: '$sections',
            totalEnrolled: '$sectionCount'
          }
        },
        totalEnrolled: { $sum: '$sectionCount' }
      }
    },
    {
      $project: {
        _id: 1,
        code: 1,
        title: 1,
        department: 1,
        faculty: 1,
        sections: {
          $filter: {
            input: '$sections',
            as: 'section',
            cond: { $ne: ['$$section.section', null] }
          }
        },
        totalEnrolled: 1
      }
    },
    { $sort: { code: 1 } }
  ]);
  res.json({ success: true, data: { courses: summary } });
});

module.exports = { lowAttendance, courseSummary };
