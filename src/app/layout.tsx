import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeInitializer } from "@/components/ThemeInitializer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PrintDex",
  description: "3D print file browser and previewer",
};

// Inline script — runs before paint to set data-mode and avoid FOUC.
// Mirrors logic in lib/theme.ts; keep them in sync.
const noFoucScript = `
(function(){
  try {
    var mode = null;
    var ls = localStorage.getItem('printdex.theme');
    if (ls) { try { var p = JSON.parse(ls); if (p && (p.mode === 'light' || p.mode === 'dark')) mode = p.mode; } catch(e){} }
    if (!mode) {
      var m = document.cookie.match(/(?:^|; )printdex_theme=([^;]+)/);
      if (m) { var v = decodeURIComponent(m[1]); if (v === 'light' || v === 'dark') mode = v; }
    }
    if (!mode) {
      mode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.dataset.mode = mode;
  } catch(e) {
    document.documentElement.dataset.mode = 'light';
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-mode="light"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFoucScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeInitializer />
        {children}
      </body>
    </html>
  );
}
