import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeParts } from "@/hooks/useCountdown.helpers";

// We freeze the wall clock at a known instant so the math is deterministic.
const NOW_ISO = "2025-06-01T12:00:00.000Z";
const NOW_MS = new Date(NOW_ISO).getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW_MS));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("computeParts", () => {
  it("returns finished:true with all zeros for null input", () => {
    expect(computeParts(null)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalMs: 0,
      finished: true,
    });
  });

  it("returns finished:true with all zeros for undefined input", () => {
    expect(computeParts(undefined)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalMs: 0,
      finished: true,
    });
  });

  it("returns finished:true for an unparseable date string", () => {
    expect(computeParts("not-a-date")).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalMs: 0,
      finished: true,
    });
  });

  it("returns finished:true for a target exactly at 'now' (diff === 0)", () => {
    const result = computeParts(NOW_ISO);
    expect(result.finished).toBe(true);
    expect(result.totalMs).toBe(0);
  });

  it("returns finished:true for a past target", () => {
    // 1 hour ago.
    const past = new Date(NOW_MS - 60 * 60 * 1000).toISOString();
    const result = computeParts(past);
    expect(result.finished).toBe(true);
    expect(result.totalMs).toBeLessThan(0);
    expect(result.days).toBe(0);
    expect(result.hours).toBe(0);
  });

  it("breaks down a +1 hour target into hours/minutes correctly", () => {
    const target = new Date(NOW_MS + 60 * 60 * 1000).toISOString();
    const result = computeParts(target);
    expect(result.finished).toBe(false);
    expect(result.days).toBe(0);
    expect(result.hours).toBe(1);
    expect(result.minutes).toBe(0);
    expect(result.seconds).toBe(0);
    expect(result.totalMs).toBe(60 * 60 * 1000);
  });

  it("breaks down 90 seconds into 0d 0h 1m 30s", () => {
    const target = new Date(NOW_MS + 90 * 1000).toISOString();
    const result = computeParts(target);
    expect(result).toEqual({
      days: 0,
      hours: 0,
      minutes: 1,
      seconds: 30,
      totalMs: 90 * 1000,
      finished: false,
    });
  });

  it("breaks down 2 days exactly into days only", () => {
    const target = new Date(
      NOW_MS + 2 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const result = computeParts(target);
    expect(result.days).toBe(2);
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(0);
    expect(result.seconds).toBe(0);
    expect(result.finished).toBe(false);
  });

  it("breaks down 1d 2h 3m 4s correctly", () => {
    const ms =
      1 * 24 * 60 * 60 * 1000 +
      2 * 60 * 60 * 1000 +
      3 * 60 * 1000 +
      4 * 1000;
    const target = new Date(NOW_MS + ms).toISOString();
    const result = computeParts(target);
    expect(result).toEqual({
      days: 1,
      hours: 2,
      minutes: 3,
      seconds: 4,
      totalMs: ms,
      finished: false,
    });
  });

  it("sets totalMs to the millisecond delta for a future target", () => {
    const target = new Date(NOW_MS + 5_000).toISOString();
    expect(computeParts(target).totalMs).toBe(5_000);
  });
});
