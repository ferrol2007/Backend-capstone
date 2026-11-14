const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 20 },
  title: { type: String, required: true, trim: true, maxlength: 150 },
  department: { type: String, required: true, trim: true, maxlength: 100 },
  credits: { type: Number, required: true, min: 1, max: 30 },
  faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  sections: [{ type: String, trim: true, maxlength: 20 }]
}, { timestamps: true });

courseSchema.index({ department: 1, code: 1 });

module.exports = mongoose.model('Course', courseSchema);
