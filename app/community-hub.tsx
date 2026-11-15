"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Users, MessageCircle, Plus, Search, Trophy, Clapperboard, Play, LogIn, Send, CalendarDays, X, ChevronRight, RefreshCw, Hash } from "lucide-react";
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
  const [series,setSeries]=useState<Series[]>([]);
  const [ownVideos,setOwnVideos]=useState<any[]>([]);
  const [selectedCommunity,setSelectedCommunity]=useState<Community|null>(null);
  const [posts,setPosts]=useState<any[]>([]);
  const [postText,setPostText]=useState("");
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [busy,setBusy]=useState(false);
  const [search,setSearch]=useState("");
  const [showCommunityForm,setShowCommunityForm]=useState(false);
  const [communityName,setCommunityName]=useState("");
  const [communityDescription,setCommunityDescription]=useState("");
  const [communityVisibility,setCommunityVisibility]=useState<"public"|"private">("public");
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
  const [entryChallenge,setEntryChallenge]=useState<Challenge|null>(null);
  const [entryVideo,setEntryVideo]=useState("");

  const load=useCallback(async(spinner=true)=>{
    if(!supabase){setLoading(false);return;}
    if(spinner)setLoading(true);else setRefreshing(true);
    const [publicResult,challengeResult,seriesResult,memberResult,videoResult,ownedPrivateResult]=await Promise.all([
      supabase.from("zavo_communities").select("id,owner_id,name,slug,description,visibility,created_at").eq("visibility","public").order("created_at",{ascending:false}).limit(60),
      supabase.from("zavo_challenges").select("id,creator_id,title,description,hashtag,starts_at,ends_at,status,entries:zavo_challenge_entries(count)").order("created_at",{ascending:false}).limit(60),
      supabase.from("zavo_series").select("id,creator_id,title,description,cover_url,is_public,created_at,episodes:zavo_series_episodes(count)").eq("is_public",true).order("created_at",{ascending:false}).limit(60),
      userId?supabase.from("zavo_community_members").select("community_id").eq("user_id",userId):Promise.resolve({data:[],error:null} as any),
      userId?supabase.from("videos").select("id,caption,content_type,thumbnail_url,created_at").eq("user_id",userId).in("content_type",["short","video"]).order("created_at",{ascending:false}).limit(100):Promise.resolve({data:[],error:null} as any),
      userId?supabase.from("zavo_communities").select("id,owner_id,name,slug,description,visibility,created_at").eq("owner_id",userId).eq("visibility","private"):Promise.resolve({data:[],error:null} as any)
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
    const {data,error}=await supabase!.from("zavo_series_episodes").select("id,episode_number,video:videos!zavo_series_episodes_video_id_fkey(id,caption,thumbnail_url,content_type,created_at)").eq("series_id",item.id).order("episode_number",{ascending:true});
    if(error){onNotice("Impossible de charger les épisodes : "+error.message);return;}
    setEpisodes(data||[]);
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
        {(memberships.includes(selectedCommunity.id)||selectedCommunity.owner_id===userId)&&<form className="community-post-form" onSubmit={sendPost}><textarea value={postText} onChange={e=>setPostText(e.target.value)} maxLength={3000} rows={3} placeholder="Partage une idée avec la communauté…"/><button disabled={busy||!postText.trim()}><Send size={15}/> Publier</button></form>}
        <div className="community-post-list">{posts.length?posts.map(post=><article key={post.id}><div className="community-post-author"><span>{(post.profiles?.display_name||"Z").slice(0,1).toUpperCase()}</span><div><strong>{post.profiles?.display_name||"Membre ZAVO"}</strong><small>@{post.profiles?.username||"membre"} · {new Date(post.created_at).toLocaleDateString("fr-FR")}</small></div></div><p>{post.body}</p></article>):<div className="community-empty"><MessageCircle/><strong>La discussion commence ici</strong><span>Sois le premier à partager quelque chose.</span></div>}</div>
      </section>:<div className="community-grid">{filteredCommunities.map(c=><article className="community-card" key={c.id}><div className="community-card-icon"><Users/></div><span className="community-eyebrow">{c.visibility==="public"?"PUBLIQUE":"PRIVÉE"}</span><h3>{c.name}</h3><p>{c.description||"Une communauté ZAVO pour échanger et partager."}</p><div className="community-card-actions"><button onClick={()=>void openCommunity(c)}>Voir la communauté <ChevronRight size={15}/></button><button className={memberships.includes(c.id)?"joined":""} onClick={()=>void joinCommunity(c)}>{memberships.includes(c.id)?"Quitter":"Rejoindre"}</button></div></article>)}</div>}
      {!filteredCommunities.length&&<div className="community-empty"><Users/><strong>Aucune communauté trouvée</strong><span>Essaie un autre mot ou crée la première communauté.</span></div>}
    </div>}
    {tab==="challenges"&&<div className="community-section">
      <div className="community-toolbar"><div><h2>Les défis ZAVO</h2><p>Participe avec une vidéo originale et partage-la avec le hashtag du défi.</p></div><button onClick={()=>userId?setShowChallengeForm(true):onLogin()}><Plus size={16}/> Lancer un défi</button></div>
      <div className="community-grid">{challenges.map(ch=><article className="community-card challenge-card" key={ch.id}><div className="community-card-icon challenge"><Trophy/></div><span className="community-eyebrow">{ch.status==="active"&&new Date(ch.ends_at)>new Date()?"EN COURS":ch.status==="paused"?"EN PAUSE":"TERMINÉ"}</span><h3>{ch.title}</h3><p>{ch.description||"Relève le défi et publie ta participation sur ZAVO."}</p><strong className="community-hashtag"><Hash size={14}/>{ch.hashtag}</strong><div className="community-card-footer"><span>{ch.entries?.[0]?.count||0} participation(s)</span><button disabled={ch.status!=="active"||new Date(ch.ends_at)<new Date()||new Date(ch.starts_at)>new Date()} onClick={()=>{if(!userId){onLogin();return;}setEntryChallenge(ch);}}>Participer</button></div><small className="community-date"><CalendarDays size={13}/> Jusqu’au {new Date(ch.ends_at).toLocaleDateString("fr-FR")}</small></article>)}</div>
      {!challenges.length&&<div className="community-empty"><Trophy/><strong>Aucun défi pour le moment</strong><span>Crée le premier défi et invite les autres à participer.</span></div>}
    </div>}
    {tab==="series"&&<div className="community-section">
      <div className="community-toolbar"><div><h2>Séries et épisodes</h2><p>Regroupe tes vidéos dans un parcours et aide ton audience à suivre l’ordre des épisodes.</p></div><button onClick={()=>userId?setShowSeriesForm(true):onLogin()}><Plus size={16}/> Créer une série</button></div>
      {activeSeries?<section className="community-detail"><header><button className="community-back" onClick={()=>setActiveSeries(null)}>← Toutes les séries</button><span>{activeSeries.title}</span></header><div className="community-detail-title"><div><span className="community-eyebrow">SÉRIE VIDÉO</span><h2>{activeSeries.title}</h2><p>{activeSeries.description}</p></div><span className="community-symbol"><Clapperboard/></span></div>
        <div className="community-post-list">{episodes.length?episodes.map(ep=><article className="series-episode" key={ep.id}><span className="episode-number">{String(ep.episode_number).padStart(2,"0")}</span><div><strong>{ep.video?.caption||"Épisode sans titre"}</strong><small>{ep.video?.content_type==="short"?"Short":"Vidéo"} · {ep.video?.created_at?new Date(ep.video.created_at).toLocaleDateString("fr-FR"):""}</small></div></article>):<div className="community-empty"><Play/><strong>Aucun épisode ajouté</strong><span>Ajoute tes premières vidéos à cette série.</span></div>}</div>
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
