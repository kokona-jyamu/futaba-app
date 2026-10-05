/* components/AdminImg.tsx — 管理画面用の画像（next/image を使わない）
 *
 * 管理画面では次の理由で、最適化しない素の <img> を使う。
 *  - 選んだファイルのプレビューは blob: の一時URLで、next/image では最適化できない
 *  - 一覧の写真は職員しか見ないので、画像変換の手間（費用）をかけるほどではない
 *
 * 保護者が見る画面では next/image を使うこと。
 */

import type { ImgHTMLAttributes } from 'react'

export default function AdminImg({ alt, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  // eslint-disable-next-line @next/next/no-img-element -- 上のコメントの理由で素の img を使う
  return <img alt={alt ?? ''} {...props} />
}
