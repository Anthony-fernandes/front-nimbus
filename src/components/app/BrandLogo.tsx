/**
 * Logo oficial do NimbusDesk: letra "N" com headset (fone + microfone)
 * em gradiente azul → roxo. Recriada em SVG para escalar em qualquer tamanho.
 */
export function BrandLogo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={className}
      role="img"
      aria-label="NimbusDesk"
      fill="none"
    >
      <defs>
        <linearGradient id="nimbus-logo-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>
      </defs>

      {/* Headband (arco do fone) */}
      <path
        d="M74 268 A182 182 0 1 1 438 268"
        stroke="url(#nimbus-logo-grad)"
        strokeWidth="38"
        strokeLinecap="round"
      />

      {/* Haste do microfone */}
      <path
        d="M92 330 Q110 462 288 466"
        stroke="url(#nimbus-logo-grad)"
        strokeWidth="24"
        strokeLinecap="round"
      />
      {/* Cápsula do microfone */}
      <rect x="272" y="440" width="76" height="52" rx="26" fill="url(#nimbus-logo-grad)" />

      {/* Conchas (ear cups) */}
      <rect x="42" y="222" width="72" height="128" rx="26" fill="url(#nimbus-logo-grad)" />
      <rect x="398" y="222" width="72" height="128" rx="26" fill="url(#nimbus-logo-grad)" />

      {/* Letra N */}
      <path
        d="M162 168 h56 l82 142 v-142 h56 v226 h-56 l-82 -142 v142 h-56 z"
        fill="url(#nimbus-logo-grad)"
      />
    </svg>
  );
}
