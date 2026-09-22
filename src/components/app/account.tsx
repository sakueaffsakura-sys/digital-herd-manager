import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CreditCard,
  Crown,
  ImagePlus,
  Lock,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  friendlyError,
  Empty,
  PageTitle,
  Panel,
  pretty,
} from "./shared";
import {
  avaliarPlano,
  formatarDataHora,
  planoTitulo,
  situacaoPlano,
  statusTitulo,
  PLANO_GRATUITO,
  type AssinaturaView,
  type Plano,
  type StatusAssinatura,
} from "@/lib/plan";
import {
  LIMITES_TEXTO,
  emailValido,
  normalizarUrl,
  sanitizarLinha,
  sanitizarTexto,
  telefoneValido,
  urlValida,
} from "@/lib/texto";
import {
  MAX_IMAGE_BYTES,
  prepararUpload,
  readableSize,
  recomendacoes,
  type TipoImagem,
} from "@/lib/image";

export const BUCKETS = {
  avatars: "profile-avatars",
  logos: "property-logos",
  banners: "property-banners",
  images: "property-images",
} as const;
type ImageBucket = (typeof BUCKETS)[keyof typeof BUCKETS];

export type PlanView = AssinaturaView;
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type PropertyProfileRow = Database["public"]["Tables"]["propriedade_perfil"]["Row"];
type AuditRow = Database["public"]["Tables"]["plano_auditoria"]["Row"];

export const RECURSOS_PREMIUM = [
  "Importação em massa de registros",
  "Exportação de dados (CSV)",
  "Logo da propriedade",
  "Banner personalizado da propriedade",
  "Foto de perfil da propriedade",
] as const;

export const RECURSOS_GRATUITOS = [
  "Registros ilimitados",
  "Foto de perfil do usuário",
  "Relatórios e diagnóstico",
  "Suporte da comunidade",
] as const;

// ---------------------------------------------------------------------------
// URLs assinadas (bucket privado) com cache em módulo.
// ---------------------------------------------------------------------------
const urlCache = new Map<string, { url: string; expires: number }>();

export async function getSignedUrl(
  bucket: ImageBucket,
  path: string,
  ttl = 3600,
): Promise<string> {
  const key = `${bucket}/${path}`;
  const hit = urlCache.get(key);
  if (hit && hit.expires > Date.now() + ttl * 1000 * 0.15) return hit.url;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ttl);
  if (error || !data?.signedUrl) throw error ?? new Error("URL da imagem indisponível.");
  urlCache.set(key, { url: data.signedUrl, expires: Date.now() + ttl * 1000 });
  return data.signedUrl;
}

