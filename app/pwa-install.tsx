"use client";

import { useEffect, useState } from "react";
import { Download, X, Smartphone, Monitor, Share } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function PwaInstall() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setStandalone(isStandalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setStandalone(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) {
      setHelpOpen(true);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setStandalone(true);
    setInstallPrompt(null);
  }

  if (standalone || dismissed) return null;

  return (
    <>
      <section className="install-banner" aria-label="Installer ZAVO">
        <div className="install-copy">
          <span className="install-icon"><Download size={18} /></span>
          <div><strong>Emporte ZAVO avec toi.</strong><p>Installe l’application sur ton téléphone ou ton ordinateur.</p></div>
        </div>
        <div className="install-actions">
          <button className="install-now" onClick={install}><Download size={15} /> Installer</button>
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
            <h2>Ajouter ZAVO à ton appareil</h2>
            {ios ? (
              <ol><li>Ouvre cette page dans Safari.</li><li>Appuie sur le bouton <Share size={14} /> Partager.</li><li>Choisis « Sur l’écran d’accueil » puis « Ajouter ».</li></ol>
            ) : (
              <ol><li>Ouvre le menu de ton navigateur (⋮ ou ⋯).</li><li>Choisis « Installer ZAVO » ou « Installer cette page comme application ».</li><li>Confirme l’installation dans la fenêtre du navigateur.</li></ol>
            )}
            <p className="install-help-note">L’installation PWA crée une fenêtre d’application autonome lorsque ton navigateur et ton appareil la prennent en charge.</p>
            <button className="primary-action modal-submit" onClick={() => setHelpOpen(false)}>J’ai compris</button>
          </section>
        </div>
      )}
    </>
  );
}