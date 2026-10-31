import type { ReactNode } from "react";

/**
 * O brinco amarelo de identificação do gado — elemento-assinatura do visual.
 * Use SÓ em dois lugares: os indicadores principais do Início (tamanho "grande")
 * e o número do brinco do animal nas listas e na ficha (tamanho "pequeno").
 */
const CONTORNO =
  "M36 7Q36 1 42 1H58Q64 1 64 7V17Q64 23 71 25L89 30Q98 33 98 42V103Q98 115 86 115H14Q2 115 2 103V42Q2 33 11 30L29 25Q36 23 36 17Z";

type Props = {
  valor: ReactNode;
  legenda?: ReactNode;
  tamanho?: "grande" | "pequeno";
  /** Balança uma vez ao aparecer (só no Início). */
  balancar?: boolean;
  atrasoMs?: number;
  /** Texto para leitor de tela quando o número sozinho não diz o que é. */
  rotulo?: string;
  className?: string;
};

function tamanhoDoTexto(texto: string, grande: boolean) {
  const n = texto.length;
  if (!grande) return n > 6 ? "text-[0.8rem]" : n > 4 ? "text-[0.9rem]" : "text-base";
  return n > 6 ? "text-[1.6rem]" : n > 4 ? "text-[2.1rem]" : "text-[2.75rem]";
}

export function Brinco({ valor, legenda, tamanho = "grande", balancar, atrasoMs = 0, rotulo, className }: Props) {
  const grande = tamanho === "grande";
  const bruto = typeof valor === "string" || typeof valor === "number" ? String(valor) : "";
  // Brinco comprido (SISBOV, códigos de importação): mostra o fim, que é o que diferencia; o número todo fica no título.
  const longo = !grande && bruto.length > 8;
  const texto = longo ? `…${bruto.slice(-6)}` : bruto;
  return (
    <span className={`inline-flex flex-col items-center ${className ?? ""}`}>
      <span
        role={rotulo ? "img" : undefined}
        aria-label={rotulo}
        title={longo ? bruto : undefined}
        className={`relative inline-grid place-items-center ${grande ? "h-[7.25rem] w-[6.25rem]" : "h-11 min-w-10 px-1"} ${balancar ? "brinco-balanca" : ""}`}
        style={balancar ? { animationDelay: `${atrasoMs}ms`, transformOrigin: "50% 6%" } : undefined}
      >
        <svg aria-hidden viewBox="0 0 100 116" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          <path d={CONTORNO} fill="var(--brinco)" stroke="var(--brinco-borda)" strokeWidth={grande ? 2.5 : 1.5} vectorEffect="non-scaling-stroke" />
          <ellipse cx="50" cy="11" rx="5.5" ry="4.8" fill="var(--background)" stroke="var(--brinco-borda)" strokeWidth={grande ? 2 : 1.25} vectorEffect="non-scaling-stroke" />
        </svg>
        <span
          aria-hidden={rotulo ? true : undefined}
          className={`relative font-display font-extrabold leading-none tabular-nums text-[var(--brinco-tinta)] ${grande ? "mt-7" : "mt-3"} ${tamanhoDoTexto(texto, grande)}`}
        >
          {longo ? texto : valor}
        </span>
      </span>
      {legenda && <span className={`mt-2 text-center text-sm leading-tight text-muted-foreground ${grande ? "max-w-[9rem]" : ""}`}>{legenda}</span>}
    </span>
  );
}
