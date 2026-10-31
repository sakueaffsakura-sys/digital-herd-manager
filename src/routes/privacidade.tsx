import { createFileRoute } from "@tanstack/react-router";
import { PaginaPublica, Texto } from "@/components/publico/PaginaPublica";

// RASCUNHO PARA REVISÃO JURÍDICA: texto claro, em linguagem simples, mas que deve ser revisado por
// um advogado antes de ser considerado definitivo (inclua o CNPJ/CPF e o e-mail do responsável).
export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de privacidade | Pecuária Digital" },
      { name: "description", content: "Quais dados o Pecuária Digital guarda, para quê, por quanto tempo e como pedir cópia ou exclusão." },
    ],
  }),
  component: Privacidade,
});

function Privacidade() {
  return (
    <PaginaPublica titulo="Política de privacidade" subtitulo="Atualizada em 31 de outubro de 2026.">
      <Texto>
        <p>Esta página explica, em linguagem simples, quais dados o Pecuária Digital guarda, para que usa, com quem compartilha, por quanto tempo guarda e como você pode pedir uma cópia ou a exclusão. Ela segue a Lei Geral de Proteção de Dados (Lei 13.709/2018, a LGPD).</p>

        <h2>Que dados guardamos</h2>
        <ul>
          <li><strong>Da sua conta:</strong> nome, e-mail, senha (guardada embaralhada, ninguém consegue ler), telefone e foto, se você informar.</li>
          <li><strong>Da sua fazenda:</strong> tudo que você cadastra: animais, lotes, vacinas, inseminações, nascimentos, pesagens, leite, anotações, compras, vendas e lançamentos de dinheiro, além do logo e do banner da propriedade.</li>
          <li><strong>De uso e segurança:</strong> data e hora de acesso, o navegador ou aparelho usado e o endereço de rede, para proteger a conta contra acessos estranhos e ataques.</li>
          <li><strong>De pagamento:</strong> o plano escolhido, o valor, a data e a situação do pagamento. Os dados do cartão ficam só com o Mercado Pago; nós não recebemos o número do cartão.</li>
          <li><strong>Conversas com a Yui:</strong> as perguntas que você faz à assistente e as respostas, para manter o histórico da conversa.</li>
        </ul>

        <h2>Para que usamos</h2>
        <ul>
          <li>Para o site e o aplicativo funcionarem: mostrar e guardar os dados da sua fazenda, calcular resumos, avisos e relatórios.</li>
          <li>Para proteger a sua conta: confirmar quem está entrando, bloquear tentativas de invasão e recuperar a senha.</li>
          <li>Para cobrar e liberar a assinatura, quando você assina.</li>
          <li>Para responder ao suporte quando você pede ajuda.</li>
        </ul>
        <p>Não vendemos os seus dados e não usamos os dados da sua fazenda para propaganda.</p>

        <h2>Com quem compartilhamos</h2>
        <p>Só com empresas que fazem o serviço funcionar, e só o necessário:</p>
        <ul>
          <li><strong>Hospedagem e banco de dados</strong> (Lovable Cloud, que usa Supabase e Cloudflare): guardam os dados com criptografia na transmissão.</li>
          <li><strong>Mercado Pago:</strong> processa os pagamentos da assinatura.</li>
          <li><strong>Serviços de inteligência artificial</strong> usados pela Yui: recebem a pergunta e um resumo dos números da propriedade aberta para montar a resposta.</li>
          <li><strong>Google:</strong> apenas se você escolher entrar com a conta Google.</li>
        </ul>
        <p>Também podemos entregar dados quando a lei ou uma ordem judicial obrigar.</p>

        <h2>Por quanto tempo guardamos</h2>
        <ul>
          <li>Os dados da conta e da fazenda ficam guardados enquanto a conta existir.</li>
          <li>Quando você pede a exclusão, apagamos a conta e os dados das propriedades em que você é dono(a) em até 15 dias. Cópias de segurança automáticas podem guardar os dados por alguns dias a mais, até serem substituídas.</li>
          <li>Registros de pagamento podem ser guardados pelo prazo que a lei fiscal exigir.</li>
          <li>Registros de segurança (tentativas de acesso bloqueadas) são apagados em poucos meses.</li>
        </ul>

        <h2>Seus direitos</h2>
        <p>Você pode, a qualquer momento:</p>
        <ul>
          <li><strong>Ver e corrigir</strong> os seus dados nas páginas do site.</li>
          <li><strong>Baixar uma cópia</strong> de tudo em Conta, Senha e segurança, Baixar meus dados (arquivo com planilhas).</li>
          <li><strong>Pedir a exclusão da conta</strong> em Conta, Senha e segurança, Pedir exclusão da conta.</li>
          <li><strong>Tirar dúvidas</strong> pelo suporte do site (Conta, Ajuda, Falar com o suporte).</li>
        </ul>

        <h2>Cookies e armazenamento no aparelho</h2>
        <p>Usamos o armazenamento do navegador para manter você conectado, lembrar o tema claro ou escuro e a propriedade escolhida. Um cookie técnico identifica o aparelho para a proteção contra ataques. Não usamos cookies de propaganda.</p>

        <h2>Segurança</h2>
        <p>A conexão com o site é sempre criptografada. Cada conta só enxerga as próprias propriedades, e isso é garantido no banco de dados, não só na tela. Você pode ligar a verificação em duas etapas e ver os aparelhos conectados em Senha e segurança.</p>

        <h2>Mudanças nesta política</h2>
        <p>Quando esta política mudar, a data no alto da página é atualizada e avisamos dentro do site se a mudança for importante.</p>
      </Texto>
    </PaginaPublica>
  );
}
