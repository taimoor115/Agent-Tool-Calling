import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevAgent — AI Agent with Tool Calling",
  description:
    "Watch an AI agent reason and call tools (web search, database, calculator, code runner) in real time.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
