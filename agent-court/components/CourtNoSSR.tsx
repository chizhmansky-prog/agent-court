"use client";
import dynamic from "next/dynamic";
const CourtApp = dynamic(() => import("./CourtApp"), { ssr: false, loading: () => <div className="loading-court"><span className="eyebrow">Preparing the court</span><p>Loading the live messaging runtime…</p></div> });
export default function CourtNoSSR() { return <CourtApp />; }
