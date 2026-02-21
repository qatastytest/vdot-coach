import type { Metadata } from "next";
import "./globals.css";
import { AppNav } from "@/components/navigation/AppNav";
import { ProfileRouteGuard } from "@/components/auth/ProfileRouteGuard";

export const metadata: Metadata = {
  title: "VDOT Coach",
  description:
    "Daniels-style VDOT calculator, race prediction, pace zones, HR estimates, and conservative rule-based running plans."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-cloud text-ink">
        <div className="min-h-screen">
          <AppNav />
          <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
            <ProfileRouteGuard>{children}</ProfileRouteGuard>
          </main>
        </div>
      </body>
    </html>
  );
}
