import { describe, it, expect } from 'vitest'
import {
  fadeUp,
  fadeIn,
  slideUp,
  slideDown,
  scaleIn,
  staggerContainer,
  staggerContainerFast,
  blurText,
  toastSlide,
} from '@/lib/animation/motion'

// ---------------------------------------------------------------------------
// Helper — every animated variant must expose hidden + visible keys
// ---------------------------------------------------------------------------

const ALL_VARIANTS = [
  { name: 'fadeUp', variant: fadeUp },
  { name: 'fadeIn', variant: fadeIn },
  { name: 'slideUp', variant: slideUp },
  { name: 'slideDown', variant: slideDown },
  { name: 'scaleIn', variant: scaleIn },
  { name: 'staggerContainer', variant: staggerContainer },
  { name: 'staggerContainerFast', variant: staggerContainerFast },
  { name: 'blurText', variant: blurText },
  { name: 'toastSlide', variant: toastSlide },
] as const

// ---------------------------------------------------------------------------
// Structural invariant: all exports have hidden + visible
// ---------------------------------------------------------------------------

describe('all variants have hidden and visible states', () => {
  for (const { name, variant } of ALL_VARIANTS) {
    it(`${name} has a "hidden" key`, () => {
      expect(variant).toHaveProperty('hidden')
    })

    it(`${name} has a "visible" key`, () => {
      expect(variant).toHaveProperty('visible')
    })
  }
})

// ---------------------------------------------------------------------------
// fadeUp
// ---------------------------------------------------------------------------

