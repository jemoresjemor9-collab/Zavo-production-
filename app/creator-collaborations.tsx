"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, UserPlus, Check, X, Trash2, Repeat2, Video, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Props={userId:string;onNotice:(message:string)=>void};
const videoSelect="id,caption,content_type,thumbnail_url,created_at";
export default function CreatorCollaborations({userId,onNotice}:Props){
  const [videos,setVideos]=useState<any[]>([]);
  const [sources,setSources]=useState<any[]>([]);
  const [collaborations,setCollaborations]=useState<any[]>([]);
  const [remixes,setRemixes]=useState<any[]>([]);
  const [selectedVideo,setSelectedVideo]=useState("");
  const [username,setUsername]=useState("");
  const [sourceVideo,setSourceVideo]=useState("");
  const [remixVideo,setRemixVideo]=useState("");
  const [remixType,setRemixType]=useState<"duet"|"remix">("remix");
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);

  const load=useCallback(async()=>{
    if(!supabase||!userId){setLoading(false);return;}
    setLoading(true);
    const [ownResult,sourceResult,collabResult,remixResult]=await Promise.all([
      supabase.from("videos").select(videoSelect).eq("user_id",userId).eq("visibility","public").eq("moderation_status","approved").order("created_at",{ascending:false}).limit(200),
      supabase.from("videos").select("id,caption,content_type,thumbnail_url,user_id,profiles:profiles!videos_user_id_fkey(username,display_name)").eq("visibility","public").eq("moderation_status","approved").neq("user_id",userId).order("created_at",{ascending:false}).limit(200),
      supabase.from("zavo_video_collaborations").select("id,video_id,owner_id,collaborator_id,status,created_at,responded_at,video:videos!zavo_video_collaborations_video_id_fkey(id,caption,thumbnail_url),owner:profiles!zavo_video_collaborations_owner_id_fkey(username,display_name),collaborator:profiles!zavo_video_collaborations_collaborator_id_fkey(username,display_name)").or("owner_id.eq."+userId+",collaborator_id.eq."+userId).order("created_at",{ascending:false}).limit(200),
      supabase.from("zavo_video_remixes").select("id,original_video_id,remix_video_id,creator_id,remix_type,created_at,original:videos!zavo_video_remixes_original_video_id_fkey(id,caption,thumbnail_url,profiles:profiles!videos_user_id_fkey(username,display_name)),remix:videos!zavo_video_remixes_remix_video_id_fkey(id,caption,thumbnail_url,profiles:profiles!videos_user_id_fkey(username,display_name))").eq("creator_id",userId).order("created_at",{ascending:false}).limit(100)
    ]);
    if(ownResult.error||collabResult.error||remixResult.error)onNotice("Certaines données de collaboration n’ont pas pu être chargées.");
    setVideos(ownResult.data||[]);setSources(sourceResult.data||[]);setCollaborations(collabResult.data||[]);setRemixes(remixResult.data||[]);
    setLoading(false);
  },[userId,onNotice]);

  useEffect(()=>{void load();},[load]);

  const invite=async()=>{
    if(!selectedVideo||!username.trim())return;
    const normalized=username.trim().replace(/^@/,"");
    setBusy(true);
    const {data:profile,error:profileError}=await supabase!.from("profiles").select("id,username").ilike("username",normalized).maybeSingle();
    if(profileError||!profile){setBusy(false);onNotice(profileError?"Recherche impossible : "+profileError.message:"Aucun compte trouvé avec ce nom.");return;}
    if(profile.id===userId){setBusy(false);onNotice("Tu ne peux pas t’inviter toi-même.");return;}
    const {error}=await supabase!.from("zavo_video_collaborations").insert({video_id:selectedVideo,owner_id:userId,collaborator_id:profile.id,status:"pending"});
    setBusy(false);
    if(error){onNotice(error.code==="23505"?"Cette personne a déjà été invitée pour cette vidéo.":"Invitation impossible : "+error.message);return;}
    setUsername("");onNotice("Invitation de collaboration envoyée à @"+(profile.username||normalized)+".");await load();
  };

  const respond=async(item:any,status:"accepted"|"rejected")=>{
    const {error}=await supabase!.from("zavo_video_collaborations").update({status,responded_at:new Date().toISOString()}).eq("id",item.id).eq("collaborator_id",userId);
    if(error){onNotice("Impossible de répondre à cette invitation : "+error.message);return;}
    onNotice(status==="accepted"?"Collaboration acceptée.":"Invitation refusée.");await load();
  };

  const cancel=async(item:any)=>{
    const {error}=await supabase!.from("zavo_video_collaborations").delete().eq("id",item.id);
    if(error){onNotice("Impossible d’annuler cette collaboration : "+error.message);return;}
    await load();onNotice("Invitation ou collaboration retirée.");
  };

  const createRemix=async()=>{
    if(!sourceVideo||!remixVideo)return;
    setBusy(true);
    const {error}=await supabase!.from("zavo_video_remixes").insert({original_video_id:sourceVideo,remix_video_id:remixVideo,creator_id:userId,remix_type:remixType});
    setBusy(false);
    if(error){onNotice(error.code==="23505"?"Cette vidéo est déjà associée à une source.":"Association impossible : "+error.message);return;}
    setSourceVideo("");setRemixVideo("");onNotice(remixType==="duet"?"Duo attribué à la vidéo source.":"Remix attribué à la vidéo source.");await load();
  };

  const incoming=collaborations.filter(item=>item.collaborator_id===userId&&item.status==="pending");
  const outgoing=collaborations.filter(item=>item.owner_id===userId);
  const accepted=collaborations.filter(item=>item.status==="accepted");

  if(loading)return <section className="creator-panel"><p>Chargement des collaborations…</p></section>;
  return <section className="creator-panel creator-collaboration-panel">
    <div className="creator-panel-heading"><div><span className="creator-kicker">CRÉATION À PLUSIEURS</span><h2>Collaborations, duos et remixes</h2></div><Users size={20}/></div>
    <p className="creator-collaboration-intro">Invite un autre créateur à être associé à une de tes vidéos. Les invitations doivent être acceptées. Tu peux aussi relier une vidéo que tu as publiée à une vidéo source pour déclarer un duo ou un remix.</p>
    <div className="creator-collab-form">
      <h3><UserPlus size={16}/> Inviter un créateur</h3>
      <label>Ta vidéo<select value={selectedVideo} onChange={e=>setSelectedVideo(e.target.value)}><option value="">Choisir une de tes publications…</option>{videos.map(video=><option key={video.id} value={video.id}>{video.caption||"Publication sans titre"}</option>)}</select></label>
      <label>Nom d’utilisateur du collaborateur<input value={username} onChange={e=>setUsername(e.target.value)} maxLength={40} placeholder="@nom_utilisateur"/></label>
      <button disabled={busy||!selectedVideo||!username.trim()} onClick={()=>void invite()}><UserPlus size={14}/> Envoyer l’invitation</button>
    </div>
    {incoming.length>0&&<div className="creator-collab-list"><h3>Invitations reçues · {incoming.length}</h3>{incoming.map(item=><article key={item.id}><div><strong>{item.video?.caption||"Publication ZAVO"}</strong><small>Invitation de @{item.owner?.username||"créateur"} · {new Date(item.created_at).toLocaleDateString("fr-FR")}</small></div><button className="creator-collab-accept" onClick={()=>void respond(item,"accepted")}><Check size={14}/> Accepter</button><button className="creator-collab-reject" onClick={()=>void respond(item,"rejected")}><X size={14}/> Refuser</button></article>)}</div>}
    {outgoing.length>0&&<div className="creator-collab-list"><h3>Mes invitations et collaborations</h3>{outgoing.map(item=><article key={item.id}><div><strong>{item.video?.caption||"Publication ZAVO"}</strong><small>@{item.collaborator?.username||"créateur"} · {item.status==="pending"?"En attente":item.status==="accepted"?"Acceptée":"Refusée"}</small></div><span className={"creator-collab-status "+item.status}>{item.status==="pending"?"En attente":item.status==="accepted"?"Acceptée":"Refusée"}</span>{item.status!=="rejected"&&<button className="creator-collab-reject" onClick={()=>void cancel(item)}><Trash2 size={14}/></button>}</article>)}</div>}
    {accepted.filter(item=>item.collaborator_id===userId).length>0&&<div className="creator-collab-list"><h3>Vidéos auxquelles tu collabores</h3>{accepted.filter(item=>item.collaborator_id===userId).map(item=><article key={item.id}><div><strong>{item.video?.caption||"Publication ZAVO"}</strong><small>Avec @{item.owner?.username||"créateur"}</small></div><span className="creator-collab-status accepted"><ShieldCheck size={13}/> Acceptée</span></article>)}</div>}
    <div className="creator-collab-form creator-remix-form">
      <h3><Repeat2 size={16}/> Déclarer un duo ou un remix</h3>
      <p>Publie d’abord ta propre vidéo, puis relie-la ici à la publication publique qui t’a inspiré.</p>
      <label>Vidéo source<select value={sourceVideo} onChange={e=>setSourceVideo(e.target.value)}><option value="">Choisir une vidéo publique…</option>{sources.map(video=><option key={video.id} value={video.id}>{video.caption||"Vidéo sans titre"} · @{video.profiles?.username||"créateur"}</option>)}</select></label>
      <label>Ta vidéo publiée<select value={remixVideo} onChange={e=>setRemixVideo(e.target.value)}><option value="">Choisir ta vidéo…</option>{videos.map(video=><option key={video.id} value={video.id}>{video.caption||"Publication sans titre"}</option>)}</select></label>
      <label>Type<select value={remixType} onChange={e=>setRemixType(e.target.value as "duet"|"remix")}><option value="remix">Remix</option><option value="duet">Duo</option></select></label>
      <button disabled={busy||!sourceVideo||!remixVideo||sourceVideo===remixVideo} onClick={()=>void createRemix()}><Repeat2 size={14}/> Associer la vidéo</button>
    </div>
    {remixes.length>0&&<div className="creator-collab-list"><h3>Mes duos et remixes</h3>{remixes.map(item=><article key={item.id}><div><strong>{item.remix?.caption||"Ma vidéo"} · {item.remix_type==="duet"?"Duo":"Remix"}</strong><small>Vidéo source : {item.original?.caption||"Publication originale"} · @{item.original?.profiles?.username||"créateur"}</small></div><button className="creator-collab-reject" onClick={async()=>{const {error}=await supabase!.from("zavo_video_remixes").delete().eq("id",item.id);if(error)onNotice("Suppression impossible : "+error.message);else{setRemixes(rows=>rows.filter(row=>row.id!==item.id));onNotice("Association supprimée.");}}}><Trash2 size={14}/></button></article>)}</div>}
  </section>;
}
