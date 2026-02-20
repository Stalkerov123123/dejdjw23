import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Студенческий рейтинг ВГУИТ",
  description: "Просмотр успеваемости студентов ВГУИТ по номеру зачётной книжки. Информация о баллах, оценках и результатах сессии.",
  keywords: ["ВГУИТ", "рейтинг", "студенты", "успеваемость", "зачётка", "баллы", "оценки"],
  authors: [{ name: "ВГУИТ" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
