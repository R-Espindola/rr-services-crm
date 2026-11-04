import type { Metadata } from "next";
import { LegalLayout } from "../legal-layout";

export const metadata: Metadata = {
  title: "Política de Privacidade | R&R Services",
  description: "Saiba como a R&R Services trata e protege os seus dados pessoais.",
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Política de Privacidade" description="Esta política explica que dados pessoais podem ser tratados quando visita o website, pede um orçamento, agenda um serviço ou utiliza o Portal do Cliente, para que finalidades e como pode exercer os seus direitos.">
      <section>
        <h2>1. Responsável pelo tratamento e contacto</h2>
        <p>Os serviços são prestados sob a marca R&amp;R Services pela entidade <strong>Roberta Cardoso Duarte</strong>, NIF/NIPC <strong>312153864</strong>, com domicílio profissional em <strong>Rua Maria Matos, 41, 1º Esq.</strong> (morada de gestão e contacto, não dispondo de estabelecimento aberto ao público, uma vez que os serviços de limpeza são prestados no local indicado pelo cliente).</p>
        <p> Para quaisquer pedidos, esclarecimentos ou apoio, utilize o e-mail <a className="font-semibold text-cyan-800 underline" href="mailto:rrservices.pt@gmail.com">rrservices.pt@gmail.com</a> e <a className="font-semibold text-cyan-800 underline" href="tel:+351969177571">+351 969 177 571</a>.</p>
      </section>

      <section>
        <h2>2. Dados pessoais tratados</h2>
        <p>Consoante a forma como interage connosco, podemos tratar:</p>
        <ul>
          <li>dados de identificação e contacto, como nome, e-mail e telemóvel/WhatsApp;</li>
          <li>morada do serviço, localidade, código postal e instruções de acesso que nos forneça;</li>
          <li>informação sobre pedidos de orçamento, tipo e dimensão do espaço, serviços e extras pretendidos, marcações, alterações e histórico de serviços;</li>
          <li>comunicações, notas necessárias à execução do serviço e informação de conta/autenticação do Portal do Cliente;</li>
          <li>data de nascimento, se a fornecer voluntariamente no perfil. A sua utilização para campanhas ou vantagens de aniversário depende de informação adequada e, quando aplicável, consentimento específico;</li>
          <li>fotografias do local antes/depois, quando recolhidas no âmbito da execução e do relatório do serviço.</li>
        </ul>
        <p>Não solicitamos que inclua dados pessoais sensíveis nas instruções ou mensagens. Se forem estritamente necessários para organizar o serviço, contacte-nos para avaliarmos a forma adequada de os tratar.</p>
      </section>

      <section>
        <h2>3. Finalidades e fundamentos</h2>
        <ul>
          <li><strong>Responder a pedidos, preparar orçamentos e gerir marcações:</strong> diligências pré-contratuais a pedido do titular e execução do contrato, quando o serviço é aceite.</li>
          <li><strong>Prestar o serviço, comunicar alterações e gerir a conta e o histórico no CRM/Portal:</strong> execução do contrato e interesses legítimos de organização, apoio ao cliente e segurança do serviço.</li>
          <li><strong>Cumprir obrigações contabilísticas, fiscais ou legais e responder a reclamações:</strong> cumprimento de obrigações legais e, quando aplicável, defesa de direitos.</li>
          <li><strong>Enviar comunicações promocionais ou usar a data de nascimento para vantagens:</strong> apenas quando exista fundamento legal adequado e, se necessário, consentimento separado. Pode retirar o consentimento a qualquer momento.</li>
        </ul>
        <p>O assistente de serviços no website recolhe os dados que introduz para preparar uma recomendação/pedido de orçamento e permitir o respetivo acompanhamento pela equipa. Uma estimativa apresentada não constitui, por si só, confirmação de uma marcação.</p>
      </section>

      <section>
        <h2>4. Destinatários e serviços tecnológicos</h2>
        <p>O acesso aos dados é limitado às pessoas que necessitam deles para gerir o pedido e executar o serviço. Podemos recorrer a prestadores tecnológicos para alojamento da aplicação, base de dados, autenticação e armazenamento de ficheiros, incluindo a plataforma Supabase configurada para o projeto, bem como a prestadores de comunicação quando o titular escolhe usar e-mail, telefone ou WhatsApp.</p>
        <p>Os prestadores atuam segundo instruções e medidas contratuais apropriadas. A localização da instância e eventuais transferências internacionais dependem da configuração efetiva dos serviços contratados; o responsável deve confirmar essa configuração e informar os titulares quando aplicável. Não vendemos dados pessoais.</p>
      </section>

      <section>
        <h2>5. Conservação</h2>
        <p>Conservamos os dados apenas durante o período necessário à finalidade para que foram recolhidos: enquanto decorre a relação de serviço e pelo tempo necessário à gestão do histórico, apoio, reclamações ou exercício de direitos. Os dados sujeitos a obrigações contabilísticas, fiscais ou outras obrigações legais são conservados pelos prazos legalmente exigidos. No fim desses períodos, os dados são eliminados ou anonimizados, salvo se tiver de ser conservada informação para a defesa de direitos.</p>
        <p>O responsável deve definir e documentar prazos concretos por categoria de dados, incluindo contas inativas, pedidos não convertidos em serviços, fotografias e registos de comunicação.</p>
      </section>

      <section>
        <h2>6. Direitos dos titulares</h2>
        <p>Nos termos da legislação aplicável, pode solicitar acesso aos seus dados, a sua retificação, apagamento quando aplicável, limitação do tratamento, portabilidade nos casos previstos, ou opor-se a tratamentos baseados em interesses legítimos. Quando o tratamento se baseia em consentimento, pode retirá-lo sem afetar a licitude do tratamento anterior.</p>
        <p>Pode corrigir alguns dados no Portal do Cliente. Para os restantes pedidos, contacte-nos pelo e-mail acima; poderemos solicitar informação razoável para confirmar a identidade e responder dentro do prazo legal. O apagamento pode não ser imediato quando a conservação seja necessária para cumprir a lei ou defender direitos.</p>
        <p>Tem ainda o direito de apresentar reclamação à Comissão Nacional de Proteção de Dados (CNPD), em <a className="font-semibold text-cyan-800 underline" href="https://www.cnpd.pt/cidadaos/direitos/" target="_blank" rel="noreferrer">cnpd.pt</a>, sem prejuízo de contactar primeiro o responsável pelo tratamento.</p>
      </section>

      <section>
        <h2>7. Cookies e armazenamento local</h2>
        <p>O website e o portal podem utilizar cookies estritamente necessários à sessão e autenticação, para manter o acesso seguro e permitir o funcionamento das áreas reservadas. O portal também pode guardar localmente no navegador a preferência visual (tema) escolhida pelo utilizador.</p>
        <p>Na versão do projeto revista para esta política não foram identificadas ferramentas de publicidade ou analítica de terceiros. Se forem adicionadas, esta política e, quando exigido, o mecanismo de consentimento serão atualizados antes da sua utilização. Pode gerir ou apagar cookies e dados locais nas definições do navegador, tendo em conta que isso pode afetar funcionalidades do portal.</p>
      </section>

      <section>
        <h2>8. Segurança</h2>
        <p>Aplicamos medidas técnicas e organizativas destinadas a proteger os dados contra acesso não autorizado, perda, alteração ou divulgação, incluindo controlo de acessos e utilização de serviços de autenticação e base de dados. Nenhum sistema ligado à Internet pode garantir segurança absoluta. Se ocorrer uma violação de dados, serão adotadas as medidas e notificações exigidas pela lei.</p>
      </section>

      <section>
        <h2>9. Alterações a esta política</h2>
        <p>Podemos atualizar esta política para refletir alterações nos serviços, na aplicação ou na lei. A versão publicada nesta página indica a data da última atualização. Se uma alteração exigir nova informação ou consentimento, essa informação será apresentada de forma adequada.</p>
      </section>
    </LegalLayout>
  );
}
