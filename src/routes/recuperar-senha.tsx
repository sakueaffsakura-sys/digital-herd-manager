import { useState, type FormEvent } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { LoaderCircle, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaginaPublica } from "@/components/publico/PaginaPublica";

export const Route = createFileRoute("/recuperar-senha")({
  head: () => ({ meta: [{ title: "Recuperar a senha | Pecuária Digital" }, { name: "robots", content: "noindex" }] }),
  component: RecuperarSenha,
});

function RecuperarSenha() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/public/conta/recuperar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email.trim() }) });
      const corpo = (await r.json().catch(() => ({}))) as { mensagem?: string; erro?: string };
      if (!r.ok) setErro(corpo.erro ?? "Não foi possível enviar agora. Tente de novo.");
      else setMensagem(corpo.mensagem ?? "Se houver uma conta com este e-mail, enviamos o link.");
    } catch {
      setErro("Sem conexão. Confira a internet e tente de novo.");
    } finally {
      setEnviando(false);
    }
  };
  return (
    <PaginaPublica titulo="Recuperar a senha" subtitulo="Digite o e-mail do cadastro. Vamos mandar um link para você criar uma senha nova." largura="formulario">
      {mensagem ? (
        <div role="status" className="painel p-5">
          <MailCheck className="size-8 text-primary" />
          <p className="mt-3 font-bold">{mensagem}</p>
          <p className="mt-2 text-muted-foreground">O link vale por pouco tempo e funciona uma vez só. Não chegou em alguns minutos? Peça de novo.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="outline" className="h-12" onClick={() => setMensagem(null)}>Pedir de novo</Button>
            <Button asChild className="h-12"><Link to="/">Voltar para entrar</Link></Button>
          </div>
        </div>
      ) : (
        <form onSubmit={enviar} noValidate className="space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" inputMode="email" autoComplete="email" autoFocus required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" aria-invalid={erro ? true : undefined} aria-describedby={erro ? "erro-rec" : undefined} />
          </div>
          {erro && <p id="erro-rec" role="alert" className="font-bold text-alerta">{erro}</p>}
          <Button type="submit" className="h-12 w-full text-base" disabled={enviando || !email.includes("@")}>{enviando ? <LoaderCircle className="animate-spin" /> : "Enviar o link"}</Button>
          <p className="text-center"><Link to="/" className="font-bold text-primary underline underline-offset-4">Lembrei a senha</Link></p>
        </form>
      )}
    </PaginaPublica>
  );
}
