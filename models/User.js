const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  password: { type: String, required: true, minlength: 8, select: false },
  refreshToken: { type: String, select: false, default: null },
  role: { type: String, enum: ['admin', 'faculty', 'student'], default: 'student', required: true },
  department: { type: String, trim: true, maxlength: 100 },
  enrollmentNo: {
    type: String,
    trim: true,
    sparse: true,
    unique: true,
    required() { return this.role === 'student'; }
  }
}, { timestamps: true });

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set('toJSON', {
  transform(_doc, result) {
    delete result.password;
    delete result.refreshToken;
    delete result.__v;
    return result;
  }
});

module.exports = mongoose.model('User', userSchema);
