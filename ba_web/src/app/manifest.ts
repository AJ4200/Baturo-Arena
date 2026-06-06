import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Baturo Arena',
    short_name: 'Baturo',
    description: 'Play online, local, CPU, and solo games together in one arcade arena.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#071522',
    theme_color: '#0c584a',
    orientation: 'any',
    categories: ['games', 'entertainment'],
    icons: [
      {
        src: '/api/app-icon?size=192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/api/app-icon?size=512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/api/app-icon?size=512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
