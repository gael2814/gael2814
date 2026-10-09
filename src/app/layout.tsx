import type { Metadata, Viewport } from "next";
import { Alfa_Slab_One, Rye, Work_Sans } from "next/font/google";
import "./globals.css";

const display = Alfa_Slab_One({ weight: "400", subsets: ["latin"], variable: "--font-display", display: "swap" });
const western = Rye({ weight: "400", subsets: ["latin"], variable: "--font-western", display: "swap" });
const body = Work_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Ay Ay Tacos | Authentic Mexican Food in Caribou, Maine", template: "%s | Ay Ay Tacos" },
  description:
    "Authentic Mexican food, made from scratch in Northern Maine. Preorder quesabirrias and lunch for pickup at 117 Sweden Street, Caribou.",
};

export const viewport: Viewport = { themeColor: "#1f3d2b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${western.variable} ${body.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
