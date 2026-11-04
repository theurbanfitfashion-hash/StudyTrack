import { NextRequest, NextResponse } from "next/server";

const API = "https://www.googleapis.com/youtube/v3";
function getPlaylistId(value: string) {
  try { const url = new URL(value); return url.searchParams.get("list") || (url.hostname.includes("youtu.be") ? null : null); }
  catch { return null; }
}
function isoDuration(value: string) { const m = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); return m ? Number(m[1]||0)*3600 + Number(m[2]||0)*60 + Number(m[3]||0) : 0; }
export async function POST(req: NextRequest) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return NextResponse.json({ error: "Playlist import is not configured yet. Add YOUTUBE_API_KEY to the deployment environment." }, { status: 503 });
  try {
    const body = await req.json(); const playlistId = getPlaylistId(String(body.url || ""));
    if (!playlistId) return NextResponse.json({ error: "Please paste a valid YouTube playlist URL containing a playlist ID." }, { status: 400 });
    const pRes = await fetch(`${API}/playlists?part=snippet&id=${encodeURIComponent(playlistId)}&key=${key}`, { next: { revalidate: 3600 } });
    const pData = await pRes.json(); if (!pRes.ok || !pData.items?.length) return NextResponse.json({ error: pData.error?.message || "Playlist not found or unavailable. Check that it is public or unlisted." }, { status: 422 });
    const playlist = pData.items[0]; let pageToken = ""; const raw: any[] = [];
    do {
      const q = new URLSearchParams({ part: "snippet,contentDetails", playlistId, maxResults: "50", key }); if (pageToken) q.set("pageToken", pageToken);
      const res = await fetch(`${API}/playlistItems?${q.toString()}`); const data = await res.json(); if (!res.ok) throw new Error(data.error?.message || "Unable to read playlist videos.");
      raw.push(...(data.items || [])); pageToken = data.nextPageToken || "";
    } while (pageToken && raw.length < 500);
    const ids = raw.map(x => x.contentDetails?.videoId).filter(Boolean); const durationMap = new Map<string,number>();
    for (let i=0;i<ids.length;i+=50) { const q = new URLSearchParams({ part:"contentDetails", id:ids.slice(i,i+50).join(","), key }); const res=await fetch(`${API}/videos?${q.toString()}`); const data=await res.json(); if (!res.ok) throw new Error(data.error?.message || "Unable to read video durations."); for (const v of data.items || []) durationMap.set(v.id,isoDuration(v.contentDetails?.duration || "")); }
    const lessons = raw.map((item:any,index:number) => ({ id:item.contentDetails.videoId, videoId:item.contentDetails.videoId, title:item.snippet?.title || "Untitled lesson", duration:durationMap.get(item.contentDetails.videoId) || 0, position:index+1, completed:false })).filter((v:any)=>v.title !== "Private video" && v.title !== "Deleted video");
    return NextResponse.json({ playlistId, title:playlist.snippet.title, thumbnail:playlist.snippet.thumbnails?.medium?.url || playlist.snippet.thumbnails?.default?.url || "", lessons });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Playlist import failed." }, { status: 500 }); }
}
