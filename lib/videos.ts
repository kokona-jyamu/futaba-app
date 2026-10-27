/* lib/videos.ts — 食育の動画の決まり（画面とサーバーの両方で使う）
 *
 * 動画は非公開の保存場所（school-videos）に置き、URL を知っていても見られないようにする。
 * 見るときは、同じ園の保護者・職員にだけ、時間で切れる再生用の URL をサーバーが発行する。
 */

export const VIDEO_BUCKET = 'school-videos'

/**
 * 1本の大きさの上限（MB）。
 * Supabase の無料プランは1ファイル 50MB まで。有料プランにしたら、
 * ここと保存場所（school-videos）の file_size_limit を一緒に上げる。
 */
export const VIDEO_MAX_MB = 50

/** 受け付ける動画の拡張子（iPhone は mov） */
export const VIDEO_EXTENSIONS = ['mp4', 'mov', 'm4v', 'webm']

/** 再生用の URL が使える時間（秒）。見ている途中で切れないよう、少し長めにする */
export const VIDEO_URL_SECONDS = 30 * 60

export const videoExtOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? ''

/** 拡張子から動画の種類を決める（ブラウザが種類を教えてくれないときに使う） */
export const VIDEO_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  webm: 'video/webm',
}
