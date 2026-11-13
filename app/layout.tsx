import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "ZAVO — Watch. Create. Connect.", description: "Discover videos, connect with creators and grow your brand on ZAVO.", manifest: "/manifest.json", themeColor: "#080812" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="fr"><body>{children}</body></html>; }