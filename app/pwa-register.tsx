"use client";

import { useEffect } from "react";

const RESET_KEY = "zavo-pwa-clean-reset-v3";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    const registerClean = async () => {
      try {
        // One-time clean reset: remove the previous ZAVO worker and its shell cache,
        // then install the current worker again from the production origin.
        let alreadyReset = false;
        try { alreadyReset = window.localStorage.getItem(RESET_KEY) === "done"; } catch {}

        if (!alreadyReset) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(
            registrations
              .filter((registration) => registration.scope.startsWith(window.location.origin + "/"))
              .map((registration) => registration.unregister())
          );

          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(
              keys.filter((key) => key.startsWith("zavo-shell-")).map((key) => caches.delete(key))
            );
          }

          try { window.localStorage.setItem(RESET_KEY, "done"); } catch {}
        }

        if (cancelled) return;
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none"
        });
        await registration.update().catch(() => undefined);
      } catch (error) {
        console.error("ZAVO service worker reset/registration failed:", error);
      }
    };

    if (document.readyState === "complete") {
      void registerClean();
    } else {
      const onLoad = () => { void registerClean(); };
      window.addEventListener("load", onLoad, { once: true });
      return () => {
        cancelled = true;
        window.removeEventListener("load", onLoad);
      };
    }

    return () => { cancelled = true; };
  }, []);

  return null;
}
