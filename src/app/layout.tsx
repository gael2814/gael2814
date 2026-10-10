import type { Metadata, Viewport } from "next";
import { Alfa_Slab_One, Fraunces, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const display = Alfa_Slab_One({ weight: "400", subsets: ["latin"], variable: "--font-display", display: "swap" });
const serif = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], weight: ["600", "700", "800"], variable: "--font-serif", display: "swap" });
const body = Source_Sans_3({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "https://ayaytacos.com"),
  title: { default: "Ay Ay Tacos | Authentic Mexican Food in Caribou, Maine", template: "%s | Ay Ay Tacos" },
  description:
    "Authentic Mexican food, made from scratch in Northern Maine. Preorder quesabirrias and lunch for pickup at 117 Sweden Street, Caribou.",
  openGraph: {
    type: "website",
    siteName: "Ay Ay Tacos",
    url: "/",
    title: "Ay Ay Tacos | Authentic Mexican Food in Caribou, Maine",
    description: "Authentic Mexican food, made from scratch in Northern Maine. Preorder lunch for pickup at 117 Sweden Street, Caribou.",
    images: [{ url: "/photos/quesabirrias-griddle.jpg", alt: "Quesabirrias at Ay Ay Tacos" }],
  },
};

export const viewport: Viewport = { themeColor: "#1f3d2b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${serif.variable} ${body.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
