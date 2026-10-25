/* components/Icon.tsx — Google の Material Symbols のアイコン（Apache License 2.0）
 *
 * 絵文字は端末によって絵柄が変わるため、画面の印にはこのアイコンを使う。
 * 形のデータ（SVG のパス）を直接持つので、外部からの読み込みはない。
 * 色は周りの文字の色（currentColor）になる。
 *
 * アイコンを足すときは、https://fonts.google.com/icons の「Outlined・Weight 400」の
 * SVG から d 属性の値をコピーして、PATHS に加える。
 */

const PATHS = {
  check: 'M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z',
  chevron_right: 'M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z',
  /* いいね（塗り・線） */
  favorite: 'm480-120-58-52q-101-91-167-157T150-447.5Q111-500 95.5-544T80-634q0-94 63-157t157-63q52 0 99 22t81 62q34-40 81-62t99-22q94 0 157 63t63 157q0 46-15.5 90T810-447.5Q771-395 705-329T538-172l-58 52Z',
  favorite_border: 'm480-120-58-52q-101-91-167-157T150-447.5Q111-500 95.5-544T80-634q0-94 63-157t157-63q52 0 99 22t81 62q34-40 81-62t99-22q94 0 157 63t63 157q0 46-15.5 90T810-447.5Q771-395 705-329T538-172l-58 52Zm0-108q96-86 158-147.5t98-107q36-45.5 50-81t14-70.5q0-60-40-100t-100-40q-47 0-87 26.5T518-680h-76q-15-41-55-67.5T300-774q-60 0-100 40t-40 100q0 35 14 70.5t50 81q36 45.5 98 107T480-228Zm0-273Z',
  /* お気に入り（塗り・線） */
  star: 'm233-80 65-281L80-550l288-25 112-265 112 265 288 25-218 189 65 281-247-149L233-80Z',
  star_border: 'm354-287 126-76 126 77-33-144 111-96-146-13-57-136-57 135-146 13 111 97-33 143ZM233-80l65-281L80-550l288-25 112-265 112 265 288 25-218 189 65 281-247-149L233-80Zm247-350Z',
  /* 電話 */
  call: 'M798-120q-125 0-247-54.5T329-329Q229-429 174.5-551T120-798q0-18 12-30t30-12h162q14 0 25 9.5t13 22.5l26 140q2 16-1 27t-11 19l-97 98q20 37 47.5 71.5T387-386q31 31 65 57.5t72 48.5l94-94q9-9 23.5-13.5T670-390l138 28q14 4 23 14.5t9 23.5v162q0 18-12 30t-30 12ZM241-600l66-66-17-94h-89q5 41 14 81t26 79Zm358 358q39 17 79.5 27t81.5 13v-88l-94-19-67 67ZM241-600Zm358 358Z',
} as const

export type IconName = keyof typeof PATHS

export default function Icon({
  name,
  size = 18,
  className,
  label,
}: {
  name: IconName
  size?: number
  className?: string
  /** 読み上げ用の名前。飾りのアイコンなら付けない */
  label?: string
}) {
  return (
    <svg
      viewBox="0 -960 960 960"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
