import { describe, it, expect, vi } from 'vitest';

// lucide-react exports React components (functions). In a node environment
// without jsdom/React, we mock them so the module can be imported cleanly.
vi.mock('lucide-react', () => ({
  Home: () => null,
  ShoppingBag: () => null,
  Ticket: () => null,
  Users: () => null,
  User: () => null,
}));

import {
  desktopNavLinks,
  mobileTabs,
  isRouteActive,
} from '@/components/layout/navigation.config';

// ---------------------------------------------------------------------------
// isRouteActive
// ---------------------------------------------------------------------------

describe('isRouteActive', () => {
  describe('pathname is null or falsy', () => {
    it('returns false when pathname is null (non-root href)', () => {
      expect(isRouteActive('/hirek', null)).toBe(false);
    });

    it('returns false when pathname is null (root href)', () => {
      expect(isRouteActive('/', null)).toBe(false);
    });

    it('returns false when pathname is an empty string', () => {
      expect(isRouteActive('/hirek', '')).toBe(false);
    });
  });

  describe('root href "/"', () => {
    it('returns true for exact root match', () => {
      expect(isRouteActive('/', '/')).toBe(true);
    });

    it('returns false when pathname is a non-root path (startsWith guard)', () => {
      expect(isRouteActive('/', '/hirek')).toBe(false);
    });

    it('returns false when pathname is a nested non-root path', () => {
      expect(isRouteActive('/', '/shop/123')).toBe(false);
    });
  });

  describe('exact match (non-root href)', () => {
    it('returns true for /shop exact match', () => {
      expect(isRouteActive('/shop', '/shop')).toBe(true);
    });

    it('returns true for /hirek exact match', () => {
      expect(isRouteActive('/hirek', '/hirek')).toBe(true);
    });

    it('returns true for /jegyek exact match', () => {
      expect(isRouteActive('/jegyek', '/jegyek')).toBe(true);
    });
  });

  describe('startsWith match — nested routes', () => {
    it('returns true for /shop when pathname is /shop/123', () => {
      expect(isRouteActive('/shop', '/shop/123')).toBe(true);
    });

    it('returns true for /shop when pathname is /shop/category/t-shirts', () => {
      expect(isRouteActive('/shop', '/shop/category/t-shirts')).toBe(true);
    });

    it('returns true for /jegyek when pathname is /jegyek/purchase', () => {
      expect(isRouteActive('/jegyek', '/jegyek/purchase')).toBe(true);
    });
  });

  describe('non-matching paths', () => {
    it('returns false for /shop when pathname is /hirek', () => {
      expect(isRouteActive('/shop', '/hirek')).toBe(false);
    });

    it('returns false for /hirek when pathname is /shop', () => {
      expect(isRouteActive('/hirek', '/shop')).toBe(false);
    });

    it('returns false for /jatekosok when pathname is /kozosseg', () => {
      expect(isRouteActive('/jatekosok', '/kozosseg')).toBe(false);
    });
  });

  describe('prefix collision edge cases', () => {
    it('returns false for /shop when pathname is /shopkeeper (no slash separator)', () => {
      expect(isRouteActive('/shop', '/shopkeeper')).toBe(false);
    });

    it('returns false for /kozosseg when pathname is /kozosseg-valami', () => {
      expect(isRouteActive('/kozosseg', '/kozosseg-valami')).toBe(false);
    });

    it('returns false for /hirek when pathname is /hirekarchivum', () => {
      expect(isRouteActive('/hirek', '/hirekarchivum')).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// desktopNavLinks
// ---------------------------------------------------------------------------

describe('desktopNavLinks', () => {
  it('contains exactly 7 links', () => {
    expect(desktopNavLinks).toHaveLength(7);
  });

  it('every link has a non-empty string label', () => {
    for (const link of desktopNavLinks) {
      expect(typeof link.label).toBe('string');
      expect(link.label.length).toBeGreaterThan(0);
    }
  });

  it('every link has a string href starting with "/"', () => {
    for (const link of desktopNavLinks) {
      expect(typeof link.href).toBe('string');
      expect(link.href.startsWith('/')).toBe(true);
    }
  });

  it('first link is Hírek → /hirek', () => {
    expect(desktopNavLinks[0]).toEqual({ label: 'Hírek', href: '/hirek' });
  });

  it('contains no duplicate hrefs', () => {
    const hrefs = desktopNavLinks.map((l) => l.href);
    const unique = new Set(hrefs);
    expect(unique.size).toBe(hrefs.length);
  });

  it('contains no duplicate labels', () => {
    const labels = desktopNavLinks.map((l) => l.label);
    const unique = new Set(labels);
    expect(unique.size).toBe(labels.length);
  });

  it('contains the expected hrefs in order', () => {
    const hrefs = desktopNavLinks.map((l) => l.href);
    expect(hrefs).toEqual([
      '/hirek',
      '/shop',
      '/jegyek',
      '/jatekosok',
      '/season',
      '/kozosseg',
      '/szavazasok',
    ]);
  });
});

// ---------------------------------------------------------------------------
// mobileTabs
// ---------------------------------------------------------------------------

describe('mobileTabs', () => {
  it('contains exactly 5 tabs', () => {
    expect(mobileTabs).toHaveLength(5);
  });

  it('every tab has a non-empty string label', () => {
    for (const tab of mobileTabs) {
      expect(typeof tab.label).toBe('string');
      expect(tab.label.length).toBeGreaterThan(0);
    }
  });

  it('every tab has a string href starting with "/"', () => {
    for (const tab of mobileTabs) {
      expect(typeof tab.href).toBe('string');
      expect(tab.href.startsWith('/')).toBe(true);
    }
  });

  it('every tab has an icon that is a function (LucideIcon)', () => {
    for (const tab of mobileTabs) {
      expect(typeof tab.icon).toBe('function');
    }
  });

  it('first tab is Főoldal → /', () => {
    expect(mobileTabs[0].label).toBe('Főoldal');
    expect(mobileTabs[0].href).toBe('/');
  });

  it('contains no duplicate hrefs', () => {
    const hrefs = mobileTabs.map((t) => t.href);
    const unique = new Set(hrefs);
    expect(unique.size).toBe(hrefs.length);
  });

  it('contains no duplicate labels', () => {
    const labels = mobileTabs.map((t) => t.label);
    const unique = new Set(labels);
    expect(unique.size).toBe(labels.length);
  });

  it('contains the expected hrefs in order', () => {
    const hrefs = mobileTabs.map((t) => t.href);
    expect(hrefs).toEqual(['/', '/shop', '/jegyek', '/kozosseg', '/profil']);
  });

  it('each tab has exactly the keys: label, href, icon', () => {
    for (const tab of mobileTabs) {
      expect(Object.keys(tab).sort()).toEqual(['href', 'icon', 'label']);
    }
  });
});
