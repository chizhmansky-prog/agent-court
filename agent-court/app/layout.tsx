import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Agent Court — Before an agent acts", description: "An AI agent proposes. Evidence challenges. A human decides. Live CometChat governance for simulated autonomous refunds." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
