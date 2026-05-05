import type { Metadata, Viewport } from "next";
import { Bebas_Neue, DM_Sans } from "next/font/google";
import { ThemeProvider, themeFlashPreventionScript } from "@/providers/ThemeProvider";
import { ToastProvider } from "@/providers/ToastProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import { CartProvider } from "@/providers/CartProvider";
import { ConsentProvider } from "@/providers/ConsentProvider";
import { SearchProvider } from "@/providers/SearchProvider";
import { Navbar } from "@/components/layout/Navbar";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/shop/CartDrawer";
import { CookieBanner } from "@/components/common/CookieBanner";
import { PageTrackingMount } from "@/components/common/PageTrackingMount";
import { CommandPalette } from "@/components/search/CommandPalette";
import "./globals.css";

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const dmSans = DM_Sans({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FC Barcelona Szurkolói Portál",
    template: "%s | FC Barcelona Szurkolói Portál",
  },
  description:
    "A magyar Barça-rajongók közössége — hírek, mérkőzések, közösség és pontok.",
  icons: {
    icon: "/images/logo/logo.png",
    apple: "/images/logo/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0e1a" },
    { media: "(prefers-color-scheme: light)", color: "#faf9f6" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="hu"
      suppressHydrationWarning
      className={`${bebas.variable} ${dmSans.variable} h-full antialiased`}
    >
      <head>
        {/* Prevents the white flash by setting data-theme before paint. */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeFlashPreventionScript }}
        />
      </head>
      <body className="bg-bg-primary text-text-primary min-h-screen flex flex-col transition-colors duration-300">
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <CartProvider>
                <ConsentProvider>
                  <SearchProvider>
                  {/* Mobile-only sticky top bar (sub-md). */}
                  <MobileHeader />

                  {/* Desktop-only floating pill navbar (md+). */}
                  <Navbar />

                  {/*
                    Main content well.
                    - pt-4 on desktop matches the navbar's `top-4` offset.
                    - pt-2 on mobile is enough — MobileHeader is `sticky top-0` and
                      pushes content naturally; we just need a small breathing room.
                    - pb-20 on mobile reserves space for the fixed bottom tab bar
                      (~64px tab + safe-area inset).
                  */}
                  <main className="flex-1 pt-2 pb-20 md:pt-4 md:pb-0">
                    {children}
                  </main>

                  {/* Site-wide footer (above the mobile tab bar). */}
                  <Footer />

                  {/* Mobile-only fixed bottom tab bar (sub-md). */}
                  <BottomTabBar />

                  {/* Slide-in cart drawer — globally mounted so any page can
                      openCart() through useCart(). */}
                  <CartDrawer />

                  {/* GDPR cookie consent banner — F14.1. Mounted once,
                      reactively driven by ConsentProvider. */}
                  <CookieBanner />

                  {/* Page-view tracking listener — F14.2. Hook-only client
                      component that pings /api/tracking/pageview on every
                      route change once consent is granted. */}
                  <PageTrackingMount />

                  {/* Global command palette — F10.6. Mounted once at the
                      app root so any page can open it via Ctrl/Cmd+K or
                      the SearchProvider's `open()` method. */}
                  <CommandPalette />
                  </SearchProvider>
                </ConsentProvider>
              </CartProvider>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
