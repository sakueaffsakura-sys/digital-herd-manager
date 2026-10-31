import { useMemo, useState, type ReactNode } from "react";
import { Calculator, CloudSun, Droplets, Scale, Syringe, Sprout, Wheat, CalendarHeart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageTitle, money } from "../shared";
import { Clima } from "./Clima";
import {
  arrobasParaPesoVivo, calagem, dosePorPeso, lerNumero, lotacao, pesoVivoParaArrobas,
  previsaoParto, quadradoPearson, racaoPorDia, valorDaVenda,
} from "@/lib/calculos";
import { dataLocalISO, formatarDataBR } from "@/lib/datas";

const n = (v: number | null | undefined, casas = 2) =>
  v == null ? "—" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: casas });

/** Caixa de uma calculadora: título, campos e o resultado em destaque. */
function Conta({ titulo, icone: Icone, explica, children, resultado, detalhe }: {
  titulo: string; icone: typeof Scale; explica: string; children: ReactNode; resultado: string; detalhe?: string;
}) {
  return (
    <section className="painel flex flex-col p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-[1.35rem] leading-tight"><Icone className="size-5 shrink-0 text-primary" />{titulo}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{explica}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div>
      <output className="mt-4 block rounded-xl bg-sucesso-fundo px-4 py-3">
        <span className="block font-display text-[2rem] font-extrabold leading-none tabular-nums text-primary">{resultado}</span>
        {detalhe && <span className="mt-1 block text-sm text-foreground/80">{detalhe}</span>}
      </output>
    </section>
  );
}

function Campo({ id, rotulo, valor, aoMudar, sufixo, modo = "decimal", tipo = "text" }: {
  id: string; rotulo: string; valor: string; aoMudar: (v: string) => void; sufixo?: string;
  modo?: "decimal" | "numeric"; tipo?: "text" | "date";
}) {
  return (
    <div>
      <Label htmlFor={id}>{rotulo}{sufixo ? ` (${sufixo})` : ""}</Label>
      <Input id={id} type={tipo} inputMode={tipo === "date" ? undefined : modo} value={valor} onChange={(e) => aoMudar(e.target.value)} />
    </div>
  );
}

function Dose() {
  const [peso, setPeso] = useState("320");
  const [kgPorMl, setKgPorMl] = useState("50");
  const ml = dosePorPeso(lerNumero(peso), lerNumero(kgPorMl));
  return (
    <Conta
      titulo="Dose pelo peso" icone={Syringe}
      explica="Para remédio que vem como “1 mL para cada X kg”. Confira sempre a bula."
      resultado={ml == null ? "—" : `${n(ml, 2)} mL`}
      detalhe={ml == null ? "Preencha o peso e a proporção da bula." : `Animal de ${n(lerNumero(peso), 0)} kg, 1 mL para cada ${n(lerNumero(kgPorMl), 0)} kg.`}
    >
      <Campo id="dose-peso" rotulo="Peso do animal" sufixo="kg" valor={peso} aoMudar={setPeso} />
      <Campo id="dose-kg" rotulo="1 mL para cada" sufixo="kg" valor={kgPorMl} aoMudar={setKgPorMl} />
    </Conta>
  );
}

function Mistura() {
  const [alto, setAlto] = useState("45");
  const [baixo, setBaixo] = useState("9");
  const [alvo, setAlvo] = useState("18");
  const [total, setTotal] = useState("100");
  const r = quadradoPearson(lerNumero(alto), lerNumero(baixo), lerNumero(alvo));
  const kg = lerNumero(total) ?? 0;
  return (
    <Conta
      titulo="Mistura de ração (quadrado de Pearson)" icone={Wheat}
      explica="Quanto usar de cada alimento para chegar na proteína que você quer."
      resultado={r == null ? "—" : `${n(r.parteAlto * 100, 1)}% + ${n(r.parteBaixo * 100, 1)}%`}
      detalhe={r == null
        ? "A proteína desejada precisa ficar entre a do alimento forte e a do fraco."
        : `Em ${n(kg, 0)} kg de mistura: ${n(r.parteAlto * kg, 1)} kg do alimento forte e ${n(r.parteBaixo * kg, 1)} kg do fraco.`}
    >
      <Campo id="mix-alto" rotulo="Proteína do alimento forte" sufixo="%" valor={alto} aoMudar={setAlto} />
      <Campo id="mix-baixo" rotulo="Proteína do alimento fraco" sufixo="%" valor={baixo} aoMudar={setBaixo} />
      <Campo id="mix-alvo" rotulo="Proteína que você quer" sufixo="%" valor={alvo} aoMudar={setAlvo} />
      <Campo id="mix-total" rotulo="Quanto vai misturar" sufixo="kg" valor={total} aoMudar={setTotal} />
    </Conta>
  );
}

