import type { Metadata } from 'next';
import { Geist_Mono } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Prints',
  description: 'Lock tokens. Mint Prints.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={mono.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
