import mongoose from 'mongoose';

const attendancePolicySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String },
  
  shiftStartTime: { type: String, default: '09:00' }, // "HH:mm"
  shiftEndTime: { type: String, default: '17:00' },   // "HH:mm"
  standardWorkHours: { type: Number, default: 8 },
  hourlyRate: { type: Number, default: 260 },
  isOfficeStaffPolicy: { type: Boolean, default: true },

  overtimeRatePerHour: { type: Number, default: 100 },       // LKR per extra hour
  earlyLeavePenaltyRatePerHour: { type: Number, default: 100 }, // LKR cut per early hour
  lateArrivalPenaltyRatePerHour: { type: Number, default: 100 },  // LKR cut per late hour
  leaveDeductionDailyRate: { type: Number, default: 0 },         // Daily wage cut for leave (0 = auto daily wage)

  applicableScope: {
    type: String,
    enum: ['ALL', 'PERMANENT', 'SPECIFIC_EMPLOYEE'],
    default: 'ALL',
  },
  
  assignedEmployees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
  }],

  isDefault: { type: Boolean, default: false },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

attendancePolicySchema.pre(/^find/, function(next) {
  if (!this.getOptions || !this.getOptions().includeDeleted) {
    this.where({ deletedAt: null });
  }
  if (typeof next === 'function') next();
});

const AttendancePolicy = mongoose.model('AttendancePolicy', attendancePolicySchema);
export default AttendancePolicy;
