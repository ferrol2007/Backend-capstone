require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Attendance = require('../models/Attendance');
const Announcement = require('../models/Announcement');

async function getOrCreateUser(details) {
  let user = await User.findOne({ email: details.email }).select('+password');
  if (!user) user = new User(details);
  else Object.assign(user, details);
  await user.save();
  return user;
}

async function seed() {
  await connectDB();
  await Promise.all([User.init(), Course.init(), Enrollment.init(), Attendance.init(), Announcement.init()]);

  const [admin, faculty, studentA, studentB] = await Promise.all([
    getOrCreateUser({
      name: 'Campus Admin', email: 'admin@campus.example', password: 'CampusAdmin123!',
      role: 'admin', department: 'Administration'
    }),
    getOrCreateUser({
      name: 'Dr. Alex Faculty', email: 'faculty@campus.example', password: 'CampusFaculty123!',
      role: 'faculty', department: 'Computer Science'
    }),
    getOrCreateUser({
      name: 'Sam Student', email: 'student@campus.example', password: 'CampusStudent123!',
      role: 'student', department: 'Computer Science', enrollmentNo: 'STU-1001'
    }),
    getOrCreateUser({
      name: 'Taylor Student', email: 'student2@campus.example', password: 'CampusStudent123!',
      role: 'student', department: 'Computer Science', enrollmentNo: 'STU-1002'
    })
  ]);

  let course = await Course.findOne({ code: 'CS101' });
  if (!course) course = new Course({ code: 'CS101', title: 'Introduction to Computer Science', department: 'Computer Science', credits: 3 });
  course.title = 'Introduction to Computer Science';
  course.department = 'Computer Science';
  course.credits = 3;
  course.faculty = faculty.id;
  course.sections = ['A', 'B'];
  await course.save();

  const enrollments = [
    { student: studentA.id, course: course.id, section: 'A' },
    { student: studentB.id, course: course.id, section: 'A' }
  ];
  for (const enrollment of enrollments) {
    await Enrollment.updateOne(
      { student: enrollment.student, course: enrollment.course },
      { $setOnInsert: enrollment },
      { upsert: true, runValidators: true }
    );
  }

  const today = new Date();
  const classDates = [1, 2, 3].map((daysAgo) => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - daysAgo);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  });
  for (let index = 0; index < classDates.length; index += 1) {
    const records = [
      { student: studentA.id, status: 'present' },
      { student: studentB.id, status: index === 0 ? 'absent' : 'present' }
    ];
    await Attendance.updateOne(
      { course: course.id, section: 'A', date: classDates[index] },
      { $setOnInsert: { course: course.id, section: 'A', date: classDates[index], markedBy: faculty.id, records } },
      { upsert: true, runValidators: true }
    );
  }

  await Announcement.updateOne(
    { title: 'Welcome to the campus portal', createdBy: admin.id },
    {
      $setOnInsert: {
        title: 'Welcome to the campus portal',
        message: 'Welcome! Check your course announcements and keep your profile up to date.',
        scope: 'university',
        createdBy: admin.id
      }
    },
    { upsert: true, runValidators: true }
  );
  await Announcement.updateOne(
    { title: 'CS101 section A orientation', createdBy: faculty.id },
    {
      $setOnInsert: {
        title: 'CS101 section A orientation',
        message: 'Section A orientation materials are available from your instructor.',
        scope: 'section',
        course: course.id,
        section: 'A',
        createdBy: faculty.id
      }
    },
    { upsert: true, runValidators: true }
  );

  console.log(JSON.stringify({
    level: 'info',
    event: 'seed_complete',
    sampleCredentials: [
      { email: admin.email, password: 'CampusAdmin123!' },
      { email: faculty.email, password: 'CampusFaculty123!' },
      { email: studentA.email, password: 'CampusStudent123!' },
      { email: studentB.email, password: 'CampusStudent123!' }
    ]
  }));
}

seed()
  .catch((error) => {
    console.error(JSON.stringify({ level: 'error', event: 'seed_failed', message: error.message }));
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