describe('fadeUp', () => {
  it('hidden state has opacity 0 and y 20', () => {
    expect(fadeUp.hidden).toEqual({ opacity: 0, y: 20 })
  })

  it('visible state has opacity 1 and y 0', () => {
    const visible = fadeUp.visible as Record<string, unknown>
    expect(visible.opacity).toBe(1)
    expect(visible.y).toBe(0)
  })

  it('visible.transition.duration is greater than 0', () => {
    const visible = fadeUp.visible as Record<string, unknown>
    const transition = visible.transition as Record<string, unknown>
    expect(Number(transition.duration)).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// fadeIn
// ---------------------------------------------------------------------------

describe('fadeIn', () => {
  it('hidden state is { opacity: 0 } with no y property', () => {
    expect(fadeIn.hidden).toEqual({ opacity: 0 })
    expect(fadeIn.hidden).not.toHaveProperty('y')
  })

  it('visible state has opacity 1', () => {
    const visible = fadeIn.visible as Record<string, unknown>
    expect(visible.opacity).toBe(1)
  })

  it('visible.transition.duration is greater than 0', () => {
    const visible = fadeIn.visible as Record<string, unknown>
    const transition = visible.transition as Record<string, unknown>
    expect(Number(transition.duration)).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// slideUp
// ---------------------------------------------------------------------------

describe('slideUp', () => {
  it('hidden state has opacity 0 and y 40', () => {
    expect(slideUp.hidden).toEqual({ opacity: 0, y: 40 })
  })

  it('visible.transition.duration is greater than 0', () => {
    const visible = slideUp.visible as Record<string, unknown>
    const transition = visible.transition as Record<string, unknown>
    expect(Number(transition.duration)).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// slideDown
// ---------------------------------------------------------------------------

describe('slideDown', () => {
  it('hidden state has opacity 0 and y -30 (negative — slides from above)', () => {
    expect(slideDown.hidden).toEqual({ opacity: 0, y: -30 })
  })

  it('visible.transition.duration is greater than 0', () => {
    const visible = slideDown.visible as Record<string, unknown>
    const transition = visible.transition as Record<string, unknown>
    expect(Number(transition.duration)).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// scaleIn
// ---------------------------------------------------------------------------

describe('scaleIn', () => {
  it('hidden state has opacity 0 and scale 0.95', () => {
    expect(scaleIn.hidden).toEqual({ opacity: 0, scale: 0.95 })
  })

  it('visible.transition.duration is greater than 0', () => {
    const visible = scaleIn.visible as Record<string, unknown>
    const transition = visible.transition as Record<string, unknown>
    expect(Number(transition.duration)).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// staggerContainer
// ---------------------------------------------------------------------------

describe('staggerContainer', () => {
  it('hidden state is an empty object (no initial animation)', () => {
    expect(staggerContainer.hidden).toEqual({})
  })

  it('visible.transition.staggerChildren is 0.15', () => {
    const visible = staggerContainer.visible as Record<string, unknown>
    const transition = visible.transition as Record<string, unknown>
    expect(transition.staggerChildren).toBe(0.15)
  })

  it('visible.transition does not contain a duration property (orchestration only)', () => {
    const visible = staggerContainer.visible as Record<string, unknown>
    const transition = visible.transition as Record<string, unknown>
    expect(transition).not.toHaveProperty('duration')
  })
})

// ---------------------------------------------------------------------------
// staggerContainerFast
// ---------------------------------------------------------------------------

describe('staggerContainerFast', () => {
  it('hidden state is an empty object (no initial animation)', () => {
    expect(staggerContainerFast.hidden).toEqual({})
  })

  it('visible.transition.staggerChildren is 0.06', () => {
    const visible = staggerContainerFast.visible as Record<string, unknown>
    const transition = visible.transition as Record<string, unknown>
    expect(transition.staggerChildren).toBe(0.06)
  })

  it('visible.transition does not contain a duration property (orchestration only)', () => {
    const visible = staggerContainerFast.visible as Record<string, unknown>
    const transition = visible.transition as Record<string, unknown>
    expect(transition).not.toHaveProperty('duration')
  })

  it('staggerChildren is faster than staggerContainer', () => {
    const containerVisible = staggerContainer.visible as Record<string, unknown>
    const fastVisible = staggerContainerFast.visible as Record<string, unknown>
    const containerTransition = containerVisible.transition as Record<string, unknown>
    const fastTransition = fastVisible.transition as Record<string, unknown>
    expect(Number(fastTransition.staggerChildren)).toBeLessThan(
      Number(containerTransition.staggerChildren)
    )
  })
})

// ---------------------------------------------------------------------------
// blurText
// ---------------------------------------------------------------------------

describe('blurText', () => {
  it('hidden state has filter "blur(10px)", opacity 0, and y 50', () => {
    expect(blurText.hidden).toEqual({ filter: 'blur(10px)', opacity: 0, y: 50 })
  })

  it('visible state clears the blur filter to "blur(0px)"', () => {
    const visible = blurText.visible as Record<string, unknown>
    expect(visible.filter).toBe('blur(0px)')
  })

  it('visible state has opacity 1 and y 0', () => {
    const visible = blurText.visible as Record<string, unknown>
    expect(visible.opacity).toBe(1)
    expect(visible.y).toBe(0)
  })

  it('visible.transition.duration is greater than 0', () => {
    const visible = blurText.visible as Record<string, unknown>
    const transition = visible.transition as Record<string, unknown>
    expect(Number(transition.duration)).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// toastSlide
// ---------------------------------------------------------------------------

describe('toastSlide', () => {
  it('has an "exit" state (toasts must animate out)', () => {
    expect(toastSlide).toHaveProperty('exit')
  })

  it('hidden state has opacity 0, y -24, and scale 0.96', () => {
    expect(toastSlide.hidden).toEqual({ opacity: 0, y: -24, scale: 0.96 })
  })

  it('visible state has opacity 1, y 0, scale 1', () => {
    const visible = toastSlide.visible as Record<string, unknown>
    expect(visible.opacity).toBe(1)
    expect(visible.y).toBe(0)
    expect(visible.scale).toBe(1)
  })

  it('visible.transition.duration is greater than 0', () => {
    const visible = toastSlide.visible as Record<string, unknown>
    const transition = visible.transition as Record<string, unknown>
    expect(Number(transition.duration)).toBeGreaterThan(0)
  })

  it('exit state has opacity 0 (fades out on dismiss)', () => {
    const exit = toastSlide.exit as Record<string, unknown>
    expect(exit.opacity).toBe(0)
  })

  it('exit state slides back upward (negative y)', () => {
    const exit = toastSlide.exit as Record<string, unknown>
    expect(Number(exit.y)).toBeLessThan(0)
  })

  it('exit.transition.duration is greater than 0', () => {
    const exit = toastSlide.exit as Record<string, unknown>
    const transition = exit.transition as Record<string, unknown>
    expect(Number(transition.duration)).toBeGreaterThan(0)
  })
})
