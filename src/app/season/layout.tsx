import type { Metadata } from "next";

/**
 * Server layout for the /season route — exposes static metadata that the
 * client `page.tsx` cannot ship itself.
 */
export const metadata: Metadata = {
  title: "Szezon",
  description:
    "FC Barcelona La Liga szezon — interaktív vizualizációk a pontok, a forma, a gólkülönbség és a top gólszerzők alakulásáról.",
};

export default function SeasonLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
