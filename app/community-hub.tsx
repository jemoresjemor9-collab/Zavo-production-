"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Users, MessageCircle, Plus, Search, Trophy, Clapperboard, Play, LogIn, Send, CalendarDays, X, ChevronRight, RefreshCw, Hash, Trash2, Heart } from "lucide-react";
import { supabase } from "@/lib/supabase";

type HubTab = "communities" | "challenges" | "series";
type Community = { id:string; owner_id:string; name:string; slug:string; description:string; visibility:"public"|"private"; created_at:string; };
type Challenge = { id:string; creator_id:string; title:string; description:string; hashtag:string; starts_at:string; ends_at:string; status:string; entries?:{count:number}[]; };
type Series = { id:string; creator_id:string; title:string; description:string; cover_url:string|null; is_public:boolean; created_at:string; episodes?:{count:number}[]; };
const localDate = (date:Date) => new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
const slugify = (value:string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,64);

export default function CommunityHub({userId,onNotice,onLogin}:{userId:string|null;onNotice:(message:string)=>void;onLogin:()=>void}) {
  const [tab,setTab]=useState<HubTab>("communities");
  const [communities,setCommunities]=useState<Community[]>([]);
  const [memberships,setMemberships]=useState<string[]>([]);
  const [challenges,setChallenges]=useState<Challenge[]>([]);
  const [challengeEntries,setChallengeEntries]=useState<any[]>([]);
  const [series,setSeries]=useState<Series[]>([]);
  const [ownVideos,setOwnVideos]=useState<any[]>([]);
  const [selectedCommunity,setSelectedCommunity]=useState<Community|null>(null);
  const [posts,setPosts]=useState<any[]>([]);
  const [postText,setPostText]=useState("");
  const [communityComments,setCommunityComments]=useState<any[]>([]);
  const [communityReactions,setCommunityReactions]=useState<any[]>([]);
  const [commentDrafts,setCommentDrafts]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [busy,setBusy]=useState(false);
  const [search,setSearch]=useState("");
  const [showCommunityForm,setShowCommunityForm]=useState(false);
  const [communityName,setCommunityName]=useState("");
  const [communityDescription,setCommunityDescription]=useState("");
  const [communityVisibility,setCommunityVisibility]=useState<"public"|"private">("public");
  const [inviteUsername,setInviteUsername]=useState("");
  const [inviteBusy,setInviteBusy]=useState(false);
  const [showChallengeForm,setShowChallengeForm]=useState(false);
  const [challengeTitle,setChallengeTitle]=useState("");
  const [challengeDescription,setChallengeDescription]=useState("");
  const [challengeHashtag,setChallengeHashtag]=useState("");
  const [challengeStart,setChallengeStart]=useState(()=>localDate(new Date()));
  const [challengeEnd,setChallengeEnd]=useState(()=>localDate(new Date(Date.now()+7*86400000)));
  const [showSeriesForm,setShowSeriesForm]=useState(false);
  const [seriesTitle,setSeriesTitle]=useState("");
  const [seriesDescription,setSeriesDescription]=useState("");
  const [activeSeries,setActiveSeries]=useState<Series|null>(null);
  const [episodes,setEpisodes]=useState<any[]>([]);
  const [activeEpisode,setActiveEpisode]=useState<any|null>(null);
  const [entryChallenge,setEntryChallenge]=useState<Challenge|null>(null);
  const [entryVideo,setEntryVideo]=useState("");

  const load=useCallback(async(spinner=true)=>{
    if(!supabase){setLoading(false);return;}
    if(spinner)setLoading(true);else setRefreshing(true);
    const [publicResult,challengeResult,seriesResult,memberResult,videoResult,ownedPrivateResult,challengeEntryResult]=await Promise.all([
      supabase.from("zavo_communities").select("id,owner_id,name,slug,description,visibility,created_at").eq("visibility","public").order("created_at",{ascending:false}).limit(60),
      supabase.from("zavo_challenges").select("id,creator_id,title,description,hashtag,starts_at,ends_at,status,entries:zavo_challenge_entries(count)").order("created_at",{ascending:false}).limit(60),
      supabase.from("zavo_series").select("id,creator_id,title,description,cover_url,is_public,created_at,episodes:zavo_series_episodes(count)").eq("is_public",true).order("created_at",{ascending:false}).limit(60),
      userId?supabase.from("zavo_community_members").select("community_id").eq("user_id",userId):Promise.resolve({data:[],error:null} as any),
      userId?supabase.from("videos").select("id,caption,content_type,thumbnail_url,created_at").eq("user_id",userId).in("content_type",["short","video"]).order("created_at",{ascending:false}).limit(100):Promise.resolve({data:[],error:null} as any),
      userId?supabase.from("zavo_communities").select("id,owner_id,name,slug,description,visibility,created_at").eq("owner_id",userId).eq("visibility","private"):Promise.resolve({data:[],error:null} as any),
      supabase.from("zavo_challenge_entries").select("id,challenge_id,user_id,video_id,created_at,video:videos!zavo_challenge_entries_video_id_fkey(id,caption,thumbnail_url,views_count,profiles:profiles!videos_user_id_fkey(username,display_name,avatar_url))").order("created_at",{ascending:false}).limit(1000)
    ]);
    const memberIds=(memberResult.data||[]).map((x:any)=>x.community_id);
    let joinedPrivate:Community[]=[];
    if(memberIds.length){
      const {data}=await supabase.from("zavo_communities").select("id,owner_id,name,slug,description,visibility,created_at").in("id",memberIds);
      joinedPrivate=(data||[]) as Community[];
    }
    const communityMap=new Map<string,Community>();
    [...(publicResult.data||[]),...joinedPrivate,...(ownedPrivateResult.data||[])].forEach((x:any)=>communityMap.set(x.id,x));
    setCommunities([...communityMap.values()].sort((a,b)=>b.created_at.localeCompare(a.created_at)));
    setMemberships(memberIds);
    setChallenges((challengeResult.data||[]) as Challenge[]);
    setChallengeEntries(challengeEntryResult.data||[]);
    setSeries((seriesResult.data||[]) as Series[]);
    setOwnVideos(videoResult.data||[]);
    if(publicResult.error||challengeResult.error||seriesResult.error)onNotice("Certaines données communautaires n’ont pas pu être chargées. Actualise dans un instant.");
    setLoading(false);setRefreshing(false);
  },[userId,onNotice]);

  useEffect(()=>{void load();},[load]);

  const filteredCommunities=useMemo(()=>communities.filter(c=>(c.name+" "+c.description).toLocaleLowerCase().includes(search.toLocaleLowerCase())),[communities,search]);
  const openCommunity=async(community:Community)=>{
    setSelectedCommunity(community);
    const {data,error}=await supabase!.from("zavo_community_posts").select("id,body,created_at,author_id,profiles!zavo_community_posts_author_id_fkey(username,display_name,avatar_url)").eq("community_id",community.id).order("created_at",{ascending:false}).limit(80);
    if(error){onNotice("Impossible de charger les discussions : "+error.message);return;}
    setPosts(data||[]);
    const postIds=(data||[]).map((post:any)=>post.id);
    if(postIds.length){
      const [commentsResult,reactionsResult]=await Promise.all([
        supabase!.from("zavo_community_post_comments").select("id,post_id,user_id,body,created_at,profiles:profiles!zavo_community_post_comments_user_id_fkey(username,display_name,avatar_url)").in("post_id",postIds).order("created_at",{ascending:true}),
        supabase!.from("zavo_community_post_reactions").select("post_id,user_id").in("post_id",postIds)
      ]);
      if(commentsResult.error||reactionsResult.error)onNotice("Les réactions ou commentaires ne sont pas tous accessibles.");
      setCommunityComments(commentsResult.data||[]);setCommunityReactions(reactionsResult.data||[]);
    }else{setCommunityComments([]);setCommunityReactions([]);}
  };
  const toggleCommunityReaction=async(post:any)=>{
    if(!userId){onLogin();return;}
    const existing=communityReactions.find((reaction:any)=>reaction.post_id===post.id&&reaction.user_id===userId);
    if(existing){
      const {error}=await supabase!.from("zavo_community_post_reactions").delete().eq("post_id",post.id).eq("user_id",userId);
      if(error){onNotice("Impossible de retirer la réaction : "+error.message);return;}
      setCommunityReactions(rows=>rows.filter((reaction:any)=>!(reaction.post_id===post.id&&reaction.user_id===userId)));
    }else{
      const {error}=await supabase!.from("zavo_community_post_reactions").insert({post_id:post.id,user_id:userId});
      if(error){onNotice("Impossible d’ajouter la réaction : "+error.message);return;}
      setCommunityReactions(rows=>[...rows,{post_id:post.id,user_id:userId}]);
    }
  };
  const sendCommunityComment=async(post:any)=>{
    if(!userId){onLogin();return;}
    const body=(commentDrafts[post.id]||"").trim();if(!body)return;
    const {data,error}=await supabase!.from("zavo_community_post_comments").insert({post_id:post.id,user_id:userId,body}).select("id,post_id,user_id,body,created_at,profiles:profiles!zavo_community_post_comments_user_id_fkey(username,display_name,avatar_url)").single();
    if(error){onNotice("Commentaire impossible : "+error.message);return;}
    setCommunityComments(rows=>[...rows,data]);setCommentDrafts(rows=>({...rows,[post.id]:""}));
  };
  const createCommunity=async()=>{
    if(!userId){onLogin();return;}
    const name=communityName.trim(),slug=slugify(name);
    if(name.length<3||!slug){onNotice("Le nom de la communauté doit contenir au moins 3 caractères.");return;}
    setBusy(true);
    const {error}=await supabase!.from("zavo_communities").insert({owner_id:userId,name,slug,description:communityDescription.trim(),visibility:communityVisibility});
    setBusy(false);
    if(error){onNotice(error.code==="23505"?"Ce nom de communauté est déjà utilisé. Choisis un autre nom.":"Création impossible : "+error.message);return;}
    setShowCommunityForm(false);setCommunityName("");setCommunityDescription("");setCommunityVisibility("public");onNotice(communityVisibility==="private"?"Ta communauté privée est créée. Elle est visible uniquement par toi et ses membres.":"Ta communauté publique est créée.");await load(false);
  };
  const joinCommunity=async(community:Community)=>{
    if(!userId){onLogin();return;}
    if(memberships.includes(community.id)){
      if(community.owner_id===userId){onNotice("Tu es propriétaire de cette communauté.");return;}
      const {error}=await supabase!.from("zavo_community_members").delete().eq("community_id",community.id).eq("user_id",userId);
      if(error){onNotice("Impossible de quitter la communauté : "+error.message);return;}
      setMemberships(v=>v.filter(id=>id!==community.id));onNotice("Tu as quitté la communauté.");
    }else{
      if(community.visibility==="private"){onNotice("Cette communauté est privée. Seuls son propriétaire et ses membres peuvent y accéder.");return;}
      const {error}=await supabase!.from("zavo_community_members").insert({community_id:community.id,user_id:userId,role:"member"});
      if(error){onNotice("Impossible de rejoindre : "+error.message);return;}
      setMemberships(v=>[...v,community.id]);onNotice("Tu as rejoint la communauté.");
    }
    await load(false);
  };
  const inviteCommunityMember=async()=>{
    if(!userId||!selectedCommunity||selectedCommunity.owner_id!==userId)return;
    const username=inviteUsername.trim().replace(/^@/,"");
    if(!username){onNotice("Saisis le nom d’utilisateur à inviter.");return;}
    setInviteBusy(true);
    const {data:profile,error:profileError}=await supabase!.from("profiles").select("id,username").ilike("username",username).maybeSingle();
    if(profileError||!profile){setInviteBusy(false);onNotice(profileError?"Recherche impossible : "+profileError.message:"Aucun utilisateur trouvé avec ce nom.");return;}
    if(profile.id===userId){setInviteBusy(false);onNotice("Tu es déjà propriétaire de cette communauté.");return;}
    const {error}=await supabase!.from("zavo_community_members").insert({community_id:selectedCommunity.id,user_id:profile.id,role:"member"});
    setInviteBusy(false);
    if(error){onNotice(error.code==="23505"?"Cet utilisateur est déjà membre.":"Invitation impossible : "+error.message);return;}
    setInviteUsername("");onNotice("@"+(profile.username||username)+" a rejoint la communauté.");
  };
  const deletePost=async(post:any)=>{
    if(!userId||post.author_id!==userId||!selectedCommunity)return;
    if(!window.confirm("Supprimer cette publication de la communauté ?"))return;
    const {error}=await supabase!.from("zavo_community_posts").delete().eq("id",post.id).eq("author_id",userId);
    if(error){onNotice("Suppression impossible : "+error.message);return;}
    setPosts(current=>current.filter(item=>item.id!==post.id));onNotice("Publication supprimée.");
  };
  const sendPost=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(!userId){onLogin();return;}
    if(!selectedCommunity||!postText.trim())return;
    setBusy(true);
    const {error}=await supabase!.from("zavo_community_posts").insert({community_id:selectedCommunity.id,author_id:userId,body:postText.trim()});
    setBusy(false);
    if(error){onNotice("Publication impossible : "+error.message);return;}
    setPostText("");await openCommunity(selectedCommunity);
  };
  const createChallenge=async()=>{
    if(!userId){onLogin();return;}
    const hashtag=challengeHashtag.replace(/^#/,"").replace(/[^a-zA-Z0-9_]/g,"");
    const start=new Date(challengeStart).toISOString(),end=new Date(challengeEnd).toISOString();
    if(challengeTitle.trim().length<3||hashtag.length<2||new Date(end)<=new Date(start)){onNotice("Vérifie le titre, le hashtag et les dates du défi.");return;}
    setBusy(true);
    const {error}=await supabase!.from("zavo_challenges").insert({creator_id:userId,title:challengeTitle.trim(),description:challengeDescription.trim(),hashtag,starts_at:start,ends_at:end});
    setBusy(false);
    if(error){onNotice("Création du défi impossible : "+error.message);return;}
    setShowChallengeForm(false);setChallengeTitle("");setChallengeDescription("");setChallengeHashtag("");onNotice("Ton défi est maintenant publié.");await load(false);
  };
  const createSeries=async()=>{
    if(!userId){onLogin();return;}
    if(seriesTitle.trim().length<3){onNotice("Le titre de la série doit contenir au moins 3 caractères.");return;}
    setBusy(true);
    const {error}=await supabase!.from("zavo_series").insert({creator_id:userId,title:seriesTitle.trim(),description:seriesDescription.trim(),is_public:true});
    setBusy(false);
    if(error){onNotice("Création de la série impossible : "+error.message);return;}
    setShowSeriesForm(false);setSeriesTitle("");setSeriesDescription("");onNotice("Ta série est créée. Tu peux maintenant y ajouter des épisodes.");await load(false);
  };
  const openSeries=async(item:Series)=>{
    setActiveSeries(item);
    const {data,error}=await supabase!.from("zavo_series_episodes").select("id,episode_number,video:videos!zavo_series_episodes_video_id_fkey(id,caption,video_url,thumbnail_url,content_type,created_at,duration_seconds)").eq("series_id",item.id).order("episode_number",{ascending:true});
    if(error){onNotice("Impossible de charger les épisodes : "+error.message);return;}
    setEpisodes(data||[]);
    setActiveEpisode((data||[]).find((episode:any)=>episode.video?.id) || null);
  };
  const addEpisode=async(videoId:string)=>{
    if(!userId||!activeSeries)return;
    const next=(episodes.reduce((m,e)=>Math.max(m,Number(e.episode_number)||0),0)+1);
    const {error}=await supabase!.from("zavo_series_episodes").insert({series_id:activeSeries.id,video_id:videoId,episode_number:next});
    if(error){onNotice("Ajout de l’épisode impossible : "+error.message);return;}
    setEntryVideo("");await openSeries(activeSeries);await load(false);onNotice("Épisode ajouté à la série.");
  };
  const submitChallengeEntry=async()=>{
    if(!userId||!entryChallenge||!entryVideo)return;
    const {error}=await supabase!.from("zavo_challenge_entries").insert({challenge_id:entryChallenge.id,user_id:userId,video_id:entryVideo});
    if(error){onNotice("Participation impossible : "+(error.code==="23505"?"Cette vidéo participe déjà à ce défi.":error.message));return;}
    setEntryChallenge(null);setEntryVideo("");onNotice("Ta vidéo participe maintenant au défi.");await load(false);
  };

  if(loading)return <section className="community-hub"><div className="community-loading"><RefreshCw className="community-spin"/> Chargement de l’espace communautaire…</div></section>;
  return <section className="community-hub">
    <header className="community-hero"><div><span className="community-eyebrow">ZAVO · ENSEMBLE</span><h1>L’espace <b>communauté</b></h1><p>Rejoins des groupes, lance des défis et organise tes vidéos en séries.</p></div><button onClick={()=>void load(false)} disabled={refreshing}><RefreshCw size={16}/> {refreshing?"Actualisation…":"Actualiser"}</button></header>
    <div className="community-tabs">
      <button className={tab==="communities"?"active":""} onClick={()=>setTab("communities")}><Users size={16}/> Communautés</button>
      <button className={tab==="challenges"?"active":""} onClick={()=>setTab("challenges")}><Trophy size={16}/> Défis</button>
      <button className={tab==="series"?"active":""} onClick={()=>setTab("series")}><Clapperboard size={16}/> Séries</button>
    </div>
    {tab==="communities"&&<div className="community-section">
      <div className="community-toolbar"><div><h2>Des espaces pour échanger</h2><p>Découvre les communautés publiques et participe aux discussions.</p></div><button onClick={()=>userId?setShowCommunityForm(true):onLogin()}><Plus size={16}/> Créer une communauté</button></div>
      <label className="community-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher une communauté"/></label>
      {selectedCommunity?<section className="community-detail"><header><button className="community-back" onClick={()=>setSelectedCommunity(null)}>← Toutes les communautés</button>{selectedCommunity.owner_id===userId?<span className="community-owner-label">Propriétaire</span>:<button onClick={()=>void joinCommunity(selectedCommunity)}>{memberships.includes(selectedCommunity.id)?"Quitter":"Rejoindre"}</button>}</header><div className="community-detail-title"><div><span className="community-eyebrow">COMMUNAUTÉ {selectedCommunity.visibility==="private"?"PRIVÉE":"PUBLIQUE"}</span><h2>{selectedCommunity.name}</h2><p>{selectedCommunity.description||"Un espace pour partager et échanger sur ZAVO."}</p></div><span className="community-symbol"><Users/></span></div>
        {selectedCommunity.owner_id===userId&&<form className="community-invite-form" onSubmit={e=>{e.preventDefault();void inviteCommunityMember();}}><input value={inviteUsername} onChange={e=>setInviteUsername(e.target.value)} placeholder="@nom_utilisateur à inviter" aria-label="Nom d’utilisateur à inviter"/><button disabled={inviteBusy||!inviteUsername.trim()}>{inviteBusy?"Ajout…":"Inviter un membre"}</button></form>}
        {(memberships.includes(selectedCommunity.id)||selectedCommunity.owner_id===userId)&&<form className="community-post-form" onSubmit={sendPost}><textarea value={postText} onChange={e=>setPostText(e.target.value)} maxLength={3000} rows={3} placeholder="Partage une idée avec la communauté…"/><button disabled={busy||!postText.trim()}><Send size={15}/> Publier</button></form>}
        <div className="community-post-list">{posts.length?posts.map(post=><article className="community-discussion-post" key={post.id}><div className="community-post-author"><span>{(post.profiles?.display_name||"Z").slice(0,1).toUpperCase()}</span><div><strong>{post.profiles?.display_name||"Membre ZAVO"}</strong><small>@{post.profiles?.username||"membre"} · {new Date(post.created_at).toLocaleDateString("fr-FR")}</small></div>{post.author_id===userId&&<button className="community-post-delete" title="Supprimer ma publication" aria-label="Supprimer ma publication" onClick={()=>void deletePost(post)}><Trash2 size={14}/></button>}</div><p>{post.body}</p><div className="community-post-engagement"><button type="button" className={communityReactions.some((reaction:any)=>reaction.post_id===post.id&&reaction.user_id===userId)?"liked":""} onClick={()=>void toggleCommunityReaction(post)}><Heart size={15}/> {communityReactions.filter((reaction:any)=>reaction.post_id===post.id).length} J’aime</button><span><MessageCircle size={14}/> {communityComments.filter((comment:any)=>comment.post_id===post.id).length} commentaire(s)</span></div><div className="community-comment-list">{communityComments.filter((comment:any)=>comment.post_id===post.id).map((comment:any)=><div key={comment.id} className="community-comment"><b>{comment.profiles?.display_name||"Membre"}</b><span>{comment.body}</span></div>)}</div><form className="community-comment-form" onSubmit={e=>{e.preventDefault();void sendCommunityComment(post);}}><input value={commentDrafts[post.id]||""} onChange={e=>setCommentDrafts(rows=>({...rows,[post.id]:e.target.value}))} maxLength={2000} placeholder="Écrire un commentaire…"/><button disabled={!(commentDrafts[post.id]||"").trim()}><Send size={14}/></button></form></article>):<div className="community-empty"><MessageCircle/><strong>La discussion commence ici</strong><span>Sois le premier à partager quelque chose.</span></div>}</div>
      </section>:<div className="community-grid">{filteredCommunities.map(c=><article className="community-card" key={c.id}><div className="community-card-icon"><Users/></div><span className="community-eyebrow">{c.visibility==="public"?"PUBLIQUE":"PRIVÉE"}</span><h3>{c.name}</h3><p>{c.description||"Une communauté ZAVO pour échanger et partager."}</p><div className="community-card-actions"><button onClick={()=>void openCommunity(c)}>Voir la communauté <ChevronRight size={15}/></button><button className={memberships.includes(c.id)?"joined":""} onClick={()=>void joinCommunity(c)}>{memberships.includes(c.id)?"Quitter":"Rejoindre"}</button></div></article>)}</div>}
      {!filteredCommunities.length&&<div className="community-empty"><Users/><strong>Aucune communauté trouvée</strong><span>Essaie un autre mot ou crée la première communauté.</span></div>}
    </div>}
    {tab==="challenges"&&<div className="community-section">
      <div className="community-toolbar"><div><h2>Les défis ZAVO</h2><p>Participe avec une vidéo originale et partage-la avec le hashtag du défi.</p></div><button onClick={()=>userId?setShowChallengeForm(true):onLogin()}><Plus size={16}/> Lancer un défi</button></div>
      <div className="community-grid">{challenges.map(ch=><article className="community-card challenge-card" key={ch.id}><div className="community-card-icon challenge"><Trophy/></div><span className="community-eyebrow">{ch.status==="paused"?"EN PAUSE":new Date(ch.ends_at)<new Date()?"TERMINÉ":new Date(ch.starts_at)>new Date()?"À VENIR":ch.status==="active"?"EN COURS":"TERMINÉ"}</span><h3>{ch.title}</h3><p>{ch.description||"Relève le défi et publie ta participation sur ZAVO."}</p><strong className="community-hashtag"><Hash size={14}/>{ch.hashtag}</strong><div className="community-card-footer"><span>{ch.entries?.[0]?.count||0} participation(s)</span><button disabled={ch.status!=="active"||new Date(ch.ends_at)<new Date()||new Date(ch.starts_at)>new Date()} onClick={()=>{if(!userId){onLogin();return;}setEntryChallenge(ch);}}>Participer</button></div><small className="community-date"><CalendarDays size={13}/> Jusqu’au {new Date(ch.ends_at).toLocaleDateString("fr-FR")}</small>{challengeEntries.filter((entry:any)=>entry.challenge_id===ch.id).sort((a:any,b:any)=>Number(b.video?.views_count||0)-Number(a.video?.views_count||0)).slice(0,3).length>0&&<div className="challenge-leaderboard"><strong>Classement provisoire · par vues</strong>{challengeEntries.filter((entry:any)=>entry.challenge_id===ch.id).sort((a:any,b:any)=>Number(b.video?.views_count||0)-Number(a.video?.views_count||0)).slice(0,3).map((entry:any,index:number)=><div key={entry.id}><span>{index+1}</span>{entry.video?.thumbnail_url&&<img src={entry.video.thumbnail_url} alt=""/>}<b>{entry.video?.profiles?.display_name||entry.video?.profiles?.username||"Participant"}</b><small>{Number(entry.video?.views_count||0).toLocaleString("fr-FR")} vues</small></div>)}</div>}</article>)}</div>
      {!challenges.length&&<div className="community-empty"><Trophy/><strong>Aucun défi pour le moment</strong><span>Crée le premier défi et invite les autres à participer.</span></div>}
    </div>}
    {tab==="series"&&<div className="community-section">
      <div className="community-toolbar"><div><h2>Séries et épisodes</h2><p>Regroupe tes vidéos dans un parcours et aide ton audience à suivre l’ordre des épisodes.</p></div><button onClick={()=>userId?setShowSeriesForm(true):onLogin()}><Plus size={16}/> Créer une série</button></div>
      {activeSeries?<section className="community-detail"><header><button className="community-back" onClick={()=>setActiveSeries(null)}>← Toutes les séries</button><span>{activeSeries.title}</span></header><div className="community-detail-title"><div><span className="community-eyebrow">SÉRIE VIDÉO</span><h2>{activeSeries.title}</h2><p>{activeSeries.description}</p></div><span className="community-symbol"><Clapperboard/></span></div>
        {activeEpisode?.video?.video_url&&<div className="series-player"><video key={activeEpisode.video.id} src={activeEpisode.video.video_url} poster={activeEpisode.video.thumbnail_url||undefined} controls playsInline preload="metadata" onEnded={()=>{const next=episodes.find((episode:any)=>episode.episode_number===activeEpisode.episode_number+1);if(next?.video?.video_url)setActiveEpisode(next);}}/><div className="series-player-caption"><strong>Épisode {activeEpisode.episode_number} · {activeEpisode.video.caption||"Sans titre"}</strong><div><button type="button" disabled={!episodes.some((episode:any)=>episode.episode_number===activeEpisode.episode_number-1&&episode.video?.video_url)} onClick={()=>setActiveEpisode(episodes.find((episode:any)=>episode.episode_number===activeEpisode.episode_number-1&&episode.video?.video_url))}>Précédent</button><button type="button" disabled={!episodes.some((episode:any)=>episode.episode_number===activeEpisode.episode_number+1&&episode.video?.video_url)} onClick={()=>setActiveEpisode(episodes.find((episode:any)=>episode.episode_number===activeEpisode.episode_number+1&&episode.video?.video_url))}>Suivant</button></div></div></div>}
        <div className="community-post-list">{episodes.length?episodes.map(ep=><button type="button" className={"series-episode "+(activeEpisode?.id===ep.id?"active":"")} key={ep.id} disabled={!ep.video?.video_url} onClick={()=>setActiveEpisode(ep)}><span className="episode-number">{String(ep.episode_number).padStart(2,"0")}</span><div><strong>{ep.video?.caption||"Épisode sans titre"}</strong><small>{ep.video?.content_type==="short"?"Short":"Vidéo"} · {ep.video?.created_at?new Date(ep.video.created_at).toLocaleDateString("fr-FR"):""}</small></div><Play size={15}/></button>):<div className="community-empty"><Play/><strong>Aucun épisode ajouté</strong><span>Ajoute tes premières vidéos à cette série.</span></div>}</div>
        {activeSeries.creator_id===userId&&<div className="community-add-episode"><select value={entryVideo} onChange={e=>setEntryVideo(e.target.value)}><option value="">Choisir une de tes vidéos…</option>{ownVideos.map(v=><option key={v.id} value={v.id}>{v.caption||"Publication sans titre"}</option>)}</select><button disabled={!entryVideo} onClick={()=>void addEpisode(entryVideo)}><Plus size={15}/> Ajouter l’épisode</button></div>}
      </section>:<div className="community-grid">{series.map(s=><article className="community-card series-card" key={s.id}><div className="community-card-icon series"><Clapperboard/></div><span className="community-eyebrow">SÉRIE · {s.episodes?.[0]?.count||0} ÉPISODE(S)</span><h3>{s.title}</h3><p>{s.description||"Un parcours vidéo à suivre dans l’ordre."}</p><div className="community-card-footer"><span>Créée le {new Date(s.created_at).toLocaleDateString("fr-FR")}</span><button onClick={()=>void openSeries(s)}>Voir les épisodes</button></div></article>)}</div>}
      {!series.length&&!activeSeries&&<div className="community-empty"><Clapperboard/><strong>Aucune série publiée</strong><span>Organise tes vidéos en épisodes pour créer un vrai rendez-vous avec ton audience.</span></div>}
    </div>}
    {showCommunityForm&&<div className="community-modal-backdrop" onClick={()=>setShowCommunityForm(false)}><section className="community-modal" onClick={e=>e.stopPropagation()}><header><h2>Créer une communauté</h2><button onClick={()=>setShowCommunityForm(false)}><X/></button></header><label>Nom<input value={communityName} onChange={e=>setCommunityName(e.target.value)} maxLength={60} placeholder="Ex. Passion Technologie"/></label><label>Description<textarea value={communityDescription} onChange={e=>setCommunityDescription(e.target.value)} maxLength={1000} rows={3} placeholder="Quel est le sujet de ta communauté ?"/></label><label>Visibilité<select value={communityVisibility} onChange={e=>setCommunityVisibility(e.target.value as "public"|"private")}><option value="public">Publique — découvrable et accessible à tous</option><option value="private">Privée — réservée au propriétaire et aux membres</option></select></label><p>{communityVisibility==="private"?"Cette communauté ne sera pas affichée dans la découverte publique. Tu pourras y accéder depuis ton espace.":"Tout le monde pourra découvrir et rejoindre cette communauté."}</p><footer><button onClick={()=>setShowCommunityForm(false)}>Annuler</button><button disabled={busy||communityName.trim().length<3} onClick={()=>void createCommunity()}>{busy?"Création…":"Créer"}</button></footer></section></div>}
    {showChallengeForm&&<div className="community-modal-backdrop" onClick={()=>setShowChallengeForm(false)}><section className="community-modal" onClick={e=>e.stopPropagation()}><header><h2>Lancer un défi</h2><button onClick={()=>setShowChallengeForm(false)}><X/></button></header><label>Titre<input value={challengeTitle} onChange={e=>setChallengeTitle(e.target.value)} maxLength={100} placeholder="Ex. 7 jours de créativité"/></label><label>Description<textarea value={challengeDescription} onChange={e=>setChallengeDescription(e.target.value)} maxLength={1500} rows={3}/></label><label>Hashtag<input value={challengeHashtag} onChange={e=>setChallengeHashtag(e.target.value.replace(/^#/,""))} maxLength={40} placeholder="ZavoChallenge"/></label><div className="community-date-grid"><label>Début<input type="datetime-local" value={challengeStart} onChange={e=>setChallengeStart(e.target.value)}/></label><label>Fin<input type="datetime-local" value={challengeEnd} onChange={e=>setChallengeEnd(e.target.value)}/></label></div><footer><button onClick={()=>setShowChallengeForm(false)}>Annuler</button><button disabled={busy||challengeTitle.trim().length<3||challengeHashtag.replace(/^#/,"").length<2} onClick={()=>void createChallenge()}>{busy?"Publication…":"Publier le défi"}</button></footer></section></div>}
    {showSeriesForm&&<div className="community-modal-backdrop" onClick={()=>setShowSeriesForm(false)}><section className="community-modal" onClick={e=>e.stopPropagation()}><header><h2>Créer une série</h2><button onClick={()=>setShowSeriesForm(false)}><X/></button></header><label>Titre de la série<input value={seriesTitle} onChange={e=>setSeriesTitle(e.target.value)} maxLength={100} placeholder="Ex. Mon parcours de développeur"/></label><label>Description<textarea value={seriesDescription} onChange={e=>setSeriesDescription(e.target.value)} maxLength={1500} rows={3}/></label><p>Tu pourras ensuite ajouter tes propres Shorts et vidéos longues comme épisodes.</p><footer><button onClick={()=>setShowSeriesForm(false)}>Annuler</button><button disabled={busy||seriesTitle.trim().length<3} onClick={()=>void createSeries()}>{busy?"Création…":"Créer la série"}</button></footer></section></div>}
    {entryChallenge&&<div className="community-modal-backdrop" onClick={()=>setEntryChallenge(null)}><section className="community-modal" onClick={e=>e.stopPropagation()}><header><h2>Participer à « {entryChallenge.title} »</h2><button onClick={()=>setEntryChallenge(null)}><X/></button></header><p>Choisis une vidéo déjà publiée sur ton compte pour participer.</p><label>Ta vidéo<select value={entryVideo} onChange={e=>setEntryVideo(e.target.value)}><option value="">Sélectionner une vidéo…</option>{ownVideos.map(v=><option key={v.id} value={v.id}>{v.caption||"Publication sans titre"}</option>)}</select></label><footer><button onClick={()=>setEntryChallenge(null)}>Annuler</button><button disabled={!entryVideo} onClick={()=>void submitChallengeEntry()}>Valider ma participation</button></footer></section></div>}
  </section>;
}
