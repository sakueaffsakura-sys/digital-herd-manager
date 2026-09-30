import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Beef, Check, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import cattleImage from "@/assets/cattle-dashboard.jpg";
import cattleImageMobile from "@/assets/cattle-dashboard-800.webp";
import cattleImageWide from "@/assets/cattle-dashboard.webp";

export const Route = createFileRoute("/")({
  validateSearch: z.object({
    motivo: z.string().optional(),
    redirect: z.string().optional(),
  }),
  head: () => ({ meta: [
    { title: "Apecuária Digital | Gestão Pecuária" },
    { name: "description", content: "Controle seu rebanho, produção, vacinação e finanças em uma plataforma segura." },
    { property: "og:title", content: "Apecuária Digital" },
    { property: "og:description", content: "Gestão pecuária completa, moderna e segura." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: AuthPage,
});

function AuthPage(){
 const navigate=useNavigate();const {motivo,redirect:redirectVolta}=Route.useSearch();const [mode,setMode]=useState<"login"|"signup">("login");const [name,setName]=useState("");const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [show,setShow]=useState(false);const [loading,setLoading]=useState(false);
 useEffect(()=>{if(motivo==="sessao-expirada")toast.info("Sua sessão expirou. Faça login novamente.");if(motivo==="conta-bloqueada")toast.error("Esta conta foi bloqueada pelo administrador.")},[motivo]);
 useEffect(()=>{if(motivo==="conta-bloqueada")return;supabase.auth.getUser().then(({data})=>{if(data.user){if(redirectVolta)window.location.assign(decodeURIComponent(redirectVolta));else navigate({to:"/app/$section",params:{section:"inicio"}})}})},[navigate,redirectVolta,motivo]);
 const traduzir=(m:string)=>/invalid login/i.test(m)?"E-mail ou senha incorretos.":/already registered/i.test(m)?"Este e-mail já possui conta. Faça login.":/rate limit|too many/i.test(m)?"Muitas tentativas. Aguarde alguns minutos.":/pwned|weak|breach/i.test(m)?"Senha fraca ou vazada. Escolha outra.":m;
 const irParaApp=()=>{if(redirectVolta)window.location.assign(decodeURIComponent(redirectVolta));else navigate({to:"/app/$section",params:{section:"inicio"}})};
 const submit=async(e:FormEvent)=>{e.preventDefault();setLoading(true);try{if(mode==="signup"){const {data,error}=await supabase.auth.signUp({email,password,options:{data:{nome_completo:name}}});if(error)throw error;if(data.session){toast.success("Conta criada! Bem-vindo.");irParaApp()}else{const r=await supabase.auth.signInWithPassword({email,password});if(r.error)throw r.error;toast.success("Conta criada! Bem-vindo.");irParaApp()}}else{const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;irParaApp()}}catch(e){toast.error(traduzir(e instanceof Error?e.message:"Não foi possível entrar")) }finally{setLoading(false)}};
 const google=async()=>{const result=await lovable.auth.signInWithOAuth("google",{redirect_uri:window.location.origin});if(result.error)toast.error(result.error.message)};
 return <main className="dark relative min-h-screen overflow-hidden bg-background text-foreground"><img src={cattleImage} srcSet={`${cattleImageWide} 1600w, ${cattleImageMobile} 800w`} sizes="100vw" width={1600} height={608} alt="Rebanho em pastagem" className="absolute inset-0 h-full w-full object-cover opacity-35"/><div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/45"/><div className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-14 px-5 py-10 lg:grid-cols-[1.2fr_.8fr] lg:px-10"><section className="max-w-2xl"><div className="mb-10 flex items-center gap-3"><div className="grid size-12 place-items-center rounded-md bg-primary text-primary-foreground"><Beef className="size-7"/></div><div><span className="block text-xl font-bold">Apecuária</span><span className="text-xs font-bold uppercase text-primary">Digital</span></div></div><h1 className="text-4xl font-bold leading-tight sm:text-6xl">Sua propriedade,<br/><span className="text-primary">sob controle.</span></h1><p className="mt-5 max-w-lg text-base text-foreground/70">Rebanho, sanidade, produção e resultados financeiros reunidos em uma gestão segura.</p><ul className="mt-8 grid gap-3 text-sm text-foreground/80 sm:grid-cols-2">{["Dados reais e protegidos","Indicadores sempre atualizados","Controle em qualquer dispositivo","Histórico completo do rebanho"].map(x=><li key={x} className="flex items-center gap-2"><span className="grid size-5 place-items-center rounded-full bg-primary/15 text-primary"><Check className="size-3"/></span>{x}</li>)}</ul></section><section className="w-full max-w-md justify-self-end rounded-lg border border-border bg-card/95 p-6 shadow-2xl backdrop-blur sm:p-8"><div className="mb-6"><p className="text-xs font-bold uppercase text-primary">Bem-vindo</p><h2 className="mt-1 text-2xl font-bold">{mode==="login"?"Acesse sua conta":"Crie sua conta"}</h2><p className="mt-1 text-sm text-muted-foreground">{mode==="login"?"Entre para gerenciar sua propriedade.":"Comece a organizar sua operação."}</p></div><form onSubmit={submit} className="space-y-4">{mode==="signup"&&<div><Label>Nome completo</Label><Input required value={name} onChange={e=>setName(e.target.value)} placeholder="Seu nome"/></div>}<div><Label>E-mail</Label><Input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@exemplo.com"/></div><div><Label>Senha</Label><div className="relative"><Input required minLength={8} type={show?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} className="pr-10"/><Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" onClick={()=>setShow(!show)} aria-label={show?"Ocultar senha":"Mostrar senha"}>{show?<EyeOff/>:<Eye/>}</Button></div></div><Button className="h-11 w-full" disabled={loading}>{loading?<LoaderCircle className="animate-spin"/>:mode==="login"?"Entrar":"Criar conta"}</Button></form><div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border"/>ou continue com<span className="h-px flex-1 bg-border"/></div><Button variant="outline" className="h-11 w-full" onClick={google}><span className="text-base font-bold">G</span>Google</Button><p className="mt-6 text-center text-sm text-muted-foreground">{mode==="login"?"Ainda não possui conta?":"Já possui uma conta?"} <button className="font-semibold text-primary hover:underline" onClick={()=>setMode(mode==="login"?"signup":"login")}>{mode==="login"?"Cadastre-se":"Entrar"}</button></p></section></div></main>
}
