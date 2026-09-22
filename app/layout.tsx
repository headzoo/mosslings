import type { Metadata } from "next";
import { DotGothic16 } from "next/font/google";
import "./globals.css";

const dotGothic = DotGothic16({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dotgothic",
});

export const metadata: Metadata = {
  title: "Mosslings — Small genetic wonders",
  description:
    "A tiny patch of ground. A world of possibility. Meet the Mosslings.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className={dotGothic.variable}>{children}</body>
    </html>
  );
}
