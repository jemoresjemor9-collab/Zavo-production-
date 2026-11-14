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
    if (choice.outcome === "accepted") {
      // The appinstalled event is the reliable confirmation that installation completed.
      setHelpOpen(false);
    }
    setInstallPrompt(null);
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
          <button className="install-now" onClick={install}><Download size={15} /> {installPrompt ? "Installer l’application" : "Vérifier l’installation"}</button>
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