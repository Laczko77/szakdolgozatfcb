import { describe, it, expect } from 'vitest'
import { applyDiscount } from '@/lib/coupons'

// Only applyDiscount is tested here — redeemCoupon, applyCouponToOrder, and
// consumeCoupon all require a live Supabase service-role client and are
// therefore excluded from unit testing.

describe('applyDiscount', () => {
  // -------------------------------------------------------------------------
  // percentage
  // -------------------------------------------------------------------------

  describe("discountType = 'percentage'", () => {
    it('returns 10% off a 1000 Ft subtotal', () => {
      const result = applyDiscount(1000, 'percentage', 10)
      expect(result.final).toBe(900)
      expect(result.discount).toBe(100)
    })

    it('returns no discount for 0%', () => {
      const result = applyDiscount(1000, 'percentage', 0)
      expect(result.final).toBe(1000)
      expect(result.discount).toBe(0)
    })

    it('returns final=0 for 100%', () => {
      const result = applyDiscount(1000, 'percentage', 100)
      expect(result.final).toBe(0)
      expect(result.discount).toBe(1000)
    })

    it('clamps 150% to 100% so final=0 and discount equals the full subtotal', () => {
      const result = applyDiscount(1000, 'percentage', 150)
      expect(result.final).toBe(0)
      expect(result.discount).toBe(1000)
    })

    it('clamps negative percentage to 0 so no discount is applied', () => {
      const result = applyDiscount(1000, 'percentage', -10)
      expect(result.final).toBe(1000)
      expect(result.discount).toBe(0)
    })

    it('applies fractional percentages correctly and rounds to 2 decimals', () => {
      // 33.333...% of 100 = 33.33
      const result = applyDiscount(100, 'percentage', 33.333_333)
      expect(result.discount).toBe(33.33)
      expect(result.final).toBe(66.67)
    })
  })

  // -------------------------------------------------------------------------
  // fixed
  // -------------------------------------------------------------------------

  describe("discountType = 'fixed'", () => {
    it('subtracts a fixed amount from the subtotal', () => {
      const result = applyDiscount(1000, 'fixed', 500)
      expect(result.final).toBe(500)
      expect(result.discount).toBe(500)
    })

    it('caps discount at the subtotal when the fixed amount exceeds it', () => {
      const result = applyDiscount(1000, 'fixed', 1500)
      expect(result.final).toBe(0)
      expect(result.discount).toBe(1000)
    })

    it('applies a fixed discount equal to the subtotal resulting in final=0', () => {
      const result = applyDiscount(500, 'fixed', 500)
      expect(result.final).toBe(0)
      expect(result.discount).toBe(500)
    })

    it('clamps a negative discountValue to 0 so no discount is applied', () => {
      const result = applyDiscount(1000, 'fixed', -200)
      expect(result.final).toBe(1000)
      expect(result.discount).toBe(0)
    })

    it('rounds the discount and final to 2 decimal places', () => {
      // 1000 - 333.336 → discount capped at 333.34 after toFixed
      const result = applyDiscount(1000, 'fixed', 333.336)
      expect(result.discount).toBe(333.34)
      expect(result.final).toBe(666.66)
    })
  })

  // -------------------------------------------------------------------------
  // free_shipping
  // -------------------------------------------------------------------------

  describe("discountType = 'free_shipping'", () => {
    it('never modifies the subtotal regardless of discountValue', () => {
      const result = applyDiscount(1000, 'free_shipping', 999)
      expect(result.discount).toBe(0)
      expect(result.final).toBe(1000)
    })

    it('works with a zero subtotal', () => {
      const result = applyDiscount(0, 'free_shipping', 0)
      expect(result.discount).toBe(0)
      expect(result.final).toBe(0)
    })

    it('works with a large subtotal', () => {
      const result = applyDiscount(99_999.99, 'free_shipping', 1)
      expect(result.discount).toBe(0)
      expect(result.final).toBe(99_999.99)
    })
  })

  // -------------------------------------------------------------------------
  // Return-value shape
  // -------------------------------------------------------------------------

  describe('return value', () => {
    it('always returns an object with numeric final and discount properties', () => {
      const result = applyDiscount(500, 'percentage', 20)
      expect(typeof result.final).toBe('number')
      expect(typeof result.discount).toBe('number')
    })

    it('final + discount always equals subtotal (within floating-point rounding)', () => {
      const subtotal = 789.5
      const result = applyDiscount(subtotal, 'percentage', 37)
      // Both values are rounded to 2 dp individually, so allow 1 cent rounding slack
      expect(Math.abs(result.final + result.discount - subtotal)).toBeLessThanOrEqual(0.01)
    })
  })
})
