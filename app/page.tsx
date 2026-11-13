"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Home, Compass, Plus, MessageCircle, UserRound, Search, Heart, MessageSquare,
  Share2, Bell, LogIn, LogOut, Clapperboard, Bookmark, Download, WifiOff,
  Flag, Megaphone, Play, Eye, Settings, X, UploadCloud, Send, Check, Trash2,
  MoreHorizontal, Film, Image as ImageIcon, ExternalLink, Users, ShieldCheck, Repeat2,
  Mic, Pause, ArrowLeft, Camera, Images, Link2, PlayCircle, EyeOff
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import PwaInstall from "@/app/pwa-install";
import PwaRegister from "@/app/pwa-register";

type Profile = { id: string; username: string | null; display_name: string | null; avatar_url?: string | null; bio?: string | null; stats_visible?: boolean; account_status?: string; country_code?: string; interest_tags?: string[]; banner_url?: string | null; profile_photos?: string[]; identity_changed_at?: string | null; followers_count?: number; followers?: { count: number }[] };
type Video = {
  id: string; caption: string; video_url: string; thumbnail_url?: string | null; user_id: string;
  views_count: number; created_at: string; content_type: "short" | "video"; allow_download: boolean;
  show_stats: boolean; moderation_status?: string; isSponsored?: boolean; campaign_id?: string; target_url?: string | null; objective?: string; category?: string | null; allow_offline_download?: boolean; allow_gallery_download?: boolean; profiles?: Profile | Profile[] | null;
  likes?: { count: number }[]; comments?: { count: number }[];
};
type Comment = { id: string; body: string; created_at: string; profiles?: Profile | Profile[] | null };
const COUNTRY_CODES = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" ");
const COUNTRY_NAMES = new Intl.DisplayNames(["fr"], { type: "region" });
const COUNTRIES = [...COUNTRY_CODES.map(code => [code, COUNTRY_NAMES.of(code) || code] as const), ["OTHER", "Autre pays"] as const].sort((a,b) => a[1].localeCompare(b[1], "fr"));
const INTERESTS = ["Super-héros","Animaux","Musique","Divertissement","Jeux vidéo","Chrétien & Bible","Comédie & humour","Sport","Cuisine","Beauté & mode","Technologie & IA","Éducation","Voyage","Actualités","Cinéma & séries","Business & entrepreneuriat","Science","Art & créativité"];
const CURRENCY_BY_COUNTRY: Record<string,{code:string;symbol:string;perUsd:number}> = {
  BJ:{code:"XOF",symbol:"FCFA",perUsd:600},CI:{code:"XOF",symbol:"FCFA",perUsd:600},SN:{code:"XOF",symbol:"FCFA",perUsd:600},TG:{code:"XOF",symbol:"FCFA",perUsd:600},BF:{code:"XOF",symbol:"FCFA",perUsd:600},ML:{code:"XOF",symbol:"FCFA",perUsd:600},NE:{code:"XOF",symbol:"FCFA",perUsd:600},
  FR:{code:"EUR",symbol:"€",perUsd:0.92},DE:{code:"EUR",symbol:"€",perUsd:0.92},BE:{code:"EUR",symbol:"€",perUsd:0.92},ES:{code:"EUR",symbol:"€",perUsd:0.92},IT:{code:"EUR",symbol:"€",perUsd:0.92},PT:{code:"EUR",symbol:"€",perUsd:0.92},NL:{code:"EUR",symbol:"€",perUsd:0.92},
  US:{code:"USD",symbol:"$",perUsd:1},CA:{code:"CAD",symbol:"CA$",perUsd:1.37},GB:{code:"GBP",symbol:"£",perUsd:0.79},CH:{code:"CHF",symbol:"CHF",perUsd:0.88},NG:{code:"NGN",symbol:"₦",perUsd:1500},GH:{code:"GHS",symbol:"GH₵",perUsd:15},KE:{code:"KES",symbol:"KSh",perUsd:130},ZA:{code:"ZAR",symbol:"R",perUsd:18.5},CN:{code:"CNY",symbol:"¥",perUsd:7.2},IN:{code:"INR",symbol:"₹",perUsd:84},JP:{code:"JPY",symbol:"¥",perUsd:150},BR:{code:"BRL",symbol:"R$",perUsd:5.7},MX:{code:"MXN",symbol:"MX$",perUsd:20},AU:{code:"AUD",symbol:"A$",perUsd:1.55}
};


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
  const [signupName, setSignupName] = useState("");
  const [signupCountry, setSignupCountry] = useState("");
  const [signupCountrySearch, setSignupCountrySearch] = useState("");
  const [signupCountryOpen, setSignupCountryOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSigninPassword, setShowSigninPassword] = useState(false);
  const [signupLanguage, setSignupLanguage] = useState("fr");
  const [languageManuallySelected, setLanguageManuallySelected] = useState(false);
  const [countryDetection, setCountryDetection] = useState("Détection automatique du pays…");
  const [signupInterests, setSignupInterests] = useState<string[]>([]);
  const [skipInterests, setSkipInterests] = useState(false);
  const [signupStep, setSignupStep] = useState(1);
  const [usernameStatus, setUsernameStatus] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup" | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("");
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [videoTargetUrl, setVideoTargetUrl] = useState("");
  const [videoCategory, setVideoCategory] = useState("Divertissement");
  const [allowOfflineDownload, setAllowOfflineDownload] = useState(false);
  const [allowGalleryDownload, setAllowGalleryDownload] = useState(false);
  const [boostAfterPublish, setBoostAfterPublish] = useState(false);
  const [videoInterestTags, setVideoInterestTags] = useState<string[]>([]);
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
  const [dmFile, setDmFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const [dmBusy, setDmBusy] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [campaignType, setCampaignType] = useState<"video"|"profile"|"product">("video");
  const [campaignTitle, setCampaignTitle] = useState("");
  const [campaignDescription, setCampaignDescription] = useState("");
  const [campaignVideo, setCampaignVideo] = useState<Video | null>(null);
  const [campaignBudget, setCampaignBudget] = useState("600");
  const [campaignDurationDays, setCampaignDurationDays] = useState("1");
  const [campaignProductPrice, setCampaignProductPrice] = useState("");
  const [campaignProductContact, setCampaignProductContact] = useState("");
  const [campaignCountries, setCampaignCountries] = useState<string[]>(["BJ"]);
  const [campaignCountrySearch, setCampaignCountrySearch] = useState("");
  const [campaignCountryListOpen, setCampaignCountryListOpen] = useState(false);
  const [campaignObjective, setCampaignObjective] = useState("views");
  const [campaignCountry, setCampaignCountry] = useState("BJ");
  const [campaignTargetUrl, setCampaignTargetUrl] = useState("");
  const [reportVideo, setReportVideo] = useState<Video | null>(null);
  const [reportReason, setReportReason] = useState("spam");
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileBannerFile, setProfileBannerFile] = useState<File | null>(null);
  const [profileAvatarFile, setProfileAvatarFile] = useState<File | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [profilePhotoFiles, setProfilePhotoFiles] = useState<File[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followerProfiles, setFollowerProfiles] = useState<Profile[]>([]);
  const [showFollowers, setShowFollowers] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [countryCode, setCountryCode] = useState("BJ");
  const [currencyInfo, setCurrencyInfo] = useState(CURRENCY_BY_COUNTRY.BJ);
  const [adminData, setAdminData] = useState<any>({ reports: [], campaigns: [], users: [], videos: [], payments: [], presence: [], activeUsers: 0, totalUsers: 0 });
  const [adminSection, setAdminSection] = useState("overview");
  const [adminSearch, setAdminSearch] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [myCampaigns, setMyCampaigns] = useState<any[]>([]);
  const [sponsoredPromos, setSponsoredPromos] = useState<any[]>([]);
  const [myReposts, setMyReposts] = useState<Video[]>([]);

  const isAdmin = session?.user?.app_metadata?.role === "admin";
  const identityCanChange = !profile?.identity_changed_at || Date.now() - new Date(profile.identity_changed_at).getTime() >= 14 * 24 * 60 * 60 * 1000;
  const identityNextChange = profile?.identity_changed_at ? new Date(new Date(profile.identity_changed_at).getTime() + 14 * 24 * 60 * 60 * 1000) : null;

  useEffect(() => {
    if (!file) { setVideoPreviewUrl(""); return; }
    const url = URL.createObjectURL(file);
    setVideoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!thumbnail) { setThumbnailPreviewUrl(""); return; }
    const url = URL.createObjectURL(thumbnail);
    setThumbnailPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [thumbnail]);

  useEffect(() => {
    let active = true;
    fetch("https://ipapi.co/json/").then(r => r.ok ? r.json() : Promise.reject()).then((geo:any) => {
      if (!active) return;
      const code = String(geo?.country_code || "").toUpperCase();
      if (COUNTRIES.some(([c]) => c === code)) setSignupCountry(code);
      else if (code) setSignupCountry("OTHER");
      const detected = String(geo?.languages || navigator.language || "fr").split(",")[0].split("-")[0].toLowerCase();
      if (!languageManuallySelected && ["fr","en","es","pt","de","ar","zh","hi","ja"].includes(detected)) setSignupLanguage(detected);
      setCountryDetection(code ? "Pays détecté automatiquement — tu peux le modifier." : "Choisis ton pays pour continuer.");
    }).catch(() => {
      if (!active) return;
      const region = (navigator.language || "fr-BJ").split("-")[1]?.toUpperCase();
      if (region && COUNTRIES.some(([c]) => c === region)) setSignupCountry(region);
      setCountryDetection("Détection indisponible : sélectionne ton pays manuellement.");
    });
    return () => { active = false; };
  }, [languageManuallySelected]);

  useEffect(() => {
    let active = true;
    const fallback = CURRENCY_BY_COUNTRY[countryCode] || CURRENCY_BY_COUNTRY.US;
    async function resolveCurrency() {
      try {
        let code = fallback.code;
        let symbol = fallback.symbol;
        if (countryCode !== "OTHER") {
          const countryResponse = await fetch(`https://restcountries.com/v3.1/alpha/${encodeURIComponent(countryCode)}?fields=currencies`);
          if (countryResponse.ok) {
            const countryData = await countryResponse.json();
            const record = Array.isArray(countryData) ? countryData[0] : countryData;
            const currencies = record?.currencies || {};
            const firstCode = Object.keys(currencies)[0];
            if (firstCode) {
              code = firstCode;
              symbol = currencies[firstCode]?.symbol || firstCode;
            }
          }
        }
        let perUsd = fallback.perUsd;
        const ratesResponse = await fetch("https://open.er-api.com/v6/latest/USD");
        if (ratesResponse.ok) {
          const ratesData = await ratesResponse.json();
          const liveRate = Number(ratesData?.rates?.[code]);
          if (ratesData?.result === "success" && Number.isFinite(liveRate) && liveRate > 0) perUsd = liveRate;
        }
        if (!active) return;
        const resolved = { code, symbol, perUsd };
        setCurrencyInfo(resolved);
        setCampaignBudget("600");
      } catch {
        if (!active) return;
        setCurrencyInfo(fallback);
        setCampaignBudget("600");
      }
    }
    resolveCurrency();
    return () => { active = false; };
  }, [countryCode]);

  const loadVideos = useCallback(async () => {
    if (!db()) return;
    let query = db()!.from("videos")
      .select("id,caption,video_url,thumbnail_url,target_url,category,user_id,views_count,created_at,content_type,allow_download,allow_offline_download,allow_gallery_download,show_stats,moderation_status,interest_tags,hashtags,profiles:profiles!videos_user_id_fkey(id,username,display_name,avatar_url,stats_visible,banner_url,profile_photos,followers:follows!follows_following_id_fkey(count)),likes:likes!likes_video_id_fkey(count),comments:comments!comments_video_id_fkey(count)")
      .eq("visibility", "public").eq("moderation_status", "approved");
    if (tab === "Shorts") query = query.eq("content_type", "short");
    if (tab === "Vidéos") query = query.eq("content_type", "video");
    query = query.order("created_at", { ascending: false }).limit(40);
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
    if (error) { console.error("ZAVO feed query failed", error); setNotice("Le fil n’a pas pu se connecter aux vidéos. Code : " + (error.code || "inconnu") + ". Réessaie dans un instant."); setVideos([]); return; }
    let organic = (data || []) as Video[];
    const preferred = profile?.interest_tags || [];
    if (preferred.length && (tab === "Pour toi" || tab === "Découvrir")) organic = [...organic].sort((a: any,b: any) => { const score=(v:any)=>(v.interest_tags||[]).filter((tag:string)=>preferred.includes(tag)).length*3+(v.hashtags||[]).filter((tag:string)=>preferred.includes(tag)).length; return score(b)-score(a); });
    if (tab === "Pour toi" || tab === "Découvrir") {
      const { data: campaigns } = await db()!.from("ad_campaigns")
        .select("id,video_id,target_url,objective,country_codes,target_type,description,video:videos!ad_campaigns_video_id_fkey(id,caption,video_url,thumbnail_url,target_url,category,user_id,views_count,created_at,content_type,allow_download,allow_offline_download,allow_gallery_download,show_stats,moderation_status,profiles:profiles!videos_user_id_fkey(id,username,display_name,avatar_url,stats_visible),likes:likes!likes_video_id_fkey(count),comments:comments!comments_video_id_fkey(count))")
        .eq("status", "active").not("video_id", "is", null)
        .or("start_at.is.null,start_at.lte." + new Date().toISOString())
        .or("end_at.is.null,end_at.gt." + new Date().toISOString()).limit(12);
      const sponsored = (campaigns || []).filter((campaign: any) => {
        const countries = campaign.country_codes || [];
        return !countries.length || countries.includes("ALL") || countries.includes(profile?.country_code || "BJ");
      }).map((campaign: any) => {
        const video = Array.isArray(campaign.video) ? campaign.video[0] : campaign.video;
        return video ? { ...video, caption: campaign.target_type === "video" ? video.caption : (campaign.description || video.caption), isSponsored: true, campaign_id: campaign.id, target_url: campaign.target_url, objective: campaign.objective } : null;
      }).filter(Boolean) as Video[];
      const mixed: Video[] = [];
      let adIndex = 0;
      organic.forEach((video, index) => {
        mixed.push(video);
        if ((index + 1) % 5 === 0 && sponsored[adIndex]) mixed.push(sponsored[adIndex++]);
      });
      setVideos(mixed);
      const { data: promoRows } = await db()!.from("ad_campaigns")
        .select("id,title,target_type,description,target_url,target_profile_id,owner_id,country_codes,objective,start_at,end_at,owner:profiles!ad_campaigns_owner_id_fkey(id,username,display_name,avatar_url),target_profile:profiles!ad_campaigns_target_profile_id_fkey(id,username,display_name,avatar_url)")
        .eq("status", "active").in("target_type", ["profile", "product"])
        .or("start_at.is.null,start_at.lte." + new Date().toISOString())
        .or("end_at.is.null,end_at.gt." + new Date().toISOString()).limit(12);
      setSponsoredPromos((promoRows || []).filter((campaign: any) => {
        const countries = campaign.country_codes || [];
        return !countries.length || countries.includes("ALL") || countries.includes(profile?.country_code || "BJ");
      }));
    } else {
      setVideos(organic);
      setSponsoredPromos([]);
    }
  }, [tab, session?.user?.id, profile?.country_code, profile?.interest_tags]);

  const loadFollowStats = useCallback(async (userId: string) => {
    if (!db()) return;
    const [{ count: followers }, { count: following }, { data: rows }] = await Promise.all([
      db()!.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", userId),
      db()!.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", userId),
      db()!.from("follows").select("follower_id").eq("following_id", userId).order("created_at", { ascending: false }).limit(100)
    ]);
    setFollowerCount(followers || 0);
    setFollowingCount(following || 0);
    const ids = (rows || []).map((row: any) => row.follower_id);
    if (!ids.length) { setFollowerProfiles([]); return; }
    const { data: people } = await db()!.from("profiles").select("id,username,display_name,avatar_url,bio").in("id", ids);
    const byId = new Map((people || []).map((person: any) => [person.id, person]));
    setFollowerProfiles(ids.map((id: string) => byId.get(id)).filter(Boolean) as Profile[]);
  }, []);

  const loadUserData = useCallback(async (userId: string) => {
    if (!db()) return;
    const [{ data: p }, { data: l }, { data: s }, { data: f }, { data: rp }] = await Promise.all([
      db()!.from("profiles").select("*").eq("id", userId).maybeSingle(),
      db()!.from("likes").select("video_id").eq("user_id", userId),
      db()!.from("saved_videos").select("video_id").eq("user_id", userId),
      db()!.from("follows").select("following_id").eq("follower_id", userId),
      db()!.from("reposts").select("video:videos(id,caption,video_url,thumbnail_url,user_id,views_count,created_at,content_type,allow_download,show_stats,moderation_status,profiles:profiles!videos_user_id_fkey(id,username,display_name,avatar_url,stats_visible),likes(count),comments(count))").eq("user_id", userId).order("created_at", { ascending: false }).limit(30)
    ]);
    setProfile(p as Profile | null);
    setDisplayName(p?.display_name || "");
    setUsername(p?.username || "");
    setBio(p?.bio || "");
    setCountryCode(p?.country_code || "BJ");
    setLiked((l || []).map((x: any) => x.video_id));
    setSaved((s || []).map((x: any) => x.video_id));
    setFollowing((f || []).map((x: any) => x.following_id));
    setMyReposts((rp || []).map((row: any) => Array.isArray(row.video) ? row.video[0] : row.video).filter(Boolean));
    await loadFollowStats(userId);
  }, [loadFollowStats]);

  useEffect(() => {
    if (!db()) return;
    let active = true;
    const { data: { subscription } } = db()!.auth.onAuthStateChange((event, value) => {
      if (!active) return;
      setSession(value);
      if (value?.user?.id) {
        // Load user data after the auth callback releases the Supabase auth lock.
        Promise.resolve().then(async () => {
          if (!active) return;
          await loadUserData(value.user.id);
          // app_metadata changes are not reflected in an already-issued JWT.
          // Refresh once on initial session restoration so newly granted admin access is picked up.
          if (event === "INITIAL_SESSION") {
            const { data, error } = await db()!.auth.refreshSession();
            if (!active) return;
            if (data.session) setSession(data.session);
            else if (error) setNotice("Actualisation des autorisations impossible : " + error.message);
          }
        });
      } else {
        setProfile(null); setDisplayName(""); setBio(""); setLiked([]); setSaved([]); setFollowing([]);
        setNotifications([]); setDmMessages([]); setActiveConversation(null); setFollowerProfiles([]);
        setFollowerCount(0); setFollowingCount(0); setMyCampaigns([]); setMyReposts([]);
        setProfileOpen(false); setUploadOpen(false); setCampaignOpen(false); setLogoutConfirm(false);
        setTab("Pour toi");
      }
    });
    const onOnline = () => { setOffline(false); setOfflineVideos([]); };
    const onOffline = async () => { setOffline(true); try { setOfflineVideos(await readOfflineVideos()); } catch { setOfflineVideos([]); } };
    setOffline(!navigator.onLine);
    if (!navigator.onLine) onOffline();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { active = false; subscription.unsubscribe(); window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, [loadUserData]);

  useEffect(() => { loadVideos(); }, [loadVideos]);
  useEffect(() => { if (tab === "Notifications" && session?.user?.id) loadNotifications(); }, [tab, session?.user?.id]);
  useEffect(() => { if (tab === "Téléchargements") readOfflineVideos().then(setOfflineVideos).catch(() => setOfflineVideos([])); }, [tab]);

  async function searchPeople() {
    if (!db() || !session || dmSearch.trim().length < 2) { setDmUsers([]); return; }
    const term = dmSearch.trim().replace(/[,%]/g, "");
    const { data, error } = await db()!.from("profiles")
      .select("id,username,display_name,avatar_url,bio,account_status,followers:follows!follows_following_id_fkey(count)")
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
      .select("id,conversation_id,sender_id,body,created_at,read_at,message_type,media_url,media_name,mime_type,duration_seconds")
      .eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(200);
    if (error) { setNotice(error.message); return; }
    const hydrated = await Promise.all((data || []).map(async (message: any) => {
      if (!message.media_url || message.media_url.startsWith("http")) return message;
      const { data: signed, error: signedError } = await db()!.storage.from("zavo-message-media").createSignedUrl(message.media_url, 3600);
      if (signedError) console.error("ZAVO message attachment URL error", signedError);
      return { ...message, media_url: signed?.signedUrl || null };
    }));
    setDmMessages(hydrated);
    await db()!.from("messages").update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId).neq("sender_id", session?.user?.id || "").is("read_at", null);
  }

  async function sendDirectMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !activeConversation || (!dmText.trim() && !dmFile)) return;
    setDmBusy(true);
    let mediaUrl: string | null = null;
    let messageType: "text"|"image"|"video"|"audio" = "text";
    let mimeType: string | null = null;
    const mediaName = dmFile?.name || null;
    if (dmFile) {
      mimeType = dmFile.type || "application/octet-stream";
      messageType = mimeType.startsWith("image/") ? "image" : mimeType.startsWith("video/") ? "video" : mimeType.startsWith("audio/") ? "audio" : "text";
      if (messageType === "text") { setNotice("Format de pièce jointe non pris en charge."); setDmBusy(false); return; }
      if (dmFile.size > 50 * 1024 * 1024) { setNotice("La pièce jointe doit faire 50 Mo maximum."); setDmBusy(false); return; }
      const path = activeConversation + "/" + session.user.id + "/" + crypto.randomUUID() + "-" + dmFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const upload = await db()!.storage.from("zavo-message-media").upload(path, dmFile, { contentType: mimeType });
      if (upload.error) { setNotice("Le fichier n’a pas pu être envoyé : " + upload.error.message); setDmBusy(false); return; }
      mediaUrl = path;
    }
    const body = dmText.trim() || (dmFile ? "Pièce jointe" : "");
    const { error } = await db()!.from("messages").insert({
      conversation_id: activeConversation, sender_id: session.user.id, body,
      message_type: messageType, media_url: mediaUrl, media_name: mediaName, mime_type: mimeType
    });
    if (error) setNotice(error.message);
    else { setDmText(""); setDmFile(null); await loadMessages(activeConversation); }
    setDmBusy(false);
  }

  async function toggleVoiceRecording() {
    if (isRecording) { mediaRecorderRef.current?.stop(); setIsRecording(false); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setNotice("L’enregistrement vocal n’est pas disponible sur cet appareil ou ce navigateur.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) recordingChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setDmFile(new File([blob], "vocal-zavo.webm", { type: blob.type }));
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setNotice("Autorise l’accès au microphone pour envoyer un message vocal.");
    }
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
    setBusy(false);
    if (error) setNotice(error.message);
    else { setNotice("Connexion réussie."); setAuthMode(null); setPassword(""); }
  }

  async function performLogout() {
    if (!db()) return;
    setBusy(true);
    const { error } = await db()!.auth.signOut({ scope: "local" });
    setBusy(false);
    if (error) { setNotice("La déconnexion a échoué : " + error.message); return; }
    setSession(null);
    setProfile(null); setDisplayName(""); setBio(""); setLiked([]); setSaved([]); setFollowing([]);
    setNotifications([]); setDmMessages([]); setActiveConversation(null); setFollowerProfiles([]);
    setFollowerCount(0); setFollowingCount(0); setMyCampaigns([]); setMyReposts([]);
    setProfileOpen(false); setUploadOpen(false); setCampaignOpen(false); setLogoutConfirm(false);
    setAuthMode(null); setPassword(""); setCurrentPassword(""); setNewPassword(""); setConfirmNewPassword("");
    setTab("Pour toi");
    setNotice("Tu es déconnecté de ZAVO.");
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db() || !session?.user?.email) return;
    if (newPassword.length < 8 || !/\\d/.test(newPassword)) { setNotice("Le nouveau mot de passe doit contenir au moins 8 caractères et un chiffre."); return; }
    if (newPassword !== confirmNewPassword) { setNotice("Les deux nouveaux mots de passe ne correspondent pas."); return; }
    setPasswordBusy(true);
    const verified = await db()!.auth.signInWithPassword({ email: session.user.email, password: currentPassword });
    if (verified.error) { setPasswordBusy(false); setNotice("Mot de passe actuel incorrect."); return; }
    const updated = await db()!.auth.updateUser({ password: newPassword });
    setPasswordBusy(false);
    if (updated.error) { setNotice("Le mot de passe n’a pas pu être modifié : " + updated.error.message); return; }
    setCurrentPassword(""); setNewPassword(""); setConfirmNewPassword("");
    setNotice("Ton mot de passe a été modifié avec succès.");
  }
  async function continueSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!db()) return;
    const clean = username.toLowerCase().trim().replace(/[^a-z0-9_]/g, "");
    if (!/^[a-z0-9_]{3,24}$/.test(clean)) { setUsernameStatus("3 à 24 caractères : lettres, chiffres et _ uniquement."); return; }
    if (password.length < 8 || !/\d/.test(password)) { setUsernameStatus("Le mot de passe doit contenir au moins 8 caractères et un chiffre."); return; }
    if (!signupCountry) { setUsernameStatus("Sélectionne ton pays de résidence."); return; }
    setBusy(true); setUsernameStatus("");
    const { data, error } = await db()!.from("profiles").select("id").ilike("username", clean).limit(1);
    setBusy(false);
    if (error) { setUsernameStatus("Impossible de vérifier cet identifiant. Réessaie."); return; }
    if (data?.length) { setUsernameStatus("Identifiant déjà utilisé. Essaie d'ajouter un chiffre."); return; }
    setUsername(clean); setSignupStep(2);
  }
  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!db()) return;
    if (password.length < 8 || !/\d/.test(password)) { setNotice("Mot de passe invalide : 8 caractères minimum et au moins un chiffre."); setSignupStep(1); return; }
    if (!signupCountry) { setNotice("Sélectionne ton pays de résidence."); setSignupStep(1); return; }
    setBusy(true);
    const clean = username.toLowerCase().trim().replace(/[^a-z0-9_]/g, "");
    const { error } = await db()!.auth.signUp({ email, password, options: { data: {
      username: clean, display_name: signupName.trim(), country_code: signupCountry, preferred_language: signupLanguage, interest_tags: skipInterests ? [] : signupInterests
    } } });
    setNotice(error?.code === "23505" ? "Cet identifiant vient d'être pris. Retourne aux informations et choisis-en un autre." : error?.message || "Compte créé. Bienvenue sur ZAVO !");
    setBusy(false); if (!error) { setAuthMode(null); setSignupStep(1); setSignupInterests([]); }
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!db() || !session || !file) return;
    if (!getVideoMime(file).startsWith("video/")) { setNotice("Choisis un fichier vidéo valide."); return; }
    setBusy(true);
    const base = session.user.id + "/" + crypto.randomUUID();
    const videoPath = base + "-" + file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const videoMime = getVideoMime(file);
    let videoMetadata: { duration_seconds: number | null; aspect_ratio: string | null } = { duration_seconds: null, aspect_ratio: null };
    try { videoMetadata = await getVideoMetadata(file); } catch {}
    const upload = await db()!.storage.from("zavo-videos").upload(videoPath, file, { contentType: videoMime, upsert: false });
    if (upload.error) { setNotice("Impossible d’importer la vidéo : " + upload.error.message); setBusy(false); return; }
    const videoUrl = db()!.storage.from("zavo-videos").getPublicUrl(videoPath).data.publicUrl;
    let thumbnailUrl: string | null = null;
    if (thumbnail) {
      const thumbPath = session.user.id + "/" + crypto.randomUUID() + "-" + thumbnail.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const thumbUpload = await db()!.storage.from("zavo-media").upload(thumbPath, thumbnail, { contentType: thumbnail.type || "image/jpeg" });
      if (!thumbUpload.error) thumbnailUrl = db()!.storage.from("zavo-media").getPublicUrl(thumbPath).data.publicUrl;
    }
    const offlinePermission = allowOfflineDownload;
    const galleryPermission = allowGalleryDownload;
    const { data: published, error } = await db()!.from("videos").insert({
      user_id: session.user.id, caption, video_url: videoUrl, thumbnail_url: thumbnailUrl,
      target_url: safeUrl(videoTargetUrl), category: videoCategory,
      content_type: contentType, allow_download: offlinePermission || galleryPermission,
      allow_offline_download: offlinePermission, allow_gallery_download: galleryPermission,
      show_stats: showStats, visibility: "public", interest_tags: videoInterestTags, ...videoMetadata
    }).select("id,caption,video_url,thumbnail_url,target_url,category,user_id,views_count,created_at,content_type,allow_download,allow_offline_download,allow_gallery_download,show_stats,moderation_status").single();
    if (error) setNotice("La vidéo a été importée, mais sa publication a échoué : " + error.message);
    else {
      setNotice("Ta vidéo est publiée sur ZAVO.");
      setUploadOpen(false); setCaption(""); setFile(null); setThumbnail(null); setVideoTargetUrl("");
      setAllowOfflineDownload(false); setAllowGalleryDownload(false); setVideoInterestTags([]);
      const shouldBoost = boostAfterPublish;
      setBoostAfterPublish(false);
      await loadVideos();
      if (shouldBoost && published) {
        setCampaignType("video"); setCampaignVideo(published as Video);
        setCampaignTitle("Promotion de ma vidéo"); setCampaignOpen(true);
      }
    }
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
    const nextValue = !(video.allow_offline_download || video.allow_gallery_download || video.allow_download);
    const { error } = await db()!.from("videos").update({ allow_download: nextValue, allow_offline_download: nextValue, allow_gallery_download: nextValue }).eq("id", video.id);
    if (error) setNotice(error.message);
    else setVideos(items => items.map(v => v.id === video.id ? { ...v, allow_download: nextValue, allow_offline_download: nextValue, allow_gallery_download: nextValue } : v));
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
    if (!error) await loadUserData(session.user.id);
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
    else await loadFollowStats(session.user.id);
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
    const canSaveOffline = video.allow_offline_download ?? video.allow_download;
    const canSaveGallery = video.allow_gallery_download ?? video.allow_download;
    if (offlineOnly && !canSaveOffline) { setNotice("Le créateur n’autorise pas l’enregistrement hors connexion."); return; }
    if (!offlineOnly && !canSaveGallery) { setNotice("Le créateur n’autorise pas le téléchargement dans la galerie."); return; }
    try {
      if (offlineOnly) {
        await saveOfflineVideo(video);
        setOfflineVideos(await readOfflineVideos());
        setNotice("Vidéo enregistrée dans tes téléchargements ZAVO. Tu pourras la regarder sans Internet.");
      } else {
        const response = await fetch(video.video_url);
        if (!response.ok) throw new Error("Téléchargement indisponible");
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "ZAVO-" + video.id + (blob.type.includes("webm") ? ".webm" : ".mp4");
        document.body.appendChild(anchor); anchor.click(); anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1500);
        setNotice("Téléchargement lancé. Vérifie la galerie ou le dossier de téléchargements de ton appareil.");
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

  async function startCampaignCheckout(campaignId: string): Promise<boolean> {
    if (!session || !db()) { setAuthMode("signin"); return false; }
    setBusy(true);
    const { data, error } = await db()!.functions.invoke("saspay-create-checkout", {
      body: { campaign_id: campaignId }
    });
    setBusy(false);
    if (error || !data?.checkout_url) {
      setNotice("Impossible de lancer le paiement : " + (data?.error || error?.message || "réponse invalide du service de paiement") + " Tu peux réessayer depuis Mes promotions.");
      return false;
    }
    window.location.assign(data.checkout_url);
    return true;
  }

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !db()) { setAuthMode("signin"); return; }
    if (campaignCountries.length < 1 || campaignCountries.length > 8) { setNotice("Sélectionne entre 1 et 8 pays pour ta campagne."); return; }
    if (campaignType === "video" && !campaignVideo) { setNotice("Choisis la vidéo que tu souhaites promouvoir."); return; }
    const selectedCurrency = { code: "XOF" };
    const dailyBudget = Number(campaignBudget);
    const durationDays = Number(campaignDurationDays);
    const amount = dailyBudget * durationDays;
    if (!Number.isInteger(dailyBudget) || dailyBudget < 600) { setNotice("Le budget minimum est de 600 FCFA par jour."); return; }
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 90) { setNotice("Choisis une durée comprise entre 1 et 90 jours."); return; }
    if (campaignType === "product" && (!campaignTitle.trim() || !campaignDescription.trim() || (!safeUrl(campaignTargetUrl) && !campaignProductContact.trim()))) { setNotice("Pour promouvoir un produit, renseigne son nom, sa description et un lien ou un contact."); return; }
    if (campaignType === "profile" && (!campaignTitle.trim() || !campaignDescription.trim())) { setNotice("Présente ton compte et explique pourquoi les visiteurs devraient te suivre."); return; }
    const targetUrl = safeUrl(campaignTargetUrl);
    if (campaignType === "product" && !targetUrl && !campaignProductContact.trim()) { setNotice("Ajoute un lien de vente ou un contact pour recevoir les commandes."); return; }
    setBusy(true);
    const { data, error } = await db()!.from("ad_campaigns").insert({
      owner_id: session.user.id,
      target_type: campaignType,
      target_profile_id: campaignType === "profile" ? session.user.id : null,
      video_id: campaignType === "video" ? campaignVideo?.id || null : null,
      title: campaignTitle.trim() || (campaignType === "video" ? "Promotion de ma vidéo" : campaignType === "profile" ? "Promotion de mon compte" : "Promotion de mon produit"),
      target_label: campaignTitle.trim() || null,
      description: campaignType === "product" ? [campaignDescription.trim(), campaignProductPrice.trim() ? "Prix : " + campaignProductPrice.trim() : "", campaignProductContact.trim() ? "Contact : " + campaignProductContact.trim() : ""].filter(Boolean).join("\n\n") : campaignDescription.trim() || null,
      target_url: targetUrl,
      budget: amount, daily_budget: dailyBudget, duration_days: durationDays, currency: selectedCurrency.code, objective: campaignObjective,
      country_codes: campaignCountries, status: "awaiting_payment"
    }).select("id").single();
    setBusy(false);
    if (error || !data?.id) {
      setNotice("La campagne n’a pas pu être enregistrée : " + (error?.message || "identifiant de campagne manquant"));
      return;
    }
    setCampaignOpen(false); setCampaignVideo(null); setCampaignTargetUrl(""); setCampaignTitle(""); setCampaignDescription(""); setCampaignProductPrice(""); setCampaignProductContact(""); setCampaignBudget("600"); setCampaignDurationDays("1");
    setCampaignType("video"); setTab("Promotions");
    await loadMyCampaigns();
    const started = await startCampaignCheckout(data.id);
    if (!started) await loadMyCampaigns();
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !db()) return;
    const cleanUsername = username.toLowerCase().trim().replace(/^@+/, "").replace(/[^a-z0-9_]/g, "");
    if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) { setNotice("Identifiant invalide : 3 à 24 caractères, lettres, chiffres et _."); return; }
    const identityChanged = cleanUsername !== (profile?.username || "") || displayName.trim() !== (profile?.display_name || "");
    if (identityChanged && profile?.identity_changed_at && Date.now() - new Date(profile.identity_changed_at).getTime() < 14 * 24 * 60 * 60 * 1000) {
      const nextDate = new Date(new Date(profile.identity_changed_at).getTime() + 14 * 24 * 60 * 60 * 1000);
      setNotice("Tu pourras modifier ton nom et ton identifiant à partir du " + nextDate.toLocaleDateString("fr-FR") + ".");
      return;
    }
    setBusy(true);
    let bannerUrl = profile?.banner_url || null;
    let avatarUrl = profile?.avatar_url || null;
    const photoUrls = [...(profile?.profile_photos || [])];
    if (profileAvatarFile) {
      const path = session.user.id + "/profile/avatar-" + crypto.randomUUID() + "-" + profileAvatarFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const result = await db()!.storage.from("zavo-media").upload(path, profileAvatarFile, { contentType: profileAvatarFile.type || "image/jpeg" });
      if (result.error) { setNotice("La photo de profil n’a pas pu être envoyée : " + result.error.message); setBusy(false); return; }
      avatarUrl = db()!.storage.from("zavo-media").getPublicUrl(path).data.publicUrl;
    }
    if (profileBannerFile) {
      const path = session.user.id + "/profile/banner-" + crypto.randomUUID() + "-" + profileBannerFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const result = await db()!.storage.from("zavo-media").upload(path, profileBannerFile, { contentType: profileBannerFile.type || "image/jpeg" });
      if (result.error) { setNotice("La bannière n’a pas pu être envoyée : " + result.error.message); setBusy(false); return; }
      bannerUrl = db()!.storage.from("zavo-media").getPublicUrl(path).data.publicUrl;
    }
    for (const photo of profilePhotoFiles) {
      const path = session.user.id + "/profile/photos/" + crypto.randomUUID() + "-" + photo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const result = await db()!.storage.from("zavo-media").upload(path, photo, { contentType: photo.type || "image/jpeg" });
      if (result.error) { setNotice("Une photo n’a pas pu être envoyée : " + result.error.message); setBusy(false); return; }
      photoUrls.push(db()!.storage.from("zavo-media").getPublicUrl(path).data.publicUrl);
    }
    const { error } = await db()!.from("profiles").update({
      username: cleanUsername, display_name: displayName.trim(), bio: bio.trim(), country_code: countryCode,
      avatar_url: avatarUrl, banner_url: bannerUrl, profile_photos: photoUrls.slice(-12)
    }).eq("id", session.user.id);
    setBusy(false);
    if (error) setNotice(error.code === "23505" ? "Cet identifiant est déjà utilisé. Choisis-en un autre." : error.message.includes("14 jours") ? error.message : "Profil non enregistré : " + error.message);
    else {
      setNotice("Profil mis à jour.");
      setProfileOpen(false); setProfileBannerFile(null); setProfileAvatarFile(null); setProfilePhotoFiles([]);
      await loadUserData(session.user.id);
    }
  }

  async function loadMyCampaigns() {
    if (!session || !db()) return;
    const { data, error } = await db()!.from("ad_campaigns")
      .select("id,title,target_type,target_label,description,target_url,video_id,target_profile_id,country_codes,budget,daily_budget,duration_days,currency,status,objective,impressions,clicks,spent_amount,created_at,start_at,end_at,paused_at,remaining_seconds,admin_note")
      .eq("owner_id", session.user.id).order("created_at", { ascending: false }).limit(50);
    if (error) setNotice(error.message);
    setMyCampaigns(data || []);
  }

  async function manageCampaign(campaign: any, action: "approve" | "pause" | "resume") {
    if (!isAdmin || !db() || !campaign?.id) return;
    const prompts: Record<string, string> = {
      approve: "Confirmer l'approbation et le lancement de cette campagne ?",
      pause: "Suspendre cette campagne ? Le temps restant sera conservé.",
      resume: "Reprendre cette campagne avec le temps restant conservé ?"
    };
    if (!window.confirm(prompts[action])) return;
    setAdminLoading(true);
    const { data, error } = await db()!.functions.invoke("admin-manage-campaign", {
      body: { campaign_id: campaign.id, action }
    });
    setAdminLoading(false);
    if (error || !data?.success) {
      setNotice("Action impossible : " + (data?.error || error?.message || "réponse invalide du serveur"));
      return;
    }
    setNotice(data.message || "Statut de la campagne actualisé.");
    await loadAdmin();
  }

  async function loadAdmin() {
    if (!isAdmin || !db()) return;
    setAdminLoading(true);
    try {
      const results = await Promise.all([
        db()!.from("reports").select("*").order("created_at", { ascending: false }).limit(100),
        db()!.from("ad_campaigns").select("*").order("created_at", { ascending: false }).limit(100),
        db()!.from("profiles").select("id,username,display_name,account_status,created_at").order("created_at", { ascending: false }).limit(1000),
        db()!.from("videos").select("id,caption,user_id,moderation_status,visibility,created_at,profiles:profiles!videos_user_id_fkey(username,display_name)").order("created_at", { ascending: false }).limit(100),
        db()!.from("ad_payments").select("id,campaign_id,owner_id,amount,currency,status,provider,provider_reference,created_at,paid_at").order("created_at", { ascending: false }).limit(200),
        db()!.functions.invoke("admin-user-analytics")
      ]);
      const failed = results.slice(0,5).find((result:any) => result.error);
      if (failed?.error) throw failed.error;
      const [reports, campaignRows, profiles, adminVideos, paymentRows] = results.slice(0,5).map((result:any) => result.data || []);
      // Profiles are the primary source for the visible account list. A failure in the
      // privileged email/last-login endpoint must never blank the entire admin dashboard.
      const analytics = results[5].error ? {} : (results[5].data || {});
      const authUsers = Array.isArray(analytics.users) ? analytics.users : [];
      const authById = new Map(authUsers.map((u:any) => [u.id, u]));
      const users = profiles.map((p:any) => ({ ...p, ...(authById.get(p.id) || {}) }));
      const profileById = new Map(users.map((u:any) => [u.id, u]));
      const campaigns = campaignRows.map((c:any) => ({ ...c, owner_profile: profileById.get(c.owner_id) || null }));
      const campaignById = new Map<string, any>(campaigns.map((c:any) => [c.id, c] as [string, any]));
      const payments = paymentRows.map((p:any) => ({
        ...p,
        owner_profile: profileById.get(p.owner_id) || null,
        campaign_title: campaignById.get(p.campaign_id)?.title || "Campagne introuvable"
      }));
      const presence = Array.isArray(analytics.presence) ? analytics.presence : [];
      const activeUsers = presence.filter((p:any) => p.is_online).length;
      setAdminData({ reports, campaigns, users, videos: adminVideos, payments, presence, activeUsers, totalUsers: users.length });
      if (results[5].error) setNotice("Les comptes sont chargés. Les e-mails et dates de connexion détaillées sont temporairement indisponibles : " + results[5].error.message);
    } catch (error:any) {
      setNotice("Chargement du dashboard impossible : " + (error?.message || "erreur inconnue"));
    } finally {
      setAdminLoading(false);
    }
  }
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") !== "return") return;
    setNotice("Retour de paiement reçu. ZAVO vérifie la confirmation ; le statut de ta campagne sera actualisé automatiquement.");
    setTab("Promotions");
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  useEffect(() => {
    if (!session?.user?.id || !db()) return;
    const userId = session.user.id;
    const ping = async () => {
      if (document.visibilityState !== "visible") return;
      const now = new Date().toISOString();
      await db()!.from("user_presence").upsert({ user_id: userId, last_seen_at: now, updated_at: now }, { onConflict: "user_id" });
    };
    void ping();
    const interval = window.setInterval(ping, 60000);
    const onVisible = () => { if (document.visibilityState === "visible") void ping(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [session?.user?.id]);

  useEffect(() => { if (isAdmin) setTab("Administration"); }, [isAdmin]);
  useEffect(() => { if (tab === "Administration") loadAdmin(); if (tab === "Promotions") loadMyCampaigns(); }, [tab, isAdmin, session?.user?.id]);

  const visibleVideos = useMemo(() => videos.filter((v) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const p = creatorOf(v);
    return (v.caption || "").toLowerCase().includes(q) || (p?.username || "").toLowerCase().includes(q) || (p?.display_name || "").toLowerCase().includes(q);
  }), [videos, search]);

  const nav = [
    { label: "Pour toi", icon: Home }, { label: "Shorts", icon: Play }, { label: "Vidéos", icon: Clapperboard }, { label: "Découvrir", icon: Compass },
    { label: "Abonnements", icon: Users }, { label: "Messages", icon: MessageCircle },
    { label: "Enregistrés", icon: Bookmark }, { label: "Téléchargements", icon: Download },
    { label: "Notifications", icon: Bell }, { label: "Profil", icon: UserRound }
  ];

  if (offline) {
    return <main className="offline-screen"><div className="offline-header"><img src="/icons/zavo-192.png" alt="Logo ZAVO"/><strong>ZAVO</strong><span><WifiOff size={16}/> Hors connexion</span></div><h1>Tes vidéos téléchargées</h1><p>Sans Internet, tu peux regarder uniquement les vidéos enregistrées sur cet appareil.</p><div className="offline-grid">{offlineVideos.map((v) => <OfflineVideoPlayer key={v.id} item={v}/>)}</div>{offlineVideos.length === 0 && <div className="empty-state">Aucune vidéo téléchargée pour le moment.</div>}</main>;
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
            {session ? <><button className="profile-chip" onClick={() => setTab("Profil")}>{(profile?.display_name || session.user.email || "Z").slice(0,1).toUpperCase()}</button><button className="login-button" onClick={() => setLogoutConfirm(true)}><LogOut size={16}/><span>Quitter</span></button></> : <button className="login-button" onClick={() => setAuthMode("signin")}><LogIn size={16}/><span>Connexion</span></button>}
          </div>
        </header>
        <div className="page-content">
          <PwaInstall />
          {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Fermer"><X size={15}/></button></div>}
          {tab === "Administration" && isAdmin ? (
            <section className="admin-page">
              <div className="admin-heading">
                <div><div className="section-kicker">ESPACE SÉCURISÉ</div><h1>Administration ZAVO</h1><p>Vue centrale de la plateforme : communauté, contenus, campagnes et paiements.</p></div>
                <button className="admin-refresh" onClick={loadAdmin} disabled={adminLoading}>{adminLoading ? "Actualisation…" : "Actualiser les données"}</button>
              </div>
              <div className="admin-stats">
                <article><strong>{adminData.totalUsers}</strong><span>Comptes inscrits</span></article>
                <article><strong>{adminData.activeUsers}</strong><span>Comptes actifs (5 min)</span></article>
                <article><strong>{adminData.videos.length}</strong><span>Vidéos chargées</span></article>
                <article><strong>{adminData.reports.filter((r:any)=>r.status==="open"||r.status==="reviewing").length}</strong><span>Signalements à traiter</span></article>
                <article><strong>{adminData.campaigns.filter((c:any)=>c.status==="active").length}</strong><span>Campagnes actives</span></article>
                <article><strong>{adminData.campaigns.filter((c:any)=>c.status==="paused").length}</strong><span>Campagnes suspendues</span></article>
                <article><strong>{adminData.payments.filter((p:any)=>p.status==="succeeded").length}</strong><span>Paiements confirmés</span></article>
                <article><strong>{adminData.payments.filter((p:any)=>p.status==="succeeded").reduce((sum:number,p:any)=>sum+Number(p.amount||0),0).toLocaleString("fr-FR")} FCFA</strong><span>Total encaissé confirmé</span></article>
              </div>
              <div className="admin-toolbar">
                <div className="admin-tabs">
                  {([{id:"overview",label:"Vue générale"},{id:"users",label:"Utilisateurs"},{id:"videos",label:"Vidéos"},{id:"reports",label:"Signalements"},{id:"campaigns",label:"Campagnes"},{id:"payments",label:"Paiements"}] as const).map(item=><button key={item.id} className={adminSection===item.id?"active":""} onClick={()=>{setAdminSection(item.id);setAdminSearch("");}}>{item.label}</button>)}
                </div>
                <input className="admin-search" value={adminSearch} onChange={e=>setAdminSearch(e.target.value)} placeholder="Rechercher dans cette section…"/>
              </div>
              {adminLoading && <p className="admin-loading">Synchronisation des données administratives…</p>}
              {adminSection==="overview" && <div className="admin-overview-grid">
                <section className="admin-panel"><h2>Signalements prioritaires</h2>{adminData.reports.filter((r:any)=>r.status==="open"||r.status==="reviewing").slice(0,6).map((r:any)=><article className="admin-row" key={r.id}><div><strong>{r.reason}</strong><small>{r.target_type} · {r.status} · {new Date(r.created_at).toLocaleDateString("fr-FR")}</small></div><button onClick={()=>setAdminSection("reports")}>Examiner</button></article>)}{!adminData.reports.some((r:any)=>r.status==="open"||r.status==="reviewing")&&<p className="admin-empty">Aucun signalement en attente.</p>}</section>
                <section className="admin-panel"><h2>Campagnes récentes</h2>{adminData.campaigns.slice(0,6).map((c:any)=><article className="admin-row" key={c.id}><div><strong>{c.title}</strong><small>{c.budget} {c.currency} · {c.status}</small></div><span>{c.objective}</span></article>)}{!adminData.campaigns.length&&<p className="admin-empty">Aucune campagne enregistrée.</p>}</section>
                <section className="admin-panel"><h2>Derniers paiements</h2>{adminData.payments.slice(0,6).map((p:any)=><article className="admin-row" key={p.id}><div><strong>{p.amount} {p.currency}</strong><small>{p.provider} · {p.status}</small></div><span>{new Date(p.created_at).toLocaleDateString("fr-FR")}</span></article>)}{!adminData.payments.length&&<p className="admin-empty">Aucune transaction enregistrée.</p>}</section>
              </div>}
              {adminSection==="users" && <section className="admin-panel"><h2>Gestion des utilisateurs · {adminData.totalUsers} comptes</h2><p className="admin-note">Un compte est indiqué « actif » s’il a envoyé un signal de présence au cours des 5 dernières minutes. La dernière connexion correspond à la date fournie par le service d’authentification.</p>{adminData.users.filter((u:any)=>JSON.stringify(u).toLowerCase().includes(adminSearch.toLowerCase())).map((u:any)=>{const presence=adminData.presence.find((p:any)=>p.user_id===u.id);const online=!!presence?.is_online;return <article className="admin-row admin-user-row" key={u.id}><div className="admin-user-identity"><strong>@{u.username||"utilisateur"} · {u.display_name||u.user_metadata?.display_name||u.user_metadata?.full_name||"Sans nom"}</strong><small>{u.email||"Adresse e-mail non disponible"}</small><small>{u.account_status||"active"} · Inscrit le {u.created_at?new Date(u.created_at).toLocaleDateString("fr-FR"):"—"} · Dernière connexion : {u.last_sign_in_at?new Date(u.last_sign_in_at).toLocaleString("fr-FR"):"Jamais enregistrée"}</small><small>Dernière activité ZAVO : {presence?.last_seen_at?new Date(presence.last_seen_at).toLocaleString("fr-FR"):"Aucune activité enregistrée"}</small></div><span className={online?"admin-presence online":"admin-presence"}><i/> {online?"En ligne":"Hors ligne"}</span><button onClick={async()=>{const suspended=u.account_status!=="suspended";const {error}=await db()!.functions.invoke("admin-moderate-account",{body:{target_user_id:u.id,action:suspended?"suspend":"unsuspend",reason:"Décision depuis le dashboard administrateur"}});setNotice(error?.message||(suspended?"Compte suspendu.":"Compte réactivé."));await loadAdmin();}}>{u.account_status==="suspended"?"Réactiver":"Suspendre"}</button></article>})}{!adminData.users.length&&<p className="admin-empty">Aucun compte utilisateur trouvé.</p>}</section>}
              {adminSection==="videos" && <section className="admin-panel"><h2>Modération des vidéos</h2>{adminData.videos.filter((v:any)=>JSON.stringify(v).toLowerCase().includes(adminSearch.toLowerCase())).map((v:any)=><article className="admin-row" key={v.id}><div><strong>{(v.caption||"Vidéo sans légende").slice(0,100)}</strong><small>@{v.profiles?.username||"créateur"} · {v.moderation_status} · {v.visibility}</small></div><button onClick={async()=>{const action=v.moderation_status==="restricted"?"restore":"restrict";const {error}=await db()!.functions.invoke("admin-moderate-video",{body:{video_id:v.id,action,reason:"Décision depuis le dashboard administrateur"}});setNotice(error?.message||(action==="restrict"?"Vidéo retirée.":"Vidéo restaurée."));await loadAdmin();}}>{v.moderation_status==="restricted"?"Restaurer":"Retirer"}</button></article>)}</section>}
              {adminSection==="reports" && <section className="admin-panel"><h2>Traitement des signalements</h2>{adminData.reports.filter((r:any)=>JSON.stringify(r).toLowerCase().includes(adminSearch.toLowerCase())).map((r:any)=><article className="admin-row" key={r.id}><div><strong>{r.reason} · {r.target_type}</strong><small>{r.status} · {new Date(r.created_at).toLocaleString("fr-FR")} · {r.details||"Aucun détail"}</small></div>{r.status==="open"&&<button onClick={async()=>{const {error}=await db()!.from("reports").update({status:"reviewing",reviewed_by:session.user.id,reviewed_at:new Date().toISOString()}).eq("id",r.id);setNotice(error?.message||"Signalement pris en charge.");await loadAdmin();}}>Prendre en charge</button>}</article>)}</section>}
              {adminSection==="campaigns" && <section className="admin-panel"><h2>Gestion et suivi des campagnes publicitaires</h2><p className="admin-note">Une campagne payée reste en attente jusqu'à ton approbation. En cas de suspension, le temps restant est gelé puis restitué à la reprise.</p>{adminData.campaigns.filter((c:any)=>JSON.stringify(c).toLowerCase().includes(adminSearch.toLowerCase())).map((c:any)=><article className="admin-row admin-campaign-row" key={c.id}><div><strong>{c.title}</strong><small>Annonceur : {c.owner_profile?.display_name||c.owner_profile?.username||"Compte ZAVO"} · @{c.owner_profile?.username||"utilisateur"} · {c.owner_profile?.email||c.owner_profile?.email||"E-mail dans la liste des utilisateurs"}</small><small>Budget payé prévu : {Number(c.budget).toLocaleString("fr-FR")} {c.currency} · {Number(c.daily_budget||600).toLocaleString("fr-FR")} {c.currency}/jour × {c.duration_days||1} jour(s) · {c.objective}</small><small>{(c.country_codes||[]).join(", ")||"Aucun pays ciblé"} · {c.impressions||0} impressions · {c.clicks||0} clics · Statut : {c.status}</small>{c.status==="paused"&&<small>Temps restant conservé : {Math.floor(Number(c.remaining_seconds||0)/86400)} j {Math.floor((Number(c.remaining_seconds||0)%86400)/3600)} h</small>}</div><span>{c.status==="awaiting_payment"?"En attente de paiement":c.status==="pending"?"Payée — à valider":c.status==="active"?"En diffusion":c.status==="paused"?"Suspendue":c.status==="completed"?"Terminée":c.status}</span><div className="admin-campaign-actions">{c.status==="pending"&&<button className="primary-action" disabled={adminLoading} onClick={()=>manageCampaign(c,"approve")}>Approuver et lancer</button>}{c.status==="active"&&<button disabled={adminLoading} onClick={()=>manageCampaign(c,"pause")}>Suspendre</button>}{c.status==="paused"&&<button className="primary-action" disabled={adminLoading} onClick={()=>manageCampaign(c,"resume")}>Reprendre</button>}</div></article>)}</section>}
              {adminSection==="payments" && <section className="admin-panel"><h2>Historique des transactions</h2><p className="admin-note">Seules les notifications SasPay vérifiées font foi. Les montants ci-dessous correspondent aux paiements enregistrés ; ils ne représentent pas automatiquement des dépenses publicitaires consommées.</p>{adminData.payments.filter((p:any)=>JSON.stringify(p).toLowerCase().includes(adminSearch.toLowerCase())).map((p:any)=><article className="admin-row" key={p.id}><div><strong>{Number(p.amount).toLocaleString("fr-FR")} {p.currency} · {p.status==="succeeded"?"Paiement confirmé":p.status}</strong><small>Annonceur : {p.owner_profile?.display_name||p.owner_profile?.username||"Compte ZAVO"} · @{p.owner_profile?.username||"utilisateur"} · {p.owner_profile?.email||"E-mail non disponible"}</small><small>Campagne : {p.campaign_title} · {p.provider} · {new Date(p.created_at).toLocaleString("fr-FR")}</small><small>Référence : {p.provider_reference||"Non renseignée"} · Payé le : {p.paid_at?new Date(p.paid_at).toLocaleString("fr-FR"):"—"}</small></div><span>{String(p.campaign_id).slice(0,8)}</span></article>)}</section>}
            </section>
          )  : tab === "Téléchargements" ? (
            <section className="downloads-page">
              <div className="feed-toolbar"><div><div className="section-kicker">TA BIBLIOTHÈQUE PERSONNELLE</div><h2>Téléchargements ZAVO</h2></div><span>{offlineVideos.length} vidéo(s)</span></div>
              <p className="section-description">Ces vidéos sont enregistrées sur cet appareil. Tu peux les regarder même sans connexion Internet.</p>
              {offlineVideos.length ? <div className="offline-grid">{offlineVideos.map((v:any)=><OfflineVideoPlayer key={v.id} item={v}/>)}</div> : <section className="empty-state"><div className="empty-icon"><Download/></div><h3>Aucun téléchargement pour le moment</h3><p>Sur une vidéo, utilise l’option « Enregistrer dans ZAVO » lorsque le créateur l’autorise. Elle apparaîtra ici.</p><button className="primary-action" onClick={()=>setTab("Pour toi")}>Découvrir les vidéos</button></section>}
            </section>
          ) : tab === "Messages" ? (
            <section className="messages-page">
              <div className="feed-toolbar"><div><div className="section-kicker">ÉCHANGES PRIVÉS</div><h2>Messages</h2></div></div>
              {!session ? <section className="empty-state"><div className="empty-icon"><MessageCircle/></div><h3>Connecte-toi pour écrire</h3><button className="primary-action" onClick={()=>setAuthMode("signin")}>Connexion</button></section> : <>
                <div className="dm-search"><Search size={17}/><input value={dmSearch} onChange={e=>setDmSearch(e.target.value)} onKeyUp={e=>{if(e.key==="Enter")searchPeople();}} placeholder="Rechercher un créateur ou un utilisateur"/><button onClick={searchPeople}>Rechercher</button></div>
                {dmUsers.length>0 && <div className="dm-results">{dmUsers.map(u=><button key={u.id} onClick={()=>openConversation(u.id)}><span className="creator-avatar">{(u.display_name||"Z").slice(0,1).toUpperCase()}</span><span><strong>{u.display_name||"Utilisateur"}</strong><small>@{u.username||"zavo"} · {(u.followers?.[0]?.count||0).toLocaleString("fr-FR")} abonnés</small></span><MessageCircle size={17}/></button>)}</div>}
                {activeConversation ? <div className="dm-chat"><div className="dm-chat-head"><strong>Conversation privée</strong><button onClick={()=>setActiveConversation(null)}>Fermer</button></div><div className="dm-chat-list">{dmMessages.map(m=><div key={m.id} className={m.sender_id===session.user.id?"dm-message mine":"dm-message"}>{m.message_type==="image"&&m.media_url&&<a href={m.media_url} target="_blank" rel="noopener noreferrer"><img className="dm-media-image" src={m.media_url} alt={m.media_name||"Image reçue"}/></a>}{m.message_type==="video"&&m.media_url&&<video className="dm-media-video" src={m.media_url} controls playsInline/>}{m.message_type==="audio"&&m.media_url&&<audio className="dm-media-audio" src={m.media_url} controls/>}{m.body&&<p>{m.body}</p>}<small>{new Date(m.created_at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}{m.sender_id===session.user.id&&m.read_at?" · Lu":""}</small></div>)}</div>{dmFile&&<div className="dm-attachment-preview"><span>{dmFile.name}</span><button type="button" onClick={()=>setDmFile(null)} aria-label="Retirer la pièce jointe"><X size={14}/></button></div>}<form className="dm-send" onSubmit={sendDirectMessage}><label className="dm-attach" title="Joindre une photo ou une vidéo"><Images size={18}/><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" onChange={e=>setDmFile(e.target.files?.[0]||null)}/></label><button type="button" className={isRecording?"recording-button":"dm-attach"} onClick={toggleVoiceRecording} title={isRecording?"Arrêter l’enregistrement":"Enregistrer un vocal"}>{isRecording?<Pause size={18}/>:<Mic size={18}/>}</button><input value={dmText} onChange={e=>setDmText(e.target.value)} maxLength={4000} placeholder={isRecording?"Enregistrement vocal…":"Écrire un message..."}/><button className="primary-action" disabled={dmBusy||(!dmText.trim()&&!dmFile)}><Send size={16}/></button></form></div> : <section className="empty-state"><div className="empty-icon"><MessageCircle/></div><h3>Parle directement aux créateurs</h3><p>Recherche un utilisateur pour commencer une conversation privée. Les messages sont synchronisés en temps réel.</p></section>}
                {dmBusy&&<p className="dm-loading">Ouverture de la conversation…</p>}
              </>}
            </section>
          ) : tab === "Promotions" ? (
            <section className="campaigns-page">
              <div className="feed-toolbar"><div><div className="section-kicker">VISIBILITÉ DE TON CONTENU</div><h2>Mes promotions</h2></div><button className="primary-action" onClick={()=>session?setCampaignOpen(true):setAuthMode("signin")}><Megaphone size={15}/> Nouvelle campagne</button></div>
              {myCampaigns.length ? myCampaigns.map((campaign:any)=><article className="campaign-card" key={campaign.id}><div className="campaign-card-top"><strong>{campaign.title}</strong><span className="campaign-status">{campaign.status==="awaiting_payment"?"Paiement en attente":campaign.status==="pending"?"Paiement confirmé — validation ZAVO":campaign.status==="active"?"En diffusion":campaign.status==="paused"?"Suspendue":campaign.status==="completed"?"Terminée":campaign.status==="rejected"?"Refusée":campaign.status}</span></div><div className="campaign-card-meta">{campaign.target_type==="profile"?"Promotion du compte":campaign.target_type==="product"?"Promotion d’un produit ou service":"Promotion d’une vidéo"} · {campaign.country_codes?.length||0} pays · {Number(campaign.daily_budget||600).toLocaleString("fr-FR")} FCFA/jour · {campaign.duration_days||1} jour(s) · total {Number(campaign.budget).toLocaleString("fr-FR")} FCFA · {campaign.objective}</div><div className="campaign-metrics"><span><Eye size={14}/> {campaign.impressions||0} impressions</span><span><ExternalLink size={14}/> {campaign.clicks||0} clics</span></div>{campaign.status==="active"&&campaign.end_at&&<p className="campaign-note">Ta campagne est en cours de diffusion. Fin prévue le {new Date(campaign.end_at).toLocaleString("fr-FR")}.</p>}{campaign.status==="paused"&&<p className="campaign-note">Ta campagne est temporairement suspendue. Le temps restant est conservé : {Math.floor(Number(campaign.remaining_seconds||0)/86400)} j {Math.floor((Number(campaign.remaining_seconds||0)%86400)/3600)} h.</p>}{campaign.status==="completed"&&<p className="campaign-note">Cette campagne est terminée. Consulte les résultats enregistrés : {campaign.impressions||0} impressions et {campaign.clicks||0} clics.</p>}{campaign.status==="rejected"&&campaign.admin_note&&<p className="campaign-note">Motif : {campaign.admin_note}</p>}{campaign.status==="awaiting_payment"&&<><p className="campaign-note">En attente du règlement. La diffusion commencera uniquement après confirmation du paiement et validation par ZAVO.</p><button className="primary-action" disabled={busy} onClick={()=>startCampaignCheckout(campaign.id)}>{busy?"Préparation…":"Payer ma publicité"}</button></>}</article>) : <section className="empty-state"><div className="empty-icon"><Megaphone/></div><h3>Aucune campagne pour le moment</h3><p>Fais connaître ton compte, une vidéo ou ton produit auprès d’une nouvelle audience.</p><button className="primary-action" onClick={()=>session?setCampaignOpen(true):setAuthMode("signin")}>Créer une campagne</button></section>}
            </section>
          ) : tab === "Notifications" ? (
            <section><div className="feed-toolbar"><div><div className="section-kicker">TON ACTIVITÉ</div><h2>Notifications</h2></div></div>{notifications.map((n) => <article className="notification-row" key={n.id}><strong>{n.title}</strong><p>{n.body}</p><small>{new Date(n.created_at).toLocaleString("fr-FR")}</small></article>)}</section>
          ) : tab === "Profil" ? (
            <section className="profile-page">
              <div className="profile-banner" style={profile?.banner_url?{backgroundImage:"url("+profile.banner_url+")"}:undefined}><span>{profile?.banner_url ? "" : "BANNIÈRE ZAVO"}</span></div>
              <div className="profile-hero"><div className="profile-avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt={"Photo de profil de "+(profile.display_name||"membre ZAVO")}/> : (profile?.display_name || "Z").slice(0,1).toUpperCase()}</div><div className="profile-identity"><h1>{profile?.display_name || "Ton profil"}</h1><p>@{profile?.username || "nouveau_createur"}</p><span>{profile?.bio || "Présente-toi à la communauté ZAVO."}</span></div><button onClick={() => setProfileOpen(true)}><Settings size={16}/> Modifier</button></div>
              <div className="profile-stats"><button onClick={()=>setShowFollowers(v=>!v)}><strong>{followerCount.toLocaleString("fr-FR")}</strong><span>Abonnés</span></button><div><strong>{followingCount.toLocaleString("fr-FR")}</strong><span>Abonnements</span></div><div><strong>{videos.filter(v=>v.user_id===session?.user?.id).length}</strong><span>Vidéos</span></div><button className="profile-boost" onClick={()=>{setCampaignType("profile");setCampaignObjective("profile_visits");setCampaignVideo(null);setCampaignTitle("Promotion de mon compte");setCampaignDescription("");setCampaignTargetUrl("");setCampaignProductPrice("");setCampaignProductContact("");setCampaignOpen(true);}}><Megaphone size={15}/> Booster mon compte</button></div>
              {showFollowers && <section className="followers-panel"><div className="followers-panel-head"><h3>Personnes abonnées à ton compte</h3><button onClick={()=>setShowFollowers(false)} aria-label="Fermer"><X size={15}/></button></div>{followerProfiles.length?followerProfiles.map(person=><article className="follower-row" key={person.id}><span className="creator-avatar">{(person.display_name||"Z").slice(0,1).toUpperCase()}</span><div><strong>{person.display_name||"Utilisateur"}</strong><small>@{person.username||"zavo"}</small></div></article>):<p>Tu n’as pas encore d’abonné.</p>}</section>}
              {profile?.profile_photos?.length ? <><h2>Photos du profil</h2><div className="profile-photo-grid">{profile.profile_photos.map((photo,index)=><img key={photo+index} src={photo} alt={"Photo de profil "+(index+1)}/>)}</div></>:null}
              <div className="profile-actions"><button onClick={() => setTab("Enregistrés")}>Vidéos enregistrées</button><button onClick={() => setTab("Téléchargements")}>Téléchargements</button><button onClick={() => setTab("Promotions")}>Mes promotions</button><button onClick={()=>{setCampaignType("product");setCampaignObjective("website_clicks");setCampaignTitle("");setCampaignVideo(null);setCampaignDescription("");setCampaignTargetUrl("");setCampaignProductPrice("");setCampaignProductContact("");setCampaignOpen(true);}}>Booster un produit</button></div>
              <h2>Mes vidéos</h2><div className="video-grid">{videos.filter(v => v.user_id === session?.user?.id).map(v => <VideoCard key={v.id} video={v} session={session} liked={liked} saved={saved} following={following} onLike={toggleLike} onSave={toggleSave} onFollow={toggleFollow} onComments={openComments} onShare={shareVideo} onReport={setReportVideo} onDownload={downloadVideo} onBoost={(x: Video) => {setCampaignType("video");setCampaignVideo(x);setCampaignOpen(true);}} onView={recordView} onToggleStats={toggleVideoStats} onToggleDownload={toggleVideoDownload} onRepost={repostVideo} onCampaignEvent={trackCampaignEvent}/>)}</div>
              <h2>Partagés sur mon profil</h2><div className="video-grid">{myReposts.map(v => <VideoCard key={"repost-"+v.id} video={v} session={session} liked={liked} saved={saved} following={following} onLike={toggleLike} onSave={toggleSave} onFollow={toggleFollow} onComments={openComments} onShare={shareVideo} onReport={setReportVideo} onDownload={downloadVideo} onBoost={(x: Video)=>{setCampaignType("video");setCampaignVideo(x);setCampaignOpen(true);}} onView={recordView} onToggleStats={toggleVideoStats} onToggleDownload={toggleVideoDownload} onRepost={repostVideo} onCampaignEvent={trackCampaignEvent}/>)}</div>
            </section>
          ) : (
            <>
              <section className="welcome-panel compact-welcome"><div className="welcome-copy"><div className="eyebrow"><span className="eyebrow-mark"/> LA SCÈNE EST À TOI</div><h1>Regarde. Crée.<br/><span>Fais-toi découvrir.</span></h1><p>Des vidéos de tous les horizons. Publie ton contenu, rassemble ta communauté et développe ton activité.</p><div className="welcome-actions"><button className="primary-action" onClick={() => session ? setUploadOpen(true) : setAuthMode("signup")}><Clapperboard size={17}/> Publier une vidéo</button><button className="secondary-action" onClick={() => {if(!session){setAuthMode("signin");return;}setCampaignType("video");setCampaignObjective("views");setCampaignTitle("Promotion de ma vidéo");setCampaignVideo(null);setCampaignDescription("");setCampaignTargetUrl("");setCampaignProductPrice("");setCampaignProductContact("");setCampaignOpen(true);}}><Megaphone size={16}/> Booster mon contenu</button></div></div><div className="welcome-art"><img src="/icons/zavo-512.png" alt="ZAVO"/></div></section>
              <div className="feed-toolbar"><div><div className="section-kicker">LE FLUX ZAVO</div><h2>{tab === "Découvrir" ? "Découvrir" : tab === "Abonnements" ? "Tes abonnements" : tab === "Enregistrés" ? "Vidéos enregistrées" : tab === "Shorts" ? "Shorts" : tab === "Vidéos" ? "Vidéos" : "Pour toi"}</h2></div><div className="feed-tabs">{["Pour toi","Shorts","Vidéos","Abonnements","Découvrir","Enregistrés"].map((x: string) => <button key={x} className={tab === x ? "selected" : ""} onClick={() => setTab(x)}>{x}</button>)}</div></div>
              {visibleVideos.length ? <div className="video-grid">{visibleVideos.map(v => <VideoCard key={v.id} video={v} session={session} liked={liked} saved={saved} following={following} onLike={toggleLike} onSave={toggleSave} onFollow={toggleFollow} onComments={openComments} onShare={shareVideo} onReport={setReportVideo} onDownload={downloadVideo} onBoost={(x: Video) => {setCampaignType("video");setCampaignObjective("views");setCampaignTitle("Promotion de ma vidéo");setCampaignDescription("");setCampaignTargetUrl("");setCampaignProductPrice("");setCampaignProductContact("");setCampaignVideo(x);setCampaignOpen(true);}} onView={recordView} onToggleStats={toggleVideoStats} onToggleDownload={toggleVideoDownload} onCampaignEvent={trackCampaignEvent}/>)}</div> : <section className="empty-state"><div className="empty-icon"><Play/></div><h3>{tab === "Abonnements" ? "Tu ne suis pas encore de créateur" : "Le fil commence ici."}</h3><p>Les vidéos publiques apparaîtront ici. Crée un compte pour publier, suivre et interagir avec les créateurs.</p><button className="primary-action" onClick={() => session ? setUploadOpen(true) : setAuthMode("signup")}>Rejoindre ZAVO</button></section>}
              {sponsoredPromos.map(campaign=><SponsoredPromoCard key={campaign.id} campaign={campaign} currentUserId={session?.user?.id} following={following} onFollow={toggleFollow} onCampaignEvent={trackCampaignEvent}/>) }
            </>
          )}
          <footer className="site-footer"><div className="footer-brand"><img src="/icons/zavo-192.png" alt=""/> ZAVO</div><span>Regarde · Crée · Partage</span><span>© 2026 ZAVO</span></footer>
        </div>
      </section>
      <aside className="right-rail"><section className="rail-card"><div className="rail-heading"><h3>Sur ZAVO</h3><span className="tiny-status">EN DIRECT</span></div><div className="rail-feature"><span className="feature-icon red-feature"><Film size={18}/></span><div><strong>Des vidéos pour tous</strong><p>Découvre de nouveaux univers.</p></div></div><div className="rail-feature"><span className="feature-icon blue-feature"><Users size={18}/></span><div><strong>Une communauté ouverte</strong><p>Échange avec les créateurs.</p></div></div><div className="rail-feature"><span className="feature-icon green-feature"><Megaphone size={18}/></span><div><strong>Fais grandir ta visibilité</strong><p>Booste tes publications.</p></div></div></section><section className="business-card"><div className="business-topline"><span className="green-dot"/> PROMOTION DE CONTENU</div><h3>Ton contenu mérite<br/>plus de visibilité.</h3><p>Transforme une publication en campagne sponsorisée pour toucher de nouvelles personnes.</p><button onClick={() => session ? setCampaignOpen(true) : setAuthMode("signin")}>Découvrir le boost <Plus size={15}/></button></section><div className="rail-links"><a href="#">Conditions</a><a href="#">Confidentialité</a><a href="#">Règles de la communauté</a></div></aside>

      {authMode && <div className="modal-backdrop" onClick={() => setAuthMode(null)}><section className="modal signup-modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setAuthMode(null)}><X/></button><div className="modal-brand"><img src="/icons/zavo-192.png" alt=""/><span>ZAVO</span></div><div className="section-kicker">{authMode === "signin" ? "HEUREUX DE TE REVOIR" : signupStep === 1 ? "REJOINS LA COMMUNAUTÉ" : "PERSONNALISONS TON FIL"}</div><h2>{authMode === "signin" ? "Connexion" : signupStep === 1 ? "Créer ton compte" : "Qu’aimes-tu regarder ?"}</h2>
      {authMode === "signin" ? <form onSubmit={signIn} autoComplete="on"><label>Adresse e-mail</label><input type="email" name="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" inputMode="email" spellCheck={false} required/><label>Mot de passe</label><div className="password-field"><input type={showSigninPassword ? "text" : "password"} name="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} autoComplete="current-password" required/><button type="button" className="password-toggle" onClick={()=>setShowSigninPassword(v=>!v)} aria-label={showSigninPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>{showSigninPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div><button className="primary-action modal-submit" disabled={busy}>{busy ? "Patiente..." : "Se connecter"}</button></form> :
      signupStep === 1 ? <form onSubmit={continueSignup} autoComplete="on"><label>Nom complet ou nom d’affichage</label><input value={signupName} onChange={e=>setSignupName(e.target.value)} maxLength={60} placeholder="Comment doit-on t’appeler ?" required/><label>Identifiant unique</label><div className="username-input-wrap"><span>@</span><input value={username} onChange={e=>{setUsername(e.target.value.toLowerCase().replace(/^@+/,"").replace(/[^a-z0-9_]/g,""));setUsernameStatus("");}} minLength={3} maxLength={24} placeholder="ex. alex_2026" autoComplete="off" spellCheck={false} required/></div><small className="field-hint">3 à 24 caractères : lettres, chiffres et _. Un identifiant déjà utilisé sera refusé.</small>{usernameStatus && <p className="field-error">{usernameStatus}</p>}<label>Adresse e-mail</label><input type="email" name="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" inputMode="email" spellCheck={false} required/><label>Pays de résidence (obligatoire)</label><div className="signup-country-picker"><input type="search" value={signupCountrySearch} onFocus={()=>setSignupCountryOpen(true)} onChange={e=>{setSignupCountrySearch(e.target.value);setSignupCountryOpen(true);}} placeholder={signupCountry ? (COUNTRIES.find(([c])=>c===signupCountry)?.[1] || "Pays sélectionné") : "Rechercher un pays…"} aria-label="Rechercher un pays" autoComplete="off"/>{signupCountryOpen && <div className="signup-country-results">{COUNTRIES.filter(([code,name])=>!signupCountrySearch.trim() || name.toLocaleLowerCase("fr").includes(signupCountrySearch.trim().toLocaleLowerCase("fr")) || code.toLowerCase().includes(signupCountrySearch.trim().toLowerCase())).slice(0,60).map(([code,name])=><button type="button" key={code} onClick={()=>{setSignupCountry(code);setSignupCountrySearch("");setSignupCountryOpen(false);}}>{name}<span>{code==="OTHER" ? "Pays non répertorié" : code}</span></button>)}{COUNTRIES.filter(([code,name])=>!signupCountrySearch.trim() || name.toLocaleLowerCase("fr").includes(signupCountrySearch.trim().toLocaleLowerCase("fr")) || code.toLowerCase().includes(signupCountrySearch.trim().toLowerCase())).length===0 && <p>Aucun résultat. Choisis « Autre pays » si ton pays n’est pas répertorié.</p>}</div>}</div><small className="field-hint">{signupCountry ? `Pays sélectionné : ${COUNTRIES.find(([c])=>c===signupCountry)?.[1] || signupCountry}.` : countryDetection} Tu peux saisir son nom pour le retrouver.</small><label>Langue de l’application</label><select value={signupLanguage} onChange={e=>{setSignupLanguage(e.target.value);setLanguageManuallySelected(true);}}><option value="fr">Français</option><option value="en">English</option><option value="es">Español</option><option value="pt">Português</option><option value="de">Deutsch</option><option value="ar">العربية</option><option value="zh">中文</option><option value="hi">हिन्दी</option><option value="ja">日本語</option></select><small className="field-hint">La langue est proposée selon ton pays ou ton navigateur. Tu peux la modifier.</small><label>Mot de passe</label><div className="password-field"><input type={showPassword ? "text" : "password"} name="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} autoComplete="new-password" required aria-describedby="signup-password-help"/><button type="button" className="password-toggle" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div><small className="field-hint" id="signup-password-help"><span className={password.length>=8 ? "password-rule valid" : "password-rule"}>• 8 caractères minimum</span> <span className={/\d/.test(password) ? "password-rule valid" : "password-rule"}>• Au moins un chiffre</span></small><button className="primary-action modal-submit" disabled={busy}>{busy ? "Vérification..." : "Continuer"}</button></form> :
      <form onSubmit={signUp}><p className="interest-intro">Choisis les thèmes que tu aimes. ZAVO s’en servira pour personnaliser ton fil de vidéos. Plusieurs choix sont possibles.</p><div className="interest-grid">{INTERESTS.map(tag=><button type="button" key={tag} className={"interest-chip "+(signupInterests.includes(tag)?"selected":"")} onClick={()=>{setSkipInterests(false);setSignupInterests(old=>old.includes(tag)?old.filter(x=>x!==tag):[...old,tag]);}}>{tag}</button>)}</div><div className="interest-actions"><button type="button" className="secondary-action" onClick={()=>{setSkipInterests(false);setSignupInterests(INTERESTS.slice());}}>Tout sélectionner</button><button type="button" className="secondary-action" onClick={()=>{setSkipInterests(false);setSignupInterests([]);}}>Effacer</button></div><button className="primary-action modal-submit" disabled={busy}>{busy ? "Création..." : "Terminer et créer mon compte"}</button><button type="button" className="switch-auth" onClick={()=>setSignupStep(1)}>Retour aux informations</button><button type="button" className="switch-auth" onClick={()=>{setSkipInterests(true);setSignupInterests([]);}}>Passer cette étape (sans préférences)</button></form>}
      <button className="switch-auth" onClick={() => {setAuthMode(authMode === "signin" ? "signup" : "signin");setSignupStep(1);}}>{authMode === "signin" ? "Pas encore de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}</button></section></div>}

      {uploadOpen && <div className="creator-studio-overlay"><section className="creator-studio">
        <header className="studio-header"><button type="button" onClick={()=>setUploadOpen(false)}><ArrowLeft size={18}/> Retour</button><div className="studio-brand"><img src="/icons/zavo-192.png" alt=""/> <strong>Studio de création ZAVO</strong></div><span>PUBLICATION</span></header>
        <div className="studio-content"><div className="studio-intro"><div className="section-kicker">TON CONTENU, TES RÈGLES</div><h1>Prépare ta publication</h1><p>Importe ta vidéo, vérifie son aperçu et choisis comment elle sera présentée sur ZAVO.</p></div>
          <form onSubmit={publish} className="studio-form">
            <div className="studio-main-column">
              <label className="studio-upload-drop"><UploadCloud size={28}/><strong>{file?file.name:"Importer une vidéo"}</strong><span>MP4, MOV, WebM et autres formats vidéo courants</span><input type="file" accept="video/*,.mkv,.avi,.wmv,.flv,.mpeg,.mpg,.3gp,.3g2,.ts" required onChange={async e=>{const selected=e.target.files?.[0]||null;setFile(selected);if(selected){try{setThumbnail(await createVideoThumbnail(selected));}catch{setThumbnail(null);}}}}/></label>
              {videoPreviewUrl && <div className="studio-preview"><div className="studio-preview-head"><strong>Aperçu de ta vidéo</strong><span>{contentType==="short"?"Format Short":"Format vidéo"}</span></div><video src={videoPreviewUrl} controls playsInline preload="metadata"/></div>}
              <div className="studio-section"><h2>Comment veux-tu publier cette vidéo ?</h2><div className="publish-format-grid"><button type="button" className={contentType==="short"?"format-choice selected":"format-choice"} onClick={()=>setContentType("short")}><PlayCircle size={22}/><strong>Short</strong><span>Vidéo courte, verticale ou horizontale</span></button><button type="button" className={contentType==="video"?"format-choice selected":"format-choice"} onClick={()=>setContentType("video")}><Film size={22}/><strong>Vidéo</strong><span>Publication vidéo longue ou complète</span></button></div></div>
              <div className="studio-section"><h2>Miniature de la publication</h2><div className="thumbnail-editor">{thumbnail&&<img src={thumbnailPreviewUrl} alt="Miniature sélectionnée"/>}<div><strong>{thumbnail?"Miniature prête":"Miniature automatique"}</strong><p>ZAVO sélectionne automatiquement une image de ta vidéo. Tu peux la remplacer par une image de ton choix.</p><label className="secondary-action"><ImageIcon size={16}/> Importer une miniature<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setThumbnail(e.target.files?.[0]||null)}/></label></div></div></div>
              <div className="studio-section"><h2>Description et lien</h2><label>Description<textarea value={caption} onChange={e=>setCaption(e.target.value)} maxLength={2200} placeholder="Présente ta vidéo, ajoute des hashtags et donne envie de la regarder…"/></label><label>Lien externe (facultatif)<div className="input-with-icon"><Link2 size={17}/><input type="url" value={videoTargetUrl} onChange={e=>setVideoTargetUrl(e.target.value)} placeholder="https://ton-site.com"/></div></label><p className="studio-hint">Les liens HTTPS sont reconnus et deviennent cliquables dans la publication.</p></div>
              <div className="studio-section"><h2>Catégorie</h2><select value={videoCategory} onChange={e=>setVideoCategory(e.target.value)}>{INTERESTS.map(tag=><option key={tag} value={tag}>{tag}</option>)}</select><div className="interest-grid compact-interest-grid">{INTERESTS.map(tag=><button type="button" key={tag} className={"interest-chip "+(videoInterestTags.includes(tag)?"selected":"")} onClick={()=>setVideoInterestTags(old=>old.includes(tag)?old.filter(x=>x!==tag):[...old,tag])}>{tag}</button>)}</div></div>
            </div>
            <aside className="studio-settings"><div className="studio-settings-card"><h2>Paramètres de la vidéo</h2><p>Tu gardes le contrôle sur les téléchargements.</p><label className="permission-row"><span><strong>Enregistrer dans ZAVO</strong><small>Permettre aux personnes de garder la vidéo dans leurs téléchargements pour la regarder hors connexion.</small></span><input type="checkbox" checked={allowOfflineDownload} onChange={e=>setAllowOfflineDownload(e.target.checked)}/></label><label className="permission-row"><span><strong>Télécharger dans la galerie</strong><small>Autoriser le téléchargement direct sur le téléphone ou l’ordinateur.</small></span><input type="checkbox" checked={allowGalleryDownload} onChange={e=>setAllowGalleryDownload(e.target.checked)}/></label><label className="permission-row"><span><strong>Afficher les statistiques</strong><small>Rendre visibles les vues et les interactions.</small></span><input type="checkbox" checked={showStats} onChange={e=>setShowStats(e.target.checked)}/></label></div><div className="studio-settings-card studio-boost-card"><div className="studio-boost-icon"><Megaphone/></div><h2>Booster cette vidéo</h2><p>Option facultative. Prépare une campagne pour toucher des personnes dans les pays que tu choisis.</p><label className="permission-row"><span><strong>Ouvrir le parcours de promotion après publication</strong><small>Tu pourras définir ton objectif, ton budget et tes pays ciblés.</small></span><input type="checkbox" checked={boostAfterPublish} onChange={e=>setBoostAfterPublish(e.target.checked)}/></label></div><div className="studio-submit-card"><button className="primary-action modal-submit" disabled={busy||!file}>{busy?"Publication en cours…":"Publier sur ZAVO"}</button><small>Vérifie l’aperçu et les autorisations avant de publier.</small></div></aside>
          </form>
        </div>
      </section></div>}

      {commentsVideo && <div className="modal-backdrop" onClick={()=>setCommentsVideo(null)}><section className="modal comments-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setCommentsVideo(null)}><X/></button><h2>Commentaires</h2><div className="comment-list">{comments.map(c=>{const p=Array.isArray(c.profiles)?c.profiles[0]:c.profiles;return <article key={c.id}><strong>{p?.display_name || "Utilisateur"}</strong><p><Caption value={c.body}/></p></article>;})}{comments.length===0 && <p>Aucun commentaire. Lance la conversation.</p>}</div><form onSubmit={sendComment} className="comment-form"><input value={commentText} onChange={e=>setCommentText(e.target.value)} placeholder="Écrire un commentaire..." maxLength={1000}/><button className="primary-action" disabled={!commentText.trim()}><Send size={16}/></button></form></section></div>}

      {campaignOpen && <div className="creator-studio-overlay"><section className="creator-studio boost-studio">
        <header className="studio-header"><button type="button" onClick={()=>setCampaignOpen(false)}><ArrowLeft size={18}/> Retour</button><div className="studio-brand"><img src="/icons/zavo-192.png" alt=""/> <strong>Centre de promotion ZAVO</strong></div><span>CAMPAGNE</span></header>
        <div className="studio-content"><div className="studio-intro"><div className="section-kicker">DÉVELOPPE TA VISIBILITÉ</div><h1>Configure ta promotion</h1><p>Présente ton contenu ou ton activité, choisis ton audience et définis le budget que tu souhaites investir.</p></div>
          <form onSubmit={createCampaign} className="boost-form">
            <section className="studio-section"><h2>Que veux-tu promouvoir ?</h2><div className="boost-type-grid"><button type="button" className={campaignType==="video"?"boost-type selected":"boost-type"} onClick={()=>{setCampaignType("video");setCampaignObjective("views");setCampaignTitle("Promotion de ma vidéo");setCampaignVideo(null);setCampaignDescription("");setCampaignTargetUrl("");setCampaignProductPrice("");setCampaignProductContact("");}}><Film/><strong>Une vidéo</strong><span>Augmenter sa portée</span></button><button type="button" className={campaignType==="profile"?"boost-type selected":"boost-type"} onClick={()=>{setCampaignType("profile");setCampaignObjective("profile_visits");setCampaignTitle("Promotion de mon compte");setCampaignVideo(null);setCampaignDescription("");setCampaignTargetUrl("");setCampaignProductPrice("");setCampaignProductContact("");}}><Users/><strong>Mon compte</strong><span>Attirer des abonnés</span></button><button type="button" className={campaignType==="product"?"boost-type selected":"boost-type"} onClick={()=>{setCampaignType("product");setCampaignObjective("website_clicks");setCampaignTitle("Promotion de mon produit ou service");setCampaignVideo(null);setCampaignDescription("");setCampaignTargetUrl("");setCampaignProductPrice("");setCampaignProductContact("");}}><Megaphone/><strong>Un produit ou service</strong><span>Générer des visites ou ventes</span></button></div></section>
            {campaignType==="video" && <section className="studio-section"><h2>Vidéo à promouvoir</h2><p>La vidéo sélectionnée sera diffusée auprès de l’audience ciblée.</p><select value={campaignVideo?.id||""} onChange={e=>setCampaignVideo(videos.find(v=>v.id===e.target.value)||null)} required><option value="">Sélectionner une de mes vidéos</option>{videos.filter(v=>v.user_id===session?.user?.id&&!v.isSponsored).map(v=><option key={v.id} value={v.id}>{(v.caption||"Ma vidéo").slice(0,70)} · {v.content_type==="short"?"Short":"Vidéo"}</option>)}</select></section>}
            {campaignType==="profile" && <p className="studio-hint">La promotion mettra ton profil ZAVO en avant avec ta présentation et ton bouton Suivre.</p>}
            {campaignType==="product" && <p className="studio-hint">La promotion présentera ton offre, son prix et le lien ou contact que tu renseignes.</p>}
            {campaignType==="video" && <section className="studio-section"><h2>Informations sur la vidéo</h2><label>Nom de la campagne<input value={campaignTitle} onChange={e=>setCampaignTitle(e.target.value)} maxLength={100} placeholder="Ex. Booster ma nouvelle vidéo"/></label><label>Que va découvrir le public ?<textarea value={campaignDescription} onChange={e=>setCampaignDescription(e.target.value)} maxLength={1000} placeholder="Décris le sujet, le message et ce qui rend cette vidéo intéressante."/></label></section>}
            {campaignType==="profile" && <section className="studio-section"><h2>Informations sur ton compte</h2><label>Nom de la campagne<input value={campaignTitle} onChange={e=>setCampaignTitle(e.target.value)} maxLength={100} placeholder="Ex. Découvrir mon compte"/></label><label>Quelle activité présentes-tu ?<textarea value={campaignDescription} onChange={e=>setCampaignDescription(e.target.value)} maxLength={1000} placeholder="Présente ton activité, tes thèmes, tes contenus et pourquoi les visiteurs devraient te suivre."/></label><p>La promotion dirigera les visiteurs vers ton profil ZAVO.</p></section>}
            {campaignType==="product" && <section className="studio-section"><h2>Informations sur ton produit ou service</h2><label>Nom du produit ou service<input value={campaignTitle} onChange={e=>setCampaignTitle(e.target.value)} maxLength={100} placeholder="Ex. Formation, vêtement, prestation…"/></label><label>Description et avantages<textarea value={campaignDescription} onChange={e=>setCampaignDescription(e.target.value)} maxLength={1000} placeholder="Quel problème ton offre résout-elle ? Quels sont ses avantages ?"/></label><label>Prix ou offre (facultatif)<input value={campaignProductPrice} onChange={e=>setCampaignProductPrice(e.target.value)} maxLength={100} placeholder="Ex. 5 000 FCFA, promotion spéciale…"/></label><label>Lien de vente ou de présentation (facultatif si contact renseigné)<div className="input-with-icon"><Link2 size={17}/><input type="url" value={campaignTargetUrl} onChange={e=>setCampaignTargetUrl(e.target.value)} placeholder="https://ton-site.com"/></div></label><label>Contact pour commander ou demander des informations<input value={campaignProductContact} onChange={e=>setCampaignProductContact(e.target.value)} maxLength={120} placeholder="Téléphone, WhatsApp ou autre contact"/></label></section>}
            <section className="studio-section"><h2>Objectif de la promotion</h2><div className="objective-grid">{(campaignType==="video"?[["views","Plus de vues"],["profile_visits","Visites du profil"]]:campaignType==="profile"?[["profile_visits","Visites de mon compte"],["views","Plus de portée"]]:[["website_clicks","Visites de mon offre"],["messages","Recevoir des demandes"]]).map(([value,label])=><label key={value}><input type="radio" checked={campaignObjective===value} onChange={()=>setCampaignObjective(value)}/>{label}</label>)}</div></section>
            <section className="studio-section"><h2>Pays ciblés (1 à 8)</h2><p>Recherche un pays par son nom ou son code, puis ajoute-le à ta campagne.</p><div className="country-picker"><input type="search" value={campaignCountrySearch} onFocus={()=>setCampaignCountryListOpen(true)} onChange={e=>{setCampaignCountrySearch(e.target.value);setCampaignCountryListOpen(true);}} onKeyDown={e=>{if(e.key==="Escape")setCampaignCountryListOpen(false);}} placeholder="Rechercher un pays (ex. Bénin, France, Canada)…" autoComplete="off" aria-label="Rechercher un pays à cibler"/><div className="country-picker-toolbar"><span>{campaignCountries.length}/8 pays sélectionnés</span><button type="button" onClick={()=>setCampaignCountryListOpen(v=>!v)}>{campaignCountryListOpen?"Masquer la liste":"Afficher les pays"}</button></div>{campaignCountries.length>0&&<div className="country-selected-list">{campaignCountries.map(code=>{const country=COUNTRIES.find(([item])=>item===code);return <span className="country-selected-chip" key={code}>{country?.[1]||code}<button type="button" aria-label={"Retirer "+(country?.[1]||code)} onClick={()=>setCampaignCountries(items=>items.filter(item=>item!==code))}>×</button></span>;})}</div>}{campaignCountryListOpen&&<div className="country-picker-results">{COUNTRIES.filter(([code,name])=>code!=="OTHER"&&!campaignCountries.includes(code)&&(name.toLocaleLowerCase("fr").includes(campaignCountrySearch.trim().toLocaleLowerCase("fr"))||code.toLowerCase().includes(campaignCountrySearch.trim().toLowerCase()))).map(([code,name])=><button type="button" key={code} disabled={campaignCountries.length>=8} onClick={()=>{if(campaignCountries.length<8){setCampaignCountries(items=>[...items,code]);setCampaignCountrySearch("");}}}>{name}<span>{code}</span></button>)}{COUNTRIES.filter(([code,name])=>code!=="OTHER"&&!campaignCountries.includes(code)&&(name.toLocaleLowerCase("fr").includes(campaignCountrySearch.trim().toLocaleLowerCase("fr"))||code.toLowerCase().includes(campaignCountrySearch.trim().toLowerCase()))).length===0&&<p>Aucun pays trouvé. Essaie une autre orthographe.</p>}</div>}</div></section>
            <section className="studio-section budget-section"><h2>Budget et durée</h2><label>Budget par jour (FCFA)<input type="number" min="600" step="100" value={campaignBudget} onChange={e=>setCampaignBudget(e.target.value)} required/></label><label>Durée de la promotion<select value={campaignDurationDays} onChange={e=>setCampaignDurationDays(e.target.value)}><option value="1">1 jour</option><option value="2">2 jours</option><option value="3">3 jours</option><option value="7">7 jours</option><option value="14">14 jours</option><option value="30">30 jours</option><option value="90">90 jours</option></select></label><small className="studio-hint">Le tarif minimum est de 600 FCFA par jour. Le montant total est calculé automatiquement selon la durée.</small></section>
            <div className="boost-submit-panel"><div><strong>Récapitulatif</strong><p>{campaignCountries.length} pays · {Number(campaignBudget||0).toLocaleString("fr-FR")} FCFA/jour × {campaignDurationDays} jour(s) = {(Number(campaignBudget||0)*Number(campaignDurationDays||1)).toLocaleString("fr-FR")} FCFA</p><small>Après confirmation du paiement et validation de ta campagne, ZAVO lancera sa diffusion pendant la durée choisie.</small></div><button className="primary-action modal-submit" disabled={busy||(campaignType==="video"&&!campaignVideo)}>{busy?"Préparation…":"Payer ma publicité"}</button></div>
          </form>
        </div>
      </section></div>}

      {reportVideo && <div className="modal-backdrop" onClick={()=>setReportVideo(null)}><section className="modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setReportVideo(null)}><X/></button><h2>Signaler cette vidéo</h2><p>Le signalement sera transmis à l'équipe de modération.</p><form onSubmit={submitReport}><label>Motif</label><select value={reportReason} onChange={e=>setReportReason(e.target.value)}><option value="spam">Spam ou publicité trompeuse</option><option value="harassment">Harcèlement</option><option value="hate">Discours haineux</option><option value="nudity">Nudité</option><option value="violence">Violence</option><option value="copyright">Droits d'auteur</option><option value="fraud">Fraude</option><option value="privacy">Atteinte à la vie privée</option><option value="other">Autre</option></select><button className="primary-action modal-submit">Envoyer le signalement</button></form></section></div>}

      {profileOpen && <div className="creator-studio-overlay"><section className="creator-studio profile-edit-studio">
        <header className="studio-header"><button type="button" onClick={()=>setProfileOpen(false)}><ArrowLeft size={18}/> Retour</button><div className="studio-brand"><img src="/icons/zavo-192.png" alt=""/> <strong>Personnaliser mon profil</strong></div><span>PROFIL</span></header>
        <div className="studio-content profile-edit-content"><div className="studio-intro"><div className="section-kicker">TON ESPACE, TON IDENTITÉ</div><h1>Fais bonne impression</h1><p>Ajoute une bannière et plusieurs photos pour présenter ton univers à la communauté.</p></div>
          <form onSubmit={saveProfile} className="profile-edit-form"><label>Nom affiché<input value={displayName} onChange={e=>setDisplayName(e.target.value)} maxLength={60} disabled={!identityCanChange}/></label><label>Identifiant unique</label><div className="username-input-wrap"><span>@</span><input value={username} onChange={e=>setUsername(e.target.value.toLowerCase().replace(/^@+/,"").replace(/[^a-z0-9_]/g,""))} minLength={3} maxLength={24} disabled={!identityCanChange} autoComplete="off" spellCheck={false}/></div><small className="field-hint">{identityCanChange ? "3 à 24 caractères : lettres, chiffres et _. Cet identifiant doit être unique." : "Modification disponible à partir du "+(identityNextChange?.toLocaleDateString("fr-FR")||"bientôt")+"."}</small><label>Biographie<textarea value={bio} onChange={e=>setBio(e.target.value)} maxLength={240} placeholder="Présente-toi en quelques mots…"/></label><label>Pays<select value={countryCode} onChange={e=>setCountryCode(e.target.value)}>{COUNTRIES.filter(([code])=>code!=="OTHER").map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label><div className="profile-upload-grid"><label className="profile-file-card"><Camera/><strong>Photo de profil</strong><span>{profileAvatarFile?.name||"Choisir une photo"}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setProfileAvatarFile(e.target.files?.[0]||null)}/></label><label className="profile-file-card"><Camera/><strong>Photo de couverture</strong><span>{profileBannerFile?.name||"Choisir une bannière"}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setProfileBannerFile(e.target.files?.[0]||null)}/></label><label className="profile-file-card"><Images/><strong>Galerie de photos</strong><span>{profilePhotoFiles.length?profilePhotoFiles.length+" photo(s) sélectionnée(s)":"Ajouter plusieurs photos"}</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>setProfilePhotoFiles(Array.from(e.target.files||[]))}/></label></div><button className="primary-action modal-submit" disabled={busy}>{busy?"Enregistrement…":"Enregistrer mon profil"}</button></form><form onSubmit={changePassword} className="profile-password-form"><h2>Modifier mon mot de passe</h2><label>Mot de passe actuel<input type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} autoComplete="current-password" required/></label><label>Nouveau mot de passe<input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} autoComplete="new-password" minLength={8} required/></label><small className="field-hint">8 caractères minimum et au moins un chiffre.</small><label>Confirmer le nouveau mot de passe<input type="password" value={confirmNewPassword} onChange={e=>setConfirmNewPassword(e.target.value)} autoComplete="new-password" minLength={8} required/></label><button className="primary-action modal-submit" disabled={passwordBusy}>{passwordBusy?"Modification…":"Mettre à jour le mot de passe"}</button></form>
        </div>
      </section></div>}
      {logoutConfirm && <div className="modal-backdrop" onClick={()=>setLogoutConfirm(false)}><section className="modal confirm-logout" onClick={e=>e.stopPropagation()}><div className="section-kicker">SESSION ZAVO</div><h2>Es-tu sûr de vouloir te déconnecter ?</h2><p>Tu pourras te reconnecter à tout moment avec ton adresse e-mail et ton mot de passe.</p><div className="confirm-actions"><button className="secondary-action" onClick={()=>setLogoutConfirm(false)}>Annuler</button><button className="primary-action" onClick={performLogout} disabled={busy}>{busy?"Déconnexion…":"Oui, me déconnecter"}</button></div></section></div>}
      <nav className="mobile-nav">{nav.slice(0,6).map(item=>{const Icon=item.icon;return <button key={item.label} className={tab===item.label?"active":""} onClick={()=>setTab(item.label)}><Icon size={18}/><span>{item.label}</span></button>;})}<button className="mobile-publish" onClick={()=>session?setUploadOpen(true):setAuthMode("signup")}><Plus size={19}/><span>Publier</span></button></nav>
    </main>
  );
}

function OfflineVideoPlayer({ item }: { item: any }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!item?.blob) return;
    const url = URL.createObjectURL(item.blob);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [item?.blob]);
  return <article><video controls playsInline preload="metadata" src={src || undefined}/><strong>{item.caption || "Vidéo ZAVO"}</strong><small>{item.contentType === "short" ? "Short" : "Vidéo"}{item.savedAt ? " · Enregistrée le " + new Date(item.savedAt).toLocaleDateString("fr-FR") : ""}</small></article>;
}

function SponsoredPromoCard({ campaign, currentUserId, following, onFollow, onCampaignEvent }: any) {
  const ref = useRef<HTMLElement | null>(null);
  const impressionTracked = useRef(false);
  const person = campaign.target_type === "profile" ? campaign.target_profile : campaign.owner;
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      if (!impressionTracked.current && entries.some(entry => entry.isIntersecting)) {
        impressionTracked.current = true;
        onCampaignEvent?.(campaign.id, "impression");
        observer.disconnect();
      }
    }, { threshold: 0.5 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [campaign.id, onCampaignEvent]);
  const isProfile = campaign.target_type === "profile";
  return <article ref={ref} className="campaign-card sponsored-promo-card">
    <div className="campaign-card-top"><strong>{campaign.title}</strong><span className="campaign-status">SPONSORISÉ</span></div>
    <div className="campaign-card-meta">{isProfile ? "Promotion d’un compte ZAVO" : "Promotion d’un produit ou service"} · {person?.display_name || person?.username || "Annonceur"}</div>
    {campaign.description && <p className="campaign-note">{campaign.description}</p>}
    {isProfile && person?.id && currentUserId !== person.id && <button className="primary-action" onClick={() => { onCampaignEvent?.(campaign.id, "click"); onFollow(person.id); }}>{following.includes(person.id) ? "Abonné" : "Suivre le compte"}</button>}
    {!isProfile && campaign.target_url && <a className="sponsored-cta" href={safeUrl(campaign.target_url) || "#"} target="_blank" rel="noopener noreferrer" onClick={() => onCampaignEvent?.(campaign.id, "click")}>Découvrir l’offre <ExternalLink size={13}/></a>}
  </article>;
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
  return <article className={"video-card social-video-card " + (video.content_type === "short" ? "is-short" : "is-long-video")}><div className={"video-frame " + (video.content_type === "short" ? "short-frame" : "long-frame")}><video ref={playerRef} data-zavo-feed src={video.video_url} poster={video.thumbnail_url || undefined} controls playsInline muted loop preload="metadata" controlsList="nodownload" onContextMenu={e=>e.preventDefault()} onTimeUpdate={e=>{const s=Math.floor(e.currentTarget.currentTime);if(s>watchSeconds){setWatchSeconds(s);if(s>=2 && watchSeconds<2)onView(video,s);if(video.isSponsored && s>=1 && watchSeconds<1)onCampaignEvent(video.campaign_id,"impression");}}}/><span className="video-label">{video.isSponsored ? "SPONSORISÉ" : video.content_type === "short" ? "SHORT" : "VIDÉO"}</span><button className="video-menu-button" onClick={()=>setMenu(!menu)}><MoreHorizontal size={20}/></button>{menu && <div className="video-menu"><button onClick={()=>{onReport(video);setMenu(false);}}><Flag size={14}/> Signaler</button>{owner && <button onClick={()=>{onBoost(video);setMenu(false);}}><Megaphone size={14}/> Booster</button>}{owner && <button onClick={()=>{onToggleStats(video);setMenu(false);}}><Eye size={14}/> {video.show_stats?"Masquer":"Afficher"} mes statistiques</button>}{owner && <button onClick={()=>{onToggleDownload(video);setMenu(false);}}><Download size={14}/> {(video.allow_offline_download||video.allow_gallery_download||video.allow_download)?"Désactiver les téléchargements":"Autoriser les téléchargements"}</button>}{(video.allow_offline_download??video.allow_download) && <button onClick={()=>{onDownload(video,true);setMenu(false);}}><Download size={14}/> Enregistrer dans ZAVO</button>}{(video.allow_gallery_download??video.allow_download) && <button onClick={()=>{onDownload(video,false);setMenu(false);}}><Download size={14}/> Télécharger dans la galerie</button>}</div>}</div><div className="video-details"><div className="creator-row"><div className="creator-avatar">{(creator?.display_name||"Z").slice(0,1).toUpperCase()}</div><div className="creator-meta"><strong>{creator?.display_name||"Créateur ZAVO"}</strong><span>@{creator?.username||"createur"} · {(creator?.followers?.[0]?.count||0).toLocaleString("fr-FR")} abonnés</span></div>{!owner && <button className="follow-button" onClick={()=>{if(video.isSponsored)onCampaignEvent?.(video.campaign_id,"click");onFollow(video.user_id);}}>{following.includes(video.user_id)?"Abonné":"Suivre"}</button>}</div><p className="video-caption"><Caption value={video.caption||""}/></p>{video.target_url && <a className="sponsored-cta" href={safeUrl(video.target_url)||"#"} target="_blank" rel="noopener noreferrer" onClick={()=>video.isSponsored&&onCampaignEvent(video.campaign_id,"click")}>{video.isSponsored?"Découvrir l’offre":"Ouvrir le lien associé"} <ExternalLink size={13}/></a>}<div className="video-controls"><button className={liked.includes(video.id)?"engagement liked":"engagement"} onClick={()=>onLike(video)}><Heart size={17} fill={liked.includes(video.id)?"currentColor":"none"}/>{(video.show_stats || owner) ? likesCount+(liked.includes(video.id)?1:0) : "J’aime"}</button><button className="engagement" onClick={()=>onComments(video)}><MessageSquare size={17}/>{commentsCount}</button><button className={saved.includes(video.id)?"save-button saved":"save-button"} onClick={()=>onSave(video)} aria-label="Enregistrer"><Bookmark size={17} fill={saved.includes(video.id)?"currentColor":"none"}/></button><button className="save-button" onClick={()=>onRepost(video)} aria-label="Partager sur mon profil"><Repeat2 size={17}/></button><button className="save-button" onClick={()=>onShare(video)} aria-label="Partager"><Share2 size={17}/></button>{(video.allow_gallery_download ?? video.allow_download) && <button className="save-button" onClick={()=>onDownload(video,false)} aria-label="Télécharger dans la galerie"><Download size={17}/></button>}<button className="save-button" onClick={()=>onBoost(video)} aria-label="Booster"><Megaphone size={17}/></button></div>{(video.show_stats || owner) && <div className="video-stats"><Eye size={13}/> {video.views_count||0} vues</div>}</div></article>;
}
