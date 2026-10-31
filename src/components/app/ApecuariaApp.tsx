import { YuiAssistant } from "./yui/YuiAssistant";
import { useCriadores } from "./criadores";
import { HerdIcon } from "@/components/app/HerdIcon";
import { CalfIcon } from "@/components/app/CalfIcon";
import { Suspense, lazy, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import {
  CircleDollarSign, FileText, FlaskConical, HeartPulse, Info, Milk, Pencil, Plus, Search, ShieldCheck,
  ShoppingCart, Syringe, Trash2, TrendingUp, Upload, Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { supabaseDinamico } from "@/lib/supabaseDinamico";
import { formatarDataBR } from "@/lib/datas";
import { loadFormRefs } from "./formRefs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";
import {
  Abas, Empty, EmptyProperty, EmptySection, Module, Row, PageTitle, Status,
  friendlyError, money, pretty,
} from "./shared";
import { useDebouncedValue, usePagedRows, type GridFilter } from "./usePagedRows";
import { VirtualTable, type AcaoLinha } from "./VirtualTable";
import ImportDialog from "./ImportDialog";
import { RecordDialog } from "./RecordDialog";
import { NotesMural, productionNotes } from "./NotesMural";
import { MyProfilePage, PlanPage, PropertyProfilePage, usePlan } from "./account";
import { Brinco } from "./Brinco";
import { MenuLateral } from "./casca/MenuLateral";
import { BarraTopo } from "./casca/BarraTopo";
import { BarraInferior } from "./casca/BarraInferior";
import { BuscaGlobal } from "./casca/BuscaGlobal";
import { filtrarMenu } from "./casca/navegacao";
import { SegurancaPage } from "./conta/Seguranca";

const Dashboard = lazy(() => import("./Dashboard"));
const Reports = lazy(() => import("./Reports"));
const Diagnostics = lazy(() => import("./Diagnostics"));
const Agenda = lazy(() => import("./Agenda"));
const AreaAssinante = lazy(() => import("./assinatura/AreaAssinante"));
const Biblioteca = lazy(() => import("./biblioteca/Biblioteca"));
const Indicadores = lazy(() => import("./Indicadores"));
const Ferramentas = lazy(() => import("./ferramentas/Ferramentas"));
const Aplicativo = lazy(() => import("./aplicativo/Aplicativo"));
const Ajuda = lazy(() => import("./ajuda/Ajuda"));

const modules: Record<string, Module> = {
  rebanho: { title: "Meu rebanho", singular: "animal", novo: "Novo animal", primeiro: "Cadastrar o primeiro animal", table: "animais", icon: HerdIcon, description: "Todos os animais, com brinco, lote e situação. Toque num animal para ver a ficha.", searchColumns: ["numero_brinco","nome","raca"], columns: [{key:"numero_brinco",label:"Brinco"},{key:"nome",label:"Nome"},{key:"sexo",label:"Sexo"},{key:"raca",label:"Raça"},{key:"situacao",label:"Situação"}], fields: [
    {key:"numero_brinco",label:"Número do brinco",required:true},{key:"nome",label:"Nome"},{key:"sexo",label:"Sexo",type:"select",required:true,options:[{value:"F",label:"Fêmea"},{value:"M",label:"Macho"}]},{key:"raca",label:"Raça"},{key:"data_nascimento",label:"Data de nascimento",type:"date"},{key:"lote_id",label:"Lote",type:"lote"},{key:"mae_id",label:"Mãe",type:"animal",sex:"F"},{key:"pai_id",label:"Pai",type:"animal",sex:"M"},{key:"situacao",label:"Situação",type:"select",required:true,options:[["ativo","Ativo"],["vendido","Vendido"],["perdido","Perdido"],["falecido","Morto"],["transferido","Transferido"]].map(([value,label])=>({value,label}))},{key:"observacoes",label:"Observações",type:"textarea"}
  ]},
  bezerros: { title:"Evolução dos bezerros", singular:"pesagem", novo:"Nova pesagem", primeiro:"Registrar a primeira pesagem", table:"pesagens", icon:CalfIcon, description:"Pesagens dos animais jovens, para ver se estão ganhando peso.", searchColumns:["data"], columns:[{key:"animal_id",label:"Animal"},{key:"data",label:"Data"},{key:"peso_kg",label:"Peso (kg)"},{key:"observacoes",label:"Observações"}], fields:[{key:"animal_id",label:"Bezerro",type:"animal",required:true,activeOnly:true},{key:"data",label:"Data",type:"date",required:true},{key:"peso_kg",label:"Peso (kg)",type:"number",required:true},{key:"observacoes",label:"Observações",type:"textarea"}]},
  vacinacao: { title:"Vacinação", singular:"aplicação", novo:"Nova aplicação", primeiro:"Registrar a primeira vacina", table:"vacinacoes", icon:Syringe, description:"Cada aplicação, a próxima dose e o que está atrasado.", searchColumns:["responsavel"], columns:[{key:"tipo_vacina_id",label:"Vacina"},{key:"animal_id",label:"Animal"},{key:"data_aplicacao",label:"Aplicação"},{key:"proxima_aplicacao",label:"Próxima"},{key:"responsavel",label:"Responsável"}], fields:[{key:"tipo_vacina_id",label:"Tipo de vacina",type:"vacina",required:true},{key:"animal_id",label:"Animal",type:"animal",activeOnly:true},{key:"lote_id",label:"Lote",type:"lote"},{key:"data_aplicacao",label:"Data da aplicação",type:"date",required:true},{key:"proxima_aplicacao",label:"Próxima aplicação",type:"date"},{key:"responsavel",label:"Responsável"},{key:"observacao",label:"Observação",type:"textarea"}]},
  inseminacao: { title:"Inseminação", singular:"inseminação", novo:"Nova inseminação", primeiro:"Registrar a primeira inseminação", table:"inseminacoes", icon:FlaskConical, description:"Inseminações, situação e a previsão de parto de cada vaca.", searchColumns:["reprodutor_semen"], columns:[{key:"animal_id",label:"Animal"},{key:"data_inseminacao",label:"Data"},{key:"previsao_parto",label:"Previsão de parto"},{key:"situacao",label:"Situação"}], fields:[{key:"animal_id",label:"Animal",type:"animal",required:true,sex:"F",activeOnly:true},{key:"data_inseminacao",label:"Data da inseminação",type:"date",required:true},{key:"reprodutor_semen",label:"Reprodutor / sêmen",required:true},{key:"previsao_parto",label:"Previsão de parto",type:"date",required:true},{key:"situacao",label:"Situação",type:"select",required:true,options:[["em_andamento","Em andamento"],["confirmada","Confirmada"],["falhou","Falhou"],["parto_realizado","Parto realizado"],["cancelada","Cancelada"]].map(([value,label])=>({value,label}))},{key:"observacao",label:"Observação",type:"textarea"}]},
  nascimentos: { title:"Nascimentos", singular:"nascimento", novo:"Novo nascimento", primeiro:"Registrar o primeiro nascimento", table:"nascimentos", icon:HeartPulse, description:"Quem nasceu, de qual vaca e quando.", columns:[{key:"vaca_id",label:"Vaca"},{key:"bezerro_id",label:"Bezerro"},{key:"data_nascimento",label:"Nascimento"},{key:"sexo",label:"Sexo"}], fields:[{key:"vaca_id",label:"Vaca",type:"animal",required:true,sex:"F",activeOnly:true},{key:"bezerro_id",label:"Bezerro",type:"animal",required:true,activeOnly:true},{key:"data_nascimento",label:"Data",type:"date",required:true},{key:"sexo",label:"Sexo",type:"select",required:true,options:[{value:"F",label:"Fêmea"},{value:"M",label:"Macho"}]},{key:"lote_id",label:"Lote",type:"lote"},{key:"observacoes",label:"Observações",type:"textarea"}]},
  lotes: { title:"Lotes", singular:"lote", novo:"Novo lote", primeiro:"Criar o primeiro lote", table:"lotes", icon:Warehouse, description:"Grupos de animais por pasto ou finalidade.", searchColumns:["nome","finalidade","descricao"], columns:[{key:"nome",label:"Nome"},{key:"finalidade",label:"Finalidade"},{key:"descricao",label:"Descrição"},{key:"ativo",label:"Status"}], fields:[{key:"nome",label:"Nome",required:true},{key:"finalidade",label:"Finalidade"},{key:"descricao",label:"Descrição",type:"textarea"}]},
  producao: { title:"Leite", singular:"registro de leite", novo:"Registrar leite", primeiro:"Registrar o leite de hoje", table:"producao_leite", icon:Milk, description:"Litros de cada vaca por dia. O total em reais é calculado sozinho.", columns:[{key:"animal_id",label:"Animal"},{key:"data",label:"Data"},{key:"litros",label:"Litros"},{key:"valor_litro",label:"R$ / litro"},{key:"valor_total",label:"Total"}], fields:[{key:"animal_id",label:"Animal",type:"animal",required:true,sex:"F",activeOnly:true},{key:"lote_id",label:"Lote",type:"lote"},{key:"data",label:"Data",type:"date",required:true},{key:"litros",label:"Litros",type:"number",required:true},{key:"valor_litro",label:"Valor por litro",type:"number",required:true},{key:"observacao",label:"Observação",type:"textarea"}]},
  financeiro: { title:"Lucros e investimentos", singular:"lançamento", novo:"Novo lançamento", primeiro:"Fazer o primeiro lançamento", table:"movimentacoes_financeiras", icon:CircleDollarSign, description:"Receitas, despesas e investimentos lançados à mão. Compras e vendas entram sozinhas por Compra e venda.", impliedFilter:{key:"origem_tipo",isNull:true}, searchColumns:["descricao","categoria"], columns:[{key:"tipo",label:"Tipo"},{key:"descricao",label:"Descrição"},{key:"categoria",label:"Categoria"},{key:"data",label:"Data"},{key:"valor",label:"Valor"}], fields:[{key:"tipo",label:"Tipo",type:"select",required:true,options:[["receita","Receita"],["despesa","Despesa"],["investimento","Investimento"]].map(([value,label])=>({value,label}))},{key:"descricao",label:"Descrição",required:true},{key:"categoria",label:"Categoria",required:true},{key:"valor",label:"Valor",type:"number",required:true},{key:"data",label:"Data",type:"date",required:true},{key:"observacao",label:"Observação",type:"textarea"}]},
};

const vaccineTypes: Module = { title:"Tipos de vacina", singular:"tipo de vacina", novo:"Novo tipo de vacina", primeiro:"Cadastrar a primeira vacina", table:"tipos_vacinas", icon:ShieldCheck, description:"As vacinas que você usa e de quantos em quantos dias repetir.", searchColumns:["nome"], columns:[{key:"nome",label:"Nome"},{key:"intervalo_dias",label:"Intervalo (dias)"},{key:"descricao",label:"Descrição"},{key:"ativo",label:"Status"}], fields:[{key:"nome",label:"Nome",required:true},{key:"intervalo_dias",label:"Intervalo em dias",type:"number"},{key:"descricao",label:"Descrição",type:"textarea"}]};

const IMPLEMENTADAS = new Set(["inicio", "agenda", "rebanho", "lotes", "bezerros", "vacinacao", "inseminacao", "nascimentos", "producao", "financeiro", "comercial", "relatorios", "indicadores", "ferramentas", "biblioteca", "assinatura", "aplicativo", "ajuda", "perfil", "perfil-propriedade", "seguranca", "diagnostico"]);
const GRUPOS = filtrarMenu((chave) => IMPLEMENTADAS.has(chave));
const GRUPOS_LATERAL = filtrarMenu((chave) => IMPLEMENTADAS.has(chave), { lateral: true });
const CHAVE_PROPRIEDADE = "pd-propriedade";
const lerPropriedadeSalva = () => { try { return localStorage.getItem(CHAVE_PROPRIEDADE); } catch { return null; } };

export function ApecuariaApp() {
  const { section = "inicio" } = useParams({ strict: false }) as { section?: string };
  const busca = useSearch({ strict: false }) as { novo?: string; editar?: string; animal?: string; ebook?: string; retorno?: "sucesso" | "pendente" | "falha" };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menuAberto, setMenuAberto] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [propertyId, setPropertyIdState] = useState<string | null>(null);
  const [propertyDialog, setPropertyDialog] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const userQuery = useQuery({ queryKey: ["session-user"], queryFn: async () => { const cached = await supabase.auth.getSession(); if (cached.data.session?.user) return cached.data.session.user; const { data, error } = await supabase.auth.getUser(); if (error) throw error; return data.user; } });
  const propertiesQuery = useQuery({ queryKey: ["properties", userQuery.data?.id], enabled: !!userQuery.data, queryFn: async () => { const { data, error } = await supabase.from("propriedades").select("*").eq("ativo", true).order("created_at"); if (error) throw error; return data; } });
  const setPropertyId = (id: string) => { setPropertyIdState(id); try { localStorage.setItem(CHAVE_PROPRIEDADE, id); } catch { /* só nesta visita */ } };
  useEffect(() => {
    const lista = propertiesQuery.data;
    if (propertyId || !lista?.length) return;
    const salva = lerPropriedadeSalva();
    setPropertyIdState(lista.find((p) => p.id === salva)?.id ?? lista[0].id);
  }, [propertiesQuery.data, propertyId]);
  useEffect(() => { if (propertiesQuery.isSuccess && !propertiesQuery.data.length) setPropertyDialog(true); }, [propertiesQuery.isSuccess, propertiesQuery.data]);
  const currentProperty = propertiesQuery.data?.find((p) => p.id === propertyId);

  const go = (target: string) => { setMenuAberto(false); return navigate({ to: "/app/$section", params: { section: target } }); };
  const lancar = (secao: string, novo: string) => { setMenuAberto(false); return navigate({ to: "/app/$section", params: { section: secao }, search: { novo } }); };
  const abrirRegistro = (secao: string, id: string) => navigate({ to: "/app/$section", params: { section: secao }, search: { editar: id } });
  const abrirAnimal = (id: string) => navigate({ to: "/app/$section", params: { section: "rebanho" }, search: { animal: id } });
  const limparBusca = () => navigate({ to: "/app/$section", params: { section }, search: {}, replace: true });
  const isAdminQuery = useQuery({ queryKey: ["sou-admin"], queryFn: async () => { const r = await (supabase.rpc as unknown as (f: string) => Promise<{ data: unknown }>)("sou_admin"); return r.data === true; } });
  const signOut = async () => { await queryClient.cancelQueries(); queryClient.clear(); await supabase.auth.signOut(); navigate({ to: "/", replace: true }); };
  const pedido = { novo: busca.novo, editar: busca.editar, animal: busca.animal, limpar: limparBusca };

  const secaoPropriedade = ["perfil-propriedade", "configuracoes", "assinatura", "diagnostico"].includes(section) || !["perfil", "seguranca"].includes(section);
  let conteudo: ReactNode;
  if (section === "perfil") conteudo = userQuery.data?.id ? <MyProfilePage userId={userQuery.data.id} email={userQuery.data.email} /> : <SectionLoading />;
  else if (section === "seguranca") conteudo = userQuery.data ? <SegurancaPage email={userQuery.data.email ?? ""} /> : <SectionLoading />;
  else if (section === "aplicativo") conteudo = <Suspense fallback={<SectionLoading />}><Aplicativo /></Suspense>;
  else if (section === "ajuda") conteudo = <Suspense fallback={<SectionLoading />}><Ajuda propriedadeId={propertyId} /></Suspense>;
  else if (!propertyId) conteudo = propertiesQuery.isLoading ? <SectionLoading /> : <EmptyProperty onCreate={() => setPropertyDialog(true)} />;
  else if (section === "inicio") conteudo = <Suspense fallback={<SectionLoading />}><Dashboard propertyId={propertyId} propertyName={currentProperty?.nome ?? "Propriedade"} go={go} lancar={lancar} /></Suspense>;
  else if (section === "agenda") conteudo = <Suspense fallback={<SectionLoading />}><Agenda propertyId={propertyId} propertyName={currentProperty?.nome ?? "Propriedade"} go={go} abrirRegistro={abrirRegistro} /></Suspense>;
  else if (section === "relatorios") conteudo = <Suspense fallback={<SectionLoading />}><Reports propertyId={propertyId} /></Suspense>;
  else if (section === "indicadores") conteudo = <Suspense fallback={<SectionLoading />}><Indicadores propertyId={propertyId} /></Suspense>;
  else if (section === "ferramentas") conteudo = <Suspense fallback={<SectionLoading />}><Ferramentas diasGestacao={currentProperty?.periodo_gestacao_dias ?? 283} cidade={currentProperty?.cidade ?? null} estado={currentProperty?.estado ?? null} /></Suspense>;
  else if (section === "diagnostico") conteudo = <Suspense fallback={<SectionLoading />}><Diagnostics propertyId={propertyId} /></Suspense>;
  else if (section === "comercial") conteudo = <Commerce key={propertyId} propertyId={propertyId} pedido={pedido} />;
  else if (section === "vacinacao") conteudo = <VaccinationArea key={propertyId} propertyId={propertyId} pedido={pedido} />;
  else if (section === "producao") conteudo = <ProductionArea key={propertyId} propertyId={propertyId} pedido={pedido} />;
  else if (section === "perfil-propriedade" || section === "configuracoes") conteudo = <div className="space-y-8"><SettingsPage property={currentProperty} onUpdated={() => queryClient.invalidateQueries({ queryKey: ["properties"] })} /><PropertyProfilePage propertyId={propertyId} /></div>;
  else if (section === "assinatura") conteudo = <Suspense fallback={<SectionLoading />}><AreaAssinante propriedades={propertiesQuery.data ?? []} propriedadeId={propertyId} ehAdmin={isAdminQuery.data === true} retorno={busca.retorno} aoIr={(c) => void go(c)} /></Suspense>;
  else if (section === "biblioteca") conteudo = <Suspense fallback={<SectionLoading />}><Biblioteca ebookAberto={busca.ebook} aoAbrir={(id) => void navigate({ to: "/app/$section", params: { section: "biblioteca" }, search: { ebook: id } })} aoFechar={() => void navigate({ to: "/app/$section", params: { section: "biblioteca" }, search: {}, replace: true })} aoIr={(c) => void go(c)} /></Suspense>;
  else if (modules[section]) conteudo = <CrudModule key={`${propertyId}:${section}`} config={modules[section]} propertyId={propertyId} globalSearch="" pedido={pedido} />;
  else conteudo = <EmptySection go={() => go("inicio")} />;
  void secaoPropriedade;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#conteudo" className="sr-only z-[70] rounded-[10px] bg-primary px-4 py-3 font-bold text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Pular para o conteúdo</a>
      <MenuLateral
        grupos={GRUPOS_LATERAL}
        secao={section}
        aberto={menuAberto}
        ehAdmin={isAdminQuery.data === true}
        aoIr={(c) => void go(c)}
        aoFechar={() => setMenuAberto(false)}
        aoAdmin={() => navigate({ to: "/admin" })}
        aoBuscar={() => { setMenuAberto(false); setBuscaAberta(true); }}
      />
      <div className="lg:pl-[248px]">
        <BarraTopo
          propriedades={propertiesQuery.data ?? []}
          propriedadeId={propertyId}
          aoTrocarPropriedade={setPropertyId}
          aoNovaPropriedade={() => setPropertyDialog(true)}
          aoBuscar={() => setBuscaAberta(true)}
          aoIr={(c) => void go(c)}
          aoSair={() => void signOut()}
          aoSobre={() => setAboutOpen(true)}
          userId={userQuery.data?.id}
          email={userQuery.data?.email}
          ehAdmin={isAdminQuery.data === true}
        />
        <main id="conteudo" tabIndex={-1} data-tour="conteudo" className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-5 outline-none sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          {conteudo}
        </main>
      </div>
      <BarraInferior secao={section} aoIr={(c) => void go(c)} aoLancar={(s, n) => void lancar(s, n)} aoMais={() => setMenuAberto(true)} />
      <BuscaGlobal aberta={buscaAberta} aoMudar={setBuscaAberta} grupos={GRUPOS} propriedadeId={propertyId} aoIr={(c) => void go(c)} aoAbrirAnimal={(id) => void abrirAnimal(id)} />
      <PropertyDialog open={propertyDialog} userId={userQuery.data?.id} onClose={() => setPropertyDialog(false)} onCreated={(id) => { setPropertyId(id); setPropertyDialog(false); queryClient.invalidateQueries({ queryKey: ["properties"] }); }} />
      <AboutDialog open={aboutOpen} isAdmin={isAdminQuery.data === true} onClose={() => setAboutOpen(false)} />
      <YuiAssistant section={section} go={go} abrirMenu={setMenuAberto} isAdmin={isAdminQuery.data === true} propriedadeId={propertyId} />
    </div>
  );
}

