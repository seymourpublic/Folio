import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/useTheme";
import "./globals.css";

// No `weight`: both are variable fonts, so this ships a single file covering the
// whole weight range instead of one static file per weight (which preloads more
// than the first screen uses).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Not preloaded: the splash screen renders no monospace text, so preloading it
// only earns a "preloaded but not used" warning. It still loads on demand.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Folio",
  description: "A PDF viewer, editor, and document workspace.",
};

const themeInitScript = `(function(){try{var t=localStorage.getItem('acrobat-clone:theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark')document.documentElement.classList.add('dark');if(localStorage.getItem('acrobat-clone:reduce-motion')==='true')document.documentElement.classList.add('reduce-motion');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Runs synchronously during HTML parsing so the class is set before first
            paint. next/script can't do this — inline children are never executed. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="h-full flex flex-col">
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