export function StorageImage({
  bucket,
  path,
  alt,
  className,
  fallback,
}: {
  bucket: ImageBucket;
  path: string | null | undefined;
  alt: string;
  className?: string;
  fallback?: ReactNode;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    setFailed(false);
    if (!path || typeof window === "undefined") return;
    getSignedUrl(bucket, path)
      .then((u) => {
        if (alive) setUrl(u);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [bucket, path]);
  if (!path || failed) return <>{fallback}</>;
  if (!url) return <div className={cn("animate-pulse bg-muted", className)} />;
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}

export async function uploadWithProgress(opts: {
  bucket: ImageBucket;
  path: string;
  blob: Blob;
  onProgress?: (percent: number) => void;
}): Promise<void> {
  opts.onProgress?.(10);
  const { error } = await supabase.storage
    .from(opts.bucket)
    .upload(opts.path, opts.blob, {
      upsert: true,
      contentType: opts.blob.type || "image/webp",
    });
  if (error) throw error;
  opts.onProgress?.(100);
}

async function removeStorageObject(bucket: ImageBucket, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}

function useLocalUpload(kind: TipoImagem, bucket: ImageBucket, folder: string) {
  const [progress, setProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const run = async (
    file: File,
  ): Promise<{ ok: true; path: string } | { ok: false; motivo: string }> => {
    const prep = await prepararUpload(file, kind);
    if (!prep.ok) return prep;
    const ext =
      prep.blob.type === "image/webp"
        ? "webp"
        : prep.blob.type === "image/jpeg"
          ? "jpg"
          : "png";
    const path = `${folder}/${kind}.${ext}`;
    setUploading(true);
    setProgress(1);
    try {
      await uploadWithProgress({ bucket, path, blob: prep.blob, onProgress: setProgress });
      return { ok: true, path };
    } catch (err) {
      const causa = err instanceof Error ? err.message : "Erro desconhecido";
      if (/(bucket|storage|network)/i.test(causa)) {
        return {
          ok: false,
          motivo:
            "Não foi possível enviar a imagem. O armazenamento está indisponível; tente novamente em instantes.",
        };
      }
      if (/(size|limit)/i.test(causa)) {
        return {
          ok: false,
          motivo: "O arquivo excede o limite permitido pelo armazenamento.",
        };
      }
      return { ok: false, motivo: friendlyError(err) };
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };
  return { progress, uploading, run };
}

function Initials({ text, size = 36 }: { text?: string; size?: number }) {
  const parts = (text ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const label = parts.map((p) => p[0]?.toUpperCase()).join("") || "A";
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full bg-primary font-bold text-primary-foreground"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {label}
    </div>
  );
}

export function AvatarView({
  profile,
  size = 36,
  className,
}: {
  profile?: ProfileRow | null;
  size?: number;
  className?: string;
}) {
  const dim = { width: size, height: size };
  return (
    <div style={dim} className={cn("shrink-0", className)}>
      {profile?.avatar_url ? (
        <StorageImage
          bucket={BUCKETS.avatars}
          path={profile.avatar_url}
          alt="Foto de perfil"
          className="h-full w-full rounded-full object-cover"
          fallback={
            <Initials text={profile.nome_exibicao ?? profile.nome_completo} size={size} />
          }
        />
      ) : (
        <Initials
          text={profile?.nome_exibicao ?? profile?.nome_completo}
          size={size}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hooks de perfil e plano.
// ---------------------------------------------------------------------------
export function useMyProfile(userId?: string) {
  return useQuery({
    queryKey: ["my-profile", userId],
    enabled: !!userId,
    queryFn: async (): Promise<ProfileRow | null> => {
      if (!userId) return null;
      let { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        const { error: insErr } = await supabase
          .from("profiles")
          .insert({ id: userId } as never);
        if (insErr) throw insErr;
        const res = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        if (res.error) throw res.error;
        data = res.data;
      }
      return data;
    },
  });
}

export function usePropertyProfile(propertyId: string | null) {
  return useQuery({
    queryKey: ["property-profile", propertyId],
    enabled: !!propertyId,
    queryFn: async (): Promise<PropertyProfileRow | null> => {
      if (!propertyId) return null;
      const { data, error } = await supabase
        .from("propriedade_perfil")
        .select("*")
        .eq("propriedade_id", propertyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function usePlan(propertyId: string | null) {
  return useQuery({
    queryKey: ["plan", propertyId],
    enabled: !!propertyId,
    queryFn: async (): Promise<PlanView> => {
      if (!propertyId) return PLANO_GRATUITO;
      const { data, error } = await supabase.rpc("minha_assinatura", {
        _propriedade_id: propertyId,
      });
      if (error) {
        console.warn("[plano] assinatura indisponível, assumindo gratuito:", error.message);
        return PLANO_GRATUITO;
      }
      return {
        ...PLANO_GRATUITO,
        ...(data ?? {}),
      } as PlanView;
    },
  });
}

export function useCanManagePlans() {
  return useQuery({
    queryKey: ["can-manage-plans"],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("pode_gerenciar_planos");
      if (error) return false;
      return !!data;
    },
  });
}

export function useAudit(propertyId: string) {
  return useQuery({
    queryKey: ["plan-audit", propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plano_auditoria")
        .select("*")
        .eq("propriedade_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });
}

export function useSetPlanDemo(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["set-plan-demo", propertyId],
    mutationFn: async (args: {
      plano: Plano;
      status: StatusAssinatura;
      dataExpiracao?: string | null;
      motivo?: string | null;
    }) => {
      const { data, error } = await supabase.rpc("setar_plano_demonstracao", {
        _propriedade_id: propertyId,
        _plano: args.plano,
        _status: args.status,
        _data_expiracao: args.dataExpiracao ?? null,
        _motivo: args.motivo ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan", propertyId] });
      qc.invalidateQueries({ queryKey: ["plan-audit", propertyId] });
    },
  });
}

export function useCancelPlanDemo(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["cancel-plan-demo", propertyId],
    mutationFn: async (motivo?: string) => {
      const { data, error } = await supabase.rpc("cancelar_plano_demonstracao", {
        _propriedade_id: propertyId,
        _motivo: motivo ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan", propertyId] });
      qc.invalidateQueries({ queryKey: ["plan-audit", propertyId] });
    },
  });
}

// ---------------------------------------------------------------------------
// Selos.
// ---------------------------------------------------------------------------
export function PremiumBadge({ plan, compact = false }: { plan: PlanView; compact?: boolean }) {
  const r = avaliarPlano(plan);
  if (!r.premium_ativo) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#f59e0b]/15 px-2.5 py-1 text-[11px] font-bold uppercase text-[#f59e0b]">
      <Crown className="size-3.5" />
      {!compact && "Premium"}
      {!!plan.demonstracao && <span title="Modo demonstração">· demo</span>}
    </span>
  );
}

export function DemoSeal({ plan }: { plan: PlanView }) {
  if (!plan?.demonstracao) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-2 py-1 text-[10px] font-bold uppercase text-[#f59e0b]"
      title="Ativado sem cobrança, para avaliação"
    >
      <Sparkles className="size-3.5" />
      Premium de demonstração
    </span>
  );
}

export function PremiumLock({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid h-full min-h-56 place-items-center rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
          <Lock className="size-6" />
        </div>
        <strong className="block">{title}</strong>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cabeçalho com avatar + nome + selo (usado no header do app).
// ---------------------------------------------------------------------------
export function HeaderAccount({
  userId,
  propertyId,
  onClick,
}: {
  userId?: string;
  propertyId?: string | null;
  onClick?: () => void;
}) {
  const profile = useMyProfile(userId);
  const plan = usePlan(propertyId ?? null);
  const name =
    profile.data?.nome_exibicao ||
    profile.data?.nome_completo ||
    (userId ? "Conta" : "");
  return (
    <Button variant="ghost" className="h-auto gap-2 px-2 py-1" onClick={onClick}>
      <AvatarView profile={profile.data ?? null} />
      <span className="hidden max-w-40 truncate text-sm font-medium md:block lg:max-w-52">
        {name}
      </span>
      <PremiumBadge plan={plan.data ?? PLANO_GRATUITO} compact />
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Banner visual da propriedade (usado no Dashboard e na página de perfil).
// ---------------------------------------------------------------------------
const DEFAULT_BANNER = "/assets/property-banner-default.svg";

export function PropertyBanner({
  propertyId,
  className,
}: {
  propertyId: string;
  className?: string;
}) {
  const profile = usePropertyProfile(propertyId);
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <StorageImage
        bucket={BUCKETS.banners}
        path={profile.data?.banner_url}
        alt="Banner da propriedade"
        className="absolute inset-0 h-full w-full object-cover"
        fallback={
          <img
            src={DEFAULT_BANNER}
            alt="Banner padrão"
            className="absolute inset-0 h-full w-full object-cover"
          />
        }
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meu Perfil.
// ---------------------------------------------------------------------------
export function MyProfilePage({ userId, email }: { userId: string; email?: string }) {
  const qc = useQueryClient();
  const profile = useMyProfile(userId);
  const p = profile.data ?? null;
  const [nome, setNome] = useState("");
  const [exibicao, setExibicao] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cargo, setCargo] = useState("");
  const [biografia, setBiografia] = useState("");
  const [saving, setSaving] = useState(false);
  const avatar = useLocalUpload("avatar", BUCKETS.avatars, userId);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNome(p?.nome_completo ?? "");
    setExibicao(p?.nome_exibicao ?? "");
    setTelefone(p?.telefone ?? "");
    setCargo(p?.cargo ?? "");
    setBiografia(p?.biografia ?? "");
  }, [p]);

  const pickAvatar = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const res = await avatar.run(file);
    if (!res.ok) {
      toast.error(res.motivo);
      return;
    }
    const { error } = await supabase.from("profiles").update({ avatar_url: res.path }).eq("id", userId);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success("Foto de perfil atualizada.");
    qc.invalidateQueries({ queryKey: ["my-profile", userId] });
  };

  const removeAvatar = async () => {
    const current = p?.avatar_url;
    if (!current) return;
    const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    await removeStorageObject(BUCKETS.avatars, current).catch(() => undefined);
    qc.invalidateQueries({ queryKey: ["my-profile", userId] });
    toast.success("Foto de perfil removida.");
  };

  const save = async () => {
    const nomeLimp = sanitizarLinha(nome, LIMITES_TEXTO.nome);
    const exibicaoLimp = sanitizarLinha(exibicao, LIMITES_TEXTO.exibicao);
    const cargoLimp = sanitizarLinha(cargo, LIMITES_TEXTO.cargo);
    const biografiaLimp = sanitizarTexto(biografia, LIMITES_TEXTO.biografia);
    const telefoneLimp = sanitizarLinha(telefone, LIMITES_TEXTO.telefone);
    if (!nomeLimp) {
      toast.error("Informe seu nome completo.");
      return;
    }
    if (!telefoneValido(telefoneLimp)) {
      toast.error("Telefone inválido. Use um número com DDD, ex.: (00) 00000-0000.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        nome_completo: nomeLimp,
        nome_exibicao: exibicaoLimp || null,
        cargo: cargoLimp || null,
        telefone: telefoneLimp || null,
        biografia: biografiaLimp || null,
      })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success("Alterações salvas com sucesso.");
    qc.invalidateQueries({ queryKey: ["my-profile", userId] });
  };

  return (
    <div className="space-y-5">
      <PageTitle icon={UserRound} title="Meu Perfil" description="Dados pessoais, foto e forma de exibição no aplicativo." />
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-semibold">Foto de perfil</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Disponível em todos os planos. PNG, JPG ou WebP até{" "}
            {readableSize(MAX_IMAGE_BYTES)}.
          </p>
          <div className="mt-5 flex justify-center">
            <div className="relative">
              {avatar.uploading && (
                <span className="absolute -inset-1 grid place-items-center rounded-full bg-background/70">
                  <span className="text-xs font-bold">{avatar.progress ?? 0}%</span>
                </span>
              )}
              <AvatarView profile={p} size={96} />
            </div>
          </div>
          <div className="mt-5 space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={pickAvatar}
            />
            <Button
              variant="outline"
              className="w-full"
              disabled={avatar.uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload /> {avatar.uploading ? "Enviando…" : "Alterar foto"}
            </Button>
            {p?.avatar_url && (
              <Button variant="ghost" className="w-full text-muted-foreground" onClick={removeAvatar}>
                <Trash2 /> Remover foto
              </Button>
            )}
            {avatar.uploading && <Progress value={avatar.progress ?? 0} />}
          </div>
          <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
            Recomendado: quadrado, {recomendacoes.avatar.w}×{recomendacoes.avatar.h}px. A
            imagem é convertida automaticamente para WebP.
          </p>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-semibold">Dados pessoais</h2>
          {profile.isLoading && (
            <p className="mt-3 text-sm text-muted-foreground">Carregando perfil…</p>
          )}
          {profile.isError && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              Não foi possível carregar os dados do perfil. Tente novamente em instantes.
            </div>
          )}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Nome completo</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={LIMITES_TEXTO.nome} />
            </div>
            <div>
              <Label>Nome de exibição</Label>
              <Input
                value={exibicao}
                onChange={(e) => setExibicao(e.target.value)}
                maxLength={LIMITES_TEXTO.exibicao}
                placeholder="Como aparece no app"
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} maxLength={LIMITES_TEXTO.telefone} placeholder="(00) 00000-0000" />
            </div>
            <div>
              <Label>Cargo</Label>
              <Input value={cargo} onChange={(e) => setCargo(e.target.value)} maxLength={LIMITES_TEXTO.cargo} placeholder="Ex.: Médico veterinário" />
            </div>
            <div className="sm:col-span-2">
              <Label>Biografia</Label>
              <Textarea value={biografia} onChange={(e) => setBiografia(e.target.value)} maxLength={LIMITES_TEXTO.biografia} placeholder="Sobre você, experiência com pecuária…" />
            </div>
            <div className="sm:col-span-2 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
              <div>
                <Label>E-mail (conta)</Label>
                <Input value={email ?? ""} disabled />
              </div>
              <div>
                <Label>ID da conta</Label>
                <Input value={userId} disabled className="font-mono text-xs" />
              </div>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <Button onClick={save} disabled={saving || profile.isLoading}>
              <Save /> {saving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Perfil da Propriedade.
// ---------------------------------------------------------------------------
export function PropertyProfilePage({ propertyId }: { propertyId: string }) {
  const qc = useQueryClient();
  const profile = usePropertyProfile(propertyId);
  const p = profile.data ?? null;
  const planQuery = usePlan(propertyId);
  const premium = avaliarPlano(planQuery.data ?? PLANO_GRATUITO).premium_ativo;

  const [descricao, setDescricao] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [endereco, setEndereco] = useState("");
  const [website, setWebsite] = useState("");
  const [texto, setTexto] = useState("");
  const [saving, setSaving] = useState(false);

  const logo = useLocalUpload("logo", BUCKETS.logos, propertyId);
  const banner = useLocalUpload("banner", BUCKETS.banners, propertyId);
  const imagem = useLocalUpload("avatar", BUCKETS.images, propertyId);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setDescricao(p?.descricao ?? "");
    setTelefone(p?.telefone ?? "");
    setEmail(p?.email ?? "");
    setEndereco(p?.endereco ?? "");
    setWebsite(p?.website ?? "");
    setTexto(p?.texto_apresentacao ?? "");
  }, [p]);

  const upsert = async (patch: Partial<PropertyProfileRow>) => {
    const { data: existing } = await supabase
      .from("propriedade_perfil")
      .select("id")
      .eq("propriedade_id", propertyId)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("propriedade_perfil")
        .update(patch)
        .eq("id", existing.id);
      return error;
    }
    const { error } = await supabase.from("propriedade_perfil").insert({
      propriedade_id: propertyId,
      ...patch,
    } as never);
    return error;
  };

  const save = async () => {
    const descricaoLimp = sanitizarTexto(descricao, LIMITES_TEXTO.descricao);
    const telefoneLimp = sanitizarLinha(telefone, LIMITES_TEXTO.telefone);
    const emailLimp = sanitizarLinha(email, LIMITES_TEXTO.email);
    const enderecoLimp = sanitizarLinha(endereco, LIMITES_TEXTO.endereco);
    const websiteLimp = normalizarUrl(website);
    const textoLimp = sanitizarTexto(texto, LIMITES_TEXTO.texto);
    if (!telefoneValido(telefoneLimp)) {
      toast.error("Telefone inválido. Use um número com DDD.");
      return;
    }
    if (!emailValido(emailLimp)) {
      toast.error("E-mail inválido. Verifique o endereço informado.");
      return;
    }
    if (!urlValida(websiteLimp)) {
      toast.error("Website inválido. Use um endereço como https://….");
      return;
    }
    setSaving(true);
    const err = await upsert({
      descricao: descricaoLimp || null,
      telefone: telefoneLimp || null,
      email: emailLimp || null,
      endereco: enderecoLimp || null,
      website: websiteLimp || null,
      texto_apresentacao: textoLimp || null,
    });
    setSaving(false);
    if (err) {
      toast.error(friendlyError(err));
      return;
    }
    toast.success("Perfil da propriedade salvo.");
    qc.invalidateQueries({ queryKey: ["property-profile", propertyId] });
  };

  const guard = (recurso: string): boolean => {
    if (premium) return true;
    toast.error(`"${recurso}" é um recurso do plano Premium.`);
    return false;
  };

  const pickFile = async (
    kind: TipoImagem,
    upload: ReturnType<typeof useLocalUpload>,
    bucket: ImageBucket,
    file: File | undefined,
    col: "logo_url" | "banner_url" | "imagem_url",
    label: string,
  ) => {
    if (!file) return;
    if (!guard(label)) return;
    setBusy(label);
    const res = await upload.run(file);
    if (!res.ok) {
      setBusy(null);
      toast.error(res.motivo);
      return;
    }
    const err = await upsert({ [col]: res.path } as never);
    setBusy(null);
    if (err) {
      toast.error(friendlyError(err));
      return;
    }
    toast.success(`${label} atualizado.`);
    qc.invalidateQueries({ queryKey: ["property-profile", propertyId] });
  };

  const removeMedia = async (col: "logo_url" | "banner_url" | "imagem_url", label: string) => {
    const current = p?.[col];
    if (!current) return;
    if (!guard(label)) return;
    setBusy(label);
    const bucket: ImageBucket =
      col === "logo_url" ? BUCKETS.logos : col === "banner_url" ? BUCKETS.banners : BUCKETS.images;
    const err = await upsert({ [col]: null } as never);
    setBusy(null);
    if (err) {
      toast.error(friendlyError(err));
      return;
    }
    await removeStorageObject(bucket, current).catch(() => undefined);
    toast.success(`${label} removido.`);
    qc.invalidateQueries({ queryKey: ["property-profile", propertyId] });
  };

  const renderUpload = (
    label: string,
    col: "logo_url" | "banner_url" | "imagem_url",
    upload: ReturnType<typeof useLocalUpload>,
    bucket: ImageBucket,
    previewClass: string,
    fallback: ReactNode,
  ) => {
    const uploading = busy === label;
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <Label>{label}</Label>
          {!premium && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#f59e0b]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[#f59e0b]">
              <Lock className="size-3" /> Premium
            </span>
          )}
        </div>
        <div className={cn("mt-3 overflow-hidden rounded-md", previewClass)}>
          <StorageImage
            bucket={bucket}
            path={p?.[col]}
            alt={label}
            className="h-full w-full object-cover"
            fallback={fallback}
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            id={`file-${col}`}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void pickFile(kindFor(col), upload, bucket, file, col, label);
            }}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => document.getElementById(`file-${col}`)?.click()}
          >
            <ImagePlus /> {uploading ? "Enviando…" : "Escolher imagem"}
          </Button>
          {p?.[col] && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => removeMedia(col, label)}
            >
              <Trash2 /> Remover
            </Button>
          )}
        </div>
        {uploading && <Progress className="mt-2" value={upload.progress ?? 0} />}
      </div>
    );
  };

  const kindFor = (col: "logo_url" | "banner_url" | "imagem_url"): TipoImagem =>
    col === "banner_url" ? "banner" : col === "logo_url" ? "logo" : "avatar";

  return (
    <div className="space-y-5">
      <PageTitle
        icon={Building2}
        title="Perfil da Propriedade"
        description="Apresentação visual e dados de contato exibidos no app."
      />
      <PropertyBanner propertyId={propertyId} className="h-44 rounded-lg border border-border sm:h-56" />
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-semibold">Identidade visual</h2>
          <p className="mb-5 mt-1 text-xs text-muted-foreground">
            Logo, banner e foto da propriedade são recursos do plano Premium.
          </p>
          <div className="space-y-4">
            {renderUpload(
              "Banner da propriedade",
              "banner_url",
              banner,
              BUCKETS.banners,
              "h-32",
              <div className="grid h-full w-full place-items-center bg-muted text-xs text-muted-foreground">
                Sem banner
              </div>,
            )}
            {renderUpload(
              "Logo da propriedade",
              "logo_url",
              logo,
              BUCKETS.logos,
              "h-28",
              <div className="grid h-full w-full place-items-center bg-muted text-xs text-muted-foreground">
                Sem logo
              </div>,
            )}
            {renderUpload(
              "Foto de perfil da propriedade",
              "imagem_url",
              imagem,
              BUCKETS.images,
              "h-28",
              <div className="grid h-full w-full place-items-center bg-muted text-xs text-muted-foreground">
                Sem foto
              </div>,
            )}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-semibold">Apresentação e contato</h2>
          <div className="mt-5 grid gap-4">
            <div>
              <Label>Descrição</Label>
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={500} placeholder="História da propriedade, atividades…" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Telefone</Label>
                <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} maxLength={30} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} />
              </div>
              <div>
                <Label>Endereço</Label>
                <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} maxLength={200} />
              </div>
              <div>
                <Label>Website</Label>
                <Input value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={200} placeholder="https://…" />
              </div>
            </div>
            <div>
              <Label>Texto de apresentação</Label>
              <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2000} placeholder="Boas-vindas, diferenciais…" />
            </div>
          </div>
          <div className="mt-6">
            <Button onClick={save} disabled={saving}>
              <Save /> {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plano e Assinatura.
// ---------------------------------------------------------------------------
export function PlanPage({ propertyId }: { propertyId: string }) {
  const plan = usePlan(propertyId);
  const canManage = useCanManagePlans();
  const audit = useAudit(propertyId);
  const planStatus = plan.data ?? PLANO_GRATUITO;
  const r = avaliarPlano(planStatus);
  const situacao = situacaoPlano(planStatus);

  const [plano, setPlano] = useState<Plano>("premium");
  const [status, setStatus] = useState<StatusAssinatura>("ativo");
  const [expiracao, setExpiracao] = useState("");
  const [motivo, setMotivo] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const setDemo = useSetPlanDemo(propertyId);
  const cancelDemo = useCancelPlanDemo(propertyId);

  const expIso = expiracao ? new Date(`${expiracao}T23:59:59`).toISOString() : null;

  const applyPlan = () => {
    setConfirmOpen(false);
    setDemo.mutate(
      { plano, status, dataExpiracao: expIso, motivo: motivo.trim() || null },
      {
        onSuccess: () => toast.success("Plano atualizado no modo de demonstração."),
        onError: (e) => toast.error(friendlyError(e)),
      },
    );
  };

  const cancelPlan = () => {
    setConfirmCancel(false);
    cancelDemo.mutate(motivo.trim() || null, {
      onSuccess: () => toast.success("Demonstração cancelada."),
      onError: (e) => toast.error(friendlyError(e)),
    });
  };

  return (
    <div className="space-y-5">
      <PageTitle
        icon={CreditCard}
        title="Plano e Assinatura"
        description="Recursos liberados e gerenciamento do plano da sua conta."
      />

      <section className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold">{situacao.label}</h2>
              <DemoSeal plan={planStatus} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {r.premium_ativo
                ? "Todos os recursos Premium estão liberados."
                : "Plano gratuito com acesso ao essencial do rebanho."}
            </p>
          </div>
          <PremiumBadge plan={planStatus} />
        </div>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Status</dt>
            <dd className="mt-1 font-semibold capitalize">{statusTitulo(planStatus.status)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Início</dt>
            <dd className="mt-1">{formatarDataHora(planStatus.data_inicio) ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Expiração</dt>
            <dd className="mt-1">{formatarDataHora(planStatus.data_expiracao) ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Plano gratuito" subtitle="Acesso essencial">
          <ul className="space-y-3">
            {RECURSOS_GRATUITOS.map((feat) => (
              <li key={feat} className="flex items-start gap-3 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                {feat}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Premium" subtitle="Recursos exclusivos">
          <ul className="space-y-3">
            {RECURSOS_PREMIUM.map((feat) => {
              const on = r.premium_ativo;
              return (
                <li key={feat} className="flex items-start gap-3 text-sm">
                  {on ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#f59e0b]" />
                  ) : (
                    <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className={on ? "" : "text-muted-foreground"}>{feat}</span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="font-semibold">Outras formas de assinatura</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A cobrança por cartão ainda não está ativa. O Premium pode ser avaliado no modo
          de demonstração (sem custo) por um administrador.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled title="Em breve">
            <CreditCard /> Assinar com cartão (Pagar.me — em breve)
          </Button>
          <Button variant="outline" disabled title="Em breve">
            <ShieldCheck /> Gerenciar assinatura
          </Button>
        </div>
      </section>

      {canManage.data && (
        <section className="rounded-lg border border-[#f59e0b]/30 bg-card p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-[#f59e0b]" />
            <h2 className="font-semibold">Administração — modo de demonstração</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Altera o plano da propriedade atual sem nenhuma cobrança. Cada alteração fica
            registrada na auditoria.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Plano</Label>
              <Select value={plano} onValueChange={(v) => setPlano(v as Plano)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="gratuito">Gratuito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as StatusAssinatura)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="trial">Período de teste</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                  <SelectItem value="expirado">Expirado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Expiração</Label>
              <Input type="date" value={expiracao} onChange={(e) => setExpiracao(e.target.value)} />
            </div>
            <div className="sm:col-span-3">
              <Label>Motivo</Label>
              <Input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                maxLength={500}
                placeholder="Ex.: Cliente solicitou avaliação do Premium."
              />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={setDemo.isPending || cancelDemo.isPending}
            >
              {planStatus.plano === "premium" ? "Atualizar" : "Ativar"} Premium (demo)
            </Button>
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar alteração de plano?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O plano da propriedade será alterado para {planoTitulo({ plano })}{" "}
                    (status: {statusTitulo(status)}) no modo de demonstração, sem cobrança.
                    A alteração fica registrada na auditoria.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={applyPlan}>Confirmar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              variant="outline"
              onClick={() => setConfirmCancel(true)}
              disabled={setDemo.isPending || cancelDemo.isPending}
            >
              Cancelar demonstração
            </Button>
            <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar a demonstração?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Os recursos Premium serão desativados imediatamente. Os dados da
                    propriedade não serão apagados.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Manter</AlertDialogCancel>
                  <AlertDialogAction onClick={cancelPlan}>Cancelar demonstração</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="font-semibold">Histórico de alterações</h2>
        {audit.isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">Carregando…</p>
        ) : (audit.data?.length ?? 0) === 0 ? (
          <Empty message="Nenhuma alteração de plano registrada." />
        ) : (
          <div className="mt-4 divide-y divide-border">
            {audit.data?.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div>
                  <strong className="block text-sm">
                    {pretty(a.plano_anterior)} → {pretty(a.plano_novo)}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      status: {pretty(a.status_anterior)} → {pretty(a.status_novo)}
                    </span>
                  </strong>
                  <span className="text-xs text-muted-foreground">
                    {formatarDataHora(a.created_at) ?? "—"}
                    {a.motivo ? ` · ${a.motivo}` : ""} · por {a.alterado_por.slice(0, 8)}
                  </span>
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase text-primary">
                  {a.origem}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}