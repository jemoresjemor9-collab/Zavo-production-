import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZAVO — Regarde. Crée. Partage.",
  description: "Découvre des créateurs, partage tes vidéos et fais connaître ton activité sur ZAVO.",
  applicationName: "ZAVO",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "ZAVO" },
  icons: {
    icon: [
      { url: "/icons/zavo-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/zavo-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/zavo-192.png", sizes: "192x192", type: "image/png" }]
  }
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#103a8a",
  viewportFit: "cover"
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}