import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/resgate")({
  head: () => ({
    meta: [
      { title: "Resgate da manutenção — Pecuária Digital" },
      { name: "description", content: "Desligar o modo de manutenção com a chave de resgate do administrador." },
      { property: "og:title", content: "Resgate da manutenção — Pecuária Digital" },
      { property: "og:description", content: "Acesso de emergência do administrador." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Resgate,
});

function Resgate() {
  const [chave, setChave] = useState("");
  const [estado, setEstado] = useState<{ ok: boolean; msg: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const r = await fetch("/api/public/resgate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chave }) });
      const j = (await r.json().catch(() => ({}))) as { erro?: string };
      setEstado(r.ok ? { ok: true, msg: "Manutenção desligada. O site já está liberado." } : { ok: false, msg: j.erro ?? "Não foi possível concluir." });
    } catch {
      setEstado({ ok: false, msg: "Sem conexão. Tente de novo." });
    } finally { setEnviando(false); setChave(""); }
  }
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <form onSubmit={enviar} className="painel w-full max-w-md space-y-4 p-6">
        <h1 className="text-xl font-semibold">Resgate da manutenção</h1>
        <p className="text-muted-foreground">Cole a chave de resgate cadastrada no painel para desligar a manutenção.</p>
        <div className="space-y-2">
          <Label htmlFor="chave">Chave de resgate</Label>
          <Input id="chave" type="password" autoComplete="off" value={chave} onChange={(e) => setChave(e.target.value)} required />
        </div>
        <Button type="submit" disabled={enviando || !chave} className="w-full">{enviando ? "Conferindo…" : "Desligar manutenção"}</Button>
        {estado && <p role="status" className={estado.ok ? "text-primary" : "text-destructive"}>{estado.msg}</p>}
        <Link to="/" className="block text-center text-muted-foreground underline">Voltar para a entrada</Link>
      </form>
    </main>
  );
}
