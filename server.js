require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const User = require('./models/User');
const Enrollment = require('./models/Enrollment');
const Course = require('./models/Course');
const requestLogger = require('./middleware/requestLogger');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const campusEvents = require('./events/campusEvents');

const app = express();
const server = http.createServer(app);
const allowedOrigin = process.env.CLIENT_ORIGIN || '*';
const io = new Server(server, { cors: { origin: allowedOrigin } });

app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.get('/api/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/courses', require('./routes/courseRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/announcements', require('./routes/announcementRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use(notFound);
app.use(errorHandler);

io.use(async (socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication required'));
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
  } catch (_error) {
    return next(new Error('Invalid or expired access token'));
  }
  try {
    const user = await User.findById(payload.sub).select('_id role');
    if (!user) return next(new Error('User account no longer exists'));
    socket.data.user = user;
    next();
  } catch (error) {
    next(error);
  }
});

async function joinUserRooms(socket) {
  const user = socket.data.user;
  socket.join(`user_${user.id}`);
  socket.join(`role_${user.role}`);
  if (user.role === 'admin') {
    socket.join('university');
    const courses = await Course.find().select('_id sections');
    for (const course of courses) {
      socket.join(`course_${course.id}`);
      for (const section of course.sections) socket.join(`section_${course.id}_${section}`);
    }
    return;
  }
  socket.join('university');
  if (user.role === 'faculty') {
    const courses = await Course.find({ faculty: user.id }).select('_id sections');
    for (const course of courses) {
      socket.join(`course_${course.id}`);
      for (const section of course.sections) socket.join(`section_${course.id}_${section}`);
    }
    return;
  }
  const enrollments = await Enrollment.find({ student: user.id }).select('course section');
  for (const enrollment of enrollments) {
    socket.join(`course_${enrollment.course}`);
    socket.join(`section_${enrollment.course}_${enrollment.section}`);
  }
}

io.on('connection', (socket) => {
  joinUserRooms(socket).catch((error) => {
    console.error(JSON.stringify({ level: 'error', event: 'socket_room_join_failed', userId: socket.data.user.id, message: error.message }));
    socket.disconnect(true);
  });
});

campusEvents.configureCampusEvents(io);

async function start() {
  if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be configured');
  }
  await connectDB();
  const port = Number(process.env.PORT) || 3000;
  server.listen(port, () => console.log(JSON.stringify({ level: 'info', event: 'server_listening', port })));
}

if (require.main === module) {
  start().catch((error) => {
    console.error(JSON.stringify({ level: 'error', event: 'startup_failed', message: error.message }));
    process.exitCode = 1;
  });
}

module.exports = { app, server, io, start };
