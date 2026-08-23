import { describe, expect, it } from 'vitest'
import { validateShiftConfig } from './shift-config'

const ok = (c) => validateShiftConfig(c).length === 0

describe('validateShiftConfig', () => {
  it('accepts a sane shift', () => {
    expect(ok({ start: '03:45', end: '05:00', lockout: '20:45' })).toBe(true)
  })

  it('accepts lockout exactly at attendance end', () => {
    expect(ok({ start: '03:45', end: '05:00', lockout: '05:00' })).toBe(true)
  })

  it('rejects the production config that locked riders out on check-in', () => {
    const errors = validateShiftConfig({ start: '03:45', end: '21:00', lockout: '20:45' })
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/Lockout Time/)
  })

  it('rejects a window that starts after it ends', () => {
    expect(validateShiftConfig({ start: '05:00', end: '03:45', lockout: '20:45' })[0])
      .toMatch(/Attendance Start/)
  })

  it('rejects a zero-length window', () => {
    expect(ok({ start: '05:00', end: '05:00', lockout: '20:45' })).toBe(false)
  })

  it('reports every missing field at once', () => {
    expect(validateShiftConfig({ start: '', end: '', lockout: '' })[0])
      .toMatch(/Attendance Start, Attendance End, Lockout Time/)
  })
})
