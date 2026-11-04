"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Check, CheckCircle2, Clock3, Flame, GraduationCap, ListFilter, Plus, Search, Target, Trash2, Youtube, Play, Circle, CalendarDays, ArrowUpDown, LoaderCircle, LogOut, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type Lesson = { id: string; title: string; duration: number; videoId: string; position: number; completed: boolean; };
type Course = { id: string; title: string; playlistId: string; thumbnail: string; lessons: Lesson[]; addedAt: number; };
type Store = { courses: Course[]; goalHours: number; goalVideos: number; studiedMinutes: number; completedToday: number; day: string; };
const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const initial: Store = { courses: [], goalHours: 2, goalVideos: 5, studiedMinutes: 0, completedToday: 0, day: localDay() };
const fmt = (seconds: number) => { const m = Math.floor(seconds / 60); const h = Math.floor(m / 60); return h ? `${h}h ${m % 60}m` : `${m}m`; };
const supabase = createClient();

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<"signin"|"signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [store, setStore] = useState<Store>(initial);
  const [ready, setReady] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("original");
  const [activeCourse, setActiveCourse] = useState<string | null>(null);
  const [studyInput, setStudyInput] = useState("30");

  const loadWorkspace = useCallback(async (currentUser: User) => {
    setReady(false);
    const [courseResult, goalResult, sessionResult] = await Promise.all([
      supabase.from("courses").select("id,title,playlist_id,thumbnail,added_at,lessons(id,video_id,title,duration_seconds,position,completed)").eq("user_id", currentUser.id).order("added_at", {ascending:false}),
      supabase.from("daily_goals").select("goal_hours,goal_videos").eq("user_id", currentUser.id).maybeSingle(),
      supabase.from("study_sessions").select("studied_minutes").eq("user_id", currentUser.id).eq("studied_on", localDay())
    ]);
    if (courseResult.error || goalResult.error || sessionResult.error) {
      setError(courseResult.error?.message || goalResult.error?.message || sessionResult.error?.message || "Could not load your study data.");
      setReady(true); return;
    }
    const courses: Course[] = (courseResult.data || []).map((c: any) => ({
      id:c.id,title:c.title,playlistId:c.playlist_id,thumbnail:c.thumbnail || "",addedAt:new Date(c.added_at).getTime(),
      lessons:(c.lessons || []).sort((a:any,b:any)=>a.position-b.position).map((v:any)=>({id:v.id,videoId:v.video_id,title:v.title,duration:v.duration_seconds,position:v.position,completed:v.completed}))
    }));
    const completedToday = (courseResult.data || []).flatMap((c:any)=>c.lessons || []).filter((v:any)=>v.completed && v.completed_at && String(v.completed_at).slice(0,10)===localDay()).length;
    setStore({courses,goalHours:Number(goalResult.data?.goal_hours ?? 2),goalVideos:goalResult.data?.goal_videos ?? 5,studiedMinutes:(sessionResult.data || []).reduce((n:any,s:any)=>n+s.studied_minutes,0),completedToday,day:localDay()});
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
    if (sort === "short") items = [...items].sort((a,b) => a.duration-b.duration);
    if (sort === "long") items = [...items].sort((a,b) => b.duration-a.duration);
    if (sort === "pending") items = [...items].sort((a,b) => Number(a.completed)-Number(b.completed));
    return items;
  }, [selected, search, sort]);
  const timePct = Math.min(100, Math.round(store.studiedMinutes / Math.max(1, store.goalHours * 60) * 100));
  const videoPct = Math.min(100, Math.round(store.completedToday / Math.max(1, store.goalVideos) * 100));

  async function updateCourse(courseId: string, lessonId: string) {
    const lesson = store.courses.find(c=>c.id===courseId)?.lessons.find(v=>v.id===lessonId);
    if (!lesson) return;
    const next = !lesson.completed;
    const completedAt = next ? new Date().toISOString() : null;
    const {error} = await supabase.from("lessons").update({completed:next,completed_at:completedAt}).eq("id",lessonId);
    if (error) { setError(error.message); return; }
    setStore(s => ({ ...s, completedToday: Math.max(0,s.completedToday + (next?1:(String((lesson as any).completedAt || "").slice(0,10)===localDay()?-1:0))), courses: s.courses.map(c => c.id !== courseId ? c : { ...c, lessons: c.lessons.map(v => v.id===lessonId ? {...v,completed:next} : v) }) }));
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

  async function addStudyTime() {
    const mins = Math.max(1,Math.min(600,Number(studyInput)||0));
    const {error} = await supabase.from("study_sessions").insert({user_id:user!.id,studied_minutes:mins,studied_on:localDay()});
    if (error) {setError(error.message);return;}
    setStore(s=>({...s,studiedMinutes:s.studiedMinutes+mins})); setStudyInput("30");
  }

  async function saveGoals(goalHours:number,goalVideos:number) {
    setStore(s=>({...s,goalHours,goalVideos}));
    const {error} = await supabase.from("daily_goals").upsert({user_id:user!.id,goal_hours:goalHours,goal_videos:goalVideos,updated_at:new Date().toISOString()});
    if(error) setError(error.message);
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
        <label>Password</label><input className="auth-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" minLength={6} required autoComplete={authMode==="signin"?"current-password":"new-password"}/>
        <button className="auth-submit" disabled={authBusy}>{authBusy?<LoaderCircle className="spin" size={17}/>:null}{authMode==="signin"?"Sign in":"Create account"}</button>
        {authMessage&&<div className="auth-message">{authMessage}</div>}
        <div className="auth-switch">{authMode==="signin"?"New to StudyTrack?":"Already have an account?"} <button type="button" onClick={()=>{setAuthMode(authMode==="signin"?"signup":"signin");setAuthMessage("");}}>{authMode==="signin"?"Create account":"Sign in"}</button></div>
      </form>
    </main>
  );

  return (
    <main className="shell">
      <aside className="sidebar">
        <a className="brand" href="#"><span className="brand-mark"><GraduationCap size={22}/></span><span>studytrack</span></a>
        <div className="nav-label">WORKSPACE</div>
        <a className="nav-item active"><BookOpen size={18}/> My learning</a>
        <a className="nav-item" href="#daily-goals"><Target size={18}/> Daily goals</a>
        <div className="sidebar-bottom"><div className="mini-avatar">{(user.email||"S")[0].toUpperCase()}</div><div className="account-details"><strong>{user.email}</strong><small>Synced account</small></div><button className="signout-button" onClick={signOut} title="Sign out"><LogOut size={17}/></button></div>
      </aside>
      <section className="main-area">
        <header className="topbar"><div><span className="eyebrow">YOUR PERSONAL LEARNING SPACE</span><h1>Good to see you<span className="wave"> ✦</span></h1><p>Make steady progress, one lesson at a time.</p></div><div className="date-chip"><CalendarDays size={16}/>{new Date().toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"})}</div></header>
        <section className="stats-grid">
          <article className="stat-card"><div className="stat-icon violet"><BookOpen size={19}/></div><span>Courses</span><strong>{store.courses.length}</strong><small>Playlists in your library</small></article>
          <article className="stat-card"><div className="stat-icon blue"><CheckCircle2 size={19}/></div><span>Lessons completed</span><strong>{completed}<small className="muted-total"> / {total}</small></strong><small>Across all courses</small></article>
          <article className="stat-card"><div className="stat-icon orange"><Clock3 size={19}/></div><span>Study time today</span><strong>{fmt(store.studiedMinutes*60)}</strong><small>Keep your momentum</small></article>
          <article className="stat-card"><div className="stat-icon pink"><Flame size={19}/></div><span>Today's lessons</span><strong>{store.completedToday}<small className="muted-total"> / {store.goalVideos}</small></strong><small>Daily video target</small></article>
        </section>
        <section className="goals-section" id="daily-goals">
          <div className="section-heading"><div><span className="eyebrow">STAY CONSISTENT</span><h2>Today's targets</h2></div><span className="goal-date">Daily goals</span></div>
          <div className="goals-grid">
            <article className="goal-card"><div className="goal-top"><div className="goal-icon"><Clock3 size={18}/></div><span>Study time</span><strong>{timePct}%</strong></div><div className="progress-track"><div className="progress-fill purple-fill" style={{width:`${timePct}%`}}/></div><div className="goal-bottom"><b>{fmt(store.studiedMinutes*60)} <i>/ {store.goalHours}h</i></b><label>Daily target <input aria-label="Daily study hours target" type="number" min="1" max="24" step="0.5" value={store.goalHours} onChange={e=>void saveGoals(Math.max(1,Math.min(24,Number(e.target.value)||1)),store.goalVideos)}/></label></div></article>
            <article className="goal-card"><div className="goal-top"><div className="goal-icon blue-goal"><CheckCircle2 size={18}/></div><span>Lessons</span><strong>{videoPct}%</strong></div><div className="progress-track"><div className="progress-fill blue-fill" style={{width:`${videoPct}%`}}/></div><div className="goal-bottom"><b>{store.completedToday} <i>/ {store.goalVideos} videos</i></b><label>Daily target <input aria-label="Daily video target" type="number" min="1" max="500" value={store.goalVideos} onChange={e=>void saveGoals(store.goalHours,Math.max(1,Math.min(500,Number(e.target.value)||1)))}/></label></div></article>
          </div>
          <div className="log-time"><span><Clock3 size={16}/> Log a study session</span><input aria-label="Minutes studied" type="number" min="1" max="600" value={studyInput} onChange={e=>setStudyInput(e.target.value)}/><span className="mins">minutes</span><button onClick={()=>void addStudyTime()}>Add time</button></div>
        </section>
        <section className="courses-section">
          <div className="section-heading"><div><span className="eyebrow">BUILD YOUR ROUTINE</span><h2>My courses <span className="count-pill">{store.courses.length}</span></h2></div></div>
          <form className="add-form" onSubmit={addPlaylist}><div className="youtube-symbol"><Youtube size={21}/></div><input value={playlistUrl} onChange={e=>setPlaylistUrl(e.target.value)} placeholder="Paste a YouTube playlist link to get started..." aria-label="YouTube playlist URL" required/><button disabled={loading||!playlistUrl.trim()}>{loading?<LoaderCircle className="spin" size={17}/>:<Plus size={17}/>}<span>{loading?"Importing":"Add playlist"}</span></button></form>
          {error&&<div className="error-msg">{error}</div>}
          <div className="course-layout">
            <div className="course-list">
              {store.courses.length===0?<div className="empty-state"><div className="empty-icon"><Youtube size={27}/></div><h3>Your learning library starts here</h3><p>Add a public YouTube playlist and its lessons will appear here, ready to organize and track.</p><div className="empty-tip">✦ Your progress syncs to your account across devices.</div></div>:store.courses.map(c=><button key={c.id} className={`course-row ${selected?.id===c.id?"selected":""}`} onClick={()=>{setActiveCourse(c.id);setSearch("");}}><img src={c.thumbnail||"https://placehold.co/96x64/25243a/ffffff?text=Course"} alt=""/><div className="course-info"><strong>{c.title}</strong><small>{c.lessons.length} lessons · {fmt(c.lessons.reduce((a,v)=>a+v.duration,0))}</small><div className="tiny-track"><div style={{width:`${courseProgress(c)}%`}}/></div></div><b className="course-percent">{courseProgress(c)}%</b></button>)}
            </div>
            <div className="lesson-panel">
              {selected?<><div className="lesson-head"><div><h3>{selected.title}</h3><p>{selected.lessons.filter(v=>v.completed).length} of {selected.lessons.length} lessons completed</p></div><button className="delete-course" title="Remove course" onClick={()=>void deleteCourse(selected.id)}><Trash2 size={17}/></button></div><div className="lesson-toolbar"><div className="search-box"><Search size={16}/><input placeholder="Find a lesson..." value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="sort-box"><ListFilter size={15}/><select aria-label="Sort lessons" value={sort} onChange={e=>setSort(e.target.value)}><option value="original">Playlist order</option><option value="pending">Incomplete first</option><option value="short">Shortest first</option><option value="long">Longest first</option></select><ArrowUpDown size={13}/></div></div><div className="lesson-list">{filteredLessons.map((v,i)=><div className={`lesson-row ${v.completed?"is-complete":""}`} key={v.id}><button className="check-button" aria-label={v.completed?"Mark incomplete":"Mark complete"} onClick={()=>void updateCourse(selected.id,v.id)}>{v.completed?<Check size={15}/>:<Circle size={17}/>}</button><span className="lesson-number">{String(v.position||i+1).padStart(2,"0")}</span><div className="lesson-title"><strong>{v.title}</strong><small>{v.completed?"Completed":"Not completed"}</small></div><span className="lesson-duration">{fmt(v.duration)}</span><a className="play-link" href={`https://www.youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noreferrer" title="Watch on YouTube"><Play size={15}/></a></div>)}</div>{filteredLessons.length===0&&<div className="no-results">No lessons match your search.</div>}</>:<div className="select-course"><BookOpen size={28}/><h3>Select a course</h3><p>Choose a playlist to see and manage its lessons.</p></div>}
            </div>
          </div>
        </section>
        <footer>Made for focused learning <span>·</span> StudyTrack MVP</footer>
      </section>
    </main>
  );
}
