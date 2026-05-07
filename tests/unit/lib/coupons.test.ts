import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest'

// vi.mock is hoisted — must appear before the module-under-test import.
vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(),
}))

import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  applyDiscount,
  redeemCoupon,
  applyCouponToOrder,
  consumeCoupon,
  COUPONS_BUSINESS_RULE_SQLSTATE,
} from '@/lib/coupons'

// ---------------------------------------------------------------------------
// Supabase mock helpers
// ---------------------------------------------------------------------------

/** Build a minimal mock that satisfies the `.rpc(name, params)` call chain. */
function makeRpcMock(result: { data: unknown; error: unknown }) {
  const rpcFn = vi.fn().mockResolvedValue(result)
  ;(createServiceRoleClient as Mock).mockReturnValue({ rpc: rpcFn })
  return rpcFn
}

// ---------------------------------------------------------------------------
// COUPONS_BUSINESS_RULE_SQLSTATE constant
// ---------------------------------------------------------------------------

describe('COUPONS_BUSINESS_RULE_SQLSTATE', () => {
  it('equals "P0001"', () => {
    expect(COUPONS_BUSINESS_RULE_SQLSTATE).toBe('P0001')
  })

  it('is a string', () => {
    expect(typeof COUPONS_BUSINESS_RULE_SQLSTATE).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// redeemCoupon
// ---------------------------------------------------------------------------

describe('redeemCoupon', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the RedeemedCoupon row on success', async () => {
    const fakeRow = {
      id: 'rc-1',
      user_id: 'u-1',
      coupon_id: 'c-1',
      code: 'BARCA-XXXX-YYYY',
      is_used: false,
      created_at: '2025-01-01T00:00:00Z',
    }
    makeRpcMock({ data: fakeRow, error: null })

    const result = await redeemCoupon('u-1', 'c-1')
    expect(result).toEqual(fakeRow)
  })

  it('calls rpc with the correct procedure name and params', async () => {
    const fakeRow = { id: 'rc-2', coupon_id: 'c-2', user_id: 'u-2', code: 'X', is_used: false, created_at: '' }
    const rpc = makeRpcMock({ data: fakeRow, error: null })

    await redeemCoupon('u-2', 'c-2')
    expect(rpc).toHaveBeenCalledWith('redeem_coupon', { p_user_id: 'u-2', p_coupon_id: 'c-2' })
  })

  it('returns an Error wrapping the Postgres error message when the RPC fails', async () => {
    makeRpcMock({ data: null, error: { message: 'Insufficient points', code: 'P0001' } })

    const result = await redeemCoupon('u-3', 'c-3')
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toBe('Insufficient points')
  })

  it('preserves the SQLSTATE code on the returned Error', async () => {
    makeRpcMock({ data: null, error: { message: 'Coupon not found', code: 'P0001' } })

    const result = await redeemCoupon('u-4', 'c-4') as Error & { code?: string }
    expect(result.code).toBe('P0001')
  })

  it('returns an Error when rpc returns null data', async () => {
    makeRpcMock({ data: null, error: null })

    const result = await redeemCoupon('u-5', 'c-5')
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toMatch(/váratlan/)
  })

  it('returns an Error when rpc returns an array instead of an object', async () => {
    makeRpcMock({ data: [], error: null })

    const result = await redeemCoupon('u-6', 'c-6')
    expect(result).toBeInstanceOf(Error)
  })

  it('returns an Error when rpc returns a primitive (string)', async () => {
    makeRpcMock({ data: 'invalid', error: null })

    const result = await redeemCoupon('u-7', 'c-7')
    expect(result).toBeInstanceOf(Error)
  })

  it('uses the fallback message "Adatbázis hiba" when the error has no message', async () => {
    makeRpcMock({ data: null, error: { code: 'P0001' } })

    const result = await redeemCoupon('u-8', 'c-8') as Error
    expect(result.message).toBe('Adatbázis hiba')
  })
})

// ---------------------------------------------------------------------------
// applyCouponToOrder
// ---------------------------------------------------------------------------

describe('applyCouponToOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const validApplyResult = {
    redeemed_id: 'rc-10',
    coupon_id: 'c-10',
    discount_type: 'percentage',
    discount_value: 10,
  }

  it('returns a CouponApplyResult on success', async () => {
    makeRpcMock({ data: validApplyResult, error: null })

    const result = await applyCouponToOrder('o-1', 'u-1', 'BARCA-AAAA-BBBB')
    expect(result).toEqual(validApplyResult)
  })

  it('calls rpc with the correct params', async () => {
    const rpc = makeRpcMock({ data: validApplyResult, error: null })

    await applyCouponToOrder('o-2', 'u-2', 'CODE-123')
    expect(rpc).toHaveBeenCalledWith('apply_coupon_to_order', {
      p_order_id: 'o-2',
      p_user_id: 'u-2',
      p_code: 'CODE-123',
    })
  })

  it('returns an Error wrapping the Postgres error on RPC failure', async () => {
    makeRpcMock({ data: null, error: { message: 'Code already used', code: 'P0001' } })

    const result = await applyCouponToOrder('o-3', 'u-3', 'USED-CODE')
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toBe('Code already used')
  })

  it('preserves the SQLSTATE code on the Error', async () => {
    makeRpcMock({ data: null, error: { message: 'Order not found', code: 'P0001' } })

    const result = await applyCouponToOrder('o-4', 'u-4', 'C') as Error & { code?: string }
    expect(result.code).toBe('P0001')
  })

  it('returns an Error when data is null', async () => {
    makeRpcMock({ data: null, error: null })

    const result = await applyCouponToOrder('o-5', 'u-5', 'C5')
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toMatch(/váratlan/)
  })

  it('returns an Error when data is an array', async () => {
    makeRpcMock({ data: [validApplyResult], error: null })

    const result = await applyCouponToOrder('o-6', 'u-6', 'C6')
    expect(result).toBeInstanceOf(Error)
  })

  it('returns an Error when redeemed_id is missing', async () => {
    makeRpcMock({ data: { coupon_id: 'c', discount_type: 'fixed', discount_value: 5 }, error: null })

    const result = await applyCouponToOrder('o-7', 'u-7', 'C7')
    expect(result).toBeInstanceOf(Error)
  })

  it('returns an Error when discount_value is a string instead of number', async () => {
    makeRpcMock({
      data: { redeemed_id: 'rc', coupon_id: 'c', discount_type: 'fixed', discount_value: '5' },
      error: null,
    })

    const result = await applyCouponToOrder('o-8', 'u-8', 'C8')
    expect(result).toBeInstanceOf(Error)
  })

  it('handles fixed discount type', async () => {
    const fixedResult = { redeemed_id: 'rc-11', coupon_id: 'c-11', discount_type: 'fixed', discount_value: 500 }
    makeRpcMock({ data: fixedResult, error: null })

    const result = await applyCouponToOrder('o-9', 'u-9', 'C9')
    expect(result).toEqual(fixedResult)
  })

  it('handles free_shipping discount type', async () => {
    const shippingResult = { redeemed_id: 'rc-12', coupon_id: 'c-12', discount_type: 'free_shipping', discount_value: 0 }
    makeRpcMock({ data: shippingResult, error: null })

    const result = await applyCouponToOrder('o-10', 'u-10', 'C10')
    expect(result).toEqual(shippingResult)
  })
})

