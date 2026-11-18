import { describe, expect, it } from 'vitest';
import { countUpValue, easeOutCubic } from './countUpMath';

describe('easeOutCubic', () => {
  it('starts at 0 and ends at 1', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it('is past halfway at the halfway point (fast start, gentle end)', () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });

  it('clamps times outside 0-1', () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
  });
});

describe('countUpValue', () => {
  it('counts from 0 to the target', () => {
    expect(countUpValue(70, 0)).toBe(0);
    expect(countUpValue(70, 1)).toBe(70);
  });

  it('shows whole numbers that never go down', () => {
    let last = 0;
    for (let i = 0; i <= 20; i++) {
      const n = countUpValue(174, i / 20);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(last);
      last = n;
    }
  });

  it('stays at 0 for a 0 target', () => {
    expect(countUpValue(0, 0.5)).toBe(0);
  });
});
