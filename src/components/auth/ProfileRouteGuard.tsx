"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getActiveProfileId } from "@/lib/storage/local";

interface ProfileRouteGuardProps {
  children: React.ReactNode;
}

export function ProfileRouteGuard({ children }: ProfileRouteGuardProps): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (pathname === "/") {
      setAllowed(true);
      return;
    }

    const activeProfileId = getActiveProfileId();
    if (!activeProfileId) {
      setAllowed(false);
      router.replace("/");
      return;
    }

    setAllowed(true);
  }, [pathname, router]);

  if (!allowed) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-600">Loading profile...</p>
      </div>
    );
  }

  return <>{children}</>;
}
