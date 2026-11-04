"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, CheckCircle2, Clock3, Flame, GraduationCap, ListFilter, Plus, Search, Target, Trash2, Youtube, Play, Circle, CalendarDays, ArrowUpDown, LoaderCircle } from "lucide-react";

type Lesson = { id: string; title: string; duration: number; videoId: string; position: number; completed: boolean; };
type Course = { id: string; title: string; playlistId: string; thumbnail: string; lessons: Lesson[]; addedAt: number; };
type Store = { courses: Course[]; goalHours: number; goalVideos: number; studiedMinutes: number; completedToday: number; day: string; };

const today = () => new Date().toISOString().slice(0, 10);
const initial: Store = { courses: [], goalHours: 2, goalVideos: 5, studiedMinutes: 0, completedToday: 0, day: today() };
const fmt = (seconds: number) => { const m = Math.floor(seconds / 60); const h = Math.floor(m / 60); return h ? `${h}h ${m % 60}m` : `${m}m`; };

export default function Home() {
  const [store, setStore] = useState<Store>(initial);
  const [ready, setReady] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("original");
  const [activeCourse, setActiveCourse] = useState<string | null>(null);
  const [studyInput, setStudyInput] = useState("30");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("studytrack-v1");
      if (saved) {
        const parsed = JSON.parse(saved) as Store;
        if (parsed.day !== today()) { parsed.day = today(); parsed.studiedMinutes = 0; parsed.completedToday = 0; }
        setStore(parsed);
      }
    } catch { /* Start with a clean local workspace if saved data is invalid. */ }
    setReady(true);
  }, []);

  useEffect(() => { if (ready) localStorage.setItem("studytrack-v1", JSON.stringify(store)); }, [store, ready]);

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

  function updateCourse(courseId: string, lessonId: string) {
    setStore(s => ({ ...s, courses: s.courses.map(c => c.id !== courseId ? c : { ...c, lessons: c.lessons.map(v => {
      if (v.id !== lessonId) return v;
      const next = !v.completed;
      return { ...v, completed: next };
    }) }) }));
  }

  async function addPlaylist(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const response = await fetch("/api/youtube/playlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: playlistUrl }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not import this playlist.");
      const course: Course = { id: crypto.randomUUID(), title: data.title, playlistId: data.playlistId, thumbnail: data.thumbnail, lessons: data.lessons, addedAt: Date.now() };
      setStore(s => ({ ...s, courses: [course, ...s.courses] }));
      setActiveCourse(course.id); setPlaylistUrl(""); setSearch("");
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); }
    finally { setLoading(false); }
  }

  function addStudyTime() {
    const mins = Math.max(1, Math.min(600, Number(studyInput) || 0));
    setStore(s => ({ ...s, studiedMinutes: s.studiedMinutes + mins }));
    setStudyInput("30");
  }

  const courseProgress = (c: Course) => c.lessons.length ? Math.round(c.lessons.filter(v => v.completed).length / c.lessons.length * 100) : 0;

  return (
    <main className="shell">
      <aside className="sidebar">
        <a className="brand" href="#"><span className="brand-mark"><GraduationCap size={22}/></span><span>studytrack</span></a>
        <div className="nav-label">WORKSPACE</div>
        <a className="nav-item active"><BookOpen size={18}/> My learning</a>
        <a className="nav-item" href="#daily-goals"><Target size={18}/> Daily goals</a>
        <div className="sidebar-bottom"><div className="mini-avatar">S</div><div><strong>My study space</strong><small>Personal workspace</small></div></div>
      </aside>

      <section className="main-area">
        <header className="topbar"><div><span className="eyebrow">YOUR PERSONAL LEARNING SPACE</span><h1>Good to see you<span className="wave"> ✦</span></h1><p>Make steady progress, one lesson at a time.</p></div><div className="date-chip"><CalendarDays size={16}/>{new Date().toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"})}</div></header>

        <section className="stats-grid">
          <article className="stat-card"><div className="stat-icon violet"><BookOpen size={19}/></div><span>Courses</span><strong>{store.courses.length}</strong><small>Playlists in your library</small></article>
          <article className="stat-card"><div className="stat-icon blue"><CheckCircle2 size={19}/></div><span>Lessons completed</span><strong>{completed}<small className="muted-total"> / {total}</small></strong><small>Across all courses</small></article>
          <article className="stat-card"><div className="stat-icon orange"><Clock3 size={19}/></div><span>Study time today</span><strong>{fmt(store.studiedMinutes * 60)}</strong><small>Keep your momentum</small></article>
          <article className="stat-card"><div className="stat-icon pink"><Flame size={19}/></div><span>Today's lessons</span><strong>{store.completedToday}<small className="muted-total"> / {store.goalVideos}</small></strong><small>Daily video target</small></article>
        </section>

        <section className="goals-section" id="daily-goals">
          <div className="section-heading"><div><span className="eyebrow">STAY CONSISTENT</span><h2>Today's targets</h2></div><span className="goal-date">Daily goals</span></div>
          <div className="goals-grid">
            <article className="goal-card"><div className="goal-top"><div className="goal-icon"><Clock3 size={18}/></div><span>Study time</span><strong>{timePct}%</strong></div><div className="progress-track"><div className="progress-fill purple-fill" style={{width:`${timePct}%`}}/></div><div className="goal-bottom"><b>{fmt(store.studiedMinutes*60)} <i>/ {store.goalHours}h</i></b><label>Daily target <input aria-label="Daily study hours target" type="number" min="1" max="16" value={store.goalHours} onChange={e=>setStore(s=>({...s,goalHours:Math.max(1,Number(e.target.value)||1)}))}/></label></div></article>
            <article className="goal-card"><div className="goal-top"><div className="goal-icon blue-goal"><CheckCircle2 size={18}/></div><span>Lessons</span><strong>{videoPct}%</strong></div><div className="progress-track"><div className="progress-fill blue-fill" style={{width:`${videoPct}%`}}/></div><div className="goal-bottom"><b>{store.completedToday} <i>/ {store.goalVideos} videos</i></b><label>Daily target <input aria-label="Daily video target" type="number" min="1" max="100" value={store.goalVideos} onChange={e=>setStore(s=>({...s,goalVideos:Math.max(1,Number(e.target.value)||1)}))}/></label></div></article>
          </div>
          <div className="log-time"><span><Clock3 size={16}/> Log a study session</span><input aria-label="Minutes studied" type="number" min="1" max="600" value={studyInput} onChange={e=>setStudyInput(e.target.value)}/><span className="mins">minutes</span><button onClick={addStudyTime}>Add time</button></div>
        </section>

        <section className="courses-section">
          <div className="section-heading"><div><span className="eyebrow">BUILD YOUR ROUTINE</span><h2>My courses <span className="count-pill">{store.courses.length}</span></h2></div></div>
          <form className="add-form" onSubmit={addPlaylist}><div className="youtube-symbol"><Youtube size={21}/></div><input value={playlistUrl} onChange={e=>setPlaylistUrl(e.target.value)} placeholder="Paste a YouTube playlist link to get started..." aria-label="YouTube playlist URL" required/><button disabled={loading || !playlistUrl.trim()}>{loading ? <LoaderCircle className="spin" size={17}/> : <Plus size={17}/>}<span>{loading ? "Importing" : "Add playlist"}</span></button></form>
          {error && <div className="error-msg">{error}</div>}
          {!process.env.NEXT_PUBLIC_SUPABASE_URL && <div className="local-note">Prototype mode: courses and progress are saved in this browser. Account sync will be connected in the next backend step.</div>}
          <div className="course-layout">
            <div className="course-list">
              {store.courses.length === 0 ? <div className="empty-state"><div className="empty-icon"><Youtube size={27}/></div><h3>Your learning library starts here</h3><p>Add a public YouTube playlist and its lessons will appear here, ready to organize and track.</p><div className="empty-tip">✦ Your progress is saved automatically in this browser.</div></div> : store.courses.map(c=><button key={c.id} className={`course-row ${selected?.id===c.id?"selected":""}`} onClick={()=>{setActiveCourse(c.id);setSearch("");}}><img src={c.thumbnail || "https://placehold.co/96x64/25243a/ffffff?text=Course"} alt="" /><div className="course-info"><strong>{c.title}</strong><small>{c.lessons.length} lessons · {fmt(c.lessons.reduce((a,v)=>a+v.duration,0))}</small><div className="tiny-track"><div style={{width:`${courseProgress(c)}%`}}/></div></div><b className="course-percent">{courseProgress(c)}%</b></button>)}
            </div>
            <div className="lesson-panel">
              {selected ? <><div className="lesson-head"><div><h3>{selected.title}</h3><p>{selected.lessons.filter(v=>v.completed).length} of {selected.lessons.length} lessons completed</p></div><button className="delete-course" title="Remove course" onClick={()=>{setStore(s=>({...s,courses:s.courses.filter(c=>c.id!==selected.id)}));setActiveCourse(null);}}><Trash2 size={17}/></button></div><div className="lesson-toolbar"><div className="search-box"><Search size={16}/><input placeholder="Find a lesson..." value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="sort-box"><ListFilter size={15}/><select aria-label="Sort lessons" value={sort} onChange={e=>setSort(e.target.value)}><option value="original">Playlist order</option><option value="pending">Incomplete first</option><option value="short">Shortest first</option><option value="long">Longest first</option></select><ArrowUpDown size={13}/></div></div><div className="lesson-list">{filteredLessons.map((v,i)=><div className={`lesson-row ${v.completed?"is-complete":""}`} key={v.id}><button className="check-button" aria-label={v.completed?"Mark incomplete":"Mark complete"} onClick={()=>{const was=v.completed;updateCourse(selected.id,v.id);if(!was)setStore(s=>({...s,completedToday:s.completedToday+1}));else setStore(s=>({...s,completedToday:Math.max(0,s.completedToday-1)}));}}>{v.completed?<Check size={15}/>:<Circle size={17}/>}</button><span className="lesson-number">{String(v.position || i+1).padStart(2,"0")}</span><div className="lesson-title"><strong>{v.title}</strong><small>{v.completed?"Completed":"Not completed"}</small></div><span className="lesson-duration">{fmt(v.duration)}</span><a className="play-link" href={`https://www.youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noreferrer" title="Watch on YouTube"><Play size={15}/></a></div>)}</div>{filteredLessons.length===0&&<div className="no-results">No lessons match your search.</div>}</> : <div className="select-course"><BookOpen size={28}/><h3>Select a course</h3><p>Choose a playlist to see and manage its lessons.</p></div>}
            </div>
          </div>
        </section>
        <footer>Made for focused learning <span>·</span> StudyTrack MVP</footer>
      </section>
    </main>
  );
}
