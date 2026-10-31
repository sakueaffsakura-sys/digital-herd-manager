import { createFileRoute } from "@tanstack/react-router";
import { PaginaPublica, Texto } from "@/components/publico/PaginaPublica";

// RASCUNHO PARA REVISÃO JURÍDICA: revisar com advogado antes de considerar definitivo
// (incluir razão social/CPF, endereço e e-mail do responsável pelo serviço).
export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso | Pecuária Digital" },
      { name: "description", content: "Regras de uso do Pecuária Digital: conta, dados da fazenda, assinatura, biblioteca e responsabilidades." },
    ],
  }),
  component: Termos,
});

function Termos() {
  return (
    <PaginaPublica titulo="Termos de uso" subtitulo="Atualizados em 31 de outubro de 2026.">
      <Texto>
        <p>Ao criar uma conta ou usar o Pecuária Digital (site e aplicativo), você concorda com estes termos. Se não concordar, não use o serviço.</p>

        <h2>O serviço</h2>
        <p>O Pecuária Digital é um sistema para anotar e acompanhar a fazenda: rebanho, vacinas, reprodução, leite, compras, vendas e dinheiro, com resumos, avisos e relatórios. Os cálculos ajudam na gestão, mas não substituem a orientação de veterinário, agrônomo ou contador.</p>

        <h2>Sua conta</h2>
        <ul>
          <li>Use dados verdadeiros e mantenha a senha em segredo. Recomendamos ligar a verificação em duas etapas.</li>
          <li>Você é responsável pelo que for feito com a sua conta. Se perceber um acesso estranho, troque a senha e use Sair de todos os aparelhos.</li>
          <li>Podemos bloquear contas usadas para fraude, ataque ao sistema ou para prejudicar outras pessoas.</li>
        </ul>

        <h2>Os dados da sua fazenda são seus</h2>
        <p>Você continua dono(a) de tudo que cadastra. Nós só guardamos e processamos esses dados para o serviço funcionar, como explica a <a href="/privacidade" className="font-bold text-primary underline underline-offset-2">política de privacidade</a>. Você pode baixar uma cópia ou pedir a exclusão quando quiser.</p>

        <h2>Plano gratuito e assinatura</h2>
        <ul>
          <li>O plano gratuito permite usar as funções principais. Alguns recursos e a biblioteca de eBooks são só para assinantes.</li>
          <li>A assinatura é paga pelo Mercado Pago (Pix, cartão ou boleto) e vale pelo período escolhido. Ela não se renova sozinha: perto do vencimento, avisamos para você renovar se quiser.</li>
          <li>Os preços aparecem na página de assinatura antes do pagamento.</li>
          <li><strong>Direito de arrependimento:</strong> como a compra é feita pela internet, você pode desistir em até 7 dias depois do pagamento e receber o valor de volta (Código de Defesa do Consumidor, art. 49). Peça pelo suporte.</li>
        </ul>

        <h2>Biblioteca de eBooks</h2>
        <ul>
          <li>Os eBooks são licenciados para uso pessoal do assinante, enquanto a assinatura estiver ativa.</li>
          <li>É proibido copiar, imprimir para distribuir, compartilhar ou revender os eBooks. As páginas mostram uma marca com o nome e o e-mail de quem está lendo.</li>
          <li>O descumprimento pode levar ao cancelamento da assinatura, sem reembolso do período usado, e às medidas legais cabíveis.</li>
        </ul>

        <h2>Disponibilidade</h2>
        <p>Trabalhamos para o serviço ficar sempre no ar, mas pode haver paradas para manutenção ou por problemas de internet e dos fornecedores. Quando houver manutenção programada, avisamos no site. O aplicativo Android guarda as anotações no aparelho e envia quando a internet voltar.</p>

        <h2>Limites de responsabilidade</h2>
        <p>Não respondemos por decisões tomadas só com base nos números do sistema, por dados cadastrados errado ou por perdas causadas por falta de internet, de energia ou por uso indevido da conta por terceiros a quem você passou a senha. Isso não afasta os direitos garantidos pelo Código de Defesa do Consumidor.</p>

        <h2>Encerramento</h2>
        <p>Você pode parar de usar e pedir a exclusão da conta quando quiser. Se a conta for encerrada por descumprimento destes termos, você ainda pode pedir uma cópia dos seus dados.</p>

        <h2>Mudanças e lei aplicável</h2>
        <p>Estes termos podem mudar; a data no alto da página mostra a última versão e avisamos dentro do site quando a mudança for importante. Vale a lei brasileira, e fica escolhido o foro do domicílio do consumidor.</p>
      </Texto>
    </PaginaPublica>
  );
}
