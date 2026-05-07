import { vi, describe, it, expect } from 'vitest';

// The AdminSidebar module is a "use client" React component file.
// We mock every external module it imports so it can be evaluated in a
// Node (non-jsdom) environment without errors.

vi.mock('next/link', () => ({ default: () => null }));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('lucide-react', () => ({
  BarChart3: () => null,
  ChevronRight: () => null,
  ClipboardList: () => null,
  Coins: () => null,
  FileText: () => null,
  MessageSquare: () => null,
  Newspaper: () => null,
  Package: () => null,
  ShoppingBag: () => null,
  Star: () => null,
  Ticket: () => null,
  Users: () => null,
  Vote: () => null,
}));
vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

import {
  ADMIN_NAV_GROUPS,
  findActiveNavItem,
} from '@/components/admin/AdminSidebar';

// ---------------------------------------------------------------------------
// ADMIN_NAV_GROUPS — structural invariants
// ---------------------------------------------------------------------------

describe('ADMIN_NAV_GROUPS', () => {
  it('contains exactly 4 groups', () => {
    expect(ADMIN_NAV_GROUPS).toHaveLength(4);
  });

  it('first group label is "Tartalom" with 3 items', () => {
    expect(ADMIN_NAV_GROUPS[0].label).toBe('Tartalom');
    expect(ADMIN_NAV_GROUPS[0].items).toHaveLength(3);
  });

  it('second group label is "Sport" with 2 items', () => {
    expect(ADMIN_NAV_GROUPS[1].label).toBe('Sport');
    expect(ADMIN_NAV_GROUPS[1].items).toHaveLength(2);
  });

  it('third group label is "Kereskedelem" with 4 items', () => {
    expect(ADMIN_NAV_GROUPS[2].label).toBe('Kereskedelem');
    expect(ADMIN_NAV_GROUPS[2].items).toHaveLength(4);
  });

  it('fourth group label is "Elemzés" with 1 item', () => {
    expect(ADMIN_NAV_GROUPS[3].label).toBe('Elemzés');
    expect(ADMIN_NAV_GROUPS[3].items).toHaveLength(1);
  });

  it('every item has href, label, and icon properties', () => {
    for (const group of ADMIN_NAV_GROUPS) {
      for (const item of group.items) {
        expect(typeof item.href).toBe('string');
        expect(typeof item.label).toBe('string');
        expect(item.icon).toBeDefined();
      }
    }
  });

  it('every href starts with "/admin/"', () => {
    for (const group of ADMIN_NAV_GROUPS) {
      for (const item of group.items) {
        expect(item.href.startsWith('/admin/')).toBe(true);
      }
    }
  });

  it('contains no duplicate hrefs', () => {
    const hrefs = ADMIN_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    const unique = new Set(hrefs);
    expect(unique.size).toBe(hrefs.length);
  });

  it('every icon is a function (lucide mock)', () => {
    for (const group of ADMIN_NAV_GROUPS) {
      for (const item of group.items) {
        expect(typeof item.icon).toBe('function');
      }
    }
  });

  it('total nav item count across all groups is 10', () => {
    const total = ADMIN_NAV_GROUPS.reduce(
      (sum, group) => sum + group.items.length,
      0,
    );
    expect(total).toBe(10);
  });

  it('contains a "Cikkek" item with href "/admin/cikkek"', () => {
    const allItems = ADMIN_NAV_GROUPS.flatMap((g) => g.items);
    const cikkek = allItems.find((i) => i.href === '/admin/cikkek');
    expect(cikkek).toBeDefined();
    expect(cikkek?.label).toBe('Cikkek');
  });
});

// ---------------------------------------------------------------------------
// findActiveNavItem — no match cases
// ---------------------------------------------------------------------------

describe('findActiveNavItem — no match', () => {
  it('returns null for "/admin" (not a registered nav item)', () => {
    expect(findActiveNavItem('/admin')).toBeNull();
  });

  it('returns null for the root path "/"', () => {
    expect(findActiveNavItem('/')).toBeNull();
  });

  it('returns null for an unknown admin path "/admin/ismeretlen"', () => {
    expect(findActiveNavItem('/admin/ismeretlen')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(findActiveNavItem('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// findActiveNavItem — exact match
// ---------------------------------------------------------------------------

describe('findActiveNavItem — exact match', () => {
  it('returns the Cikkek item for "/admin/cikkek"', () => {
    const result = findActiveNavItem('/admin/cikkek');
    expect(result).not.toBeNull();
    expect(result?.href).toBe('/admin/cikkek');
    expect(result?.label).toBe('Cikkek');
  });

  it('returns the Termékek item for "/admin/termekek"', () => {
    const result = findActiveNavItem('/admin/termekek');
    expect(result).not.toBeNull();
    expect(result?.label).toBe('Termékek');
  });

  it('returns the Analitika item for "/admin/analitika"', () => {
    const result = findActiveNavItem('/admin/analitika');
    expect(result).not.toBeNull();
    expect(result?.label).toBe('Analitika');
  });

  it('returns the Meccsek item for "/admin/meccsek"', () => {
    const result = findActiveNavItem('/admin/meccsek');
    expect(result).not.toBeNull();
    expect(result?.label).toBe('Meccsek');
  });
});

// ---------------------------------------------------------------------------
// findActiveNavItem — startsWith match (nested routes)
// ---------------------------------------------------------------------------

describe('findActiveNavItem — startsWith match', () => {
  it('returns the Cikkek item for "/admin/cikkek/uj"', () => {
    const result = findActiveNavItem('/admin/cikkek/uj');
    expect(result).not.toBeNull();
    expect(result?.href).toBe('/admin/cikkek');
    expect(result?.label).toBe('Cikkek');
  });

  it('returns the Termékek item for "/admin/termekek/123"', () => {
    const result = findActiveNavItem('/admin/termekek/123');
    expect(result).not.toBeNull();
    expect(result?.label).toBe('Termékek');
  });

  it('returns the Rendelések item for "/admin/rendelesek/detail/456"', () => {
    const result = findActiveNavItem('/admin/rendelesek/detail/456');
    expect(result).not.toBeNull();
    expect(result?.label).toBe('Rendelések');
  });

  it('returns the Kuponok item for "/admin/kuponok/edit"', () => {
    const result = findActiveNavItem('/admin/kuponok/edit');
    expect(result).not.toBeNull();
    expect(result?.label).toBe('Kuponok');
  });
});

// ---------------------------------------------------------------------------
// findActiveNavItem — prefix collision guard
// ---------------------------------------------------------------------------

describe('findActiveNavItem — prefix collision guard', () => {
  it('returns null for "/admin/cikkekalap" (no slash separator after href)', () => {
    // The path does NOT start with "/admin/cikkek/" — only starts with "/admin/cikkek"
    // without a trailing slash, so it must not match.
    expect(findActiveNavItem('/admin/cikkekalap')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// findActiveNavItem — returned item structure
// ---------------------------------------------------------------------------

describe('findActiveNavItem — returned item structure', () => {
  it('returned item has href, label, and icon properties', () => {
    const result = findActiveNavItem('/admin/meccsek');
    expect(result).not.toBeNull();
    expect(typeof result?.href).toBe('string');
    expect(typeof result?.label).toBe('string');
    expect(typeof result?.icon).toBe('function');
  });

  it('returns label "Szavazások" for "/admin/szavazasok"', () => {
    expect(findActiveNavItem('/admin/szavazasok')?.label).toBe('Szavazások');
  });
});
