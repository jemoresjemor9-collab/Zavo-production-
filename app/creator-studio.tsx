"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Eye, Clock3, Heart, MessageCircle, Users, Video as VideoIcon, RefreshCw, Pencil, Trash2, Save, X, TrendingUp, Play, ImagePlus, CalendarDays, ArrowUpRight } from "lucide-react";
import { supabase } from "@/lib/supabase";

type CreatorVideo = {
  id:string; caption:string; video_url:string; thumbnail_url:string|null; views_count:number;
  created_at:string; content_type:string; duration_seconds:number|null; visibility:string;
  likes?:{count:number}[]; comments?:{count:number}[];
};
type ViewEvent = { video_id:string; watch_seconds:number; viewed_on:string };
type WatchSession = { video_id:string; watch_seconds:number; created_at:string };
type VideoDraft = { id:string;caption:string;video_url:string;thumbnail_url:string|null;target_url:string|null;category:string|null;content_type:string;duration_seconds:number|null;aspect_ratio:string|null;interest_tags:string[];allow_offline_download:boolean;allow_gallery_download:boolean;show_stats:boolean;created_at:string };
type DailyPoint = { date:string; views:number };
const dateKey=(d:Date)=>d.toISOString().slice(0,10);
const fmt=(n:number)=>Math.round(n||0).toLocaleString("fr-FR");
const shortDate=(s:string)=>new Date(s+"T12:00:00").toLocaleDateString("fr-FR",{day:"2-digit",month:"short"});
const storagePath=(url:string|null,bucket:string)=>{if(!url)return null;const marker="/storage/v1/object/public/"+bucket+"/";const i=url.indexOf(marker);return i<0?null:decodeURIComponent(url.slice(i+marker.length).split("?")[0]);};

