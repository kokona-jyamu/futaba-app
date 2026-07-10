type AllergenData = { [key: string]: boolean }

const ALLERGENS_8 = [
  { key: 'egg',      label: '卵',     emoji: '🥚' },
  { key: 'milk',     label: '乳',     emoji: '🥛' },
  { key: 'wheat',    label: '小麦',   emoji: '🌾' },
  { key: 'buckwheat',label: 'そば',   emoji: '🍜' },
  { key: 'peanut',   label: '落花生', emoji: '🥜' },
  { key: 'shrimp',   label: 'えび',   emoji: '🦐' },
  { key: 'crab',     label: 'かに',   emoji: '🦀' },
  { key: 'walnut',   label: 'くるみ', emoji: '🌰' },
  { key: 'cashew',   label: 'カシュー', content: 'https://tpqocjthnpesuytfgnek.supabase.co/storage/v1/object/public/menu-photos/cashew.png', isImg: true },
]

type Props = {
  allergens: AllergenData | null
  size?: 'sm' | 'md'
}

export default function AllergenBadges({ allergens, size = 'md' }: Props) {
  const isSmall = size === 'sm'

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: isSmall ? '4px' : '6px' }}>
      {ALLERGENS_8.map(a => {
        const active = allergens?.[a.key] === true
        return (
          <div
            key={a.key}
            title={a.label}
            style={{
              width:  isSmall ? '36px' : '48px',
              height: isSmall ? '36px' : '48px',
              borderRadius: '50%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? '#FFF0E6' : '#f0f0f0',
              border: `2px solid ${active ? '#BA7517' : '#e0e0e0'}`,
              opacity: active ? 1 : 0.4,
              transition: 'all .15s',
            }}
          >
            <span style={{ fontSize: isSmall ? '14px' : '18px' }}>{a.emoji}</span>
            <span style={{
              fontSize: '9px',
              color: active ? '#BA7517' : '#999',
              fontWeight: active ? 'bold' : 'normal',
              marginTop: '1px',
              lineHeight: 1,
            }}>
              {a.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}