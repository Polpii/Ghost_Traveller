import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Inter, Caveat, Kalam, Dancing_Script, Playfair_Display, Klee_One } from 'next/font/google';
import './globals.css';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
});

const klee = Klee_One({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-hand',
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${playfair.variable} ${klee.variable} ${inter.variable} ${caveat.variable} ${kalam.variable} ${dancingScript.variable}`}
    >
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
