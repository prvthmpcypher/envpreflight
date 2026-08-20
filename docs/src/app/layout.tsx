import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'envpreflight — Zero-config dev environment health checker',
  description:
    'Check your machine can actually run this project — before you waste a day finding out it cannot. Zero network calls, key privacy guarantee, sub-3s runtime.',
  keywords: [
    'developer tools',
    'environment checker',
    'preflight',
    'cli',
    'docker check',
    'node version',
    'python version',
    'vscode extension',
    'mcp server',
  ],
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
    other: { rel: 'icon', url: '/favicon.png', sizes: '32x32', type: 'image/png' },
  },
  openGraph: {
    title: 'envpreflight — Know whether the repository can run',
    description: 'Check runtimes, services, Docker, ports, and environment keys before setup becomes debugging.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'envpreflight scan report' }],
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
