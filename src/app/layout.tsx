import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./legacy.css";

export const metadata: Metadata = {
  title: "Legacy Gateway — the modern web on an iPad mini (iOS 9)",
  description:
    "A server-side compatibility gateway that lets obsolete browsers (iPad mini / iOS 9.3.6 WebKit) browse the modern web.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="lg-page">{children}</div>
      </body>
    </html>
  );
}
