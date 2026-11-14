const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 150 },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
  scope: { type: String, enum: ['university', 'course', 'section'], required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
  section: { type: String, trim: true, maxlength: 20 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

announcementSchema.pre('validate', function validateScope() {
  if (this.scope === 'university' && (this.course || this.section)) {
    this.invalidate('course', 'University announcements cannot target a course or section.');
  }
  if (this.scope === 'course' && !this.course) this.invalidate('course', 'Course is required for course announcements.');
  if (this.scope === 'section' && (!this.course || !this.section)) {
    this.invalidate('section', 'Course and section are required for section announcements.');
  }
});

module.exports = mongoose.model('Announcement', announcementSchema);
