const test = require('node:test');
const assert = require('node:assert/strict');
const validate = require('../middleware/validate');
const Enrollment = require('../models/Enrollment');
const Attendance = require('../models/Attendance');
const User = require('../models/User');

function runValidation(middleware, req) {
  return new Promise((resolve) => {
    middleware(req, {}, (error) => resolve(error));
  });
}

test('request validation returns a structured 400 for missing and malformed fields', async () => {
  const middleware = validate({
    body: {
      email: { required: true, type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
      role: { enum: ['admin', 'faculty', 'student'] }
    },
    query: { page: { type: 'number', min: 1, integer: true } }
  });
  const error = await runValidation(middleware, {
    body: { email: 'bad-email', role: 'owner' },
    query: { page: '1.5' }
  });

  assert.equal(error.statusCode, 400);
  assert.equal(error.message, 'Request validation failed');
  assert.deepEqual(error.errors.map((item) => item.field), ['email', 'role', 'page']);
});

test('students require enrollment numbers while non-student accounts may omit them', () => {
  const student = new User({ name: 'Student One', email: 'student@example.edu', password: 'password123', role: 'student' });
  const faculty = new User({ name: 'Faculty One', email: 'faculty@example.edu', password: 'password123', role: 'faculty' });

  assert.ok(student.validateSync().errors.enrollmentNo);
  assert.equal(faculty.validateSync(), undefined);
});

test('user serialization never exposes password or refresh-token storage', () => {
  const user = new User({
    name: 'Student One',
    email: 'student@example.edu',
    password: 'password123',
    refreshToken: 'stored-token-digest',
    role: 'student',
    enrollmentNo: 'STU-1'
  });
  const serialized = user.toJSON();

  assert.equal(serialized.password, undefined);
  assert.equal(serialized.refreshToken, undefined);
});

test('enrollment and attendance prevent duplicate business records with unique compound indexes', () => {
  const enrollmentIndex = Enrollment.schema.indexes().find(([keys]) =>
    keys.student === 1 && keys.course === 1
  );
  const attendanceIndex = Attendance.schema.indexes().find(([keys]) =>
    keys.course === 1 && keys.section === 1 && keys.date === 1
  );

  assert.equal(enrollmentIndex[1].unique, true);
  assert.equal(attendanceIndex[1].unique, true);
});
