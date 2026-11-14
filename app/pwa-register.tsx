"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    const register = async () => {
      try {
        // Keep the existing worker intact: unregistering every worker on the
        // origin can interrupt an already-installed PWA and its offline shell.
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none"
        });
        if (cancelled) return;
        await registration.update().catch(() => undefined);
      } catch (error) {
        console.error("ZAVO service worker registration failed:", error);
      }
    };

    void register();
    return () => { cancelled = true; };
  }, []);

  return null;
}
