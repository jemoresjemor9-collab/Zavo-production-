"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Home, Compass, Plus, MessageCircle, UserRound, Search, Heart,
  MessageSquare, Share2, Bell, LogIn, LogOut, Clapperboard,
  TrendingUp, Store, X, UploadCloud, Play, Bookmark, ArrowRight
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import PwaInstall from "@/app/pwa-install";
import PwaRegister from "@/app/pwa-register";

type Video = {
  id: string;
  caption: string;
  video_url: string;
  user_id: string;
  views_count: number;
  profiles?: { username: string; display_name: string; avatar_url?: string | null };
};

export default function HomePage() {
  const [tab, setTab] = useState("Accueil");
  const [videos, setVideos] = useState<Video[]>([]);
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup" | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [liked, setLiked] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);

  async function loadVideos() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("videos")
      .select("id,caption,video_url,user_id,views_count,profiles(username,display_name,avatar_url)")
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(24);
    if (error) {
      setNotice("Impossible de charger le flux pour le moment.");
      return;
    }
    setVideos((data || []) as Video[]);
  }

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, value) => setSession(value));
    loadVideos();
    return () => subscription.unsubscribe();
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setNotice(error?.message || "Tu es connecté.");
    setBusy(false);
    if (!error) setAuthMode(null);
  }

  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setNotice(error?.message || "Compte créé. Consulte ton e-mail pour confirmer ton adresse si demandé.");
    setBusy(false);
    if (!error) setAuthMode(null);
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !session || !file) return;
    setBusy(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = session.user.id + "/" + Date.now() + "-" + safeName;
    const uploaded = await supabase.storage.from("zavo-videos").upload(path, file, { contentType: file.type });
    if (uploaded.error) {
      setNotice(uploaded.error.message);
      setBusy(false);
      return;
    }
    const { data: publicData } = supabase.storage.from("zavo-videos").getPublicUrl(path);
    const { error } = await supabase.from("videos").insert({
      user_id: session.user.id,
      caption,
      video_url: publicData.publicUrl
    });
    setNotice(error?.message || "Ta vidéo est publiée.");
    setBusy(false);
    setUploadOpen(false);
    setCaption("");
    setFile(null);
    loadVideos();
  }

  async function toggleLike(videoId: string) {
    if (!supabase || !session) {
      setAuthMode("signin");
      return;
    }
    const alreadyLiked = liked.includes(videoId);
    setLiked((current) => alreadyLiked ? current.filter((id) => id !== videoId) : [...current, videoId]);
    const result = alreadyLiked
      ? await supabase.from("likes").delete().eq("user_id", session.user.id).eq("video_id", videoId)
      : await supabase.from("likes").insert({ user_id: session.user.id, video_id: videoId });
    if (result.error) {
      setLiked((current) => alreadyLiked ? [...current, videoId] : current.filter((id) => id !== videoId));
      if (result.error.code !== "23505") setNotice(result.error.message);
    }
  }

  const navItems = [
    { label: "Accueil", icon: Home },
    { label: "Découvrir", icon: Compass },
    { label: "Messages", icon: MessageCircle },
    { label: "Profil", icon: UserRound }
  ];

  return (
    <main className="zavo-app">
      <PwaRegister />
      <aside className="sidebar">
        <a className="brand-lockup" href="/" aria-label="ZAVO, accueil">
          <img src="/icons/zavo-192.png" alt="Logo ZAVO" />
          <span>ZAVO</span>
        </a>
        <div className="brand-caption">REGARDE · CRÉE · PARTAGE</div>
        <nav className="side-nav" aria-label="Navigation principale">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.label} className={tab === item.label ? "nav-link active" : "nav-link"} onClick={() => setTab(item.label)}>
                <Icon size={19} strokeWidth={2.1} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <button className="publish-side" onClick={() => session ? setUploadOpen(true) : setAuthMode("signin")}>
          <Plus size={19} /> Publier une vidéo
        </button>
        <div className="sidebar-bottom">
          <div className="live-indicator"><span /> ZAVO est ouvert à tous</div>
          <p>Une nouvelle scène pour les créateurs.</p>
        </div>
      </aside>

      <section className="main-column">
        <header className="topbar">
          <a className="mobile-brand" href="/">
            <img src="/icons/zavo-192.png" alt="" />
            <strong>ZAVO</strong>
          </a>
          <label className="search-box">
            <Search size={18} />
            <input placeholder="Rechercher une vidéo, un créateur ou une boutique" aria-label="Recherche" />
            <kbd>⌕</kbd>
          </label>
          <div className="top-actions">
            <button className="top-icon" aria-label="Notifications" onClick={() => setNotice("Les notifications seront disponibles dans une prochaine mise à jour.")}><Bell size={19} /></button>
            {session ? (
              <>
                <button className="profile-chip" onClick={() => setTab("Profil")} aria-label="Mon profil">{(session.user.email || "Z").slice(0, 1).toUpperCase()}</button>
                <button className="login-button" onClick={() => supabase?.auth.signOut()}><LogOut size={16} /><span>Déconnexion</span></button>
              </>
            ) : (
              <button className="login-button" onClick={() => setAuthMode("signin")}><LogIn size={16} /><span>Connexion</span></button>
            )}
          </div>
        </header>

        <div className="page-content">
          <PwaInstall />
          <section className="welcome-panel">
            <div className="welcome-copy">
              <div className="eyebrow"><span className="eyebrow-mark" /> LA PLATEFORME QUI RASSEMBLE</div>
              <h1>Les vidéos. Les idées.<br /><span>Tout commence ici.</span></h1>
              <p>Découvre des créateurs, partage tes vidéos et fais connaître ce que tu construis.</p>
              <div className="welcome-actions">
                <button className="primary-action" onClick={() => session ? setUploadOpen(true) : setAuthMode("signup")}>
                  <Clapperboard size={17} /> Publier ma première vidéo
                </button>
                <button className="secondary-action" onClick={() => setTab("Découvrir")}>
                  Explorer ZAVO <ArrowRight size={16} />
                </button>
              </div>
            </div>
            <div className="welcome-art">
              <img src="/icons/zavo-512.png" alt="Emblème ZAVO rouge, bleu et vert" />
              <div className="art-caption"><span className="red-dot" /><span className="blue-dot" /><span className="green-dot" /> Une plateforme. Toutes les voix.</div>
            </div>
          </section>

          {notice && <div className="notice" role="status">{notice}<button aria-label="Fermer" onClick={() => setNotice("")}><X size={15} /></button></div>}

          <div className="feed-toolbar">
            <div>
              <div className="section-kicker">LE FLUX ZAVO</div>
              <h2>{tab === "Découvrir" ? "À découvrir" : tab === "Accueil" ? "À regarder maintenant" : tab}</h2>
            </div>
            <div className="feed-tabs" role="tablist" aria-label="Filtres du flux">
              {["Pour toi", "Abonnements", "Récents"].map((label) => (
                <button key={label} className={(tab === label || (tab === "Accueil" && label === "Pour toi")) ? "selected" : ""} onClick={() => setTab(label)}>{label}</button>
              ))}
            </div>
          </div>

          {!supabase && <div className="notice">La connexion à la base de données doit être configurée pour activer les comptes et les vidéos.</div>}

          {tab === "Messages" || tab === "Profil" ? (
            <section className="empty-state">
              <div className="empty-icon">{tab === "Messages" ? <MessageCircle size={25} /> : <UserRound size={25} />}</div>
              <h3>{tab === "Messages" ? "Ta messagerie arrive" : "Ton espace personnel"}</h3>
              <p>{tab === "Messages" ? "Les conversations privées seront activées dans la prochaine étape du développement." : "Connecte-toi pour retrouver ton profil et tes publications."}</p>
              {!session && <button className="primary-action" onClick={() => setAuthMode("signin")}>Connexion</button>}
            </section>
          ) : videos.length === 0 ? (
            <section className="empty-state">
              <div className="empty-icon"><Play size={25} /></div>
              <h3>La scène est à toi.</h3>
              <p>Les premières vidéos apparaîtront ici. Crée ton compte et publie la première vidéo de la communauté.</p>
              <button className="primary-action" onClick={() => session ? setUploadOpen(true) : setAuthMode("signup")}>Commencer sur ZAVO <ArrowRight size={16} /></button>
            </section>
          ) : (
            <div className="video-grid">
              {videos.map((video) => (
                <article className="video-card" key={video.id}>
                  <div className="video-frame">
                    <video src={video.video_url} controls playsInline preload="metadata" />
                    <span className="video-label">ZAVO</span>
                  </div>
                  <div className="video-details">
                    <div className="creator-row">
                      <div className="creator-avatar">{(video.profiles?.display_name || "Z").slice(0, 1).toUpperCase()}</div>
                      <div className="creator-meta"><strong>{video.profiles?.display_name || "Créateur ZAVO"}</strong><span>@{video.profiles?.username || "createur"}</span></div>
                      <button className="follow-button" onClick={() => setNotice("Les abonnements seront activés dans la prochaine mise à jour.")}>Suivre</button>
                    </div>
                    <p className="video-caption">{video.caption}</p>
                    <div className="video-controls">
                      <button className={liked.includes(video.id) ? "engagement liked" : "engagement"} onClick={() => toggleLike(video.id)}><Heart size={17} fill={liked.includes(video.id) ? "currentColor" : "none"} /> J’aime</button>
                      <button className="engagement" onClick={() => setNotice("Les commentaires seront activés dans la prochaine mise à jour.")}><MessageSquare size={17} /> Commenter</button>
                      <button className={saved.includes(video.id) ? "save-button saved" : "save-button"} aria-label="Enregistrer" onClick={() => setSaved((current) => current.includes(video.id) ? current.filter((id) => id !== video.id) : [...current, video.id])}><Bookmark size={17} fill={saved.includes(video.id) ? "currentColor" : "none"} /></button>
                      <button className="save-button" aria-label="Partager" onClick={() => navigator.clipboard?.writeText(window.location.href)}><Share2 size={17} /></button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          <footer className="site-footer">
            <div className="footer-brand"><img src="/icons/zavo-192.png" alt="" /> ZAVO</div>
            <span>Regarde · Crée · Partage</span>
            <span>© 2026 ZAVO</span>
          </footer>
        </div>
      </section>

      <aside className="right-rail">
        <section className="rail-card">
          <div className="rail-heading"><h3>Sur ZAVO</h3><span className="tiny-status">EN DIRECT</span></div>
          <div className="rail-feature">
            <span className="feature-icon red-feature"><TrendingUp size={18} /></span>
            <div><strong>Découvre les tendances</strong><p>Les vidéos qui font parler.</p></div>
          </div>
          <div className="rail-feature">
            <span className="feature-icon blue-feature"><MessageCircle size={18} /></span>
            <div><strong>Rencontre la communauté</strong><p>Échange avec les créateurs.</p></div>
          </div>
          <div className="rail-feature">
            <span className="feature-icon green-feature"><Store size={18} /></span>
            <div><strong>Fais connaître ton activité</strong><p>La vitrine des marques et boutiques.</p></div>
          </div>
        </section>
        <section className="business-card">
          <div className="business-topline"><span className="green-dot" /> POUR LES ENTREPRISES</div>
          <h3>Ton activité mérite<br />d’être découverte.</h3>
          <p>Prépare tes campagnes et présente tes produits à la communauté ZAVO.</p>
          <button onClick={() => setNotice("Le Centre publicitaire sera activé après l'intégration des paiements.")}>Découvrir la publicité <ArrowRight size={15} /></button>
        </section>
        <div className="rail-links"><a href="#">Conditions</a><a href="#">Confidentialité</a><a href="#">Règles de la communauté</a></div>
      </aside>

      {authMode && (
        <div className="modal-backdrop" onClick={() => setAuthMode(null)}>
          <section className="modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setAuthMode(null)} aria-label="Fermer"><X /></button>
            <div className="modal-brand"><img src="/icons/zavo-192.png" alt="" /><span>ZAVO</span></div>
            <div className="section-kicker">{authMode === "signin" ? "HEUREUX DE TE REVOIR" : "REJOINS LA COMMUNAUTÉ"}</div>
            <h2>{authMode === "signin" ? "Connexion" : "Créer ton compte"}</h2>
            <p>Un espace pour regarder, créer et partager.</p>
            <form onSubmit={authMode === "signin" ? signIn : signUp}>
              <label htmlFor="email">Adresse e-mail</label>
              <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="toi@exemple.com" />
              <label htmlFor="password">Mot de passe</label>
              <input id="password" type="password" autoComplete={authMode === "signin" ? "current-password" : "new-password"} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="6 caractères minimum" />
              <button className="primary-action modal-submit" disabled={busy}>{busy ? "Patiente..." : authMode === "signin" ? "Se connecter" : "Créer mon compte"}</button>
            </form>
            <button className="switch-auth" onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")}>
              {authMode === "signin" ? "Pas encore de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
            </button>
          </section>
        </div>
      )}

      {uploadOpen && (
        <div className="modal-backdrop" onClick={() => setUploadOpen(false)}>
          <section className="modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setUploadOpen(false)} aria-label="Fermer"><X /></button>
            <div className="section-kicker">PARTAGE TON TALENT</div>
            <h2>Publier une vidéo</h2>
            <form onSubmit={publish}>
              <label htmlFor="video-file" className="upload-drop"><UploadCloud size={25} /><span>{file ? file.name : "Choisir une vidéo MP4, WebM ou MOV"}</span><input id="video-file" type="file" accept="video/mp4,video/webm,video/quicktime" required onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
              <label htmlFor="caption">Légende</label>
              <textarea id="caption" value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Présente ta vidéo à la communauté..." />
              <button className="primary-action modal-submit" disabled={busy || !file}>{busy ? "Publication..." : "Publier maintenant"}</button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