function Racao() {
  const [peso, setPeso] = useState("450");
  const [pct, setPct] = useState("2,5");
  const [animais, setAnimais] = useState("20");
  const r = racaoPorDia(lerNumero(peso), lerNumero(pct), Math.max(1, Math.round(lerNumero(animais) ?? 1)));
  return (
    <Conta
      titulo="Ração por dia" icone={Wheat}
      explica="Pelo peso vivo. Gado de corte no cocho costuma comer de 2% a 3% do peso."
      resultado={r == null ? "—" : `${n(r.total, 1)} kg/dia`}
      detalhe={r == null ? "Preencha peso e porcentagem." : `${n(r.porAnimal, 2)} kg por animal, por dia.`}
    >
      <Campo id="rac-peso" rotulo="Peso médio" sufixo="kg" valor={peso} aoMudar={setPeso} />
      <Campo id="rac-pct" rotulo="Do peso vivo" sufixo="%" valor={pct} aoMudar={setPct} />
      <Campo id="rac-qtd" rotulo="Quantos animais" valor={animais} aoMudar={setAnimais} modo="numeric" />
    </Conta>
  );
}

function Calagem() {
  const [ctc, setCtc] = useState("8");
  const [v1, setV1] = useState("40");
  const [v2, setV2] = useState("70");
  const [prnt, setPrnt] = useState("85");
  const [ha, setHa] = useState("10");
  const t = calagem(lerNumero(ctc), lerNumero(v1), lerNumero(v2), lerNumero(prnt));
  const area = lerNumero(ha) ?? 0;
  return (
    <Conta
      titulo="Calcário por hectare" icone={Sprout}
      explica="Use os números da análise de solo (CTC e saturação por bases V%) e o PRNT do saco."
      resultado={t == null ? "—" : `${n(t, 2)} t/ha`}
      detalhe={t == null ? "Preencha a análise de solo e o PRNT." : t === 0 ? "A saturação já está no ponto: não precisa calcário." : `Para ${n(area, 1)} ha: ${n(t * area, 1)} toneladas no total.`}
    >
      <Campo id="cal-ctc" rotulo="CTC" sufixo="cmolc/dm³" valor={ctc} aoMudar={setCtc} />
      <Campo id="cal-prnt" rotulo="PRNT do calcário" sufixo="%" valor={prnt} aoMudar={setPrnt} />
      <Campo id="cal-v1" rotulo="V atual" sufixo="%" valor={v1} aoMudar={setV1} />
      <Campo id="cal-v2" rotulo="V desejado" sufixo="%" valor={v2} aoMudar={setV2} />
      <Campo id="cal-ha" rotulo="Área" sufixo="hectares" valor={ha} aoMudar={setHa} />
    </Conta>
  );
}

function Lotacao() {
  const [animais, setAnimais] = useState("50");
  const [peso, setPeso] = useState("450");
  const [ha, setHa] = useState("25");
  const r = lotacao(lerNumero(animais), lerNumero(peso), lerNumero(ha));
  return (
    <Conta
      titulo="Lotação do pasto" icone={Scale}
      explica="Uma unidade animal (UA) são 450 kg de peso vivo."
      resultado={r == null ? "—" : `${n(r.uaPorHa, 2)} UA/ha`}
      detalhe={r == null ? "Preencha quantos animais, o peso médio e a área." : `${n(r.ua, 1)} UA no total · ${n(r.kgPorHa, 0)} kg de peso vivo por hectare.`}
    >
      <Campo id="lot-qtd" rotulo="Quantos animais" valor={animais} aoMudar={setAnimais} modo="numeric" />
      <Campo id="lot-peso" rotulo="Peso médio" sufixo="kg" valor={peso} aoMudar={setPeso} />
      <Campo id="lot-ha" rotulo="Área de pasto" sufixo="hectares" valor={ha} aoMudar={setHa} />
    </Conta>
  );
}

