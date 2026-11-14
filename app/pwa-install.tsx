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
          <div><strong>Installe ZAVO sur ton appareil.</strong><p>Ouvre ZAVO comme une application, sans barre d’adresse.</p></div>
        </div>
        <div className="install-actions">
          <button className="install-now" onClick={install}><Download size={15} /> Installer ZAVO</button>
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
              <><p>Chrome ne propose pas encore le bouton d’installation directe à ZAVO. Vérifie les étapes suivantes :</p><ol><li>Ouvre ZAVO dans Google Chrome, dans un onglet normal (pas en navigation privée).</li><li>Actualise la page après quelques instants, puis ouvre le menu ⋮.</li><li>Choisis « Installer l’application » si Chrome le propose. La confirmation affichée par Android/Chrome est obligatoire.</li></ol><p><strong>Important :</strong> « Ajouter à l’écran d’accueil » peut, selon le navigateur, créer un raccourci plutôt qu’une application autonome.</p></>
            )}
            <p className="install-help-note">Le site ne peut pas supprimer la confirmation système de Chrome ni forcer l’installation en silence. Une fois installée via l’option native, ZAVO doit s’ouvrir en mode autonome grâce à son manifeste.</p>
            <button className="primary-action modal-submit" onClick={() => setHelpOpen(false)}>J’ai compris</button>
          </section>
        </div>
      )}
    </>
  );
}
