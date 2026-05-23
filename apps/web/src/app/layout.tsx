import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 投资决策平台",
  description: "多人在线异步协作实验平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
