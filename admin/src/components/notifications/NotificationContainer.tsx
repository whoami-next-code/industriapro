'use client';

import { Toaster } from 'react-hot-toast';

export default function NotificationContainer() {
  return (
    <Toaster
      position="top-right"
      reverseOrder={false}
      gutter={8}
      toastOptions={{
        duration: 4000,
        style: {
          background: '#ffffff',
          color: '#1f2a37',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          boxShadow: '0 10px 25px rgba(15, 23, 42, 0.12)',
        },
        success: {
          duration: 3000,
          iconTheme: {
            primary: '#7fd1c8',
            secondary: '#0f172a',
          },
        },
        error: {
          duration: 4000,
          iconTheme: {
            primary: '#fca5a5',
            secondary: '#0f172a',
          },
        },
      }}
    />
  );
}
