// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { SearchProvider, useSearchPalette } from '@/providers/SearchProvider';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Fixture() {
  const { isOpen, open, close, toggle } = useSearchPalette();
  return (
    <div>
      <span data-testid="status">{isOpen ? 'open' : 'closed'}</span>
      <button data-testid="btn-open" onClick={open}>open</button>
      <button data-testid="btn-close" onClick={close}>close</button>
      <button data-testid="btn-toggle" onClick={toggle}>toggle</button>
    </div>
  );
}

function renderFixture() {
  return render(
    <SearchProvider>
      <Fixture />
    </SearchProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SearchProvider', () => {
  describe('useSearchPalette — outside provider', () => {
    it('throws a descriptive error when used outside SearchProvider', () => {
      // Suppress the expected React error boundary console.error noise
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() =>
        renderHook(() => useSearchPalette()),
      ).toThrow('useSearchPalette must be used inside <SearchProvider />');
      spy.mockRestore();
    });
  });

  describe('initial state', () => {
    it('starts with isOpen = false', () => {
      renderFixture();
      expect(screen.getByTestId('status').textContent).toBe('closed');
    });
  });

  describe('open / close / toggle', () => {
    it('open() sets isOpen to true', async () => {
      const user = userEvent.setup();
      renderFixture();
      await user.click(screen.getByTestId('btn-open'));
      expect(screen.getByTestId('status').textContent).toBe('open');
    });

    it('close() sets isOpen to false', async () => {
      const user = userEvent.setup();
      renderFixture();
      await user.click(screen.getByTestId('btn-open'));
      await user.click(screen.getByTestId('btn-close'));
      expect(screen.getByTestId('status').textContent).toBe('closed');
    });

    it('toggle() flips from closed to open', async () => {
      const user = userEvent.setup();
      renderFixture();
      await user.click(screen.getByTestId('btn-toggle'));
      expect(screen.getByTestId('status').textContent).toBe('open');
    });

    it('toggle() flips from open back to closed', async () => {
      const user = userEvent.setup();
      renderFixture();
      await user.click(screen.getByTestId('btn-toggle'));
      await user.click(screen.getByTestId('btn-toggle'));
      expect(screen.getByTestId('status').textContent).toBe('closed');
    });
  });

  describe('Ctrl+K keyboard shortcut', () => {
    it('Ctrl+K toggles isOpen from closed to open', async () => {
      const user = userEvent.setup();
      renderFixture();
      await user.keyboard('{Control>}k{/Control}');
      expect(screen.getByTestId('status').textContent).toBe('open');
    });

    it('Ctrl+K toggles isOpen from open to closed', async () => {
      const user = userEvent.setup();
      renderFixture();
      await user.keyboard('{Control>}k{/Control}');
      await user.keyboard('{Control>}k{/Control}');
      expect(screen.getByTestId('status').textContent).toBe('closed');
    });

    it('Ctrl+K inside an <input> does NOT trigger toggle', async () => {
      const user = userEvent.setup();
      render(
        <SearchProvider>
          <Fixture />
          <input data-testid="regular-input" />
        </SearchProvider>,
      );
      const input = screen.getByTestId('regular-input');
      await user.click(input);
      await user.keyboard('{Control>}k{/Control}');
      // Should remain closed — regular inputs are blocked
      expect(screen.getByTestId('status').textContent).toBe('closed');
    });

    it('Ctrl+K inside a <textarea> does NOT trigger toggle', async () => {
      const user = userEvent.setup();
      render(
        <SearchProvider>
          <Fixture />
          <textarea data-testid="regular-textarea" />
        </SearchProvider>,
      );
      await user.click(screen.getByTestId('regular-textarea'));
      await user.keyboard('{Control>}k{/Control}');
      expect(screen.getByTestId('status').textContent).toBe('closed');
    });

    it('Ctrl+K inside a [data-command-palette] input DOES toggle (palette input)', async () => {
      const user = userEvent.setup();
      render(
        <SearchProvider>
          <Fixture />
          {/* Simulating the palette's own input */}
          <div data-command-palette>
            <input data-testid="palette-input" />
          </div>
        </SearchProvider>,
      );
      const paletteInput = screen.getByTestId('palette-input');
      await user.click(paletteInput);
      // Focus is now inside [data-command-palette] — shortcut should fire
      await user.keyboard('{Control>}k{/Control}');
      expect(screen.getByTestId('status').textContent).toBe('open');
    });

    it('pressing only "k" (without Ctrl/Meta) does NOT toggle', async () => {
      const user = userEvent.setup();
      renderFixture();
      // Focus on the body / non-input area first
      document.body.focus();
      await user.keyboard('k');
      expect(screen.getByTestId('status').textContent).toBe('closed');
    });
  });

  describe('body scroll lock', () => {
    beforeEach(() => {
      document.body.style.overflow = '';
    });
    afterEach(() => {
      document.body.style.overflow = '';
    });

    it('sets overflow:hidden on body when open', async () => {
      const user = userEvent.setup();
      renderFixture();
      await user.click(screen.getByTestId('btn-open'));
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores overflow when closed', async () => {
      const user = userEvent.setup();
      renderFixture();
      await user.click(screen.getByTestId('btn-open'));
      await user.click(screen.getByTestId('btn-close'));
      // After close the effect cleanup runs and restores the previous value
      expect(document.body.style.overflow).not.toBe('hidden');
    });

    it('does not set overflow when starting closed', () => {
      renderFixture();
      expect(document.body.style.overflow).toBe('');
    });
  });
});
