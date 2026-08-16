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
