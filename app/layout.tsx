import type { Metadata } from "next";
import "./globals.css";
import { AppNav } from "@/components/navigation/AppNav";
import { ProfileRouteGuard } from "@/components/auth/ProfileRouteGuard";
import { MainFrame } from "@/components/layout/MainFrame";

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
          <MainFrame>
            <ProfileRouteGuard>{children}</ProfileRouteGuard>
          </MainFrame>
        </div>
      </body>
    </html>
  );
}