// ---------------------------------------------------------------------------
// consumeCoupon
// ---------------------------------------------------------------------------

describe('consumeCoupon', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const validConsumeResult = {
    redeemed_id: 'rc-20',
    coupon_id: 'c-20',
    discount_type: 'percentage',
    discount_value: 15,
  }

  it('returns a CouponApplyResult on success', async () => {
    makeRpcMock({ data: validConsumeResult, error: null })

    const result = await consumeCoupon('u-20', 'BARCA-CCCC-DDDD')
    expect(result).toEqual(validConsumeResult)
  })

  it('calls rpc with the correct procedure name and params', async () => {
    const rpc = makeRpcMock({ data: validConsumeResult, error: null })

    await consumeCoupon('u-21', 'TICKET-CODE')
    expect(rpc).toHaveBeenCalledWith('consume_coupon', {
      p_user_id: 'u-21',
      p_code: 'TICKET-CODE',
    })
  })

  it('returns an Error on Postgres RPC failure', async () => {
    makeRpcMock({ data: null, error: { message: 'Not owned by user', code: 'P0001' } })

    const result = await consumeCoupon('u-22', 'BAD-CODE')
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toBe('Not owned by user')
  })

  it('preserves SQLSTATE on returned Error', async () => {
    makeRpcMock({ data: null, error: { message: 'err', code: 'P0001' } })

    const result = await consumeCoupon('u-23', 'C23') as Error & { code?: string }
    expect(result.code).toBe('P0001')
  })

  it('returns an Error when data is null', async () => {
    makeRpcMock({ data: null, error: null })

    const result = await consumeCoupon('u-24', 'C24')
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toMatch(/váratlan/)
  })

  it('returns an Error when data is an array', async () => {
    makeRpcMock({ data: [], error: null })

    const result = await consumeCoupon('u-25', 'C25')
    expect(result).toBeInstanceOf(Error)
  })

  it('returns an Error when coupon_id field is missing', async () => {
    makeRpcMock({
      data: { redeemed_id: 'rc', discount_type: 'fixed', discount_value: 10 },
      error: null,
    })

    const result = await consumeCoupon('u-26', 'C26')
    expect(result).toBeInstanceOf(Error)
  })
})

// ---------------------------------------------------------------------------
// applyDiscount (existing tests kept; additional edge cases added below)
// ---------------------------------------------------------------------------

describe('applyDiscount', () => {
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
      const result = applyDiscount(100, 'percentage', 33.333_333)
      expect(result.discount).toBe(33.33)
      expect(result.final).toBe(66.67)
    })

    it('works with a zero subtotal', () => {
      const result = applyDiscount(0, 'percentage', 50)
      expect(result.final).toBe(0)
      expect(result.discount).toBe(0)
    })
  })

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
      const result = applyDiscount(1000, 'fixed', 333.336)
      expect(result.discount).toBe(333.34)
      expect(result.final).toBe(666.66)
    })
  })

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

  describe('return value shape', () => {
    it('always returns an object with numeric final and discount properties', () => {
      const result = applyDiscount(500, 'percentage', 20)
      expect(typeof result.final).toBe('number')
      expect(typeof result.discount).toBe('number')
    })

    it('final + discount always equals subtotal within floating-point rounding', () => {
      const subtotal = 789.5
      const result = applyDiscount(subtotal, 'percentage', 37)
      expect(Math.abs(result.final + result.discount - subtotal)).toBeLessThanOrEqual(0.01)
    })
  })
})
