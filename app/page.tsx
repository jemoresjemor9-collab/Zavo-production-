"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Home, Compass, Plus, MessageCircle, UserRound, Search, Heart, MessageSquare,
  Share2, Bell, LogIn, LogOut, Clapperboard, Bookmark, Download, WifiOff,
  Flag, Megaphone, Play, Eye, Settings, X, UploadCloud, Send, Check, Trash2,
  MoreHorizontal, Film, Image as ImageIcon, ExternalLink, Users, ShieldCheck, Repeat2
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import PwaInstall from "@/app/pwa-install";
import PwaRegister from "@/app/pwa-register";

type Profile = { id: string; username: string | null; display_name: string | null; avatar_url?: string | null; bio?: string | null; stats_visible?: boolean; account_status?: string; country_code?: string };
type Video = {
  id: string; caption: string; video_url: string; thumbnail_url?: string | null; user_id: string;
  views_count: number; created_at: string; content_type: "short" | "video"; allow_download: boolean;
  show_stats: boolean; moderation_status?: string; isSponsored?: boolean; campaign_id?: string; target_url?: string | null; objective?: string; profiles?: Profile | Profile[] | null;
  likes?: { count: number }[]; comments?: { count: number }[];
};
type Comment = { id: string; body: string; created_at: string; profiles?: Profile | Profile[] | null };

const db = () => supabase;
const visitorKey = () => {
  let key = localStorage.getItem("zavo_visitor_key");
  if (!key) { key = crypto.randomUUID(); localStorage.setItem("zavo_visitor_key", key); }
  return key;
};
function getVideoMime(file: File) {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    mkv: "video/x-matroska", avi: "video/x-msvideo", wmv: "video/x-ms-wmv",
    flv: "video/x-flv", mpg: "video/mpeg", mpeg: "video/mpeg",
    "3gp": "video/3gpp", "3g2": "video/3gpp2", ts: "video/mp2t",
    mov: "video/quicktime", mp4: "video/mp4", webm: "video/webm", ogv: "video/ogg"
  };
  return types[ext || ""] || "video/mp4";
}

async function getVideoMetadata(file: File) {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.src = objectUrl;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Metadata unavailable"));
    });
    return {
      duration_seconds: Number.isFinite(video.duration) ? Math.round(video.duration) : null,
      aspect_ratio: video.videoWidth && video.videoHeight ? (video.videoWidth / video.videoHeight).toFixed(3) : null
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
    video.removeAttribute("src");
    video.load();
  }
}

