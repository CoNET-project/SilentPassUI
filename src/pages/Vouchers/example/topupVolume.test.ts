import { resolveTopupVolumePointsDisplay } from './topupVolume'

describe('resolveTopupVolumePointsDisplay', () => {
  test('keeps chain value when present', () => {
    const next = resolveTopupVolumePointsDisplay(270, 270)
    expect(next).toBe(270)
  })

  test('does not overwrite previous chain value when current chain read is missing', () => {
    const next = resolveTopupVolumePointsDisplay(null, 270)
    expect(next).toBe(270)
  })

  test('returns null when neither current nor previous chain value exists', () => {
    const next = resolveTopupVolumePointsDisplay(null, null)
    expect(next).toBeNull()
  })
})

