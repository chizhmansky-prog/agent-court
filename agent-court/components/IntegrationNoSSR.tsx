"use client";
import dynamic from "next/dynamic";
const IntegrationPanel = dynamic(() => import("./IntegrationPanel"), { ssr: false, loading: () => <p>Loading browser chat integration…</p> });
export default function IntegrationNoSSR() { return <IntegrationPanel />; }
