/** Returns human-readable problems with the rider shift gate; empty means valid. */
export function validateShiftConfig({ start, end, lockout }) {
  const errors = []
  const missing = []

  if (!start) missing.push('Attendance Start')
  if (!end) missing.push('Attendance End')
  if (!lockout) missing.push('Lockout Time')
  if (missing.length) {
    return [`${missing.join(', ')} must be set.`]
  }

  if (start >= end) {
    errors.push('Attendance Start must be earlier than Attendance End.')
  }
  if (lockout < end) {
    errors.push('Lockout Time cannot be earlier than Attendance End — a rider who checks in near the end of the window would be locked out immediately.')
  }

  return errors
}
