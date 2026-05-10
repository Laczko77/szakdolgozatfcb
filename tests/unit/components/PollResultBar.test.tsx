// @vitest-environment jsdom
/**
 * PollResultBar component unit tests.
 *
 * framer-motion is mocked to a plain <div> so the test environment does not
 * need to handle animation frame scheduling.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock framer-motion — replace motion.div with a plain div
// ---------------------------------------------------------------------------
vi.mock('framer-motion', () => ({
  motion: {
    // eslint-disable-next-line react/display-name
    div: React.forwardRef(
      (props: React.HTMLAttributes<HTMLDivElement> & { [k: string]: unknown }, ref: React.Ref<HTMLDivElement>) => {
        const {
          initial: _initial,
          animate: _animate,
          whileInView: _whileInView,
          viewport: _viewport,
          transition: _transition,
          exit: _exit,
          variants: _variants,
          ...domProps
        } = props;
        return <div ref={ref} {...domProps} />;
      },
    ),
  },
}));

import { PollResultBar } from '@/components/polls/PollResultBar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface BarProps {
  label?: string;
  votes?: number;
  totalVotes?: number;
  isUserVote?: boolean;
  isCorrect?: boolean;
  index?: number;
  isNone?: boolean;
}

function renderBar(overrides: BarProps = {}) {
  const props = {
    label: 'Messi',
    votes: 3,
    totalVotes: 10,
    isUserVote: false,
    isCorrect: false,
    index: 0,
    isNone: false,
    ...overrides,
  };
  return render(<PollResultBar {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PollResultBar', () => {
  describe('pct calculation', () => {
    it('computes the correct percentage: 3/10 → 30%', () => {
      renderBar({ votes: 3, totalVotes: 10 });
      expect(screen.getByText('30%')).toBeDefined();
    });

    it('rounds to nearest integer: 1/3 → 33%', () => {
      renderBar({ votes: 1, totalVotes: 3 });
      expect(screen.getByText('33%')).toBeDefined();
    });

    it('rounds up correctly: 2/3 → 67%', () => {
      renderBar({ votes: 2, totalVotes: 3 });
      expect(screen.getByText('67%')).toBeDefined();
    });

    it('returns 0% when totalVotes is 0 (edge case)', () => {
      renderBar({ votes: 0, totalVotes: 0 });
      expect(screen.getByText('0%')).toBeDefined();
    });

    it('returns 0% when votes is 0 but totalVotes > 0', () => {
      renderBar({ votes: 0, totalVotes: 100 });
      expect(screen.getByText('0%')).toBeDefined();
    });

    it('returns 100% when votes equals totalVotes', () => {
      renderBar({ votes: 50, totalVotes: 50 });
      expect(screen.getByText('100%')).toBeDefined();
    });

    it('returns 50% for equal split', () => {
      renderBar({ votes: 5, totalVotes: 10 });
      expect(screen.getByText('50%')).toBeDefined();
    });

    it('returns 20% for 1/5', () => {
      renderBar({ votes: 1, totalVotes: 5 });
      expect(screen.getByText('20%')).toBeDefined();
    });
  });

  describe('label rendering', () => {
    it('renders the label text', () => {
      renderBar({ label: 'Pedri' });
      expect(screen.getByText('Pedri')).toBeDefined();
    });

    it('renders the vote count', () => {
      renderBar({ votes: 42, totalVotes: 100 });
      // Rendered via toLocaleString("hu-HU") — for small numbers this is just the number
      expect(screen.getByText('42')).toBeDefined();
    });
  });

  describe('isCorrect flag', () => {
    it('renders "Helyes válasz" aria-label when isCorrect=true', () => {
      renderBar({ isCorrect: true });
      expect(screen.getByLabelText('Helyes válasz')).toBeDefined();
    });

    it('does NOT render "Helyes válasz" when isCorrect=false', () => {
      renderBar({ isCorrect: false });
      expect(screen.queryByLabelText('Helyes válasz')).toBeNull();
    });
  });

  describe('isUserVote flag', () => {
    it('renders "Te szavazatod" aria-label when isUserVote=true and isCorrect=false', () => {
      renderBar({ isUserVote: true, isCorrect: false });
      expect(screen.getByLabelText('Te szavazatod')).toBeDefined();
    });

    it('does NOT render "Te szavazatod" when isUserVote=false', () => {
      renderBar({ isUserVote: false, isCorrect: false });
      expect(screen.queryByLabelText('Te szavazatod')).toBeNull();
    });
  });

  describe('isUserVote + isCorrect combined', () => {
    it('renders "Helyesen szavaztál" when both isUserVote=true and isCorrect=true', () => {
      renderBar({ isUserVote: true, isCorrect: true });
      expect(screen.getByLabelText('Helyesen szavaztál')).toBeDefined();
    });

    it('does NOT render "Te szavazatod" when both flags are true (correct styling wins)', () => {
      renderBar({ isUserVote: true, isCorrect: true });
      expect(screen.queryByLabelText('Te szavazatod')).toBeNull();
    });
  });

  describe('isNone flag', () => {
    it('renders "Más / Egyik sem" aria-label when isNone=true and no other flags', () => {
      renderBar({ isNone: true, isUserVote: false, isCorrect: false });
      expect(screen.getByLabelText('Más / Egyik sem')).toBeDefined();
    });

    it('does NOT render "Más / Egyik sem" when isCorrect=true (correct styling wins)', () => {
      renderBar({ isNone: true, isCorrect: true });
      expect(screen.queryByLabelText('Más / Egyik sem')).toBeNull();
    });

    it('does NOT render "Más / Egyik sem" when isUserVote=true (user-vote styling wins)', () => {
      renderBar({ isNone: true, isUserVote: true, isCorrect: false });
      expect(screen.queryByLabelText('Más / Egyik sem')).toBeNull();
    });

    it('does NOT render "Más / Egyik sem" when isNone=false (default)', () => {
      renderBar({ isNone: false });
      expect(screen.queryByLabelText('Más / Egyik sem')).toBeNull();
    });
  });

  describe('aria-hidden on animated fill', () => {
    it('the bar fill div is aria-hidden', () => {
      const { container } = renderBar({ votes: 7, totalVotes: 10 });
      const hiddenEl = container.querySelector('[aria-hidden]');
      expect(hiddenEl).not.toBeNull();
    });
  });
});
