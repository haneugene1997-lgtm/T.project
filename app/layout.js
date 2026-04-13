import './globals.css';

export const metadata = {
  title: 'SKT 법무 검토 에이전트',
  description: '6대 법령 기반 컴플라이언스 AI 검토 시스템',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
