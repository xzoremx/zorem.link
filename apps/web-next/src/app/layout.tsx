import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
    title: 'Zorem - Private Stories for Informal Partners',
    description: 'Share ephemeral moments securely. Create private rooms, share stories, and let them disappear when the time is right.',
    icons: {
        icon: '/logo.png',
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link 
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600&family=JetBrains+Mono:wght@300;400&family=Instrument+Serif:ital@0;1&display=swap" 
                    rel="stylesheet" 
                />
            </head>
            <body className="antialiased overflow-x-hidden">
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
