export function Mascot({ mood = 'happy', size = 84 }: { mood?: 'happy' | 'think'; size?: number }) {
  return (
    <svg className={`mascot ${mood}`} width={size} height={size} viewBox="0 0 120 120" aria-hidden>
      <defs>
        <radialGradient id="mg" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fff3ff" />
          <stop offset="45%" stopColor="#f6a8ff" />
          <stop offset="100%" stopColor="#a259ff" />
        </radialGradient>
      </defs>
      <path
        d="M60 8c26 0 46 20 46 47 0 20-6 33-6 45 0 8-7 12-12 7-4-4-7-4-10 1-4 6-10 6-14 0-3-5-7-5-10 0-4 6-10 6-13-1-3-5-6-5-10-1-5 5-12 1-12-7 0-12-5-25-5-44C14 28 34 8 60 8z"
        fill="url(#mg)"
        stroke="#fff"
        strokeWidth="4"
      />
      <ellipse cx="40" cy="30" rx="10" ry="6" fill="#fff" opacity=".7" transform="rotate(-25 40 30)" />
      {mood === 'think' ? (
        <>
          <path d="M38 58q6-6 12 0" stroke="#4a1773" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M70 58q6-6 12 0" stroke="#4a1773" strokeWidth="5" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="44" cy="56" rx="6" ry="8" fill="#3b0f63" />
          <ellipse cx="76" cy="56" rx="6" ry="8" fill="#3b0f63" />
          <circle cx="46" cy="53" r="2.4" fill="#fff" />
          <circle cx="78" cy="53" r="2.4" fill="#fff" />
        </>
      )}
      <ellipse cx="32" cy="70" rx="8" ry="5" fill="#ff7ad9" opacity=".7" />
      <ellipse cx="88" cy="70" rx="8" ry="5" fill="#ff7ad9" opacity=".7" />
      <path d="M53 70q7 7 14 0" stroke="#3b0f63" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  )
}
