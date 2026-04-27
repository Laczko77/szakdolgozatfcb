import Link from "next/link";
import {
  BarChart3,
  Coins,
  MessageSquare,
  Newspaper,
  Package,
  ShoppingBag,
  Star,
  Ticket,
  Users,
  Vote,
} from "lucide-react";

const QUICK_LINKS = [
  { href: "/admin/cikkek", label: "Cikkek", icon: Newspaper, hint: "Szerkesztés és publikálás" },
  { href: "/admin/termekek", label: "Termékek", icon: Package, hint: "Készlet és variánsok" },
  { href: "/admin/rendelesek", label: "Rendelések", icon: ShoppingBag, hint: "Státuszok kezelése" },
  { href: "/admin/meccsek", label: "Meccsek", icon: Ticket, hint: "Szektorok és jegyek" },
  { href: "/admin/jatekosok", label: "Játékosok", icon: Users, hint: "Keret szinkron" },
  { href: "/admin/posztok", label: "Posztok", icon: MessageSquare, hint: "Közösség moderálása" },
  { href: "/admin/szavazasok", label: "Szavazások", icon: Vote, hint: "Pontozás és lezárás" },
  { href: "/admin/kuponok", label: "Kuponok", icon: Coins, hint: "Pont-bolt kínálat" },
  { href: "/admin/ertekelesek", label: "Értékelések", icon: Star, hint: "Moderálás" },
  { href: "/admin/analitika", label: "Analitika", icon: BarChart3, hint: "Forgalom és bevétel" },
];

export default function AdminIndexPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-gold)]">
          Üdvözlünk újra
        </p>
        <h1 className="font-display text-4xl uppercase tracking-[0.04em] text-[var(--text-primary)] md:text-5xl">
          Admin Vezérlőpult
        </h1>
        <p className="max-w-2xl text-sm text-[var(--text-secondary)]">
          Itt minden tartalom, kereskedelmi és közösségi modul egy helyen.
          Válassz egy területet, vagy a bal oldali menüből navigálj.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {QUICK_LINKS.map(({ href, label, icon: Icon, hint }) => (
          <li key={href}>
            <Link
              href={href}
              className="group flex h-full flex-col gap-3 rounded-md border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-5 transition-colors duration-150 hover:border-[var(--accent-gold)]/40 hover:bg-[var(--bg-tertiary)]/40"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--glass-border)] bg-[var(--bg-tertiary)]/40 text-[var(--text-secondary)] transition-colors group-hover:border-[var(--accent-gold)]/40 group-hover:text-[var(--accent-gold)]">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  →
                </span>
              </div>
              <div>
                <p className="font-display text-lg uppercase tracking-[0.06em] text-[var(--text-primary)]">
                  {label}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">{hint}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
