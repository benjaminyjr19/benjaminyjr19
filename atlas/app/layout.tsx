import type { Metadata } from "next";
import { Toaster } from "sonner";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Atlas",
    template: "%s · Atlas",
  },
  description:
    "A calm, AI-native preschool work platform. Atlas works. Teachers review.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              borderRadius: "14px",
              border: "1px solid hsl(250 16% 91%)",
              boxShadow: "0 8px 24px -12px rgb(88 66 190 / 0.18)",
            },
          }}
        />
      </body>
    </html>
  );
}
