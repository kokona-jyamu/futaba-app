import type { Metadata } from "next";
import { Noto_Sans_JP, Geist_Mono } from "next/font/google";
import ThemeProvider from '@/components/ThemeProvider';
import "./globals.css";
import './styles/futaba.css';
import './styles/futaba-parent.css';
import './styles/futaba-admin.css';
import './styles/futaba-mypage.css';
import './styles/futaba-allergen.css';
import './styles/futaba-allergen2.css';
import './styles/futaba-menu.css';

/* 本文の字体：Google の日本語フォント Noto Sans JP（このアプリのサーバーから配信される）。
   日本語の文字は、表示に必要な分だけが読み込まれる */
const notoSansJp = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ふたば保育園 給食・食育ポータル",
  description: "ふたば保育園の給食の献立・食育の記録・おやすみの連絡",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${notoSansJp.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider />
        {children}
      </body>
    </html>
  );
}
