import { useId, useState } from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { avaliarSenha, SENHA_MAXIMO } from "@/lib/senha";

/** Campo de senha com botão de mostrar/ocultar (alvo de toque de 48px). */
export function CampoSenha({
  rotulo, valor, aoMudar, autoComplete, ajuda, erro, autoFocus, id: idExterno,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  ajuda?: string;
  erro?: string | null;
  autoFocus?: boolean;
  id?: string;
}) {
  const idGerado = useId();
  const id = idExterno ?? idGerado;
  const [mostrar, setMostrar] = useState(false);
  return (
    <div>
      <Label htmlFor={id}>{rotulo}</Label>
      <div className="relative">
        <Input
          id={id}
          type={mostrar ? "text" : "password"}
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          autoComplete={autoComplete}
          maxLength={SENHA_MAXIMO}
          required
          autoFocus={autoFocus}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${id}-erro` : ajuda ? `${id}-ajuda` : undefined}
          className="pr-14"
        />
        <button
          type="button"
          onClick={() => setMostrar((m) => !m)}
          className="absolute right-0.5 top-0.5 grid size-11 place-items-center rounded-[9px] text-muted-foreground hover:text-foreground"
          aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={mostrar}
        >
          {mostrar ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      </div>
      {erro ? (
        <p id={`${id}-erro`} className="mt-1.5 flex items-center gap-1.5 text-sm font-bold text-alerta"><X className="size-4 shrink-0" />{erro}</p>
      ) : ajuda ? (
        <p id={`${id}-ajuda`} className="mt-1.5 text-sm text-muted-foreground">{ajuda}</p>
      ) : null}
    </div>
  );
}

/** Lista das regras da senha nova, marcando o que já foi cumprido enquanto a pessoa digita. */
export function RegrasSenha({ senha, email }: { senha: string; email?: string | null }) {
  const { regras } = avaliarSenha(senha, email);
  return (
    <ul className="mt-2 grid gap-1 text-sm" aria-label="Regras da senha">
      {regras.map((r) => (
        <li key={r.id} className={`flex items-center gap-1.5 ${r.ok ? "text-primary" : "text-muted-foreground"}`}>
          {r.ok ? <Check className="size-4 shrink-0" /> : <X className="size-4 shrink-0" />}
          <span>{r.texto}</span>
          <span className="sr-only">{r.ok ? "(cumprida)" : "(ainda não)"}</span>
        </li>
      ))}
    </ul>
  );
}
