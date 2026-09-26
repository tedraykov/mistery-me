import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Мистерия",
  description: "Игра на загадки за компания — всеки с роля, история и тайна.",
};

export const viewport: Viewport = {
  themeColor: "#0c0d11",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg">
      <body>{children}</body>
    </html>
  );
}
