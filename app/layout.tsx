import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './globals.css';

import React from 'react';
import {
  ColorSchemeScript,
  mantineHtmlProps,
  MantineProvider,
} from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { theme } from '../theme';

export const metadata = {
  title: 'AI Interview Coach',
  description:
    'An AI-powered Interview Coach app built for AIAugust App a Day Challenge',
};

export default function RootLayout({ children }: { children: any }) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
        <link rel="shortcut icon" href="/favicon.svg" />
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width, user-scalable=no"
        />
      </head>
      <body>
        <MantineProvider theme={theme}>
          <Notifications position="top-center" limit={3} />
          <a href="#main" className="skip-link">
            Skip to main content
          </a>
          <main id="main" tabIndex={-1}>
            {children}
          </main>
        </MantineProvider>
      </body>
    </html>
  );
}