export default function CreatorStudio({userId,onNotice}:{userId:string;onNotice:(s:string)=>void}) {
  const [period,setPeriod]=useState(30);
  const [videos,setVideos]=useState<CreatorVideo[]>([]);
  const [views,setViews]=useState<ViewEvent[]>([]);
  const [watchSessions,setWatchSessions]=useState<WatchSession[]>([]);
  const [selectedType,setSelectedType]=useState<"all"|"short"|"video">("all");
  const [drafts,setDrafts]=useState<VideoDraft[]>([]);
  const [draftBusy,setDraftBusy]=useState<string|null>(null);
  const [followers,setFollowers]=useState(0);
  const [newFollowers,setNewFollowers]=useState(0);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [editing,setEditing]=useState<CreatorVideo|null>(null);
  const [editCaption,setEditCaption]=useState("");
  const [thumbnailFile,setThumbnailFile]=useState<File|null>(null);
  const [saving,setSaving]=useState(false);
  const [deleting,setDeleting]=useState<string|null>(null);

  const load=useCallback(async(showSpinner=true)=>{
    if(!supabase||!userId)return;
    if(showSpinner)setLoading(true);else setRefreshing(true);
    const since=new Date();since.setDate(since.getDate()-period+1);
    const start=dateKey(since);
    const [videoResult,followersResult,newFollowersResult,draftResult]=await Promise.all([
      supabase.from("videos").select("id,caption,video_url,thumbnail_url,views_count,created_at,content_type,duration_seconds,visibility,likes:likes!likes_video_id_fkey(count),comments:comments!comments_video_id_fkey(count)").eq("user_id",userId).order("created_at",{ascending:false}).limit(300),
      supabase.from("follows").select("follower_id",{count:"exact",head:true}).eq("following_id",userId),
      supabase.from("follows").select("created_at").eq("following_id",userId).gte("created_at",since.toISOString()),
      supabase.from("video_drafts").select("*").eq("user_id",userId).order("updated_at",{ascending:false}).limit(100)
    ]);
    if(videoResult.error){onNotice("Le Studio n’a pas pu charger tes vidéos : "+videoResult.error.message);setLoading(false);setRefreshing(false);return;}
    const ownVideos=(videoResult.data||[]) as CreatorVideo[];
    const ids=ownVideos.map(v=>v.id);
    let allViews:ViewEvent[]=[];
    if(ids.length){
      for(let from=0;from<10000;from+=1000){
        const {data,error}=await supabase.from("video_views").select("video_id,watch_seconds,viewed_on").in("video_id",ids).gte("viewed_on",start).order("viewed_on",{ascending:true}).range(from,from+999);
        if(error){onNotice("Les statistiques de visionnage ne sont pas encore accessibles : "+error.message);break;}
        const batch=(data||[]) as ViewEvent[];allViews=allViews.concat(batch);if(batch.length<1000)break;
      }
    }
    let allWatchSessions:WatchSession[]=[];
    if(ids.length){
      for(let from=0;from<10000;from+=1000){
        const {data,error}=await supabase.from("video_watch_sessions").select("video_id,watch_seconds,created_at").in("video_id",ids).gte("created_at",since.toISOString()).order("created_at",{ascending:true}).range(from,from+999);
        if(error){onNotice("Le temps de visionnage n’est pas encore accessible : "+error.message);break;}
        const batch=(data||[]) as WatchSession[];allWatchSessions=allWatchSessions.concat(batch);if(batch.length<1000)break;
      }
    }
    setVideos(ownVideos);setDrafts((draftResult.data||[]) as VideoDraft[]);setViews(allViews);setWatchSessions(allWatchSessions);setFollowers(followersResult.count||0);
    setNewFollowers(newFollowersResult.data?.length||0);
    setLoading(false);setRefreshing(false);
  },[userId,period,onNotice]);

  useEffect(()=>{void load();},[load]);

  const metrics=useMemo(()=>{
    const filteredVideos=selectedType==="all"?videos:videos.filter(v=>v.content_type===selectedType);
    const ids=new Set(filteredVideos.map(v=>v.id));
    const filteredViews=views.filter(v=>ids.has(v.video_id));
    const filteredWatch=watchSessions.filter(v=>ids.has(v.video_id));
    const watch=filteredWatch.reduce((sum,v)=>sum+Number(v.watch_seconds||0),0);
    const likes=filteredVideos.reduce((sum,v)=>sum+(v.likes?.[0]?.count||0),0);
    const comments=filteredVideos.reduce((sum,v)=>sum+(v.comments?.[0]?.count||0),0);
    const lifetimeViews=filteredVideos.reduce((sum,v)=>sum+Number(v.views_count||0),0);
    const days:DailyPoint[]=[];
    for(let i=period-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const key=dateKey(d);days.push({date:key,views:filteredViews.filter(v=>v.viewed_on===key).length});}
    const videoStats=filteredVideos.map(v=>{const rows=filteredViews.filter(x=>x.video_id===v.id);const watchRows=filteredWatch.filter(x=>x.video_id===v.id);const seconds=watchRows.reduce((sum,x)=>sum+Number(x.watch_seconds||0),0);return {...v,periodViews:rows.length,watchSeconds:seconds,averageWatch:rows.length?seconds/rows.length:0};}).sort((a,b)=>b.periodViews-a.periodViews);
    return {watch,likes,comments,lifetimeViews,periodViews:filteredViews.length,days,videoStats,publicationCount:filteredVideos.length,shortCount:videos.filter(v=>v.content_type==="short").length,longCount:videos.filter(v=>v.content_type==="video").length};
  },[videos,views,watchSessions,period,selectedType]);

  const maxDaily=Math.max(1,...metrics.days.map(d=>d.views));
  const publishDraft=async(draft:VideoDraft)=>{
    if(!supabase||!window.confirm("Publier ce brouillon maintenant ?"))return;
    setDraftBusy(draft.id);
    const {error}=await supabase.from("videos").insert({
      user_id:userId,caption:draft.caption,video_url:draft.video_url,thumbnail_url:draft.thumbnail_url,
      target_url:draft.target_url,category:draft.category,content_type:draft.content_type,
      allow_download:draft.allow_offline_download||draft.allow_gallery_download,
      allow_offline_download:draft.allow_offline_download,allow_gallery_download:draft.allow_gallery_download,
      show_stats:draft.show_stats,visibility:"public",interest_tags:draft.interest_tags||[],
      duration_seconds:draft.duration_seconds,aspect_ratio:draft.aspect_ratio
    });
    if(error){onNotice("Publication du brouillon impossible : "+error.message);setDraftBusy(null);return;}
    const removed=await supabase.from("video_drafts").delete().eq("id",draft.id).eq("user_id",userId);
    setDraftBusy(null);
    if(removed.error)onNotice("Vidéo publiée, mais le brouillon n’a pas pu être retiré : "+removed.error.message);
    else onNotice("Ton brouillon est maintenant publié sur ZAVO.");
    await load(false);
  };
  const deleteDraft=async(draft:VideoDraft)=>{
    if(!supabase||!window.confirm("Supprimer ce brouillon ?"))return;
    setDraftBusy(draft.id);
    const {error}=await supabase.from("video_drafts").delete().eq("id",draft.id).eq("user_id",userId);
    if(error){onNotice("Suppression du brouillon impossible : "+error.message);setDraftBusy(null);return;}
    const videoPath=storagePath(draft.video_url,"zavo-videos");
    const thumbPath=storagePath(draft.thumbnail_url,"zavo-media");
    if(videoPath)await supabase.storage.from("zavo-videos").remove([videoPath]);
    if(thumbPath)await supabase.storage.from("zavo-media").remove([thumbPath]);
    setDraftBusy(null);onNotice("Brouillon supprimé.");await load(false);
  };

  const saveEdit=async()=>{
    if(!supabase||!editing)return;
    setSaving(true);
    let thumbnailUrl=editing.thumbnail_url;
    if(thumbnailFile){
      const path=userId+"/"+crypto.randomUUID()+"-"+thumbnailFile.name.replace(/[^a-zA-Z0-9._-]/g,"_");
      const upload=await supabase.storage.from("zavo-media").upload(path,thumbnailFile,{contentType:thumbnailFile.type||"image/jpeg",upsert:false});
      if(upload.error){onNotice("La miniature n’a pas pu être importée : "+upload.error.message);setSaving(false);return;}
      thumbnailUrl=supabase.storage.from("zavo-media").getPublicUrl(path).data.publicUrl;
    }
    const {error}=await supabase.from("videos").update({caption:editCaption.trim(),thumbnail_url:thumbnailUrl}).eq("id",editing.id).eq("user_id",userId);
    setSaving(false);
    if(error){onNotice("Modification impossible : "+error.message);return;}
    setEditing(null);setThumbnailFile(null);onNotice("Ta vidéo a été mise à jour.");await load(false);
  };
  const removeVideo=async(video:CreatorVideo)=>{
    if(!supabase||!window.confirm("Supprimer définitivement cette vidéo et ses statistiques ? Cette action est irréversible."))return;
    setDeleting(video.id);
    const videoPath=storagePath(video.video_url,"zavo-videos");
    const thumbPath=storagePath(video.thumbnail_url,"zavo-media");
    const {error}=await supabase.from("videos").delete().eq("id",video.id).eq("user_id",userId);
    if(error){onNotice("Suppression impossible : "+error.message);setDeleting(null);return;}
    if(videoPath)await supabase.storage.from("zavo-videos").remove([videoPath]);
    if(thumbPath)await supabase.storage.from("zavo-media").remove([thumbPath]);
    setDeleting(null);onNotice("La vidéo a été supprimée.");await load(false);
  };

  if(loading)return <section className="creator-dashboard"><div className="creator-dashboard-loading"><span className="creator-pulse"/> Préparation de ton Studio ZAVO…</div></section>;
  return <section className="creator-dashboard">
    <header className="creator-dashboard-hero">
      <div><div className="creator-kicker"><BarChart3 size={15}/> ESPACE CRÉATEUR</div><h1>Studio <span>ZAVO</span></h1><p>Comprends ton audience, suis tes progrès et améliore tes publications.</p></div>
      <button className="creator-refresh" onClick={()=>void load(false)} disabled={refreshing}><RefreshCw size={16} className={refreshing?"creator-spin":""}/> {refreshing?"Actualisation…":"Actualiser"}</button>
    </header>
    <div className="creator-periods" aria-label="Période des statistiques">{[{v:7,l:"7 jours"},{v:30,l:"30 jours"},{v:90,l:"90 jours"}].map(x=><button key={x.v} className={period===x.v?"active":""} onClick={()=>setPeriod(x.v)}>{x.l}</button>)}</div>
    <div className="creator-type-filters" aria-label="Filtrer par type de publication">
      <button className={selectedType==="all"?"active":""} onClick={()=>setSelectedType("all")}>Tout <span>{videos.length}</span></button>
      <button className={selectedType==="short"?"active":""} onClick={()=>setSelectedType("short")}><Play size={14}/> Shorts <span>{metrics.shortCount}</span></button>
      <button className={selectedType==="video"?"active":""} onClick={()=>setSelectedType("video")}><VideoIcon size={14}/> Vidéos longues <span>{metrics.longCount}</span></button>
    </div>
    <div className="creator-metric-grid">
      <article className="creator-metric creator-metric-blue"><span><Eye/> Vues totales</span><strong>{fmt(metrics.lifetimeViews)}</strong><small>{fmt(metrics.periodViews)} vues suivies sur {period} jours</small></article>
      <article className="creator-metric creator-metric-green"><span><Clock3/> Temps de visionnage</span><strong>{(metrics.watch/3600).toLocaleString("fr-FR",{maximumFractionDigits:1})} h</strong><small>Temps mesuré sur la période</small></article>
      <article className="creator-metric creator-metric-red"><span><Heart/> Mentions J’aime</span><strong>{fmt(metrics.likes)}</strong><small>Sur l’ensemble de tes vidéos</small></article>
      <article className="creator-metric creator-metric-blue"><span><MessageCircle/> Commentaires</span><strong>{fmt(metrics.comments)}</strong><small>Sur l’ensemble de tes vidéos</small></article>
      <article className="creator-metric creator-metric-green"><span><Users/> Abonnés</span><strong>{fmt(followers)}</strong><small>+{fmt(newFollowers)} sur {period} jours</small></article>
      <article className="creator-metric creator-metric-red"><span><VideoIcon/> Publications</span><strong>{fmt(videos.length)}</strong><small>{selectedType==="short"?"Shorts":selectedType==="video"?"Vidéos longues":"Publications de ton compte"}</small></article>
    </div>
    <div className="creator-analytics-grid">
      <section className="creator-panel creator-chart-panel">
        <div className="creator-panel-heading"><div><span className="creator-kicker">AUDIENCE</span><h2>Évolution des vues</h2></div><span className="creator-chart-total"><TrendingUp size={15}/> {fmt(metrics.periodViews)}</span></div>
        {metrics.periodViews===0?<div className="creator-empty-chart"><BarChart3 size={30}/><strong>Les premières statistiques arrivent ici</strong><span>Les vues mesurées apparaîtront lorsque des spectateurs regarderont tes vidéos.</span></div>:<div className="creator-chart">{metrics.days.map((d,i)=><div className="creator-chart-col" key={d.date} title={shortDate(d.date)+": "+d.views+" vues"}><div className="creator-chart-bar-wrap"><div className="creator-chart-bar" style={{height:Math.max(d.views?5:0,(d.views/maxDaily)*100)+"%"}}/></div>{(period===7||i%Math.ceil(period/7)===0||i===period-1)&&<small>{shortDate(d.date)}</small>}</div>)}</div>}
      </section>
      <section className="creator-panel creator-audience-panel"><div className="creator-panel-heading"><div><span className="creator-kicker">COMMUNAUTÉ</span><h2>Ton audience</h2></div><Users size={20}/></div><div className="creator-audience-number">{fmt(followers)} <span>abonnés</span></div><div className="creator-growth"><ArrowUpRight size={17}/> +{fmt(newFollowers)} nouveaux abonnés sur {period} jours</div><p>Continue de publier régulièrement et d’échanger avec ta communauté pour développer ton audience.</p></section>
    </div>
    <section className="creator-panel creator-video-manager creator-drafts-panel">
      <div className="creator-panel-heading"><div><span className="creator-kicker">À TERMINER PLUS TARD</span><h2>Mes brouillons <span className="creator-count">{drafts.length}</span></h2></div></div>
      {!drafts.length?<div className="creator-empty-videos"><Pencil size={30}/><strong>Aucun brouillon enregistré</strong><span>Depuis l’écran de publication, tu peux enregistrer une vidéo pour la reprendre plus tard.</span></div>:<div className="creator-video-list">{drafts.map(d=><article className="creator-video-row" key={d.id}><div className="creator-video-thumb">{d.thumbnail_url?<img src={d.thumbnail_url} alt=""/>:<div><Play/></div>}</div><div className="creator-video-info"><strong>{d.caption||"Brouillon sans description"}</strong><small><CalendarDays size={12}/> Enregistré le {new Date(d.created_at).toLocaleDateString("fr-FR")} · {d.content_type==="short"?"Short":"Vidéo"}</small></div><div className="creator-video-actions"><button onClick={()=>void publishDraft(d)} disabled={draftBusy===d.id}><Play size={14}/> {draftBusy===d.id?"Traitement…":"Publier"}</button><button className="creator-delete" onClick={()=>void deleteDraft(d)} disabled={draftBusy===d.id}><Trash2 size={14}/> Supprimer</button></div></article>)}</div>}
    </section>
    <section className="creator-panel creator-video-manager">
      <div className="creator-panel-heading"><div><span className="creator-kicker">GESTION DU CONTENU</span><h2>{selectedType==="short"?"Mes Shorts":selectedType==="video"?"Mes vidéos longues":"Mes vidéos"} <span className="creator-count">{metrics.publicationCount}</span></h2></div><span className="creator-manage-hint">Modifie ou supprime tes publications</span></div>
      {!videos.length?<div className="creator-empty-videos"><VideoIcon size={34}/><strong>Tu n’as pas encore publié de vidéo</strong><span>Ta première publication apparaîtra ici avec ses statistiques.</span></div>:<div className="creator-video-list">{metrics.videoStats.map(v=><article className="creator-video-row" key={v.id}>
        <div className="creator-video-thumb">{v.thumbnail_url?<img src={v.thumbnail_url} alt=""/>:<div><Play/></div>}</div>
        <div className="creator-video-info"><strong>{v.caption||"Sans description"}</strong><small><CalendarDays size={12}/> {new Date(v.created_at).toLocaleDateString("fr-FR")} · {v.content_type==="short"?"Short":"Vidéo"} · {v.visibility==="public"?"Publique":"Privée"}</small><div className="creator-video-metrics"><span><Eye size={13}/> {fmt(v.views_count)}</span><span><Heart size={13}/> {fmt(v.likes?.[0]?.count||0)}</span><span><MessageCircle size={13}/> {fmt(v.comments?.[0]?.count||0)}</span><span><Clock3 size={13}/> {Math.round(v.averageWatch)} s moy.</span></div></div>
        <div className="creator-video-actions"><button onClick={()=>{setEditing(v);setEditCaption(v.caption||"");setThumbnailFile(null);}}><Pencil size={15}/> Modifier</button><button className="creator-delete" onClick={()=>void removeVideo(v)} disabled={deleting===v.id}><Trash2 size={15}/> {deleting===v.id?"Suppression…":"Supprimer"}</button></div>
      </article>)}</div>}
    </section>
    {editing&&<div className="creator-edit-backdrop" onClick={()=>setEditing(null)}><section className="creator-edit-modal" onClick={e=>e.stopPropagation()}><header><div><span className="creator-kicker">MODIFICATION</span><h2>Modifier la vidéo</h2></div><button onClick={()=>setEditing(null)} aria-label="Fermer"><X/></button></header><label>Description de la vidéo<textarea value={editCaption} onChange={e=>setEditCaption(e.target.value)} maxLength={2200} rows={5}/><small>{editCaption.length}/2200 caractères</small></label><label className="creator-thumbnail-upload"><ImagePlus/><span>{thumbnailFile?thumbnailFile.name:"Changer la miniature (image)"}</span><input type="file" accept="image/*" onChange={e=>setThumbnailFile(e.target.files?.[0]||null)}/></label><footer><button className="creator-cancel" onClick={()=>setEditing(null)}>Annuler</button><button className="creator-save" onClick={()=>void saveEdit()} disabled={saving||!editCaption.trim()}><Save size={15}/> {saving?"Enregistrement…":"Enregistrer"}</button></footer></section></div>}
  </section>;
}
