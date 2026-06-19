export default function manifest() {
  return {
    name: 'Api2K - Universal AI Gateway',
    short_name: 'Api2K',
    description: 'One endpoint for all your AI providers. Manage keys, monitor usage, and scale effortlessly.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0a0a0a',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icons/icon-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
      },
      {
        src: '/icons/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
      },
      {
        src: '/icons/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  }
}
