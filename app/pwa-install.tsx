"use client";

import { useEffect, useState } from "react";
import { Download, X, Smartphone, Monitor, Share } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    __zavoDeferredInstallPrompt?: InstallPromptEvent | null;
    __zavoAppInstalled?: boolean;
  }
}

export default function PwaInstall() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.__zavoAppInstalled === true;
    setStandalone(isStandalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream);

    const syncPrompt = () => {
      if (window.__zavoDeferredInstallPrompt) {
        setInstallPrompt(window.__zavoDeferredInstallPrompt);
      }
    };
    const onInstalled = () => {
      window.__zavoAppInstalled = true;
      window.__zavoDeferredInstallPrompt = null;
      setStandalone(true);
      setInstallPrompt(null);
      setHelpOpen(false);
    };

    // The prompt is captured in the document head before React hydrates.
    // Read the stored event immediately, then listen for future browser events.
    syncPrompt();
    window.addEventListener("zavo:install-prompt-ready", syncPrompt);
    window.addEventListener("zavo:app-installed", onInstalled);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("zavo:install-prompt-ready", syncPrompt);
      window.removeEventListener("zavo:app-installed", onInstalled);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    const promptEvent = installPrompt || window.__zavoDeferredInstallPrompt || null;
    if (!promptEvent) {
      setHelpOpen(true);
      return;
    }

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    window.__zavoDeferredInstallPrompt = null;
    setInstallPrompt(null);
    if (choice.outcome === "accepted") {
      // appinstalled is the confirmation that the browser completed installation.
      setHelpOpen(false);
    }
  }

  if (standalone || dismissed) return null;

  return (
    <>
      <section className="install-banner" aria-label="Installer ZAVO">
        <div className="install-copy">
          <span className="install-icon"><Download size={18} /></span>
          <div><strong>Installe la vraie application ZAVO.</strong><p>Une installation autonome, pas un simple raccourci.</p></div>
        </div>
        <div className="install-actions">
          <button className="install-now" onClick={install}><Download size={15} /> Installer l’application</button>
          <button className="install-dismiss" onClick={() => setDismissed(true)}>Plus tard</button>
        </div>
        <button className="install-close" aria-label="Fermer" onClick={() => setDismissed(true)}><X size={16} /></button>
      </section>
      {helpOpen && (
        <div className="modal-backdrop" onClick={() => setHelpOpen(false)}>
          <section className="modal install-help" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setHelpOpen(false)} aria-label="Fermer"><X /></button>
            <span className="install-help-icon">{ios ? <Smartphone /> : <Monitor />}</span>
            <div className="section-kicker">INSTALLATION DE L’APPLICATION</div>
            <h2>{ios ? "Installer ZAVO sur iPhone" : "Installation native de ZAVO"}</h2>
            {ios ? (
              <><p>Sur iPhone, Safari ne propose pas le même bouton d’installation native que Chrome. La méthode Apple est :</p><ol><li>Ouvre cette page dans Safari.</li><li>Appuie sur <Share size={14} /> Partager.</li><li>Choisis « Sur l’écran d’accueil » puis « Ajouter » : iOS crée une web app qui s’ouvre en fenêtre autonome.</li></ol></>
            ) : (
              <><p>Le navigateur n’a pas encore transmis à ZAVO son bouton d’installation native. Pour éviter un simple raccourci :</p><ol><li>Ouvre ZAVO dans Google Chrome, dans un onglet normal (pas en navigation privée).</li><li>Actualise la page après quelques instants, puis ouvre le menu ⋮.</li><li>Attends l’option « Installer l’application » ou « Installer ZAVO » et utilise uniquement cette option.</li></ol><p><strong>Important :</strong> si tu ne vois que « Ajouter à l’écran d’accueil » ou « Créer un raccourci », ne sélectionne pas cette option : elle peut créer un simple raccourci.</p></>
            )}
            <p className="install-help-note">ZAVO doit être proposée par le navigateur comme une application installable. Si l’option native n’apparaît pas, le navigateur n’a pas encore validé les critères d’installation sur cet appareil.</p>
            <button className="primary-action modal-submit" onClick={() => setHelpOpen(false)}>J’ai compris</button>
          </section>
        </div>
      )}
    </>
  );
}
