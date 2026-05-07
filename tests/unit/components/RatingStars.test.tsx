// @vitest-environment jsdom
/**
 * RatingStars component unit tests.
 *
 * No external dependencies beyond lucide-react (which renders SVGs) and
 * @/lib/utils (clsx/tailwind-merge). All tests use RTL.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { RatingStars } from '@/components/shop/RatingStars';

// ---------------------------------------------------------------------------
// Read-only (display) mode
// ---------------------------------------------------------------------------

describe('RatingStars — read-only mode', () => {
  describe('aria-label', () => {
    it('has role="img" with the correct aria-label for a whole number', () => {
      render(<RatingStars value={4} />);
      expect(screen.getByRole('img')).toHaveAttribute(
        'aria-label',
        '4.0 / 5 csillag',
      );
    });

    it('shows one decimal place in the aria-label for a fractional value', () => {
      render(<RatingStars value={3.7} />);
      expect(screen.getByRole('img')).toHaveAttribute(
        'aria-label',
        '3.7 / 5 csillag',
      );
    });

    it('clamps to 0 for negative values', () => {
      render(<RatingStars value={-1} />);
      expect(screen.getByRole('img')).toHaveAttribute(
        'aria-label',
        '0.0 / 5 csillag',
      );
    });

    it('clamps to 5 for values above 5', () => {
      render(<RatingStars value={10} />);
      expect(screen.getByRole('img')).toHaveAttribute(
        'aria-label',
        '5.0 / 5 csillag',
      );
    });

    it('shows 0.0 for a zero value', () => {
      render(<RatingStars value={0} />);
      expect(screen.getByRole('img')).toHaveAttribute(
        'aria-label',
        '0.0 / 5 csillag',
      );
    });
  });

  describe('fillPercent — foreground star width', () => {
    /** Helper: find the aria-hidden foreground element that has an inline style */
    function getForegroundStyle(container: HTMLElement): string {
      const allEls = Array.from(container.querySelectorAll('[aria-hidden]'));
      const el = allEls.find((e) => e.getAttribute('style')) as HTMLElement | undefined;
      return el?.getAttribute('style') ?? '';
    }

    it('sets width to 0% for value=0', () => {
      const { container } = render(<RatingStars value={0} />);
      expect(getForegroundStyle(container)).toContain('0%');
    });

    it('sets width to 100% for value=5', () => {
      const { container } = render(<RatingStars value={5} />);
      expect(getForegroundStyle(container)).toContain('100%');
    });

    it('sets width to 60% for value=3', () => {
      const { container } = render(<RatingStars value={3} />);
      expect(getForegroundStyle(container)).toContain('60%');
    });

    it('sets width to 80% for value=4', () => {
      const { container } = render(<RatingStars value={4} />);
      expect(getForegroundStyle(container)).toContain('80%');
    });

    it('clamps negative value to 0%', () => {
      const { container } = render(<RatingStars value={-3} />);
      expect(getForegroundStyle(container)).toContain('0%');
    });

    it('clamps value > 5 to 100%', () => {
      const { container } = render(<RatingStars value={99} />);
      expect(getForegroundStyle(container)).toContain('100%');
    });

    it('handles fractional values correctly (4.3 → 86%)', () => {
      const { container } = render(<RatingStars value={4.3} />);
      // (4.3 / 5) * 100 = 86
      expect(getForegroundStyle(container)).toContain('86%');
    });
  });

  describe('review count', () => {
    it('renders the count in parentheses when count prop is provided', () => {
      render(<RatingStars value={4} count={123} />);
      expect(screen.getByText('(123)')).toBeDefined();
    });

    it('does not render a count when count prop is omitted', () => {
      const { container } = render(<RatingStars value={4} />);
      expect(container.querySelector('span')).toBeNull();
    });

    it('renders count=0 as (0)', () => {
      render(<RatingStars value={3} count={0} />);
      expect(screen.getByText('(0)')).toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Interactive mode
// ---------------------------------------------------------------------------

describe('RatingStars — interactive mode', () => {
  describe('radiogroup structure', () => {
    it('renders a radiogroup with aria-label "Értékelés"', () => {
      render(<RatingStars value={0} interactive />);
      expect(screen.getByRole('radiogroup')).toHaveAttribute(
        'aria-label',
        'Értékelés',
      );
    });

    it('renders exactly 5 radio buttons', () => {
      render(<RatingStars value={0} interactive />);
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(5);
    });

    it('each button has an aria-label like "N csillag"', () => {
      render(<RatingStars value={0} interactive />);
      for (let n = 1; n <= 5; n++) {
        expect(screen.getByLabelText(`${n} csillag`)).toBeDefined();
      }
    });
  });

  describe('aria-checked state', () => {
    it('marks the rounded value button as aria-checked=true', () => {
      render(<RatingStars value={3} interactive />);
      const btn3 = screen.getByLabelText('3 csillag');
      expect(btn3).toHaveAttribute('aria-checked', 'true');
    });

    it('marks other buttons as aria-checked=false', () => {
      render(<RatingStars value={3} interactive />);
      const btn1 = screen.getByLabelText('1 csillag');
      expect(btn1).toHaveAttribute('aria-checked', 'false');
    });

    it('rounds a fractional value: 3.6 → checks button 4', () => {
      render(<RatingStars value={3.6} interactive />);
      expect(screen.getByLabelText('4 csillag')).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByLabelText('3 csillag')).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('onChange callback', () => {
    it('calls onChange with the clicked star value', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<RatingStars value={0} interactive onChange={onChange} />);
      await user.click(screen.getByLabelText('3 csillag'));
      expect(onChange).toHaveBeenCalledWith(3);
    });

    it('calls onChange=5 when the 5-star button is clicked', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<RatingStars value={0} interactive onChange={onChange} />);
      await user.click(screen.getByLabelText('5 csillag'));
      expect(onChange).toHaveBeenCalledWith(5);
    });

    it('calls onChange=1 when the 1-star button is clicked', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<RatingStars value={0} interactive onChange={onChange} />);
      await user.click(screen.getByLabelText('1 csillag'));
      expect(onChange).toHaveBeenCalledWith(1);
    });

    it('does not throw when onChange is not provided', async () => {
      const user = userEvent.setup();
      render(<RatingStars value={0} interactive />);
      // Should not throw
      await user.click(screen.getByLabelText('2 csillag'));
    });
  });
});
