/** Brinco grande desenhado (tela de entrar): o brinco amarelo de identificação, com o pino no alto. */
export function BrincoIlustrado({ className, numero = "001" }: { className?: string; numero?: string }) {
  return (
    <svg viewBox="0 0 240 300" role="img" aria-label="Brinco amarelo de identificação do gado" className={className}>
      {/* pino macho que atravessa a orelha */}
      <ellipse cx="120" cy="30" rx="22" ry="20" fill="#e3b40f" stroke="#c99a00" strokeWidth="4" />
      <circle cx="120" cy="30" r="9" fill="#c99a00" />
      {/* corpo do brinco */}
      <path
        d="M88 34Q88 18 104 18H136Q152 18 152 34V56Q152 68 168 72L210 82Q232 88 232 110V262Q232 290 204 290H36Q8 290 8 262V110Q8 88 30 82L72 72Q88 68 88 56Z"
        fill="#f2c318"
        stroke="#c99a00"
        strokeWidth="5"
      />
      <ellipse cx="120" cy="44" rx="13" ry="11" fill="none" stroke="#c99a00" strokeWidth="4" />
      {/* faixa de gravação, como nos brincos de verdade */}
      <rect x="34" y="118" width="172" height="10" rx="5" fill="#c99a00" opacity="0.35" />
      <text x="120" y="232" textAnchor="middle" fontFamily="'Big Shoulders Display','Big Shoulders','Arial Narrow',sans-serif" fontWeight="800" fontSize="104" fill="#15231a">
        {numero}
      </text>
    </svg>
  );
}
