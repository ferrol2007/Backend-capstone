const { EventEmitter } = require('events');

const campusEvents = new EventEmitter();
let io;

function logAudit(event, details) {
  console.log(JSON.stringify({ level: 'audit', event, ...details, occurredAt: new Date().toISOString() }));
}

campusEvents.on('announcementCreated', (announcement) => {
  const room = announcement.scope === 'university'
    ? 'university'
    : announcement.scope === 'section'
      ? `section_${announcement.course}_${announcement.section}`
      : `course_${announcement.course}`;
  logAudit('announcement_created', {
    announcementId: String(announcement._id),
    createdBy: String(announcement.createdBy),
    scope: announcement.scope
  });
  if (io) io.to(room).emit('newAnnouncement', announcement);
});

campusEvents.on('attendanceMarked', ({ attendance, course }) => {
  logAudit('attendance_marked', {
    attendanceId: String(attendance._id),
    courseId: String(course._id),
    section: attendance.section,
    markedBy: String(attendance.markedBy)
  });
  if (io) {
    const roomUpdate = {
      attendanceId: String(attendance._id),
      courseId: String(course._id),
      section: attendance.section,
      date: attendance.date
    };
    io.to(`course_${course._id}`).emit('attendanceUpdated', roomUpdate);
    io.to(`section_${course._id}_${attendance.section}`).emit('attendanceUpdated', roomUpdate);
    for (const record of attendance.records) {
      io.to(`user_${record.student}`).emit('attendanceUpdated', {
        ...roomUpdate,
        records: [{ student: record.student, status: record.status }]
      });
    }
  }
});

campusEvents.on('lowAttendanceAlert', (alert) => {
  logAudit('low_attendance_alert', {
    studentId: String(alert.student._id),
    courseId: String(alert.course._id),
    attendancePercentage: alert.attendancePercentage,
    threshold: alert.threshold
  });
  if (io) io.to(`user_${alert.student._id}`).emit('lowAttendanceAlert', alert);
});

function configureCampusEvents(socketServer) {
  io = socketServer;
}

module.exports = campusEvents;
module.exports.configureCampusEvents = configureCampusEvents;
