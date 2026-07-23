import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cpt2026.github.io/weekly-market-radar/";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "每週市場 Radar",
  description: "每週更新的市場風險、VIX、廣度、基本面與宏觀監察 Dashboard。",
  robots: { index: false, follow: false, nocache: true },
  openGraph: {
    title: "每週市場 Radar",
    description: "VIX、市場廣度、基本面與宏觀風險的每週唯讀 Dashboard。",
    images: [{ url: "/radar-social-preview.png", width: 1728, height: 909, alt: "每週市場 Radar 視覺預覽" }],
    type: "website",
  },
  twitter: { card: "summary_large_image", images: ["/radar-social-preview.png"] },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body>{children}</body></html>;
}