function Arroba() {
  const [peso, setPeso] = useState("480");
  const [rend, setRend] = useState("52");
  const [preco, setPreco] = useState("320");
  const [arrobas, setArrobas] = useState("16");
  const ida = pesoVivoParaArrobas(lerNumero(peso), lerNumero(rend));
  const volta = arrobasParaPesoVivo(lerNumero(arrobas), lerNumero(rend));
  const valor = valorDaVenda(ida?.arrobas ?? null, lerNumero(preco));
  return (
    <Conta
      titulo="Arroba e peso vivo" icone={Calculator}
      explica="Uma arroba são 15 kg de carcaça. O rendimento é quanto do peso vivo vira carcaça."
      resultado={ida == null ? "—" : `${n(ida.arrobas, 2)} @`}
      detalhe={ida == null
        ? "Preencha o peso vivo e o rendimento."
        : `${n(ida.carcacaKg, 1)} kg de carcaça${valor == null ? "" : ` · ${money(valor)} a ${money(lerNumero(preco))} a arroba`}. ${volta == null ? "" : `Na volta: ${n(arrobas ? lerNumero(arrobas) : null, 1)} @ equivalem a ${n(volta, 0)} kg vivos.`}`}
    >
      <Campo id="arr-peso" rotulo="Peso vivo" sufixo="kg" valor={peso} aoMudar={setPeso} />
      <Campo id="arr-rend" rotulo="Rendimento de carcaça" sufixo="%" valor={rend} aoMudar={setRend} />
      <Campo id="arr-preco" rotulo="Preço da arroba" sufixo="R$" valor={preco} aoMudar={setPreco} />
      <Campo id="arr-arrobas" rotulo="Ou converter de volta" sufixo="@" valor={arrobas} aoMudar={setArrobas} />
    </Conta>
  );
}

function Parto({ diasGestacao }: { diasGestacao: number }) {
  const [data, setData] = useState(dataLocalISO());
  const [dias, setDias] = useState(String(diasGestacao));
  const g = Math.round(lerNumero(dias) ?? diasGestacao);
  const prevista = previsaoParto(data, g);
  const faltam = useMemo(() => {
    if (!prevista) return null;
    const hoje = Date.parse(`${dataLocalISO()}T00:00:00Z`);
    return Math.round((Date.parse(`${prevista}T00:00:00Z`) - hoje) / 86_400_000);
  }, [prevista]);
  return (
    <Conta
      titulo="Data do parto" icone={CalendarHeart}
      explica={`Dia da cobertura mais os dias de gestação (${diasGestacao} dias nesta propriedade).`}
      resultado={prevista ? formatarDataBR(prevista) : "—"}
      detalhe={prevista == null ? "Confira a data e os dias de gestação." : faltam == null ? "" : faltam >= 0 ? `Faltam ${faltam} dia(s).` : `Já passou ${-faltam} dia(s) da previsão.`}
    >
      <Campo id="par-data" rotulo="Dia da cobertura" valor={data} aoMudar={setData} tipo="date" />
      <Campo id="par-dias" rotulo="Dias de gestação" valor={dias} aoMudar={setDias} modo="numeric" />
    </Conta>
  );
}

/** Calculadoras e previsão do tempo. Tudo roda na própria tela; nada é gravado. */
export default function Ferramentas({ diasGestacao, cidade, estado }: { diasGestacao: number; cidade: string | null; estado: string | null }) {
  return (
    <div>
      <PageTitle title="Calculadoras e clima" description="As contas do dia a dia, prontas. Mude os números e o resultado muda na hora." />
      <section className="mb-8">
        <h2 className="titulo-secao flex items-center gap-2"><CloudSun className="size-6 text-primary" />Previsão do tempo</h2>
        <Clima cidade={cidade} estado={estado} />
      </section>
      <h2 className="titulo-secao flex items-center gap-2"><Droplets className="size-6 text-primary" />Calculadoras</h2>
      <div className="mt-3 grid gap-4 xl:grid-cols-2">
        <Dose />
        <Parto diasGestacao={diasGestacao} />
        <Mistura />
        <Racao />
        <Lotacao />
        <Calagem />
        <Arroba />
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        As contas são uma ajuda, não substituem o veterinário nem o agrônomo. Para remédios, siga sempre a bula e a receita.
      </p>
    </div>
  );
}
