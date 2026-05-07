import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter, Caveat, Kalam, Dancing_Script } from 'next/font/google';
import './globals.css';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-serif',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const caveat = Caveat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-handwriting',
});

const kalam = Kalam({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  variable: '--font-cursive',
});

const dancingScript = Dancing_Script({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-script',
});

export const metadata: Metadata = {
  title: 'Ghost Traveller',
  description:
    'Receive a postcard from your Ghost — a parallel version of you, writing back from somewhere in the world.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${inter.variable} ${caveat.variable} ${kalam.variable} ${dancingScript.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