/** Pedido vindo do endereço: abrir o formulário de novo registro, editar um registro ou abrir a ficha de um animal. */
type Pedido = { novo?: string; editar?: string; animal?: string; limpar: () => void };

function AboutDialog({ open, isAdmin, onClose }: { open: boolean; isAdmin: boolean; onClose: () => void }) {
  const criadores = useCriadores(open && isAdmin);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="titulo-secao">Sobre o sistema</DialogTitle>
          <DialogDescription>Pecuária Digital: a fazenda anotada num lugar só.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-muted-foreground">
          <p>Rebanho, vacinas, reprodução, leite e dinheiro da fazenda, com os dados guardados com segurança e o aplicativo Android que funciona sem internet.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Ficha de cada animal com todo o histórico</li>
            <li>Vacinas com a próxima dose e aviso de atraso</li>
            <li>Inseminação com previsão de parto</li>
            <li>Leite por vaca e resultado do mês</li>
            <li>Relatórios por mês e por ano</li>
          </ul>
          {isAdmin && criadores.isLoading && <p className="text-sm">Carregando criadores…</p>}
          {isAdmin && criadores.isError && <p className="text-sm text-alerta">Não foi possível carregar os criadores.</p>}
          {isAdmin && !!criadores.data?.length && (
            <div className="space-y-3 border-t border-border pt-4">
              <p className="font-bold text-foreground">Criadores do site</p>
              {criadores.data.map((c) => (
                <div key={c.id} className="space-y-1">
                  <p className="font-bold text-foreground">{c.nome}</p>
                  {c.redes.length > 0 && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {c.redes.map((r, i) => <a key={`${c.id}-${i}`} href={r.url} target="_blank" rel="noopener noreferrer" className="break-all font-bold text-primary underline underline-offset-2">{r.nome}</a>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-sm">Cada conta só vê as próprias propriedades.</p>
        </div>
        <DialogFooter><Button className="h-12" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PropertyDialog({ open, userId, onClose, onCreated }: { open: boolean; userId: string | undefined; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [salvando, setSalvando] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId || salvando) return;
    setSalvando(true);
    const { data, error } = await supabase.from("propriedades").insert({ nome: name.trim(), cidade: city.trim() || null, estado: state.trim().toUpperCase() || null, proprietario_id: userId }).select("id").single();
    setSalvando(false);
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success("Propriedade cadastrada.");
    setName(""); setCity(""); setState("");
    onCreated(data.id);
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="titulo-secao">Cadastre a propriedade</DialogTitle>
          <DialogDescription>Os animais, o leite e o dinheiro ficam guardados dentro dela.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div><Label htmlFor="prop-nome">Nome da propriedade</Label><Input id="prop-nome" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Fazenda Santa Clara" /></div>
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <div><Label htmlFor="prop-cidade">Cidade</Label><Input id="prop-cidade" maxLength={80} value={city} onChange={(e) => setCity(e.target.value)} /></div>
            <div><Label htmlFor="prop-uf">Estado</Label><Input id="prop-uf" value={state} onChange={(e) => setState(e.target.value)} maxLength={2} placeholder="MG" /></div>
          </div>
          <DialogFooter><Button type="submit" className="h-12" disabled={salvando}>{salvando ? "Salvando…" : "Cadastrar propriedade"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function defaultDateValue(mode: string) { const d = new Date(); const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0"); return mode === "dia" ? `${y}-${m}-${day}` : mode === "mes" ? `${y}-${m}` : mode === "ano" ? String(y) : ""; }
function dateRange(mode: string, v: string): [string, string] | null { if (mode === "dia" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return [v, v]; if (mode === "mes" && /^\d{4}-\d{2}$/.test(v)) { const [y, m] = v.split("-").map(Number); const last = new Date(y, m, 0).getDate(); return [`${v}-01`, `${v}-${String(last).padStart(2, "0")}`]; } if (mode === "ano" && /^\d{4}$/.test(v)) return [`${v}-01-01`, `${v}-12-31`]; return null; }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUNAS_DATA = new Set(["data", "data_aplicacao", "proxima_aplicacao", "data_inseminacao", "previsao_parto", "data_nascimento"]);

function CrudModule({ config, propertyId, globalSearch, pedido }: { config: Module; propertyId: string; globalSearch: string; pedido?: Pedido }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [details, setDetails] = useState<Row | null>(null);
  const [apagando, setApagando] = useState<Row | null>(null);
  const [local, setLocal] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [importOpen, setImportOpen] = useState(false);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [dateMode, setDateMode] = useState<"todos" | "dia" | "mes" | "ano">("todos");
  const [dateValue, setDateValue] = useState("");
  const deferredLocal = useDebouncedValue(local, 300);
  const search = (globalSearch || deferredLocal).trim();
  const planGate = usePlan(propertyId);
  const premium = planGate.data?.premium_ativo ?? false;
  const table = supabaseDinamico.from(config.table);
  const selectCols = useMemo(() => { const set = new Set<string>(["id", ...config.columns.map((c) => c.key), ...config.fields.map((f) => f.key)]); if (config.table === "movimentacoes_financeiras") set.add("origem_tipo"); return [...set].join(","); }, [config]);
  const filters = useMemo<GridFilter[]>(() => {
    const bag: GridFilter[] = [];
    if (config.impliedFilter) bag.push(config.impliedFilter.isNull ? { key: config.impliedFilter.key, op: "is-null", value: null } : { key: config.impliedFilter.key, op: "eq", value: config.impliedFilter.value ?? "" });
    const dateKey = config.fields.find((f) => f.type === "date")?.key ?? "created_at";
    const r = dateRange(dateMode, dateValue);
    if (r) {
      bag.push({ key: dateKey, op: "gte", value: dateKey === "created_at" ? new Date(r[0] + "T00:00:00").toISOString() : r[0] });
      bag.push({ key: dateKey, op: "lte", value: dateKey === "created_at" ? new Date(r[1] + "T23:59:59.999").toISOString() : r[1] });
    }
    for (const f of config.filters ?? []) { const v = filterValues[f.key]; if (v && v !== "__all") bag.push({ key: f.key, op: "eq", value: v }); }
    return bag;
  }, [config, filterValues, dateMode, dateValue]);
  useEffect(() => { setPage(1); }, [search, filterValues, pageSize, dateMode, dateValue]);
  const refs = useQuery({ queryKey: ["form-refs", propertyId], queryFn: () => loadFormRefs(propertyId), staleTime: 5 * 60_000 });
  const invalidateRelated = () => {
    const related: Record<string, string[]> = { animais: ["animais", "form-refs", "dashboard", "reports", "agenda", "avisos"], vacinacoes: ["form-refs", "dashboard", "agenda", "avisos"], tipos_vacinas: ["form-refs"], inseminacoes: ["dashboard", "agenda", "avisos"], nascimentos: ["animais", "form-refs", "dashboard", "reports"], lotes: ["form-refs", "animais", "dashboard"], producao_leite: ["dashboard", "reports", "avisos"], movimentacoes_financeiras: ["dashboard", "reports"], compras: ["movimentacoes_financeiras", "dashboard", "reports"], vendas: ["movimentacoes_financeiras", "dashboard", "reports"], pesagens: ["animal-history", "agenda", "avisos"], anotacoes_producao: ["animal-history"] };
    qc.invalidateQueries({ queryKey: [config.table, propertyId] });
    (related[config.table] ?? []).forEach((k) => { if (k === "animal-history") qc.invalidateQueries({ queryKey: ["animal-history"] }); else qc.invalidateQueries({ queryKey: [k, propertyId] }); });
  };
  const save = useMutation({
    mutationFn: async (payload: Row) => {
      const body: Row = { ...payload, propriedade_id: propertyId };
      const response = editing ? await table.update(body).eq("id", String(editing["id"])).eq("propriedade_id", propertyId) : await table.insert(body);
      if (response.error) throw response.error;
    },
    onSuccess: () => { toast.success(editing ? "Alterações salvas." : `${config.singular[0].toUpperCase()}${config.singular.slice(1)} cadastrado.`); setOpen(false); setEditing(null); invalidateRelated(); },
    onError: (e) => toast.error(friendlyError(e)),
  });
  const remove = async (row: Row) => {
    const { error } = await table.delete().eq("id", String(row["id"])).eq("propriedade_id", propertyId);
    if (error) toast.error(friendlyError(error));
    else { toast.success("Registro excluído."); invalidateRelated(); }
  };

  // Pedido vindo do endereço: ?novo=1 abre o formulário; ?editar=<id> abre a edição; ?animal=<id> abre a ficha.
  const pedidoNovo = pedido?.novo, pedidoEditar = pedido?.editar, pedidoAnimal = pedido?.animal;
  useEffect(() => {
    if (!pedido) return;
    if (pedidoNovo === "1") { setEditing(null); setOpen(true); pedido.limpar(); return; }
    const id = pedidoEditar ?? (config.table === "animais" ? pedidoAnimal : undefined);
    if (!id) return;
    if (!UUID.test(id)) { pedido.limpar(); return; }
    let vivo = true;
    void supabaseDinamico.from(config.table).select(selectCols).eq("id", id).eq("propriedade_id", propertyId).maybeSingle().then(({ data }) => {
      if (!vivo) return;
      if (!data) toast.error("Esse registro não foi encontrado nesta propriedade.");
      else if (pedidoAnimal && config.table === "animais") setDetails(data as unknown as Row);
      else { setEditing(data as unknown as Row); setOpen(true); }
      pedido.limpar();
    });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoNovo, pedidoEditar, pedidoAnimal]);

  const animalRef = (value: unknown) => refs.data?.animals.find((x) => x.id === value);
  const lookup = (key: string, value: unknown): ReactNode => {
    if (value == null || value === "") return "—";
    if (key.includes("animal") || key === "vaca_id" || key === "bezerro_id") {
      const a = animalRef(value);
      if (!a) return "—";
      return <span className="inline-flex min-w-0 items-center gap-2"><Brinco tamanho="pequeno" valor={a.numero_brinco} /><span className="truncate">{a.nome || ""}</span></span>;
    }
    if (key === "lote_id") return refs.data?.lots.find((x) => x.id === value)?.nome || "—";
    if (key === "tipo_vacina_id") return refs.data?.vaccines.find((x) => x.id === value)?.nome || "—";
    if (key === "valor" || key === "valor_total" || key === "valor_litro") return money(value);
    if (key === "sexo") return value === "F" ? "Fêmea" : value === "M" ? "Macho" : pretty(value);
    if (COLUNAS_DATA.has(key)) return formatarDataBR(value);
    if (typeof value === "boolean") return value ? "Ativo" : "Inativo";
    if (typeof value === "number") return value.toLocaleString("pt-BR");
    return pretty(value);
  };
  const render = (row: Row, col: { key: string }) =>
    col.key === "numero_brinco" ? <Brinco tamanho="pequeno" valor={String(row[col.key] ?? "—")} />
      : col.key === "situacao" || col.key === "tipo" ? <Status value={String(row[col.key])} />
        : lookup(col.key, row[col.key]);
  const paged = usePagedRows({ table: config.table, propertyId, cols: selectCols, page, pageSize, search, searchColumns: config.searchColumns, filters });
  useEffect(() => { if (!paged.totalReady) return; const last = Math.max(1, Math.ceil(paged.total / pageSize)); if (page > last) setPage(last); }, [paged.total, paged.totalReady, pageSize, page]);
  const acoes = (row: Row): AcaoLinha[] => [
    ...(config.table === "animais" ? [{ rotulo: "Ver ficha", icone: FileText, aoClicar: () => setDetails(row) }] : []),
    { rotulo: "Editar", icone: Pencil, aoClicar: () => { setEditing(row); setOpen(true); } },
    { rotulo: "Excluir", icone: Trash2, perigo: true, aoClicar: () => setApagando(row) },
  ];
  const novo = () => { setEditing(null); setOpen(true); };
  const filtrando = !!search || dateMode !== "todos" || Object.values(filterValues).some((v) => v && v !== "__all");

  return (
    <div>
      <PageTitle
        title={config.title}
        description={config.description}
        action={
          <>
            <Button variant="outline" className="h-12" onClick={() => { if (!premium) { toast.error("A importação de planilhas é um recurso do plano Premium."); return; } setImportOpen(true); }} title={premium ? "Importar uma planilha" : "Disponível no plano Premium"}><Upload />Importar planilha</Button>
            <Button className="h-12 px-5 text-base" onClick={novo}><Plus />{config.novo ?? `Novo ${config.singular}`}</Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-64 sm:max-w-md">
          <span className="sr-only">Buscar em {config.title.toLowerCase()}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-12 pl-10" value={local} onChange={(e) => setLocal(e.target.value)} placeholder={config.table === "animais" ? "Brinco, nome ou raça" : `Buscar em ${config.title.toLowerCase()}`} />
        </label>
        <div role="group" aria-label="Período" className="flex flex-wrap items-center gap-1 rounded-[10px] border border-input bg-card p-1">
          {([["todos", "Tudo"], ["dia", "Hoje"], ["mes", "Este mês"], ["ano", "Este ano"]] as const).map(([m, label]) => (
            <button key={m} type="button" aria-pressed={dateMode === m} onClick={() => { setDateMode(m); setDateValue(defaultDateValue(m)); }} className={`h-10 rounded-lg px-3 text-[15px] font-bold ${dateMode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
          ))}
          <Input className="h-10 w-40 border-0 bg-transparent px-2 shadow-none" type="date" value={dateMode === "dia" ? dateValue : ""} onChange={(e) => { if (e.target.value) { setDateMode("dia"); setDateValue(e.target.value); } }} aria-label="Escolher um dia" title="Escolher um dia" />
        </div>
        {config.filters?.map((f) => (
          <Select key={f.key} value={filterValues[f.key] ?? "__all"} onValueChange={(v) => setFilterValues((prev) => ({ ...prev, [f.key]: v }))}>
            <SelectTrigger className="h-12 w-48" aria-label={f.label}><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="__all">{f.label}: todos</SelectItem>{f.options.map((o) => <SelectItem value={o.value} key={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        ))}
        {dateMode !== "todos" && <span className="text-sm text-muted-foreground">Pela {(config.fields.find((f) => f.type === "date")?.label ?? "data de cadastro").toLowerCase()}</span>}
      </div>
      <VirtualTable
        columns={config.columns}
        rows={paged.rows}
        page={page}
        pageSize={pageSize}
        total={paged.total}
        loading={paged.isPending}
        error={paged.error}
        onRetry={() => paged.refetch()}
        onPage={setPage}
        onPageSize={setPageSize}
        render={render}
        actions={acoes}
        rowLabel={(row) => (config.table === "animais" ? `animal ${String(row["numero_brinco"] ?? "")}` : config.singular)}
        emptyMessage={filtrando ? "Nada encontrado com essa busca ou período." : `Ainda não há ${config.title.toLowerCase()} cadastrados.`}
        emptyAction={filtrando ? undefined : { label: config.primeiro ?? (config.novo ?? "Cadastrar"), onClick: novo }}
      />
      <RecordDialog open={open} onClose={() => { setOpen(false); setEditing(null); }} config={config} row={editing} refs={refs.data} onSave={(p) => save.mutate(p)} saving={save.isPending} propertyId={propertyId} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} config={config} propertyId={propertyId} refs={refs.data} onImported={() => { invalidateRelated(); setPage(1); }} />
      {config.table === "animais" && <AnimalDetails open={!!details} animal={details} propertyId={propertyId} refs={refs.data} onClose={() => setDetails(null)} />}
      <AlertDialog open={!!apagando} onOpenChange={(v) => !v && setApagando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este {config.singular}?</AlertDialogTitle>
            <AlertDialogDescription>O registro sai da lista e dos relatórios. Isso não pode ser desfeito.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-12">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="h-12 bg-alerta text-white hover:bg-alerta/90 dark:text-[#0e1712]" onClick={() => { const r = apagando; setApagando(null); if (r) void remove(r); }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProductionArea({ propertyId, pedido }: { propertyId: string; pedido: Pedido }) {
  const [tab, setTab] = useState<"milk" | "notes">(pedido.novo === "anotacao" ? "notes" : "milk");
  const [novaAnotacao, setNovaAnotacao] = useState(pedido.novo === "anotacao");
  useEffect(() => { if (pedido.novo === "anotacao") { setTab("notes"); setNovaAnotacao(true); pedido.limpar(); } }, [pedido.novo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const showNotes = () => setTab("notes"); window.addEventListener("yui:show-notes", showNotes); return () => window.removeEventListener("yui:show-notes", showNotes); }, []);
  return (
    <div>
      <Abas rotulo="Leite" valor={tab} aoMudar={setTab} opcoes={[{ valor: "milk", rotulo: "Registros de leite" }, { valor: "notes", rotulo: "Anotações", tour: "notas-aba" }]} />
      {tab === "milk"
        ? <CrudModule key={`${propertyId}:producao`} config={modules["producao"] ?? productionNotes} propertyId={propertyId} globalSearch="" pedido={pedido} />
        : <NotesMural key={propertyId} propertyId={propertyId} globalSearch="" abrirNova={novaAnotacao} aoAbrirNova={() => setNovaAnotacao(false)} />}
    </div>
  );
}

function VaccinationArea({ propertyId, pedido }: { propertyId: string; pedido: Pedido }) {
  const [tab, setTab] = useState<"applications" | "types">("applications");
  return (
    <div>
      <Abas rotulo="Vacinação" valor={tab} aoMudar={setTab} opcoes={[{ valor: "applications", rotulo: "Aplicações" }, { valor: "types", rotulo: "Tipos de vacina" }]} />
      {tab === "applications"
        ? <CrudModule key={`${propertyId}:vacinacao`} config={modules["vacinacao"] ?? vaccineTypes} propertyId={propertyId} globalSearch="" pedido={pedido} />
        : <CrudModule key={`${propertyId}:tipos_vacinas`} config={vaccineTypes} propertyId={propertyId} globalSearch="" />}
    </div>
  );
}

type RefsAnimais = { animals: { id: string; nome: string | null; numero_brinco: string; data_nascimento: string | null }[]; lots: { id: string; nome: string }[]; vaccines: { id: string; nome: string }[] } | undefined;

function AnimalDetails({ open, animal, propertyId, refs, onClose }: { open: boolean; animal: Row | null; propertyId: string; refs: RefsAnimais; onClose: () => void }) {
  const animalId = String(animal?.["id"] ?? "");
  const history = useQuery({
    queryKey: ["animal-history", animalId],
    enabled: open && !!animalId,
    queryFn: async () => {
      const [weights, vaccines, inseminations, milk, notes, children] = await Promise.all([
        supabase.from("pesagens").select("id,data,peso_kg,observacoes").eq("animal_id", animalId).order("data", { ascending: false }).limit(200),
        supabase.from("vacinacoes").select("id,data_aplicacao,proxima_aplicacao,tipo_vacina_id,responsavel").eq("animal_id", animalId).order("data_aplicacao", { ascending: false }),
        supabase.from("inseminacoes").select("id,data_inseminacao,previsao_parto,situacao,reprodutor_semen").eq("animal_id", animalId).order("data_inseminacao", { ascending: false }),
        supabase.from("producao_leite").select("id,data,litros,valor_total").eq("animal_id", animalId).order("data", { ascending: false }).limit(200),
        supabase.from("anotacoes_producao").select("id,data,observacao,producao").eq("animal_id", animalId).order("data", { ascending: false }).limit(200),
        supabase.from("animais").select("id,nome,numero_brinco,data_nascimento,sexo,situacao").eq("propriedade_id", propertyId).or(`mae_id.eq.${animalId},pai_id.eq.${animalId}`).order("data_nascimento", { ascending: false }),
      ]);
      const error = [weights, vaccines, inseminations, milk, notes, children].find((r) => r.error)?.error;
      if (error) throw error;
      return { weights: weights.data ?? [], vaccines: vaccines.data ?? [], inseminations: inseminations.data ?? [], milk: milk.data ?? [], notes: notes.data ?? [], children: children.data ?? [] };
    },
  });
  const lot = refs?.lots.find((item) => item.id === animal?.["lote_id"])?.nome;
  const parent = (id: unknown) => { const found = refs?.animals.find((item) => item.id === id); return found ? found.nome || `Brinco ${found.numero_brinco}` : "—"; };
  const entries = useMemo(() => {
    if (!history.data) return [];
    // Ganho de peso por dia entre pesagens seguidas (mais recente primeiro).
    const pesos = [...history.data.weights].sort((a, b) => String(a.data).localeCompare(String(b.data)));
    const ganho = new Map<string, number>();
    for (let i = 1; i < pesos.length; i++) {
      const dias = (Date.parse(String(pesos[i].data)) - Date.parse(String(pesos[i - 1].data))) / 86_400_000;
      if (dias > 0) ganho.set(String(pesos[i].id), (Number(pesos[i].peso_kg) - Number(pesos[i - 1].peso_kg)) / dias);
    }
    return [
      ...history.data.weights.map((item) => ({ id: `w-${item.id}`, date: item.data, title: `Pesagem: ${Number(item.peso_kg).toLocaleString("pt-BR")} kg`, detail: ganho.has(String(item.id)) ? `${(ganho.get(String(item.id)) ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg por dia desde a pesagem anterior` : item.observacoes })),
      ...history.data.vaccines.map((item) => ({ id: `v-${item.id}`, date: item.data_aplicacao, title: `Vacina: ${refs?.vaccines.find((v) => v.id === item.tipo_vacina_id)?.nome ?? "aplicação"}`, detail: item.proxima_aplicacao ? `Próxima dose em ${formatarDataBR(item.proxima_aplicacao)}` : item.responsavel })),
      ...history.data.inseminations.map((item) => ({ id: `i-${item.id}`, date: item.data_inseminacao, title: `Inseminação: ${pretty(item.situacao)}`, detail: `${item.reprodutor_semen} · parto previsto em ${formatarDataBR(item.previsao_parto)}` })),
      ...history.data.milk.map((item) => ({ id: `m-${item.id}`, date: item.data, title: `Leite: ${Number(item.litros).toLocaleString("pt-BR")} litros`, detail: money(item.valor_total) })),
      ...history.data.notes.map((item) => ({ id: `n-${item.id}`, date: item.data, title: "Anotação", detail: item.observacao })),
    ].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [history.data, refs?.vaccines]);
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader className="flex-row items-center gap-4 space-y-0 text-left">
          {!!animal?.["numero_brinco"] && <Brinco tamanho="grande" valor={String(animal["numero_brinco"])} rotulo={`Brinco ${String(animal["numero_brinco"])}`} />}
          <div className="min-w-0">
            <DialogTitle className="break-words text-[2rem] lg:text-[2.5rem]">{String(animal?.["nome"] || `Brinco ${String(animal?.["numero_brinco"] ?? "")}`)}</DialogTitle>
            <DialogDescription>Ficha do animal: cadastro, família e tudo que aconteceu com ele.</DialogDescription>
          </div>
        </DialogHeader>
        <dl className="grid grid-cols-2 gap-4 border-y border-border py-4 sm:grid-cols-4">
          <AnimalFact label="Situação" value={<Status value={String(animal?.["situacao"] ?? "")} />} />
          <AnimalFact label="Lote" value={lot ?? "—"} />
          <AnimalFact label="Nascimento" value={formatarDataBR(animal?.["data_nascimento"])} />
          <AnimalFact label="Sexo" value={animal?.["sexo"] === "F" ? "Fêmea" : animal?.["sexo"] === "M" ? "Macho" : "—"} />
          <AnimalFact label="Raça" value={pretty(animal?.["raca"])} />
          <AnimalFact label="Mãe" value={parent(animal?.["mae_id"])} />
          <AnimalFact label="Pai" value={parent(animal?.["pai_id"])} />
        </dl>
        <div className="grid gap-6 lg:grid-cols-[1.3fr_.7fr]">
          <section>
            <h3 className="titulo-secao mb-3 text-[1.4rem]">Linha do tempo</h3>
            {history.isLoading ? <p className="text-muted-foreground">Carregando…</p> : history.error ? <p className="text-alerta">Não foi possível carregar o histórico.</p> : entries.length ? (
              <ol className="divide-y divide-border">
                {entries.map((entry) => (
                  <li key={entry.id} className="grid grid-cols-[6.5rem_1fr] gap-3 py-3">
                    <time className="text-sm text-muted-foreground tabular-nums">{formatarDataBR(entry.date)}</time>
                    <div className="min-w-0"><strong className="block">{entry.title}</strong>{entry.detail && <span className="text-sm text-muted-foreground">{entry.detail}</span>}</div>
                  </li>
                ))}
              </ol>
            ) : <Empty message="Nada registrado para este animal ainda." />}
          </section>
          <section>
            <h3 className="titulo-secao mb-3 text-[1.4rem]">Filhos</h3>
            {history.data?.children.length ? (
              <ul className="divide-y divide-border">
                {history.data.children.map((child) => (
                  <li className="flex items-center gap-3 py-2.5" key={child.id}>
                    <Brinco tamanho="pequeno" valor={child.numero_brinco} />
                    <span className="min-w-0"><strong className="block truncate">{child.nome || `Brinco ${child.numero_brinco}`}</strong><span className="text-sm text-muted-foreground">{child.data_nascimento ? formatarDataBR(child.data_nascimento) : "Data não informada"} · {child.sexo === "F" ? "Fêmea" : "Macho"}</span></span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-muted-foreground">Nenhum filho registrado.</p>}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AnimalFact({ label, value }: { label: string; value: ReactNode }) {
  return <div><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 font-bold">{value}</dd></div>;
}

const CONFIG_COMPRAS: Module = { title: "Compras", singular: "compra", novo: "Nova compra", primeiro: "Registrar a primeira compra", table: "compras", icon: ShoppingCart, description: "O que entrou na fazenda. O valor vai sozinho para o financeiro.", searchColumns: ["produto_animal", "fornecedor"], columns: [{ key: "data", label: "Data" }, { key: "produto_animal", label: "Produto ou animal" }, { key: "quantidade", label: "Quantidade" }, { key: "fornecedor", label: "Fornecedor" }, { key: "valor", label: "Valor" }], fields: [{ key: "data", label: "Data", type: "date", required: true }, { key: "produto_animal", label: "Produto ou animal", required: true }, { key: "quantidade", label: "Quantidade", type: "number", required: true }, { key: "valor", label: "Valor total", type: "number", required: true }, { key: "fornecedor", label: "Fornecedor" }, { key: "categoria", label: "Categoria", required: true }, { key: "observacao", label: "Observação", type: "textarea" }] };
const CONFIG_VENDAS: Module = { title: "Vendas", singular: "venda", novo: "Nova venda", primeiro: "Registrar a primeira venda", table: "vendas", icon: TrendingUp, description: "O que saiu da fazenda. O valor vai sozinho para o financeiro; o animal vendido sai do rebanho ativo.", searchColumns: ["item", "comprador"], columns: [{ key: "data", label: "Data" }, { key: "item", label: "Item" }, { key: "quantidade", label: "Quantidade" }, { key: "comprador", label: "Comprador" }, { key: "valor", label: "Valor" }], fields: [{ key: "data", label: "Data", type: "date", required: true }, { key: "animal_id", label: "Animal", type: "animal", activeOnly: true }, { key: "item", label: "Item", required: true }, { key: "quantidade", label: "Quantidade", type: "number", required: true }, { key: "valor", label: "Valor total", type: "number", required: true }, { key: "comprador", label: "Comprador" }, { key: "categoria", label: "Categoria", required: true }, { key: "observacao", label: "Observação", type: "textarea" }] };

function Commerce({ propertyId, pedido }: { propertyId: string; pedido: Pedido }) {
  const [tab, setTab] = useState<"compras" | "vendas">("compras");
  return (
    <div>
      <Abas rotulo="Compra e venda" valor={tab} aoMudar={setTab} opcoes={[{ valor: "compras", rotulo: "Compras" }, { valor: "vendas", rotulo: "Vendas" }]} />
      <CrudModule key={tab} config={tab === "compras" ? CONFIG_COMPRAS : CONFIG_VENDAS} propertyId={propertyId} globalSearch="" pedido={pedido} />
    </div>
  );
}

function SettingsPage({ property, onUpdated }: { property: Database["public"]["Tables"]["propriedades"]["Row"] | undefined; onUpdated: () => void }) {
  const [name, setName] = useState(property?.nome ?? "");
  const [city, setCity] = useState(property?.cidade ?? "");
  const [state, setState] = useState(property?.estado ?? "");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { setName(property?.nome ?? ""); setCity(property?.cidade ?? ""); setState(property?.estado ?? ""); }, [property]);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!property || salvando) return;
    setSalvando(true);
    const { error } = await supabase.from("propriedades").update({ nome: name.trim(), cidade: city.trim() || null, estado: state.trim().toUpperCase() || null }).eq("id", property.id);
    setSalvando(false);
    if (error) toast.error(friendlyError(error));
    else { toast.success("Dados da propriedade salvos."); onUpdated(); }
  };
  return (
    <section className="painel max-w-3xl p-4 sm:p-6" aria-labelledby="dados-propriedade">
      <h2 id="dados-propriedade" className="titulo-secao">Dados da propriedade</h2>
      <p className="mt-1 text-muted-foreground">O nome aparece no topo e nos relatórios; a cidade é usada na previsão do tempo.</p>
      <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_6rem]">
        <div className="sm:col-span-3"><Label htmlFor="cfg-nome">Nome</Label><Input id="cfg-nome" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="sm:col-span-2"><Label htmlFor="cfg-cidade">Cidade</Label><Input id="cfg-cidade" maxLength={80} value={city} onChange={(e) => setCity(e.target.value)} /></div>
        <div><Label htmlFor="cfg-uf">Estado</Label><Input id="cfg-uf" value={state} onChange={(e) => setState(e.target.value)} maxLength={2} /></div>
        <div className="sm:col-span-3"><Button type="submit" className="h-12 px-5" disabled={salvando}>{salvando ? "Salvando…" : "Salvar dados"}</Button></div>
      </form>
    </section>
  );
}

function SectionLoading() { return <div className="grid min-h-60 place-items-center text-muted-foreground" aria-busy="true">Carregando…</div>; }
