import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mosslings — Small bits of wonder",
  description:
    "A tiny patch of ground. A world of possibility. Meet the Mosslings.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
