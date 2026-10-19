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
