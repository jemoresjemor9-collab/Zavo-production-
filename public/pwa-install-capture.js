(() => {
  if (typeof window === "undefined" || window.__zavoInstallCaptureInstalled) return;
  window.__zavoInstallCaptureInstalled = true;
  window.__zavoDeferredInstallPrompt = null;
  window.__zavoAppInstalled = window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator && window.navigator.standalone === true);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    window.__zavoDeferredInstallPrompt = event;
    window.dispatchEvent(new Event("zavo:install-prompt-ready"));
  });

  window.addEventListener("appinstalled", () => {
    window.__zavoAppInstalled = true;
    window.__zavoDeferredInstallPrompt = null;
    window.dispatchEvent(new Event("zavo:app-installed"));
  });
})();
