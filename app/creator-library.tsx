"use client";

import { useCallback, useEffect, useState } from "react";
import { Bookmark, Clock3, ListVideo, Plus, Trash2, Play, Eye, Lock, Globe, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Props={userId:string|null;onNotice:(message:string)=>void;onOpenVideo:(video:any)=>void};
type Playlist={id:string;owner_id:string;title:string;description:string;visibility:"private"|"public";created_at:string;items?:{count:number}[]};
const videoFields="id,caption,video_url,thumbnail_url,target_url,category,user_id,views_count,clicks_count,watch_time_seconds,completed_views_count,duration_seconds,aspect_ratio,created_at,content_type,allow_download,allow_offline_download,allow_gallery_download,allow_repost,show_stats,display_mode,display_scale,display_x,display_y,media_urls,moderation_status,interest_tags,hashtags,profiles:profiles!videos_user_id_fkey(id,username,display_name,avatar_url,stats_visible)";

export default function CreatorLibrary({userId,onNotice,onOpenVideo}:Props){
  const [section,setSection]=useState<"history"|"playlists">("history");
  const [history,setHistory]=useState<any[]>([]);
  const [playlists,setPlaylists]=useState<Playlist[]>([]);
  const [selected,setSelected]=useState<Playlist|null>(null);
  const [items,setItems]=useState<any[]>([]);
  const [available,setAvailable]=useState<any[]>([]);
  const [addVideo,setAddVideo]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [showCreate,setShowCreate]=useState(false);
  const [title,setTitle]=useState("");
  const [description,setDescription]=useState("");
  const [visibility,setVisibility]=useState<"private"|"public">("private");

  const load=useCallback(async()=>{
    if(!supabase||!userId){setHistory([]);setPlaylists([]);setLoading(false);return;}
    setLoading(true);
    const [historyResult,playlistResult,videoResult]=await Promise.all([
      supabase.from("zavo_watch_history").select("id,video_id,watch_seconds,last_watched_at,completed_at,video:videos!zavo_watch_history_video_id_fkey("+videoFields+")").eq("user_id",userId).order("last_watched_at",{ascending:false}).limit(200),
      supabase.from("zavo_playlists").select("id,owner_id,title,description,visibility,created_at,items:zavo_playlist_items(count)").eq("owner_id",userId).order("updated_at",{ascending:false}).limit(100),
      supabase.from("videos").select(videoFields).eq("visibility","public").eq("moderation_status","approved").order("created_at",{ascending:false}).limit(200)
    ]);
    if(historyResult.error)onNotice("L’historique n’a pas pu être chargé : "+historyResult.error.message);
    if(playlistResult.error)onNotice("Les playlists n’ont pas pu être chargées : "+playlistResult.error.message);
    setHistory((historyResult.data||[]).filter((row:any)=>row.video));
    setPlaylists((playlistResult.data||[]) as Playlist[]);
    setAvailable(videoResult.data||[]);
    setLoading(false);
  },[userId,onNotice]);

  useEffect(()=>{void load();},[load]);

  const openPlaylist=async(playlist:Playlist)=>{
    setSelected(playlist);setItems([]);setAddVideo("");
    const {data,error}=await supabase!.from("zavo_playlist_items").select("id,playlist_id,video_id,added_at,video:videos!zavo_playlist_items_video_id_fkey("+videoFields+")").eq("playlist_id",playlist.id).order("added_at",{ascending:false});
    if(error){onNotice("Impossible d’ouvrir cette playlist : "+error.message);return;}
    setItems((data||[]).filter((row:any)=>row.video));
  };

  const create=async()=>{
    if(!userId||title.trim().length<2)return;
    setBusy(true);
    const {data,error}=await supabase!.from("zavo_playlists").insert({owner_id:userId,title:title.trim(),description:description.trim(),visibility}).select("id,owner_id,title,description,visibility,created_at").single();
    setBusy(false);
    if(error){onNotice("Création de la playlist impossible : "+error.message);return;}
    setShowCreate(false);setTitle("");setDescription("");setVisibility("private");
    await load();if(data)await openPlaylist(data as Playlist);onNotice("Playlist créée.");
  };

  const add=async()=>{
    if(!selected||!addVideo)return;
    setBusy(true);
    const {error}=await supabase!.from("zavo_playlist_items").insert({playlist_id:selected.id,video_id:addVideo});
    setBusy(false);
    if(error){onNotice(error.code==="23505"?"Cette publication est déjà dans la playlist.":"Ajout impossible : "+error.message);return;}
    await openPlaylist(selected);await load();onNotice("Publication ajoutée à la playlist.");
  };

  const removeItem=async(item:any)=>{
    const {error}=await supabase!.from("zavo_playlist_items").delete().eq("id",item.id);
    if(error){onNotice("Suppression impossible : "+error.message);return;}
    setItems(rows=>rows.filter(row=>row.id!==item.id));await load();
  };

  const removePlaylist=async(playlist:Playlist)=>{
    if(!window.confirm("Supprimer cette playlist ? Les vidéos originales ne seront pas supprimées."))return;
    const {error}=await supabase!.from("zavo_playlists").delete().eq("id",playlist.id).eq("owner_id",userId);
    if(error){onNotice("Suppression impossible : "+error.message);return;}
    if(selected?.id===playlist.id){setSelected(null);setItems([]);}await load();onNotice("Playlist supprimée. Les publications originales sont conservées.");
  };

  const toggleVisibility=async(playlist:Playlist)=>{
    const next=playlist.visibility==="public"?"private":"public";
    const {error}=await supabase!.from("zavo_playlists").update({visibility:next,updated_at:new Date().toISOString()}).eq("id",playlist.id).eq("owner_id",userId);
    if(error){onNotice("Modification de la visibilité impossible : "+error.message);return;}
    setPlaylists(rows=>rows.map(row=>row.id===playlist.id?{...row,visibility:next}:row));
    if(selected?.id===playlist.id)setSelected({...selected,visibility:next});
  };

  const removeHistory=async(row:any)=>{
    const {error}=await supabase!.from("zavo_watch_history").delete().eq("id",row.id).eq("user_id",userId);
    if(error){onNotice("Impossible de retirer cette vidéo de l’historique : "+error.message);return;}
    setHistory(rows=>rows.filter(item=>item.id!==row.id));
  };

  const clearHistory=async()=>{
    if(!window.confirm("Effacer tout ton historique de visionnage ?"))return;
    const {error}=await supabase!.from("zavo_watch_history").delete().eq("user_id",userId);
    if(error){onNotice("Impossible d’effacer l’historique : "+error.message);return;}
    setHistory([]);onNotice("Historique effacé.");
  };

  if(!userId)return <section className="library-page"><div className="section-kicker">TA BIBLIOTHÈQUE PERSONNELLE</div><h1>Ma bibliothèque</h1><p className="section-description">Connecte-toi pour retrouver ton historique et tes playlists sur tous tes appareils.</p></section>;

  return <section className="library-page">
    <div className="section-kicker">TA BIBLIOTHÈQUE PERSONNELLE</div>
    <h1>Ma bibliothèque</h1>
    <p className="section-description">Retrouve tes vidéos regardées, crée tes collections et conserve tes publications préférées.</p>
    <div className="library-collection-tabs">
      <button className={section==="history"?"active":""} onClick={()=>{setSection("history");setSelected(null);}}><Clock3 size={16}/> Historique</button>
      <button className={section==="playlists"?"active":""} onClick={()=>{setSection("playlists");setSelected(null);}}><ListVideo size={16}/> Playlists</button>
    </div>
    {loading?<div className="creator-empty-videos">Chargement de ta bibliothèque…</div>:section==="history"?<section className="library-collection-panel">
      <div className="library-collection-heading"><div><h2>Historique de visionnage</h2><p>{history.length} publication(s) récemment regardée(s)</p></div>{history.length>0&&<button className="library-danger-link" onClick={()=>void clearHistory()}>Tout effacer</button>}</div>
      {history.length? <div className="library-history-list">{history.map(row=><article className="library-history-row" key={row.id}>
        <button className="library-history-open" onClick={()=>onOpenVideo(row.video)}>{row.video.thumbnail_url?<img src={row.video.thumbnail_url} alt=""/>:<span className="library-history-placeholder"><Play/></span>}<span className="library-history-copy"><strong>{row.video.caption||"Publication sans titre"}</strong><small>@{row.video.profiles?.username||"créateur"} · {new Date(row.last_watched_at).toLocaleString("fr-FR")}</small><small>{Math.floor(Number(row.watch_seconds||0)/60)} min {Number(row.watch_seconds||0)%60} s regardées {row.completed_at?"· Terminée":""}</small></span></button>
        <button className="library-icon-button" title="Retirer de l’historique" onClick={()=>void removeHistory(row)}><Trash2 size={16}/></button>
      </article>)}</div>:<div className="library-empty"><Clock3/><strong>Aucun visionnage enregistré</strong><span>Les vidéos que tu regardes apparaîtront ici lorsque tu es connecté.</span></div>}
    </section>:<section className="library-collection-panel">
      {selected?<><div className="library-collection-heading"><div><button className="library-back-link" onClick={()=>setSelected(null)}>← Mes playlists</button><h2>{selected.title}</h2><p>{selected.description||"Ta collection de publications ZAVO."} · {selected.visibility==="public"?"Publique":"Privée"}</p></div><button className="library-icon-button" title="Supprimer la playlist" onClick={()=>void removePlaylist(selected)}><Trash2 size={16}/></button></div>
        <div className="library-playlist-add"><select value={addVideo} onChange={e=>setAddVideo(e.target.value)}><option value="">Ajouter une publication…</option>{available.filter(video=>!items.some(item=>item.video_id===video.id)).map(video=><option key={video.id} value={video.id}>{video.caption||"Publication sans titre"} · @{video.profiles?.username||"créateur"}</option>)}</select><button disabled={!addVideo||busy} onClick={()=>void add()}><Plus size={15}/> Ajouter</button></div>
        {items.length?<div className="library-history-list">{items.map(item=><article className="library-history-row" key={item.id}><button className="library-history-open" onClick={()=>onOpenVideo(item.video)}>{item.video.thumbnail_url?<img src={item.video.thumbnail_url} alt=""/>:<span className="library-history-placeholder"><Play/></span>}<span className="library-history-copy"><strong>{item.video.caption||"Publication sans titre"}</strong><small>@{item.video.profiles?.username||"créateur"} · Ajouté le {new Date(item.added_at).toLocaleDateString("fr-FR")}</small></span></button><button className="library-icon-button" title="Retirer de la playlist" onClick={()=>void removeItem(item)}><Trash2 size={16}/></button></article>)}</div>:<div className="library-empty"><ListVideo/><strong>Cette playlist est vide</strong><span>Ajoute une vidéo ou un post depuis la liste ci-dessus.</span></div>}
      </>:<><div className="library-collection-heading"><div><h2>Mes playlists</h2><p>Organise les vidéos et publications dans tes propres collections.</p></div><button className="library-create-button" onClick={()=>setShowCreate(true)}><Plus size={16}/> Créer une playlist</button></div>
        {playlists.length?<div className="library-playlist-grid">{playlists.map(playlist=><article className="library-playlist-card" key={playlist.id}><button className="library-playlist-open" onClick={()=>void openPlaylist(playlist)}><span className="library-playlist-icon"><ListVideo/></span><strong>{playlist.title}</strong><small>{playlist.items?.[0]?.count||0} publication(s) · {playlist.visibility==="public"?"Publique":"Privée"}</small><span>{playlist.description||"Aucune description"}</span></button><div className="library-playlist-actions"><button onClick={()=>void toggleVisibility(playlist)}>{playlist.visibility==="public"?<Lock size={14}/>:<Globe size={14}/>} {playlist.visibility==="public"?"Rendre privée":"Rendre publique"}</button><button onClick={()=>void removePlaylist(playlist)}><Trash2 size={14}/></button></div></article>)}</div>:<div className="library-empty"><ListVideo/><strong>Aucune playlist créée</strong><span>Crée une collection pour organiser les vidéos que tu souhaites revoir.</span></div>}
      </>}
    </section>}
    {showCreate&&<div className="library-modal-backdrop" onClick={()=>setShowCreate(false)}><section className="library-modal" onClick={e=>e.stopPropagation()}><header><h2>Créer une playlist</h2><button onClick={()=>setShowCreate(false)}><X/></button></header><label>Nom de la playlist<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={100} placeholder="Ex. Mes vidéos préférées"/></label><label>Description<textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={1000} rows={3}/></label><label>Visibilité<select value={visibility} onChange={e=>setVisibility(e.target.value as any)}><option value="private">Privée — visible uniquement par moi</option><option value="public">Publique — visible par tous</option></select></label><footer><button onClick={()=>setShowCreate(false)}>Annuler</button><button disabled={busy||title.trim().length<2} onClick={()=>void create()}>{busy?"Création…":"Créer"}</button></footer></section></div>}
  </section>;
}
