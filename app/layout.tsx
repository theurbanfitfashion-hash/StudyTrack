import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "StudyTrack — Your learning, organized", description: "Manage YouTube learning playlists, track completed lessons, and hit your daily study goals." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
