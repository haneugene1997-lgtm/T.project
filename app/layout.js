import "./globals.css";
import "../src/theme/tokens.css";
import { Providers } from "./providers";

export const metadata = {
  title: "SKT 법무 검토 에이전트",
  description: "6대 법령 기반 컴플라이언스 AI 검토 시스템",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" data-theme="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
