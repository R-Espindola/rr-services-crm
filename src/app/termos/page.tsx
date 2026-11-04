import type { Metadata } from "next";
import { LegalLayout } from "../legal-layout";

export const metadata: Metadata = {
  title: "Termos e Condições | R&R Services",
  description: "Condições aplicáveis aos pedidos de orçamento e serviços de limpeza da R&R Services.",
};

export default function TermsPage() {
  return (
    <LegalLayout title="Termos e Condições de Serviço" description="Estas condições regulam os pedidos de orçamento, agendamento e prestação de serviços de limpeza e higienização pela R&R Services. A proposta individual aceite pelo cliente completa estas condições quanto ao serviço concreto.">
      <section>
        <h2>1. Identificação e contacto</h2>
        <p>Os serviços são prestados sob a marca R&amp;R Services pela entidade <strong>Roberta Cardoso Duarte</strong>, NIF/NIPC <strong>312153864</strong>, com domicílio profissional em <strong>Rua Maria Matos, 41, 1º Esq.</strong> (morada de gestão e contacto, não dispondo de estabelecimento aberto ao público, uma vez que os serviços de limpeza são prestados no local indicado pelo cliente).</p>
        <p> Para quaisquer pedidos, esclarecimentos ou apoio, utilize o e-mail <a className="font-semibold text-cyan-800 underline" href="mailto:rrservices.pt@gmail.com">rrservices.pt@gmail.com</a> e <a className="font-semibold text-cyan-800 underline" href="tel:+351969177571">+351 969 177 571</a>.</p>
      </section>

      <section>
        <h2>2. Pedidos, orçamentos e confirmação</h2>
        <p>O formulário ou assistente conversacional do website permite recolher informação e preparar uma recomendação ou estimativa. O envio do pedido, a visualização de uma estimativa ou a criação de uma conta não confirmam uma contratação nem reservam automaticamente uma data.</p>
        <p>A marcação fica confirmada quando a R&amp;R Services comunica a aceitação do serviço, a data e horário, o âmbito e o preço final, e o cliente aceita essa proposta. A proposta pode depender da confirmação das dimensões, do estado do espaço, do acesso e dos trabalhos pedidos. Qualquer alteração relevante ao âmbito ou às condições será comunicada para aprovação antes da execução.</p>
      </section>

      <section>
        <h2>3. Preços e pagamento</h2>
        <p>O preço, os serviços incluídos, eventuais extras, impostos aplicáveis e condições de pagamento são os que constarem da proposta ou confirmação escrita aceite pelo cliente. Uma estimativa automática ou indicativa não substitui o orçamento final confirmado pela equipa.</p>
        <p>Os meios e o momento de pagamento serão comunicados na proposta/confirmação. Não se aplicam taxas, suplementos ou penalizações que não tenham sido previamente informados e aceites, sem prejuízo dos direitos legais do consumidor. Se as condições do local forem diferentes das informações fornecidas e isso alterar o trabalho necessário, a equipa interromperá a execução da parte afetada e solicitará acordo sobre a alteração de preço ou âmbito.</p>
      </section>

      <section>
        <h2>4. Agendamento, reagendamento e cancelamento</h2>
        <p>O cliente deve confirmar que a data, o horário e os dados de contacto estão corretos. Para reagendar ou cancelar, deve contactar a R&amp;R Services logo que possível, através do e-mail ou telefone indicados nesta página. A alteração depende da disponibilidade da equipa e deve ser confirmada pela R&amp;R Services.</p>
        <p>Eventuais custos de cancelamento ou deslocação só serão aplicáveis se tiverem sido previamente comunicados na proposta e forem permitidos pela lei. Na falta de uma condição específica aceite, não se presume uma penalização fixa. Mantêm-se os direitos legais de livre resolução aplicáveis aos contratos celebrados à distância ou fora do estabelecimento.</p>
        <p>Se o cliente solicitar expressamente que o serviço comece durante o prazo legal de livre resolução e depois exercer esse direito após o início da execução, poderá ser devido o montante proporcional ao serviço já prestado, nos termos da lei. O direito pode cessar após a execução integral apenas nos termos legais, incluindo consentimento prévio expresso e reconhecimento dessa consequência.</p>
      </section>

      <section>
        <h2>5. Acesso ao imóvel e colaboração do cliente</h2>
        <ul>
          <li>O cliente deve assegurar acesso ao local na data acordada e comunicar antecipadamente instruções de entrada, estacionamento ou contacto no local.</li>
          <li>Deve fornecer informação correta sobre a área, estado do espaço, serviços pretendidos, materiais delicados, avarias, riscos ou restrições relevantes.</li>
          <li>Deve guardar objetos de valor, documentos e bens pessoais e, quando necessário, afastar animais ou informar a equipa sobre a sua presença.</li>
          <li>Deve garantir condições razoáveis e seguras de trabalho, incluindo acesso a água e eletricidade quando necessários e acordados para o serviço.</li>
        </ul>
        <p>A equipa executará os trabalhos acordados com diligência e cuidado, utilizando os meios previstos na proposta. Não será responsável por atrasos ou impossibilidade de execução causados por falta de acesso, informação incorreta, condições inseguras ou circunstâncias fora do seu controlo, sem prejuízo dos direitos legais do cliente. Qualquer dano deve ser comunicado assim que detetado, com informação que permita a sua análise.</p>
      </section>

      <section>
        <h2>6. Âmbito dos serviços</h2>
        <h3>Limpeza de manutenção / regular</h3>
        <p>Abrange as tarefas de manutenção acordadas na proposta, nas áreas indicadas. Frequência, duração, produtos, equipamentos e exclusões são definidos para cada serviço.</p>
        <h3>Limpeza profunda</h3>
        <p>É um serviço mais detalhado, cujo âmbito depende do estado e das características do imóvel. Tarefas específicas, como interior de eletrodomésticos, janelas ou áreas de difícil acesso, só estão incluídas se constarem da proposta aceite.</p>
        <h3>Higienização de estofos</h3>
        <p>O método é escolhido considerando o material e a informação disponível. O cliente deve informar a composição, tratamentos anteriores e manchas conhecidas, se possível. Não é possível garantir a remoção integral de todas as manchas, odores ou danos preexistentes; limitações relevantes serão comunicadas quando identificadas.</p>
        <h3>Limpeza pós-obra</h3>
        <p>O orçamento depende do tipo e quantidade de resíduos e do estado do espaço. Resíduos perigosos, entulho que exija transporte/licença específica, trabalhos em altura ou outras tarefas não descritas ficam excluídos, salvo acordo expresso e legalmente permitido.</p>
        <p>Em todos os serviços, prevalece o âmbito detalhado da proposta aceite. A equipa pode recusar ou suspender uma tarefa que apresente risco para pessoas, bens ou superfícies, explicando a situação ao cliente.</p>
      </section>

      <section>
        <h2>7. Livre resolução em contratos à distância</h2>
        <p>Quando o cliente seja consumidor e o contrato seja celebrado à distância ou fora do estabelecimento, pode aplicar-se o direito legal de livre resolução no prazo de 14 dias, nos termos e exceções previstos no Decreto-Lei n.º 24/2014. A forma de exercício, o início antecipado do serviço e as consequências da execução parcial ou integral seguem a legislação aplicável. Para exercer o direito, contacte a R&amp;R Services por escrito para o e-mail indicado nesta página, identificando o contrato e o serviço.</p>
        <p>Esta cláusula não reduz direitos imperativos conferidos ao consumidor. Pode consultar o texto legal no <a className="font-semibold text-cyan-800 underline" href="https://files.dre.pt/1s/2014/02/03200/0139301403.pdf" target="_blank" rel="noreferrer">Diário da República</a>.</p>
      </section>

      <section>
        <h2>8. Reclamações e resolução de litígios</h2>
        <p>Para resolver uma questão sobre o serviço, contacte primeiro a equipa através de <a className="font-semibold text-cyan-800 underline" href="mailto:rrservices.pt@gmail.com">rrservices.pt@gmail.com</a> ou +351 969 177 571. O consumidor pode recorrer à entidade de Resolução Alternativa de Litígios (RAL) competente. Antes da publicação, a R&amp;R Services deve indicar aqui a designação e os contactos da entidade RAL competente, bem como os dados aplicáveis do Livro de Reclamações.</p>
        <p>O consumidor pode ainda recorrer às entidades de defesa do consumidor e aos tribunais competentes, nos termos da lei.</p>
      </section>

      <section>
        <h2>9. Dados pessoais</h2>
        <p>O tratamento de dados associado a pedidos, orçamentos, contas e execução dos serviços é explicado na <a className="font-semibold text-cyan-800 underline" href="/privacidade">Política de Privacidade</a>.</p>
      </section>

      <section>
        <h2>10. Alterações e lei aplicável</h2>
        <p>Estes termos podem ser atualizados para refletir alterações legais ou operacionais. A versão aplicável ao serviço é a disponibilizada antes da aceitação da proposta, sem prejuízo das condições particulares acordadas e dos direitos imperativos do consumidor. Aplica-se a lei portuguesa, sem prejuízo das normas de proteção do consumidor que sejam imperativas.</p>
      </section>
    </LegalLayout>
  );
}
