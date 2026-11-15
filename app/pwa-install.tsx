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
  const [android, setAndroid] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.__zavoAppInstalled === true;
    setStandalone(isStandalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream);
    setAndroid(/android/i.test(navigator.userAgent));

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

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      window.__zavoDeferredInstallPrompt = null;
      setInstallPrompt(null);
      if (choice.outcome === "accepted") setHelpOpen(false);
    } catch (error) {
      console.warn("ZAVO native install prompt failed:", error);
      setHelpOpen(true);
    }
  }

  function openChromeForInstall() {
    window.location.href = "intent://zavo-pink.vercel.app/?source=pwa#Intent;scheme=https;package=com.android.chrome;end";
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
              <><p>Le navigateur actuel ne fournit pas encore le déclencheur d’installation native à ZAVO.</p><ol><li>Ouvre ZAVO dans Google Chrome, dans un onglet normal et hors navigation privée.</li><li>Attends quelques secondes que le service worker soit actif, puis actualise la page.</li><li>Appuie de nouveau sur « Installer ZAVO » : Chrome doit alors afficher sa fenêtre système « Installer l’application ».</li></ol><p>Si Chrome ne propose toujours pas l’installation, ouvre son menu ⋮ et cherche « Installer l’application ». Évite « Ajouter à l’écran d’accueil » lorsqu’il est présenté comme simple raccourci.</p></>
            )}
            <p className="install-help-note">Android et Chrome gardent la confirmation finale : un site ne peut pas installer une application en silence. ZAVO utilise le parcours d’installation natif lorsqu’il est proposé par le navigateur.</p>{android&&!installPrompt&&<button type="button" className="secondary-action modal-submit" onClick={openChromeForInstall}>Ouvrir ZAVO dans Google Chrome</button>}
            <button className="primary-action modal-submit" onClick={() => setHelpOpen(false)}>J’ai compris</button>
          </section>
        </div>
      )}
    </>
  );
}
