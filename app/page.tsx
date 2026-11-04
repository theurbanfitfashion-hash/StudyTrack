"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Check, CheckCircle2, Clock3, Flame, GraduationCap, ListFilter, Plus, Search, Target, Trash2, Youtube, Play, Circle, CalendarDays, ArrowUpDown, LoaderCircle, LogOut, Mail, Eye, EyeOff, PanelLeftClose, PanelLeftOpen, RefreshCw, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type Lesson = { id: string; title: string; duration: number; videoId: string; position: number; completed: boolean; completedAt?: string | null; };
type Course = { id: string; title: string; playlistId: string; thumbnail: string; lessons: Lesson[]; addedAt: number; };
type Session = { studied_minutes:number; studied_on:string; created_at:string; };
type Store = { courses: Course[]; sessions: Session[]; studiedMinutes: number; completedToday: number; day: string; };
const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const initial: Store = { courses: [], sessions: [], studiedMinutes: 0, completedToday: 0, day: localDay() };
const dayKey = (date:Date) => date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
const lastSevenDays = () => Array.from({length:7},(_,i)=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-(6-i));return dayKey(d);});
const fmt = (seconds: number) => { const m = Math.floor(seconds / 60); const h = Math.floor(m / 60); return h ? `${h}h ${m % 60}m` : `${m}m`; };
const supabase = createClient();

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<"signin"|"signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [store, setStore] = useState<Store>(initial);
  const [ready, setReady] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("original");
  const [sortDirection, setSortDirection] = useState<"asc"|"desc">("asc");
  const [activeCourse, setActiveCourse] = useState<string | null>(null);
  const [studyInput, setStudyInput] = useState("30");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [refreshingDurations, setRefreshingDurations] = useState(false);
  const [activeTab,setActiveTab]=useState<"learning"|"progress"|"settings">("learning");

  const loadWorkspace = useCallback(async (currentUser: User) => {
    setReady(false);
    const [profileWrite, goalWrite] = await Promise.all([
      supabase.from("profiles").upsert({id:currentUser.id,display_name:currentUser.user_metadata?.name || currentUser.email || "Student"},{onConflict:"id"}),
      supabase.from("daily_goals").upsert({user_id:currentUser.id},{onConflict:"user_id",ignoreDuplicates:true})
    ]);
    if (profileWrite.error || goalWrite.error) {
      setError(profileWrite.error?.message || goalWrite.error?.message || "Could not initialize your account.");
      setReady(true); return;
    }
    const historyStart = lastSevenDays()[0];
    const [courseResult, sessionResult] = await Promise.all([
      supabase.from("courses").select("id,title,playlist_id,thumbnail,added_at,lessons(id,video_id,title,duration_seconds,position,completed,completed_at)").eq("user_id", currentUser.id).order("added_at", {ascending:false}),
      supabase.from("study_sessions").select("studied_minutes,studied_on,created_at").eq("user_id", currentUser.id).gte("studied_on",historyStart).lte("studied_on",localDay()).order("created_at",{ascending:false})
    ]);
    if (courseResult.error || sessionResult.error) {
      setError(courseResult.error?.message || sessionResult.error?.message || "Could not load your study data.");
      setReady(true); return;
    }
    const courses: Course[] = (courseResult.data || []).map((c: any) => ({
      id:c.id,title:c.title,playlistId:c.playlist_id,thumbnail:c.thumbnail || "",addedAt:new Date(c.added_at).getTime(),
      lessons:(c.lessons || []).sort((a:any,b:any)=>a.position-b.position).map((v:any)=>({id:v.id,videoId:v.video_id,title:v.title,duration:v.duration_seconds,position:v.position,completed:v.completed,completedAt:v.completed_at}))
    }));
    const completedToday = (courseResult.data || []).flatMap((c:any)=>c.lessons || []).filter((v:any)=>v.completed && v.completed_at && dayKey(new Date(v.completed_at))===localDay()).length;
    setStore({courses,sessions:sessionResult.data||[],studiedMinutes:(sessionResult.data||[]).filter((s:any)=>s.studied_on===localDay()).reduce((n:number,s:any)=>n+s.studied_minutes,0),completedToday,day:localDay()});
    setActiveCourse(courses[0]?.id ?? null);
    setReady(true);
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({data}) => {
      if (!alive) return;
      setUser(data.session?.user ?? null);
      if (data.session?.user) void loadWorkspace(data.session.user);
      else setReady(true);
      setAuthReady(true);
    });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setUser(session?.user ?? null);
      if (session?.user) setTimeout(() => { if (alive) void loadWorkspace(session.user); }, 0);
      else { setStore(initial); setReady(true); }
    });
    return () => { alive=false; subscription.unsubscribe(); };
  }, [loadWorkspace]);

  useEffect(() => {
    if (!user || !ready) return;
    let queued = false;
    const sync = () => {
      if (queued) return;
      queued = true;
      void loadWorkspace(user).finally(() => { queued = false; });
    };
    const channel = supabase.channel("studytrack-live-sync")
      .on("postgres_changes",{event:"*",schema:"public",table:"lessons"},sync)
      .on("postgres_changes",{event:"*",schema:"public",table:"study_sessions",filter:`user_id=eq.${user.id}`},sync)
      .subscribe();
    const onFocus = () => { if (document.visibilityState === "visible") sync(); };
    window.addEventListener("focus",onFocus);
    document.addEventListener("visibilitychange",onFocus);
    return () => {
      window.removeEventListener("focus",onFocus);
      document.removeEventListener("visibilitychange",onFocus);
      void supabase.removeChannel(channel);
    };
  },[user,ready,loadWorkspace]);

  async function handleAuth(e: FormEvent) {
    e.preventDefault(); setAuthBusy(true); setAuthMessage("");
    try {
      if (authMode === "signup") {
        const {data,error} = await supabase.auth.signUp({email:email.trim(),password});
        if (error) throw error;
        if (!data.session) setAuthMessage("Account created. Check your email to confirm your address, then sign in.");
        else setAuthMessage("Account created successfully.");
      } else {
        const {error} = await supabase.auth.signInWithPassword({email:email.trim(),password});
        if (error) throw error;
      }
    } catch (e) { setAuthMessage(e instanceof Error ? e.message : "Authentication failed."); }
    finally { setAuthBusy(false); }
  }

  async function signOut() { await supabase.auth.signOut(); setStore(initial); setUser(null); }

  const allLessons = store.courses.flatMap(c => c.lessons);
  const total = allLessons.length;
  const completed = allLessons.filter(v => v.completed).length;
  const selected = store.courses.find(c => c.id === activeCourse) ?? store.courses[0] ?? null;
  const filteredLessons = useMemo(() => {
    if (!selected) return [];
    let items = selected.lessons.filter(v => v.title.toLowerCase().includes(search.toLowerCase()));
    const direction = sortDirection === "asc" ? 1 : -1;
    if (sort === "original") items = [...items].sort((a,b) => (a.position-b.position)*direction);
    if (sort === "short") items = [...items].sort((a,b) => (a.duration-b.duration)*direction);
    if (sort === "long") items = [...items].sort((a,b) => (b.duration-a.duration)*direction);
    if (sort === "pending") items = [...items].sort((a,b) => (Number(a.completed)-Number(b.completed))*direction);
    return items;
  }, [selected, search, sort, sortDirection]);
  const dailyHistory = lastSevenDays().map(day=>{const lessons=allLessons.filter(v=>v.completed&&v.completedAt&&dayKey(new Date(v.completedAt))===day);return {day,lessons,lectureSeconds:lessons.reduce((n,v)=>n+Math.max(0,v.duration||0),0)};});
  const todayHistory = allLessons.filter(v=>v.completed&&v.completedAt&&dayKey(new Date(v.completedAt))===localDay()).sort((a,b)=>new Date(b.completedAt!).getTime()-new Date(a.completedAt!).getTime());
  const todayLectureSeconds = todayHistory.reduce((n,v)=>n+Math.max(0,v.duration||0),0);
  const sevenDayLectureSeconds = dailyHistory.reduce((n,d)=>n+d.lectureSeconds,0);

  async function updateCourse(courseId: string, lessonId: string) {
    const lesson = store.courses.find(c=>c.id===courseId)?.lessons.find(v=>v.id===lessonId);
    if (!lesson) return;
    const next = !lesson.completed;
    const completedAt = next ? new Date().toISOString() : null;
    const {error} = await supabase.from("lessons").update({completed:next,completed_at:completedAt}).eq("id",lessonId);
    if (error) { setError(error.message); return; }
    setStore(s => ({ ...s, completedToday: Math.max(0,s.completedToday + (next?1:(lesson.completedAt && new Date(lesson.completedAt).toLocaleDateString("en-CA")===localDay()?-1:0))), courses: s.courses.map(c => c.id !== courseId ? c : { ...c, lessons: c.lessons.map(v => v.id===lessonId ? {...v,completed:next,completedAt} : v) }) }));
  }

  async function addPlaylist(e: FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const response = await fetch("/api/youtube/playlist", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:playlistUrl})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not import this playlist.");
      const {data:courseRow,error:courseError} = await supabase.from("courses").insert({user_id:user!.id,title:data.title,playlist_id:data.playlistId,thumbnail:data.thumbnail}).select("id,added_at").single();
      if (courseError) throw courseError;
      const rows = data.lessons.map((v:any)=>({course_id:courseRow.id,video_id:v.videoId,title:v.title,duration_seconds:v.duration,position:v.position,completed:false}));
      if (rows.length) {
        const {error:lessonError} = await supabase.from("lessons").insert(rows);
        if (lessonError) { await supabase.from("courses").delete().eq("id",courseRow.id); throw lessonError; }
      }
      const course: Course = {id:courseRow.id,title:data.title,playlistId:data.playlistId,thumbnail:data.thumbnail,addedAt:new Date(courseRow.added_at).getTime(),lessons:data.lessons.map((v:any)=>({...v}))};
      setStore(s=>({...s,courses:[course,...s.courses]})); setActiveCourse(course.id); setPlaylistUrl(""); setSearch("");
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); }
    finally { setLoading(false); }
  }

  async function refreshDurations() {
    if (!selected) return;
    setRefreshingDurations(true); setError("");
    try {
      const response = await fetch("/api/youtube/playlist", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:`https://www.youtube.com/playlist?list=${selected.playlistId}`})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not refresh video durations.");
      const updates = new Map<string,number>(data.lessons.map((v:any)=>[v.videoId,Number(v.duration)||0]));
      const changed = selected.lessons.map(v=>({...v,duration:updates.has(v.videoId)?updates.get(v.videoId)!:v.duration}));
      const failed = changed.filter(v=>!v.duration).length;
      for (const v of changed) {
        if (v.duration !== selected.lessons.find(x=>x.id===v.id)?.duration) {
          const {error:dbError}=await supabase.from("lessons").update({duration_seconds:v.duration}).eq("id",v.id);
          if(dbError) throw dbError;
        }
      }
      setStore(s=>({...s,courses:s.courses.map(c=>c.id===selected.id?{...c,lessons:changed}:c)}));
      if (failed) setError(`Durations refreshed. ${failed} videos did not return a duration (possibly private or unavailable).`);
    } catch(e) { setError(e instanceof Error?e.message:"Could not refresh video durations."); }
    finally { setRefreshingDurations(false); }
  }

  async function resetStudyLogs() {
    if (!user || !window.confirm("Delete all your recorded study-time logs? This cannot be undone.")) return;
    const {error}=await supabase.from("study_sessions").delete().eq("user_id",user.id);
    if(error){setError(error.message);return;}
    setStore(s=>({...s,sessions:[],studiedMinutes:0}));
    setError("");
  }

  async function resetCompletionHistory() {
    if (!user || !window.confirm("Reset all lesson completion records? Every lesson will become incomplete. This cannot be undone.")) return;
    const lessonIds=allLessons.map(v=>v.id);
    if(lessonIds.length){
      const {error}=await supabase.from("lessons").update({completed:false,completed_at:null}).in("id",lessonIds);
      if(error){setError(error.message);return;}
    }
    setStore(s=>({...s,completedToday:0,courses:s.courses.map(c=>({...c,lessons:c.lessons.map(v=>({...v,completed:false,completedAt:null}))}))}));
    setError("");
  }

  async function addStudyTime() {
    const mins = Math.max(1,Math.min(600,Number(studyInput)||0));
    const {error} = await supabase.from("study_sessions").insert({user_id:user!.id,studied_minutes:mins,studied_on:localDay()});
    if (error) {setError(error.message);return;}
    setStore(s=>({...s,studiedMinutes:s.studiedMinutes+mins,sessions:[{studied_minutes:mins,studied_on:localDay(),created_at:new Date().toISOString()},...s.sessions]})); setStudyInput("30");
  }

  async function deleteCourse(courseId:string) {
    const {error}=await supabase.from("courses").delete().eq("id",courseId);
    if(error){setError(error.message);return;}
    const remaining=store.courses.filter(c=>c.id!==courseId);
    setStore(s=>({...s,courses:remaining}));setActiveCourse(remaining[0]?.id??null);
  }
  const courseProgress = (c: Course) => c.lessons.length ? Math.round(c.lessons.filter(v => v.completed).length / c.lessons.length * 100) : 0;

  if (!authReady || (user && !ready)) return <main className="auth-screen"><div className="auth-card"><LoaderCircle className="spin" size={28}/><p>Loading your StudyTrack workspace…</p></div></main>;
  if (!user) return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={handleAuth}>
        <div className="auth-brand"><span className="brand-mark"><GraduationCap size={23}/></span><span>studytrack</span></div>
        <span className="eyebrow">YOUR PERSONAL LEARNING SPACE</span>
        <h1>{authMode==="signin"?"Welcome back":"Create your account"}</h1>
        <p>Keep your courses, lesson progress and daily goals synced across devices.</p>
        <label>Email address</label><div className="auth-input"><Mail size={17}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email"/></div>
        <label>Password</label><div className="auth-password-wrap"><input className="auth-password" type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" minLength={6} required autoComplete={authMode==="signin"?"current-password":"new-password"}/><button className="password-visibility" type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Hide password":"Show password"} aria-pressed={showPassword}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
        <button className="auth-submit" disabled={authBusy}>{authBusy?<LoaderCircle className="spin" size={17}/>:null}{authMode==="signin"?"Sign in":"Create account"}</button>
        {authMessage&&<div className="auth-message">{authMessage}</div>}
        <div className="auth-switch">{authMode==="signin"?"New to StudyTrack?":"Already have an account?"} <button type="button" onClick={()=>{setAuthMode(authMode==="signin"?"signup":"signin");setAuthMessage("");}}>{authMode==="signin"?"Create account":"Sign in"}</button></div>
      </form>
    </main>
  );

  return (
    <main className={`shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-brand-row"><a className="brand" href="#"><span className="brand-mark"><GraduationCap size={22}/></span><span>studytrack</span></a><button className="sidebar-toggle" type="button" onClick={()=>setSidebarCollapsed(v=>!v)} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>{sidebarCollapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}</button></div>
        <div className="nav-label">WORKSPACE</div>
        <button className={`nav-item ${activeTab==="learning"?"active":""}`} onClick={()=>setActiveTab("learning")}><BookOpen size={18}/> My learning</button>
        <button className={`nav-item ${activeTab==="progress"?"active":""}`} onClick={()=>setActiveTab("progress")}><Target size={18}/> Daily progress</button>
        <button className={`nav-item ${activeTab==="settings"?"active":""}`} onClick={()=>{setActiveTab("settings");setError("");}}><Settings size={18}/> Settings</button>
        <div className="sidebar-bottom"><div className="mini-avatar">{(user.email||"S")[0].toUpperCase()}</div><div className="account-details"><strong>{user.email}</strong><small>Synced account</small></div><button className="signout-button" onClick={signOut} title="Sign out"><LogOut size={17}/></button></div>
      </aside>
      <section className="main-area">
        <header className="topbar"><div><span className="eyebrow">YOUR PERSONAL LEARNING SPACE</span><h1>Good to see you<span className="wave"> ✦</span></h1><p>Make steady progress, one lesson at a time.</p></div><div className="date-chip"><CalendarDays size={16}/>{new Date().toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"})}</div></header>
        <section className="stats-grid">
          <article className="stat-card"><div className="stat-icon violet"><BookOpen size={19}/></div><span>Courses</span><strong>{store.courses.length}</strong><small>Playlists in your library</small></article>
          <article className="stat-card"><div className="stat-icon blue"><CheckCircle2 size={19}/></div><span>Lessons completed</span><strong>{completed}<small className="muted-total"> / {total}</small></strong><small>Across all courses</small></article>
          <article className="stat-card"><div className="stat-icon orange"><Clock3 size={19}/></div><span>Study time today</span><strong>{fmt(todayLectureSeconds)}</strong><small>Completed video duration</small></article>
          <article className="stat-card"><div className="stat-icon pink"><Flame size={19}/></div><span>Classes today</span><strong>{todayHistory.length}</strong><small>Completed lessons</small></article>
        </section>
        {activeTab==="settings"?<section className="settings-page">
          <div className="section-heading"><div><span className="eyebrow">PREFERENCES & DATA</span><h2>Settings</h2></div></div>
          <div className="settings-card"><div><h3>Study-time logs</h3><p>Remove all manually recorded study sessions. Your courses and lesson completion status will stay unchanged.</p></div><div className="settings-action"><strong>{store.sessions.length} recent log entries</strong><button className="danger-button" onClick={()=>void resetStudyLogs()}>Reset study-time logs</button></div></div>
          <div className="settings-card"><div><h3>Lesson completion history</h3><p>Mark every lesson in every course as incomplete and clear its completion timestamp. Your playlists and video durations will remain.</p></div><div className="settings-action"><strong>{completed} completed lessons</strong><button className="danger-button" onClick={()=>void resetCompletionHistory()}>Reset lesson history</button></div></div>
          {error&&<div className="error-msg">{error}</div>}
        </section>:activeTab==="progress"?<section className="progress-page">
          <div className="section-heading"><div><span className="eyebrow">YOUR ACTIVITY</span><h2>Daily progress</h2></div><span className="goal-date">Last 7 days</span></div>
          <div className="progress-summary"><article className="progress-summary-card"><span>Total classes today</span><strong>{todayHistory.length}</strong></article><article className="progress-summary-card"><span>Total study time today</span><strong>{fmt(todayLectureSeconds)}</strong></article><article className="progress-summary-card"><span>Classes in 7 days</span><strong>{dailyHistory.reduce((n,d)=>n+d.lessons.length,0)}</strong></article><article className="progress-summary-card"><span>Study time in 7 days</span><strong>{fmt(sevenDayLectureSeconds)}</strong></article></div>
          <div className="history-card"><div className="section-heading"><div><span className="eyebrow">WEEKLY OVERVIEW</span><h2>Last 7 days</h2></div></div><div className="history-days">{dailyHistory.slice().reverse().map(d=><div className="history-day" key={d.day}><div className="history-day-date"><strong>{d.day===localDay()?"Today":new Date(d.day+"T12:00:00").toLocaleDateString(undefined,{weekday:"short"})}</strong><small>{new Date(d.day+"T12:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric"})}</small></div><div className="history-bar"><div style={{width:(Math.min(100,d.lessons.length/Math.max(1,...dailyHistory.map(x=>x.lessons.length))*100))+"%"}}/></div><strong className="history-count">{d.lessons.length} classes</strong><span className="history-time">{fmt(d.lectureSeconds)}</span></div>)}</div></div>
          <div className="history-card"><div className="section-heading"><div><span className="eyebrow">COMPLETION LOG</span><h2>Today&#39;s completed classes</h2></div><span className="goal-date">{todayHistory.length} completed</span></div>{todayHistory.length?todayHistory.map(v=><div className="completed-history-row" key={v.id}><span className="history-check"><Check size={14}/></span><div><strong>{v.title}</strong><small>{store.courses.find(c=>c.lessons.some(l=>l.id===v.id))?.title||"Course"}</small></div><time>{new Date(v.completedAt!).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"})}</time></div>):<p className="empty-history">No classes completed today yet. Mark a lesson complete in My learning and it will appear here.</p>}</div>
          <div className="history-card"><div className="section-heading"><div><span className="eyebrow">STUDY TIME</span><h2>Log a study session</h2></div></div><div className="log-time"><span><Clock3 size={16}/> Record time studied</span><input aria-label="Minutes studied" type="number" min="1" max="600" value={studyInput} onChange={e=>setStudyInput(e.target.value)}/><span className="mins">minutes</span><button onClick={()=>void addStudyTime()}>Add time</button></div></div>
        </section>:<section className="courses-section">

          <div className="section-heading"><div><span className="eyebrow">BUILD YOUR ROUTINE</span><h2>My courses <span className="count-pill">{store.courses.length}</span></h2></div></div>
          <form className="add-form" onSubmit={addPlaylist}><div className="youtube-symbol"><Youtube size={21}/></div><input value={playlistUrl} onChange={e=>setPlaylistUrl(e.target.value)} placeholder="Paste a YouTube playlist link to get started..." aria-label="YouTube playlist URL" required/><button disabled={loading||!playlistUrl.trim()}>{loading?<LoaderCircle className="spin" size={17}/>:<Plus size={17}/>}<span>{loading?"Importing":"Add playlist"}</span></button></form>
          {error&&<div className="error-msg">{error}</div>}
          <div className="course-layout">
            <div className="course-list">
              {store.courses.length===0?<div className="empty-state"><div className="empty-icon"><Youtube size={27}/></div><h3>Your learning library starts here</h3><p>Add a public YouTube playlist and its lessons will appear here, ready to organize and track.</p><div className="empty-tip">✦ Your progress syncs to your account across devices.</div></div>:store.courses.map(c=><button key={c.id} className={`course-row ${selected?.id===c.id?"selected":""}`} onClick={()=>{setActiveCourse(c.id);setSearch("");}}><img src={c.thumbnail||"https://placehold.co/96x64/25243a/ffffff?text=Course"} alt=""/><div className="course-info"><strong>{c.title}</strong><small>{c.lessons.length} lessons · {fmt(c.lessons.reduce((a,v)=>a+v.duration,0))}</small><div className="tiny-track"><div style={{width:`${courseProgress(c)}%`}}/></div></div><b className="course-percent">{courseProgress(c)}%</b></button>)}
            </div>
            <div className="lesson-panel">
              {selected?<><div className="lesson-head"><div><h3>{selected.title}</h3><p>{selected.lessons.filter(v=>v.completed).length} of {selected.lessons.length} lessons completed</p></div><div className="lesson-head-actions"><button className="refresh-durations" type="button" onClick={()=>void refreshDurations()} disabled={refreshingDurations} title="Refresh saved video durations"><RefreshCw size={15} className={refreshingDurations?"spin":""}/><span>{refreshingDurations?"Refreshing":"Refresh times"}</span></button><button className="delete-course" title="Remove course" onClick={()=>void deleteCourse(selected.id)}><Trash2 size={17}/></button></div></div><div className="lesson-toolbar"><div className="search-box"><Search size={16}/><input placeholder="Find a lesson..." value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="sort-box"><ListFilter size={15}/><select aria-label="Sort lessons" value={sort} onChange={e=>setSort(e.target.value)}><option value="original">Playlist order</option><option value="pending">Completion status</option><option value="short">Duration: shortest</option><option value="long">Duration: longest</option></select><button type="button" className="sort-direction" onClick={()=>setSortDirection(v=>v==="asc"?"desc":"asc")} aria-label={sortDirection==="asc"?"Switch to descending order":"Switch to ascending order"} title={sortDirection==="asc"?"Ascending — click for descending":"Descending — click for ascending"}>{sortDirection==="asc"?<ArrowUp size={16}/>:<ArrowDown size={16}/>}</button></div></div><div className="lesson-list">{filteredLessons.map((v,i)=><div className={`lesson-row ${v.completed?"is-complete":""}`} key={v.id}><button type="button" className="check-button" aria-pressed={v.completed} aria-label={v.completed?"Mark incomplete":"Mark complete"} title={v.completed?"Mark as not completed":"Mark as completed"} onClick={()=>void updateCourse(selected.id,v.id)}>{v.completed?<Check size={14} strokeWidth={3}/>:<Circle size={15} strokeWidth={2}/>}</button><span className="lesson-number">{String(v.position||i+1).padStart(2,"0")}</span><div className="lesson-title"><strong>{v.title}</strong><small>{v.completed?"Completed":"Not completed"}</small></div><span className="lesson-duration">{fmt(v.duration)}</span><a className="play-link" href={`https://www.youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noreferrer" title="Watch on YouTube"><Play size={15}/></a></div>)}</div>{filteredLessons.length===0&&<div className="no-results">No lessons match your search.</div>}</>:<div className="select-course"><BookOpen size={28}/><h3>Select a course</h3><p>Choose a playlist to see and manage its lessons.</p></div>}
            </div>
          </div>
        </section>}
        <footer>Made for focused learning <span>·</span> StudyTrack MVP</footer>
      </section>
    </main>
  );
}
