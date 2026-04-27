import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: {
    default: "Admin Panel",
    template: "%s · Admin",
  },
  robots: { index: false, follow: false },
};

/**
 * Admin layout (F15.1).
 *
 * Wraps every /admin/** route in the admin shell:
 *   - Left sidebar (desktop) / drawer (mobile)
 *   - Sticky topbar with breadcrumb, theme toggle, admin badge, logout
 *   - Client-side admin role guard (middleware already gates at the network)
 *
 * Sibling pages (/admin/cikkek, /admin/termekek, etc.) inherit this layout
 * automatically through Next.js App Router nesting.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
