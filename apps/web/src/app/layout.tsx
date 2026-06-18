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
      <body className="min-h-full flex flex-col">
        {children}
        <footer className="beian-footer" aria-label="公安备案信息">
          <a
            href="https://beian.mps.gov.cn/#/query/webSearch?code=37098202000886"
            rel="noreferrer"
            target="_blank"
          >
            <img src="/beian-police.png" alt="" aria-hidden="true" />
            <span>鲁公网安备37098202000886号</span>
          </a>
        </footer>
      </body>
    </html>
  );
}
