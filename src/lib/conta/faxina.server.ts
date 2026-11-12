/**
 * A faxina das tabelas de conta: sessão vencida, link de senha usado, cadastro de 2FA
 * abandonado.
 *
 * Nada disso é perigoso ficar — uma sessão vencida é recusada pela data, não pela
 * existência da linha. O problema é crescer: com o tempo, a tabela de sessões de um site
 * com uso diário fica com muito mais lixo do que sessão viva, e aí a leitura de cada
 * pedido passa a varrer o lixo.
 *
 * Por que não é uma tarefa agendada: a hospedagem compartilhada não tem agendador dentro
 * do banco, e o cPanel tem, mas seria mais um passo de configuração para o produtor fazer —
 * e um passo que, se ele esquecer, ninguém descobre até o site ficar lento. Então a faxina
 * pega carona num pedido, de vez em quando: a cada quinhentos, mais ou menos um faz a
 * limpeza. Ninguém espera por ela, e ela acontece sozinha enquanto o site é usado.
 */
import { executar, instanteUtc } from "@/lib/dados/banco.server";

/** Um pedido em quinhentos faz a faxina. O resto nem fica sabendo. */
const CHANCE = 500;
/** Link de senha e cadastro de 2FA abandonado: uma semana é tempo de sobra. */
const DIAS_PARA_ESQUECER = 7;

let rodando = false;

/**
 * Faz a faxina de vez em quando, sem fazer ninguém esperar.
 *
 * Não devolve promessa de propósito: quem chama segue em frente e a limpeza acontece
 * atrás. Se falhar, fica no registro e a próxima rodada tenta de novo — uma faxina que não
 * aconteceu não quebra nada, e não vale atrasar a resposta de quem está usando o site.
 */
export function talvezFaxinar(): void {
  if (rodando || Math.floor(Math.random() * CHANCE) !== 0) return;
  rodando = true;
  void faxinar()
    .catch((erro) => console.error("Faxina das contas falhou", erro))
    .finally(() => { rodando = false; });
}

export async function faxinar(): Promise<{ sessoes: number; recuperacoes: number; cadastros2fa: number }> {
  const agora = instanteUtc(new Date());
  const antigo = instanteUtc(new Date(Date.now() - DIAS_PARA_ESQUECER * 86_400_000));

  const sessoes = await executar("DELETE FROM sessoes WHERE expira_em < ?", [agora]);
  // Link de recuperação: o usado também sai, depois de uma semana. Guardá-lo para sempre
  // só serviria para contar quantas vezes alguém esqueceu a senha.
  const recuperacoes = await executar(
    "DELETE FROM recuperacoes_senha WHERE expira_em < ? OR (usado_em IS NOT NULL AND usado_em < ?)",
    [antigo, antigo],
  );
  // Cadastro de 2FA que ninguém confirmou em uma semana: a pessoa desistiu no meio, e o
  // segredo guardado não serve para nada.
  const cadastros2fa = await executar(
    "DELETE FROM fatores_2fa WHERE confirmado_em IS NULL AND criado_em < ?",
    [antigo],
  );

  return {
    sessoes: sessoes.afetadas,
    recuperacoes: recuperacoes.afetadas,
    cadastros2fa: cadastros2fa.afetadas,
  };
}
