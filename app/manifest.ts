/* app/manifest.ts — スマホのホーム画面に追加したときの名前・アイコン・色 */

import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ふたば保育園 給食・食育ポータル',
    /* ホーム画面のアイコンの下に出る名前（短くないと途中で切れる） */
    short_name: 'ふたば給食',
    description: 'ふたば保育園の給食の献立・食育の記録・おやすみの連絡',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#E2725B',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      /* Android は丸などに切り抜くので、絵を内側に小さく収めたものを別に用意する */
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
