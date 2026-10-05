import Link from "next/link";
import IntegrationNoSSR from "@/components/IntegrationNoSSR";
export default function IntegrationPage() {
  return <main className="integration-page"><header><Link href="/">← Agent Court</Link><h1>Integration evidence</h1><p>Gate 0 · live CometChat send, receive and independent read-back.</p></header><IntegrationNoSSR /></main>;
}
