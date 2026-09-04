import mongoose, { Schema, Document, Types } from 'mongoose';



const attendanceSchema = new Schema({
  staffId: {
    type: Schema.Types.ObjectId,
    ref: 'Staff',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  clockIn: {
    type: Date,
    default: Date.now
  },
  clockOut: {
    type: Date
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'leave'],
    default: 'present',
    required: true
  },
  totalHours: {
    type: Number,
    default: 0,
    min: 0
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

const Attendance = mongoose.model('Attendance', attendanceSchema);
export default Attendance;