async function createVideoThumbnail(file: File): Promise<File | null> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.src = objectUrl;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Lecture vidéo impossible"));
    });
    video.currentTime = Math.min(1, Math.max(0, (video.duration || 1) / 2));
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("Image vidéo indisponible"));
    });
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.84));
    return blob ? new File([blob], "zavo-thumbnail.jpg", { type: "image/jpeg" }) : null;
  } finally {
    URL.revokeObjectURL(objectUrl);
    video.removeAttribute("src");
    video.load();
  }
}

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("zavo-offline", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("videos", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function saveOfflineVideo(video: Video) {
  const response = await fetch(video.video_url);
  if (!response.ok) throw new Error("Téléchargement impossible.");
  const blob = await response.blob();
  const database = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction("videos", "readwrite");
    tx.objectStore("videos").put({ id: video.id, blob, caption: video.caption, savedAt: Date.now(), contentType: video.content_type });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  database.close();
}
async function readOfflineVideos(): Promise<any[]> {
  const database = await openOfflineDb();
  const values = await new Promise<any[]>((resolve, reject) => {
    const request = database.transaction("videos", "readonly").objectStore("videos").getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return values;
}
function creatorOf(video: Video) {
  return Array.isArray(video.profiles) ? video.profiles[0] : video.profiles;
}
function safeUrl(value: string) {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; }
}
function Caption({ value }: { value: string }) {
  const parts = value.split(/(https?:\/\/[^\s]+)/g);
  return <>{parts.map((part, index) => {
    const url = safeUrl(part);
    return url ? <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="caption-link">{part} <ExternalLink size={11} /></a> : <span key={index}>{part}</span>;
  })}</>;
}

export default function HomePage() {
  const [tab, setTab] = useState("Pour toi");
  const [videos, setVideos] = useState<Video[]>([]);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup" | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [contentType, setContentType] = useState<"short" | "video">("short");
  const [allowDownload, setAllowDownload] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [liked, setLiked] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [commentsVideo, setCommentsVideo] = useState<Video | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [search, setSearch] = useState("");
  const [offline, setOffline] = useState(false);
  const [offlineVideos, setOfflineVideos] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [dmSearch, setDmSearch] = useState("");
  const [dmUsers, setDmUsers] = useState<Profile[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [dmMessages, setDmMessages] = useState<any[]>([]);
  const [dmText, setDmText] = useState("");
  const [dmBusy, setDmBusy] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [campaignVideo, setCampaignVideo] = useState<Video | null>(null);
  const [campaignBudget, setCampaignBudget] = useState("5000");
  const [campaignObjective, setCampaignObjective] = useState("views");
  const [campaignCountry, setCampaignCountry] = useState("BJ");
  const [reportVideo, setReportVideo] = useState<Video | null>(null);
  const [reportReason, setReportReason] = useState("spam");
  const [profileOpen, setProfileOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [countryCode, setCountryCode] = useState("BJ");
  const [adminData, setAdminData] = useState<any>({ reports: [], campaigns: [], users: [], videos: [] });

  const isAdmin = session?.user?.app_metadata?.role === "admin";

  const loadVideos = useCallback(async () => {
    if (!db()) return;
    let query = db()!.from("videos")
      .select("id,caption,video_url,thumbnail_url,user_id,views_count,created_at,content_type,allow_download,show_stats,moderation_status,profiles(id,username,display_name,avatar_url,stats_visible),likes(count),comments(count)")
      .eq("visibility", "public").eq("moderation_status", "approved")
      .order("created_at", { ascending: false }).limit(40);
    if (tab === "Abonnements" && session?.user?.id) {
      const { data: follows } = await db()!.from("follows").select("following_id").eq("follower_id", session.user.id);
      const ids = (follows || []).map((row: any) => row.following_id);
      if (!ids.length) { setVideos([]); return; }
      query = query.in("user_id", ids);
    }
    if (tab === "Enregistrés" && session?.user?.id) {
      const { data: rows } = await db()!.from("saved_videos").select("video_id").eq("user_id", session.user.id);
      const ids = (rows || []).map((row: any) => row.video_id);
      if (!ids.length) { setVideos([]); return; }
      query = query.in("id", ids);
    }
    const { data, error } = await query;
    if (error) { setNotice("Le flux n'a pas pu être chargé. Réessaie dans un instant."); return; }
    const organic = (data || []) as Video[];
    if (tab === "Pour toi" || tab === "Découvrir") {
      const { data: campaigns } = await db()!.from("ad_campaigns")
        .select("id,video_id,target_url,objective,country_codes,video:videos(id,caption,video_url,thumbnail_url,user_id,views_count,created_at,content_type,allow_download,show_stats,moderation_status,profiles(id,username,display_name,avatar_url,stats_visible),likes(count),comments(count))")
        .eq("status", "active").not("video_id", "is", null).limit(12);
      const sponsored = (campaigns || []).filter((campaign: any) => {
        const countries = campaign.country_codes || [];
        return !countries.length || countries.includes("ALL") || countries.includes(profile?.country_code || "BJ");
      }).map((campaign: any) => {
        const video = Array.isArray(campaign.video) ? campaign.video[0] : campaign.video;
        return video ? { ...video, isSponsored: true, campaign_id: campaign.id, target_url: campaign.target_url, objective: campaign.objective } : null;
      }).filter(Boolean) as Video[];
      const mixed: Video[] = [];
      let adIndex = 0;
      organic.forEach((video, index) => {
        mixed.push(video);
        if ((index + 1) % 5 === 0 && sponsored[adIndex]) mixed.push(sponsored[adIndex++]);
      });
      setVideos(mixed);
    } else {
      setVideos(organic);
    }
  }, [tab, session?.user?.id, profile?.country_code]);

  const loadUserData = useCallback(async (userId: string) => {
    if (!db()) return;
    const [{ data: p }, { data: l }, { data: s }, { data: f }] = await Promise.all([
      db()!.from("profiles").select("*").eq("id", userId).maybeSingle(),
      db()!.from("likes").select("video_id").eq("user_id", userId),
      db()!.from("saved_videos").select("video_id").eq("user_id", userId),
      db()!.from("follows").select("following_id").eq("follower_id", userId)
    ]);
    setProfile(p as Profile | null);
    setDisplayName(p?.display_name || "");
    setBio(p?.bio || "");
    setCountryCode(p?.country_code || "BJ");
    setLiked((l || []).map((x: any) => x.video_id));
    setSaved((s || []).map((x: any) => x.video_id));
    setFollowing((f || []).map((x: any) => x.following_id));
  }, []);

  useEffect(() => {
    if (!db()) return;
    db()!.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user?.id) loadUserData(data.session.user.id);
    });
    const { data: { subscription } } = db()!.auth.onAuthStateChange((_event, value) => {
      setSession(value);
      if (value?.user?.id) loadUserData(value.user.id);
      else { setProfile(null); setLiked([]); setSaved([]); setFollowing([]); }
    });
    loadVideos();
    const onOnline = () => { setOffline(false); setOfflineVideos([]); };
    const onOffline = async () => { setOffline(true); try { setOfflineVideos(await readOfflineVideos()); } catch { setOfflineVideos([]); } };
    setOffline(!navigator.onLine);
    if (!navigator.onLine) onOffline();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { subscription.unsubscribe(); window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, [loadVideos, loadUserData]);

  useEffect(() => { loadVideos(); }, [loadVideos]);
  useEffect(() => { if (tab === "Notifications" && session?.user?.id) loadNotifications(); }, [tab, session?.user?.id]);

  async function searchPeople() {
    if (!db() || !session || dmSearch.trim().length < 2) { setDmUsers([]); return; }
    const term = dmSearch.trim().replace(/[,%]/g, "");
    const { data, error } = await db()!.from("profiles")
      .select("id,username,display_name,avatar_url,bio,account_status")
      .neq("id", session.user.id).eq("account_status", "active")
      .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`).limit(12);
    if (error) setNotice(error.message);
    setDmUsers((data || []) as Profile[]);
  }

  async function openConversation(recipientId: string) {
    if (!session || !db()) { setAuthMode("signin"); return; }
    setDmBusy(true);
    const { data, error } = await db()!.functions.invoke("create-conversation", { body: { recipient_id: recipientId } });
    if (error || !data?.conversation_id) {
      setNotice(error?.message || data?.error || "Impossible d'ouvrir cette conversation.");
      setDmBusy(false);
      return;
    }
    setActiveConversation(data.conversation_id);
    setDmUsers([]);
    setDmSearch("");
    await loadMessages(data.conversation_id);
    setDmBusy(false);
  }

  async function loadMessages(conversationId: string) {
    if (!db()) return;
    const { data, error } = await db()!.from("messages")
      .select("id,conversation_id,sender_id,body,created_at,read_at")
      .eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(200);
    if (error) { setNotice(error.message); return; }
    setDmMessages(data || []);
    await db()!.from("messages").update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId).neq("sender_id", session?.user?.id || "").is("read_at", null);
  }

  async function sendDirectMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !activeConversation || !dmText.trim()) return;
    const body = dmText.trim();
    setDmText("");
    const { error } = await db()!.from("messages").insert({
      conversation_id: activeConversation, sender_id: session.user.id, body
    });
    if (error) { setNotice(error.message); setDmText(body); }
    else await loadMessages(activeConversation);
  }

  useEffect(() => {
    if (!activeConversation || !db()) return;
    const channel = db()!.channel("zavo-chat-" + activeConversation)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: "conversation_id=eq." + activeConversation }, () => loadMessages(activeConversation))
      .subscribe();
    return () => { db()?.removeChannel(channel); };
  }, [activeConversation, session?.user?.id]);

  async function loadNotifications() {
    if (!db() || !session) return;
    const { data } = await db()!.from("notifications").select("*").eq("recipient_id", session.user.id).order("created_at", { ascending: false }).limit(50);
    setNotifications(data || []);
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!db()) return; setBusy(true);
    const { error } = await db()!.auth.signInWithPassword({ email, password });
    setNotice(error?.message || "Connexion réussie."); setBusy(false); if (!error) setAuthMode(null);
  }
  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!db()) return; setBusy(true);
    const clean = username.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
    const { error } = await db()!.auth.signUp({ email, password, options: { data: { username: clean, display_name: clean || "Créateur ZAVO" } } });
    setNotice(error?.message || "Compte créé. Vérifie ton adresse e-mail si une confirmation est demandée.");
    setBusy(false); if (!error) setAuthMode(null);
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db() || !session || !file) return;
    if (!file.type.startsWith("video/")) { setNotice("Choisis un fichier vidéo valide."); return; }
    setBusy(true);
    const base = session.user.id + "/" + crypto.randomUUID();
    const videoPath = base + "-" + file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const videoMime = getVideoMime(file);\n    let videoMetadata: { duration_seconds: number | null; aspect_ratio: string | null } = { duration_seconds: null, aspect_ratio: null };\n    try { videoMetadata = await getVideoMetadata(file); } catch {}\n    const upload = await db()!.storage.from("zavo-videos").upload(videoPath, file, { contentType: videoMime, upsert: false });
    if (upload.error) { setNotice(upload.error.message); setBusy(false); return; }
    const videoUrl = db()!.storage.from("zavo-videos").getPublicUrl(videoPath).data.publicUrl;
    let thumbnailUrl: string | null = null;
    if (thumbnail) {
      const thumbPath = session.user.id + "/" + crypto.randomUUID() + "-" + thumbnail.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const thumbUpload = await db()!.storage.from("zavo-media").upload(thumbPath, thumbnail, { contentType: thumbnail.type });
      if (!thumbUpload.error) thumbnailUrl = db()!.storage.from("zavo-media").getPublicUrl(thumbPath).data.publicUrl;
    }
    const { error } = await db()!.from("videos").insert({
      user_id: session.user.id, caption, video_url: videoUrl, thumbnail_url: thumbnailUrl,
      content_type: contentType, allow_download: allowDownload, show_stats: showStats, visibility: "public", ...videoMetadata
    });
    if (error) setNotice(error.message);
    else { setNotice("Ta vidéo est publiée sur ZAVO."); setUploadOpen(false); setCaption(""); setFile(null); setThumbnail(null); setAllowDownload(false); await loadVideos(); }
    setBusy(false);
  }

  async function toggleVideoStats(video: Video) {
    if (!session || video.user_id !== session.user.id) return;
    const nextValue = !video.show_stats;
    const { error } = await db()!.from("videos").update({ show_stats: nextValue }).eq("id", video.id);
    if (error) setNotice(error.message);
    else setVideos(items => items.map(v => v.id === video.id ? { ...v, show_stats: nextValue } : v));
  }

  async function toggleVideoDownload(video: Video) {
    if (!session || video.user_id !== session.user.id) return;
    const nextValue = !video.allow_download;
    const { error } = await db()!.from("videos").update({ allow_download: nextValue }).eq("id", video.id);
    if (error) setNotice(error.message);
    else setVideos(items => items.map(v => v.id === video.id ? { ...v, allow_download: nextValue } : v));
  }

  async function toggleLike(video: Video) {
    if (!session) { setAuthMode("signin"); return; }
    const exists = liked.includes(video.id);
    setLiked((v) => exists ? v.filter((id) => id !== video.id) : [...v, video.id]);
    const result = exists
      ? await db()!.from("likes").delete().eq("user_id", session.user.id).eq("video_id", video.id)
      : await db()!.from("likes").insert({ user_id: session.user.id, video_id: video.id });
    if (result.error) { setNotice(result.error.message); await loadUserData(session.user.id); }
  }

  async function repostVideo(video: Video) {
    if (!session) { setAuthMode("signin"); return; }
    const { error } = await db()!.from("reposts").insert({ user_id: session.user.id, video_id: video.id });
    setNotice(error?.code === "23505" ? "Tu as déjà partagé cette vidéo sur ton profil." : error ? error.message : "Vidéo partagée sur ton profil.");
  }

  async function toggleSave(video: Video) {
    if (!session) { setAuthMode("signin"); return; }
    const exists = saved.includes(video.id);
    setSaved((v) => exists ? v.filter((id) => id !== video.id) : [...v, video.id]);
    const result = exists
      ? await db()!.from("saved_videos").delete().eq("user_id", session.user.id).eq("video_id", video.id)
      : await db()!.from("saved_videos").insert({ user_id: session.user.id, video_id: video.id });
    if (result.error) { setNotice(result.error.message); await loadUserData(session.user.id); }
  }

  async function toggleFollow(userId: string) {
    if (!session) { setAuthMode("signin"); return; }
    if (userId === session.user.id) return;
    const exists = following.includes(userId);
    setFollowing((v) => exists ? v.filter((id) => id !== userId) : [...v, userId]);
    const result = exists
      ? await db()!.from("follows").delete().eq("follower_id", session.user.id).eq("following_id", userId)
      : await db()!.from("follows").insert({ follower_id: session.user.id, following_id: userId });
    if (result.error) { setNotice(result.error.message); await loadUserData(session.user.id); }
  }

  async function openComments(video: Video) {
    setCommentsVideo(video); setCommentText("");
    const { data } = await db()!.from("comments").select("id,body,created_at,profiles(id,username,display_name,avatar_url)").eq("video_id", video.id).order("created_at", { ascending: true }).limit(100);
    setComments((data || []) as Comment[]);
  }
  async function sendComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) { setAuthMode("signin"); return; }
    if (!commentsVideo || !commentText.trim()) return;
    const { error } = await db()!.from("comments").insert({ video_id: commentsVideo.id, user_id: session.user.id, body: commentText.trim() });
    if (error) setNotice(error.message);
    else { setCommentText(""); await openComments(commentsVideo); await loadVideos(); }
  }

  async function recordView(video: Video, seconds: number) {
    if (!db() || seconds < 2) return;
    const key = visitorKey();
    const payload: any = session?.user?.id
      ? { video_id: video.id, viewer_id: session.user.id, watch_seconds: Math.floor(seconds) }
      : { video_id: video.id, visitor_key: key, watch_seconds: Math.floor(seconds) };
    const { error } = await db()!.from("video_views").insert(payload);
    if (!error) setVideos((items) => items.map((v) => v.id === video.id ? { ...v, views_count: v.views_count + 1 } : v));
  }

  async function downloadVideo(video: Video, offlineOnly = false) {
    if (!video.allow_download) { setNotice("Le créateur n'a pas autorisé le téléchargement de cette vidéo."); return; }
    try {
      if (offlineOnly) {
        await saveOfflineVideo(video);
        setNotice("Vidéo enregistrée dans tes téléchargements ZAVO pour le hors connexion.");
      } else {
        const response = await fetch(video.video_url);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a"); anchor.href = url; anchor.download = "ZAVO-" + video.id + ".mp4";
        document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
      }
    } catch { setNotice("Le téléchargement a échoué. Vérifie ta connexion et réessaie."); }
  }

  async function trackCampaignEvent(campaignId: string | undefined, eventType: "impression" | "click") {
    if (!campaignId || !db()) return;
    await db()!.functions.invoke("track-campaign-event", {
      body: { campaign_id: campaignId, event_type: eventType, visitor_key: visitorKey() }
    });
  }

  async function shareVideo(video: Video) {
    const url = window.location.origin + "/?video=" + video.id;
    try {
      if (navigator.share) await navigator.share({ title: "Vidéo sur ZAVO", text: video.caption, url });
      else { await navigator.clipboard.writeText(url); setNotice("Lien de la vidéo copié."); }
    } catch {}
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!session || !reportVideo) return;
    const { error } = await db()!.from("reports").insert({ reporter_id: session.user.id, target_type: "video", target_id: reportVideo.id, reason: reportReason });
    setNotice(error?.message || "Signalement transmis à l'équipe ZAVO."); setReportVideo(null);
  }

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!session || !campaignVideo) return;
    const amount = Number(campaignBudget);
    if (!Number.isFinite(amount) || amount < 1000) { setNotice("Le budget minimum provisoire est de 1 000 FCFA."); return; }
    const { error } = await db()!.from("ad_campaigns").insert({
      owner_id: session.user.id, video_id: campaignVideo.id, title: "Promotion de ma vidéo",
      target_url: window.location.origin + "/?video=" + campaignVideo.id,
      budget: amount, currency: "XOF", objective: campaignObjective, country_codes: [campaignCountry], status: "awaiting_payment"
    });
    setNotice(error?.message || "Campagne enregistrée en attente de paiement. Aucun débit n'a été effectué.");
    setCampaignOpen(false); setCampaignVideo(null);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!session) return;
    const { error } = await db()!.from("profiles").update({ display_name: displayName, bio, country_code: countryCode }).eq("id", session.user.id);
    setNotice(error?.message || "Profil mis à jour."); setProfileOpen(false); await loadUserData(session.user.id);
  }

  async function loadAdmin() {
    if (!isAdmin || !db()) return;
    const [{ data: reports }, { data: campaigns }, { data: users }, { data: adminVideos }] = await Promise.all([
      db()!.from("reports").select("*").order("created_at", { ascending: false }).limit(100),
      db()!.from("ad_campaigns").select("*").order("created_at", { ascending: false }).limit(100),
      db()!.from("profiles").select("id,username,display_name,account_status,created_at").order("created_at", { ascending: false }).limit(100),
      db()!.from("videos").select("id,caption,user_id,moderation_status,visibility,created_at,profiles(username,display_name)").order("created_at", { ascending: false }).limit(100)
    ]);
    setAdminData({ reports: reports || [], campaigns: campaigns || [], users: users || [], videos: adminVideos || [] });
  }
  useEffect(() => { if (tab === "Administration") loadAdmin(); }, [tab, isAdmin]);

  const visibleVideos = useMemo(() => videos.filter((v) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const p = creatorOf(v);
    return (v.caption || "").toLowerCase().includes(q) || (p?.username || "").toLowerCase().includes(q) || (p?.display_name || "").toLowerCase().includes(q);
  }), [videos, search]);

  const nav = [
    { label: "Pour toi", icon: Home }, { label: "Découvrir", icon: Compass },
    { label: "Abonnements", icon: Users }, { label: "Messages", icon: MessageCircle },
    { label: "Enregistrés", icon: Bookmark }, { label: "Notifications", icon: Bell },
    { label: "Profil", icon: UserRound }
  ];

  if (offline) {
    return <main className="offline-screen"><div className="offline-header"><img src="/icons/zavo-192.png" /><strong>ZAVO</strong><span><WifiOff size={16}/> Hors connexion</span></div><h1>Tes vidéos téléchargées</h1><p>Sans Internet, tu peux regarder uniquement les vidéos enregistrées sur cet appareil.</p><div className="offline-grid">{offlineVideos.map((v) => <article key={v.id}><video controls playsInline src={URL.createObjectURL(v.blob)} /><strong>{v.caption || "Vidéo ZAVO"}</strong></article>)}</div>{offlineVideos.length === 0 && <div className="empty-state">Aucune vidéo téléchargée pour le moment.</div>}</main>;
  }

  return (
    <main className="zavo-app">
      <PwaRegister />
      <aside className="sidebar">
        <a className="brand-lockup" href="/"><img src="/icons/zavo-192.png" alt="Logo ZAVO"/><span>ZAVO</span></a>
        <div className="brand-caption">REGARDE · CRÉE · PARTAGE</div>
        <nav className="side-nav">{nav.map((item) => { const Icon = item.icon; return <button key={item.label} className={tab === item.label ? "nav-link active" : "nav-link"} onClick={() => setTab(item.label)}><Icon size={19}/><span>{item.label}</span></button>; })}</nav>
        <button className="publish-side" onClick={() => session ? setUploadOpen(true) : setAuthMode("signup")}><Plus size={19}/> Publier</button>
        {isAdmin && <button className="nav-link" onClick={() => setTab("Administration")}><ShieldCheck size={18}/> Administration</button>}
        <div className="sidebar-bottom"><div className="live-indicator"><span/> ZAVO est ouvert à tous</div><p>Une plateforme. Toutes les voix.</p></div>
      </aside>

      <section className="main-column">
        <header className="topbar">
          <a className="mobile-brand" href="/"><img src="/icons/zavo-192.png" alt=""/><strong>ZAVO</strong></a>
          <label className="search-box"><Search size={18}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une vidéo ou un créateur"/><kbd>⌕</kbd></label>
          <div className="top-actions">
            <button className="top-icon" aria-label="Notifications" onClick={() => setTab("Notifications")}><Bell size={19}/></button>
            {session ? <><button className="profile-chip" onClick={() => setTab("Profil")}>{(profile?.display_name || session.user.email || "Z").slice(0,1).toUpperCase()}</button><button className="login-button" onClick={() => db()?.auth.signOut()}><LogOut size={16}/><span>Quitter</span></button></> : <button className="login-button" onClick={() => setAuthMode("signin")}><LogIn size={16}/><span>Connexion</span></button>}
          </div>
        </header>
        <div className="page-content">
          <PwaInstall />
          {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Fermer"><X size={15}/></button></div>}
          {tab === "Administration" && isAdmin ? (
            <section className="admin-page"><div className="section-kicker">ESPACE SÉCURISÉ</div><h1>Administration ZAVO</h1><p>Surveillance des contenus, signalements et campagnes. Les actions sensibles restent réservées aux comptes administrateurs.</p><div className="admin-stats"><article><strong>{adminData.users.length}</strong><span>Comptes récents</span></article><article><strong>{adminData.reports.length}</strong><span>Signalements</span></article><article><strong>{adminData.campaigns.length}</strong><span>Campagnes</span></article></div><h2>Signalements</h2>{adminData.reports.map((r: any) => <article className="admin-row" key={r.id}><div><strong>{r.reason}</strong><small>{r.target_type} · {r.status} · {new Date(r.created_at).toLocaleString("fr-FR")}</small></div><button onClick={async () => { await db()!.from("reports").update({status:"reviewing",reviewed_by:session.user.id,reviewed_at:new Date().toISOString()}).eq("id",r.id); loadAdmin(); }}>Prendre en charge</button></article>)}<h2>Campagnes</h2>{adminData.campaigns.map((c: any) => <article className="admin-row" key={c.id}><div><strong>{c.title}</strong><small>{c.budget} {c.currency} · {c.status}</small></div><span>{c.objective}</span>{c.status !== "active" && c.status !== "cancelled" && c.status !== "rejected" && <button onClick={async () => { await db()!.from("ad_campaigns").update({status:"active",start_at:new Date().toISOString()}).eq("id",c.id); loadAdmin(); }}>Activer après paiement vérifié</button>}</article>)}<h2>Contenus publiés</h2>{adminData.videos.map((v: any) => <article className="admin-row" key={v.id}><div><strong>{(v.caption || "Vidéo sans légende").slice(0,90)}</strong><small>@{v.profiles?.username || "créateur"} · {v.moderation_status} · {v.visibility}</small></div><button onClick={async () => { const nextStatus = v.moderation_status === "restricted" ? "approved" : "restricted"; await db()!.from("videos").update({moderation_status:nextStatus}).eq("id",v.id); await db()!.from("moderation_actions").insert({admin_id:session.user.id,target_video_id:v.id,action:nextStatus==="restricted"?"video_removed":"restore",reason:"Décision de modération depuis le tableau de bord"}); loadAdmin(); }}>{v.moderation_status === "restricted" ? "Restaurer" : "Retirer"}</button></article>)}<h2>Comptes récents</h2>{adminData.users.map((u: any) => <article className="admin-row" key={u.id}><div><strong>@{u.username || "utilisateur"}</strong><small>{u.display_name} · {u.account_status}</small></div><button onClick={async () => { const suspended = u.account_status !== "suspended"; await db()!.from("profiles").update({account_status:suspended?"suspended":"active"}).eq("id",u.id); await db()!.from("moderation_actions").insert({admin_id:session.user.id,target_user_id:u.id,action:suspended?"suspend":"unsuspend",reason:"Décision de modération depuis le tableau de bord"}); loadAdmin(); }}>{u.account_status === "suspended" ? "Réactiver" : "Suspendre"}</button></article>)}</section>
          ) : tab === "Messages" ? (
            <section className="messages-page">
              <div className="feed-toolbar"><div><div className="section-kicker">ÉCHANGES PRIVÉS</div><h2>Messages</h2></div></div>
              {!session ? <section className="empty-state"><div className="empty-icon"><MessageCircle/></div><h3>Connecte-toi pour écrire</h3><button className="primary-action" onClick={()=>setAuthMode("signin")}>Connexion</button></section> : <>
                <div className="dm-search"><Search size={17}/><input value={dmSearch} onChange={e=>setDmSearch(e.target.value)} onKeyUp={e=>{if(e.key==="Enter")searchPeople();}} placeholder="Rechercher un créateur ou un utilisateur"/><button onClick={searchPeople}>Rechercher</button></div>
                {dmUsers.length>0 && <div className="dm-results">{dmUsers.map(u=><button key={u.id} onClick={()=>openConversation(u.id)}><span className="creator-avatar">{(u.display_name||"Z").slice(0,1).toUpperCase()}</span><span><strong>{u.display_name||"Utilisateur"}</strong><small>@{u.username||"zavo"}</small></span><MessageCircle size={17}/></button>)}</div>}
                {activeConversation ? <div className="dm-chat"><div className="dm-chat-head"><strong>Conversation privée</strong><button onClick={()=>setActiveConversation(null)}>Fermer</button></div><div className="dm-chat-list">{dmMessages.map(m=><div key={m.id} className={m.sender_id===session.user.id?"dm-message mine":"dm-message"}><p>{m.body}</p><small>{new Date(m.created_at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}{m.sender_id===session.user.id&&m.read_at?" · Lu":""}</small></div>)}</div><form className="dm-send" onSubmit={sendDirectMessage}><input value={dmText} onChange={e=>setDmText(e.target.value)} maxLength={4000} placeholder="Écrire un message..."/><button className="primary-action" disabled={!dmText.trim()}><Send size={16}/></button></form></div> : <section className="empty-state"><div className="empty-icon"><MessageCircle/></div><h3>Parle directement aux créateurs</h3><p>Recherche un utilisateur pour commencer une conversation privée. Les messages sont synchronisés en temps réel.</p></section>}
                {dmBusy&&<p className="dm-loading">Ouverture de la conversation…</p>}
              </>}
            </section>
          ) : tab === "Notifications" ? (
            <section><div className="feed-toolbar"><div><div className="section-kicker">TON ACTIVITÉ</div><h2>Notifications</h2></div></div>{notifications.map((n) => <article className="notification-row" key={n.id}><strong>{n.title}</strong><p>{n.body}</p><small>{new Date(n.created_at).toLocaleString("fr-FR")}</small></article>)}</section>
          ) : tab === "Profil" ? (
            <section className="profile-page"><div className="profile-hero"><div className="profile-avatar">{(profile?.display_name || "Z").slice(0,1).toUpperCase()}</div><div><h1>{profile?.display_name || "Ton profil"}</h1><p>@{profile?.username || "nouveau_createur"}</p><span>{profile?.bio || "Présente-toi à la communauté ZAVO."}</span></div><button onClick={() => setProfileOpen(true)}><Settings size={16}/> Modifier</button></div><div className="profile-actions"><button onClick={() => setTab("Enregistrés")}>Vidéos enregistrées</button><button onClick={() => setCampaignOpen(true)}>Mes promotions</button></div><h2>Mes vidéos</h2><div className="video-grid">{videos.filter(v => v.user_id === session?.user?.id).map(v => <VideoCard key={v.id} video={v} session={session} liked={liked} saved={saved} following={following} onLike={toggleLike} onSave={toggleSave} onFollow={toggleFollow} onComments={openComments} onShare={shareVideo} onReport={setReportVideo} onDownload={downloadVideo} onBoost={(x: Video) => {setCampaignVideo(x);setCampaignOpen(true);}} onView={recordView} onToggleStats={toggleVideoStats} onToggleDownload={toggleVideoDownload} onRepost={repostVideo} onCampaignEvent={trackCampaignEvent}/>)}</div></section>
          ) : (
            <>
              <section className="welcome-panel compact-welcome"><div className="welcome-copy"><div className="eyebrow"><span className="eyebrow-mark"/> LA SCÈNE EST À TOI</div><h1>Regarde. Crée.<br/><span>Fais-toi découvrir.</span></h1><p>Des vidéos de tous les horizons. Publie ton contenu, rassemble ta communauté et développe ton activité.</p><div className="welcome-actions"><button className="primary-action" onClick={() => session ? setUploadOpen(true) : setAuthMode("signup")}><Clapperboard size={17}/> Publier une vidéo</button><button className="secondary-action" onClick={() => setCampaignOpen(true)}><Megaphone size={16}/> Booster mon contenu</button></div></div><div className="welcome-art"><img src="/icons/zavo-512.png" alt="ZAVO"/></div></section>
              <div className="feed-toolbar"><div><div className="section-kicker">LE FLUX ZAVO</div><h2>{tab === "Découvrir" ? "Découvrir" : tab === "Abonnements" ? "Tes abonnements" : tab === "Enregistrés" ? "Vidéos enregistrées" : "Pour toi"}</h2></div><div className="feed-tabs">{["Pour toi","Abonnements","Découvrir","Enregistrés"].map((x: string) => <button key={x} className={tab === x ? "selected" : ""} onClick={() => setTab(x)}>{x}</button>)}</div></div>
              {visibleVideos.length ? <div className="video-grid">{visibleVideos.map(v => <VideoCard key={v.id} video={v} session={session} liked={liked} saved={saved} following={following} onLike={toggleLike} onSave={toggleSave} onFollow={toggleFollow} onComments={openComments} onShare={shareVideo} onReport={setReportVideo} onDownload={downloadVideo} onBoost={(x: Video) => {setCampaignVideo(x);setCampaignOpen(true);}} onView={recordView} onToggleStats={toggleVideoStats} onToggleDownload={toggleVideoDownload}/>)}</div> : <section className="empty-state"><div className="empty-icon"><Play/></div><h3>{tab === "Abonnements" ? "Tu ne suis pas encore de créateur" : "La scène est à toi."}</h3><p>Les vidéos publiques apparaîtront ici. Crée un compte pour publier, suivre et interagir avec les créateurs.</p><button className="primary-action" onClick={() => session ? setUploadOpen(true) : setAuthMode("signup")}>Rejoindre ZAVO</button></section>}
            </>
          )}
          <footer className="site-footer"><div className="footer-brand"><img src="/icons/zavo-192.png" alt=""/> ZAVO</div><span>Regarde · Crée · Partage</span><span>© 2026 ZAVO</span></footer>
        </div>
      </section>
      <aside className="right-rail"><section className="rail-card"><div className="rail-heading"><h3>Sur ZAVO</h3><span className="tiny-status">EN DIRECT</span></div><div className="rail-feature"><span className="feature-icon red-feature"><Film size={18}/></span><div><strong>Des vidéos pour tous</strong><p>Découvre de nouveaux univers.</p></div></div><div className="rail-feature"><span className="feature-icon blue-feature"><Users size={18}/></span><div><strong>Une communauté ouverte</strong><p>Échange avec les créateurs.</p></div></div><div className="rail-feature"><span className="feature-icon green-feature"><Megaphone size={18}/></span><div><strong>Fais grandir ta visibilité</strong><p>Booste tes publications.</p></div></div></section><section className="business-card"><div className="business-topline"><span className="green-dot"/> PROMOTION DE CONTENU</div><h3>Ton contenu mérite<br/>plus de visibilité.</h3><p>Transforme une publication en campagne sponsorisée pour toucher de nouvelles personnes.</p><button onClick={() => setCampaignOpen(true)}>Découvrir le boost <Plus size={15}/></button></section><div className="rail-links"><a href="#">Conditions</a><a href="#">Confidentialité</a><a href="#">Règles de la communauté</a></div></aside>

      {authMode && <div className="modal-backdrop" onClick={() => setAuthMode(null)}><section className="modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setAuthMode(null)}><X/></button><div className="modal-brand"><img src="/icons/zavo-192.png" alt=""/><span>ZAVO</span></div><div className="section-kicker">{authMode === "signin" ? "HEUREUX DE TE REVOIR" : "REJOINS LA COMMUNAUTÉ"}</div><h2>{authMode === "signin" ? "Connexion" : "Créer ton compte"}</h2><form onSubmit={authMode === "signin" ? signIn : signUp}>{authMode === "signup" && <><label>Nom d'utilisateur</label><input value={username} onChange={e=>setUsername(e.target.value)} minLength={3} maxLength={24} placeholder="ex. monpseudo" required/></>}<label>Adresse e-mail</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/><label>Mot de passe</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} required/><button className="primary-action modal-submit" disabled={busy}>{busy ? "Patiente..." : authMode === "signin" ? "Se connecter" : "Créer mon compte"}</button></form><button className="switch-auth" onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")}>{authMode === "signin" ? "Pas encore de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}</button></section></div>}

      {uploadOpen && <div className="modal-backdrop" onClick={() => setUploadOpen(false)}><section className="modal wide-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setUploadOpen(false)}><X/></button><div className="section-kicker">PARTAGE TON CONTENU</div><h2>Publier sur ZAVO</h2><form onSubmit={publish}><label className="upload-drop"><UploadCloud size={25}/><span>{file ? file.name : "Choisir une vidéo (formats vidéo courants)"}</span><input type="file" accept="video/*,.mkv,.avi,.wmv,.flv,.mpeg,.mpg,.3gp,.3g2,.ts" required onChange={async e=>{const selected=e.target.files?.[0]||null;setFile(selected);if(selected){try{setThumbnail(await createVideoThumbnail(selected));}catch{setThumbnail(null);}}}}/></label><div className="form-grid"><label>Format de publication<select value={contentType} onChange={e=>setContentType(e.target.value as "short"|"video")}><option value="short">Short / vidéo courte</option><option value="video">Vidéo complète</option></select></label><label>Miniature automatique ou image personnalisée<input type="file" accept="image/*" onChange={e=>setThumbnail(e.target.files?.[0] || null)}/></label></div><label>Légende et liens</label><textarea value={caption} onChange={e=>setCaption(e.target.value)} maxLength={2200} placeholder="Décris ta vidéo, ajoute des hashtags et des liens https://..."/><label className="check-line"><input type="checkbox" checked={allowDownload} onChange={e=>setAllowDownload(e.target.checked)}/> Autoriser le téléchargement de ma vidéo (galerie et hors connexion)</label><label className="check-line"><input type="checkbox" checked={showStats} onChange={e=>setShowStats(e.target.checked)}/> Afficher les statistiques publiques de cette vidéo</label><button className="primary-action modal-submit" disabled={busy || !file}>{busy ? "Publication en cours..." : "Publier maintenant"}</button></form></section></div>}

      {commentsVideo && <div className="modal-backdrop" onClick={()=>setCommentsVideo(null)}><section className="modal comments-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setCommentsVideo(null)}><X/></button><h2>Commentaires</h2><div className="comment-list">{comments.map(c=>{const p=Array.isArray(c.profiles)?c.profiles[0]:c.profiles;return <article key={c.id}><strong>{p?.display_name || "Utilisateur"}</strong><p>{c.body}</p></article>;})}{comments.length===0 && <p>Aucun commentaire. Lance la conversation.</p>}</div><form onSubmit={sendComment} className="comment-form"><input value={commentText} onChange={e=>setCommentText(e.target.value)} placeholder="Écrire un commentaire..." maxLength={1000}/><button className="primary-action" disabled={!commentText.trim()}><Send size={16}/></button></form></section></div>}

      {campaignOpen && <div className="modal-backdrop" onClick={()=>setCampaignOpen(false)}><section className="modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setCampaignOpen(false)}><X/></button><div className="section-kicker">ZAVO PROMOTION</div><h2>Booster une publication</h2><p>Choisis un objectif et un budget. La campagne sera enregistrée en attente de paiement ; aucun paiement n'est encore connecté.</p><form onSubmit={createCampaign}><label>Vidéo à promouvoir</label><select value={campaignVideo?.id || ""} onChange={e=>setCampaignVideo(videos.find(v=>v.id===e.target.value) || null)} required><option value="">Choisir une vidéo</option>{videos.filter(v=>v.user_id===session?.user?.id).map(v=><option key={v.id} value={v.id}>{v.caption.slice(0,70) || "Ma vidéo"} · {v.content_type}</option>)}</select><label>Objectif</label><select value={campaignObjective} onChange={e=>setCampaignObjective(e.target.value)}><option value="views">Obtenir plus de vues</option><option value="profile_visits">Visites du profil</option><option value="website_clicks">Clics vers mon site</option><option value="messages">Recevoir des messages</option></select><label>Budget (FCFA)</label><select value={campaignBudget} onChange={e=>setCampaignBudget(e.target.value)}><option value="5000">5 000 FCFA</option><option value="10000">10 000 FCFA</option><option value="20000">20 000 FCFA</option><option value="50000">50 000 FCFA</option></select><label>Pays ciblé</label><select value={campaignCountry} onChange={e=>setCampaignCountry(e.target.value)}><option value="BJ">Bénin</option><option value="CI">Côte d'Ivoire</option><option value="SN">Sénégal</option><option value="TG">Togo</option><option value="FR">France</option><option value="ALL">Tous pays (à définir)</option></select><button className="primary-action modal-submit" disabled={!campaignVideo}>Enregistrer ma campagne</button></form></section></div>}

      {reportVideo && <div className="modal-backdrop" onClick={()=>setReportVideo(null)}><section className="modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setReportVideo(null)}><X/></button><h2>Signaler cette vidéo</h2><p>Le signalement sera transmis à l'équipe de modération.</p><form onSubmit={submitReport}><label>Motif</label><select value={reportReason} onChange={e=>setReportReason(e.target.value)}><option value="spam">Spam ou publicité trompeuse</option><option value="harassment">Harcèlement</option><option value="hate">Discours haineux</option><option value="nudity">Nudité</option><option value="violence">Violence</option><option value="copyright">Droits d'auteur</option><option value="fraud">Fraude</option><option value="privacy">Atteinte à la vie privée</option><option value="other">Autre</option></select><button className="primary-action modal-submit">Envoyer le signalement</button></form></section></div>}

      {profileOpen && <div className="modal-backdrop" onClick={()=>setProfileOpen(false)}><section className="modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setProfileOpen(false)}><X/></button><h2>Modifier mon profil</h2><form onSubmit={saveProfile}><label>Nom affiché</label><input value={displayName} onChange={e=>setDisplayName(e.target.value)} maxLength={60}/><label>Biographie</label><textarea value={bio} onChange={e=>setBio(e.target.value)} maxLength={240}/><label>Pays</label><select value={countryCode} onChange={e=>setCountryCode(e.target.value)}><option value="BJ">Bénin</option><option value="CI">Côte d’Ivoire</option><option value="SN">Sénégal</option><option value="TG">Togo</option><option value="NG">Nigeria</option><option value="GH">Ghana</option><option value="FR">France</option><option value="CA">Canada</option><option value="US">États-Unis</option></select><button className="primary-action modal-submit">Enregistrer</button></form></section></div>}
      <nav className="mobile-nav">{nav.slice(0,5).map(item=>{const Icon=item.icon;return <button key={item.label} className={tab===item.label?"active":""} onClick={()=>setTab(item.label)}><Icon size={18}/><span>{item.label}</span></button>;})}<button className="mobile-publish" onClick={()=>session?setUploadOpen(true):setAuthMode("signup")}><Plus size={19}/><span>Publier</span></button></nav>
    </main>
  );
}

function VideoCard({ video, session, liked, saved, following, onLike, onSave, onFollow, onComments, onShare, onReport, onDownload, onBoost, onView, onToggleStats, onToggleDownload, onRepost, onCampaignEvent }: any) {
  const creator = creatorOf(video);
  const [menu, setMenu] = useState(false);
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const [watchSeconds, setWatchSeconds] = useState(0);
  const owner = session?.user?.id === video.user_id;
  const likesCount = video.likes?.[0]?.count || 0;
  const commentsCount = video.comments?.[0]?.count || 0;
  useEffect(() => {
    const player = playerRef.current;
    if (!player || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
          document.querySelectorAll<HTMLVideoElement>("video[data-zavo-feed]").forEach((other) => {
            if (other !== player) other.pause();
          });
          player.play().catch(() => {});
        } else {
          player.pause();
        }
      }
    }, { threshold: [0, 0.25, 0.65, 1] });
    observer.observe(player);
    return () => observer.disconnect();
  }, [video.id]);
  return <article className="video-card social-video-card"><div className="video-frame"><video ref={playerRef} data-zavo-feed src={video.video_url} poster={video.thumbnail_url || undefined} controls playsInline muted loop preload="metadata" controlsList="nodownload" onContextMenu={e=>e.preventDefault()} onTimeUpdate={e=>{const s=Math.floor(e.currentTarget.currentTime);if(s>watchSeconds){setWatchSeconds(s);if(s>=2 && watchSeconds<2)onView(video,s);if(video.isSponsored && s>=1 && watchSeconds<1)onCampaignEvent(video.campaign_id,"impression");}}}/><span className="video-label">{video.isSponsored ? "SPONSORISÉ" : video.content_type === "short" ? "SHORT" : "VIDÉO"}</span><button className="video-menu-button" onClick={()=>setMenu(!menu)}><MoreHorizontal size={20}/></button>{menu && <div className="video-menu"><button onClick={()=>{onReport(video);setMenu(false);}}><Flag size={14}/> Signaler</button>{owner && <button onClick={()=>{onBoost(video);setMenu(false);}}><Megaphone size={14}/> Booster</button>}{owner && <button onClick={()=>{onToggleStats(video);setMenu(false);}}><Eye size={14}/> {video.show_stats?"Masquer":"Afficher"} mes statistiques</button>}{owner && <button onClick={()=>{onToggleDownload(video);setMenu(false);}}><Download size={14}/> {video.allow_download?"Désactiver":"Autoriser"} le téléchargement</button>}{video.allow_download && <button onClick={()=>{onDownload(video,true);setMenu(false);}}><Download size={14}/> Hors connexion</button>}</div>}</div><div className="video-details"><div className="creator-row"><div className="creator-avatar">{(creator?.display_name||"Z").slice(0,1).toUpperCase()}</div><div className="creator-meta"><strong>{creator?.display_name||"Créateur ZAVO"}</strong><span>@{creator?.username||"createur"}</span></div>{!owner && <button className="follow-button" onClick={()=>onFollow(video.user_id)}>{following.includes(video.user_id)?"Abonné":"Suivre"}</button>}</div><p className="video-caption"><Caption value={video.caption||""}/></p>{video.isSponsored && video.target_url && <a className="sponsored-cta" href={safeUrl(video.target_url)||"#"} target="_blank" rel="noopener noreferrer" onClick={()=>onCampaignEvent(video.campaign_id,"click")}>Découvrir l’offre <ExternalLink size={13}/></a>}<div className="video-controls"><button className={liked.includes(video.id)?"engagement liked":"engagement"} onClick={()=>onLike(video)}><Heart size={17} fill={liked.includes(video.id)?"currentColor":"none"}/>{(video.show_stats || owner) ? likesCount+(liked.includes(video.id)?1:0) : "J’aime"}</button><button className="engagement" onClick={()=>onComments(video)}><MessageSquare size={17}/>{commentsCount}</button><button className={saved.includes(video.id)?"save-button saved":"save-button"} onClick={()=>onSave(video)} aria-label="Enregistrer"><Bookmark size={17} fill={saved.includes(video.id)?"currentColor":"none"}/></button><button className="save-button" onClick={()=>onRepost(video)} aria-label="Partager sur mon profil"><Repeat2 size={17}/></button><button className="save-button" onClick={()=>onShare(video)} aria-label="Partager"><Share2 size={17}/></button>{video.allow_download && <button className="save-button" onClick={()=>onDownload(video,false)} aria-label="Télécharger"><Download size={17}/></button>}<button className="save-button" onClick={()=>onBoost(video)} aria-label="Booster"><Megaphone size={17}/></button></div>{(video.show_stats || owner) && <div className="video-stats"><Eye size={13}/> {video.views_count||0} vues</div>}</div></article>;
}
