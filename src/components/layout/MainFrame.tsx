"use client";

import { usePathname } from "next/navigation";

interface MainFrameProps {
  children: React.ReactNode;
}

export function MainFrame({ children }: MainFrameProps): React.JSX.Element {
  const pathname = usePathname();
  const isLogin = pathname === "/";

  if (isLogin) {
    return <main className="min-h-screen w-full p-0">{children}</main>;
  }

  return <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">{children}</main>;
}
