import { Link } from 'react-router-dom';
import { PaginaLegal } from '@/components/publico';
import {
  CNPJ,
  COMARCA,
  EMAIL_CONTATO,
  ENDERECO,
  PRAZO_AVISO,
  RAZAO_SOCIAL,
  VALOR_PLANO,
} from '@/lib/textos';

export function Termos() {
  return (
    <PaginaLegal
      titulo="Termos de Uso"
      atualizadoEm="Atualizado em 22/09/2026"
      intro="Estes termos explicam as regras para usar o ShopScanner. Ao criar uma conta, você concorda com o que está escrito aqui. Escrevemos em linguagem simples de propósito."
      outra={{ para: '/privacidade', rotulo: 'Política de Privacidade' }}
      secoes={[
        {
          id: 't1',
          titulo: '1. Quem somos',
          conteudo: (
            <p>
              O ShopScanner é operado por {RAZAO_SOCIAL}, inscrita no CNPJ {CNPJ}, com sede em{' '}
              {ENDERECO}. Somos uma empresa independente: não temos vínculo, patrocínio nem
              aprovação do TikTok ou do TikTok Shop.
            </p>
          ),
        },
        {
          id: 't2',
          titulo: '2. O que o ShopScanner faz',
          conteudo: (
            <>
              <p>
                O ShopScanner lê as informações de comissão, de publicações e de produtos da sua
                conta de creator afiliada e organiza tudo em um painel. Nós apresentamos dados; não
                vendemos produtos, não intermediamos pagamentos e não garantimos resultado de
                vendas.
              </p>
              <p>
                Os valores exibidos vêm das informações disponibilizadas pela plataforma de origem e
                podem ser corrigidos por ela depois de devoluções, cancelamentos ou revisões. O
                valor oficial a receber é sempre o da plataforma.
              </p>
            </>
          ),
        },
        {
          id: 't3',
          titulo: '3. A sua conta',
          conteudo: (
            <>
              <p>
                Para usar o ShopScanner você precisa ter no mínimo 18 anos e informar dados
                verdadeiros. A senha é pessoal: mantenha em sigilo e avise em {EMAIL_CONTATO} se
                suspeitar de acesso indevido.
              </p>
              <p>
                Cada pessoa deve ter a sua própria conta. Compartilhar acesso com terceiros é de sua
                responsabilidade e pode levar ao encerramento da conta.
              </p>
            </>
          ),
        },
        {
          id: 't4',
          titulo: '4. Conexão com o TikTok',
          conteudo: (
            <>
              <p>
                A conexão é feita por você, na tela de autorização da própria plataforma, e concede
                acesso apenas de leitura. Não publicamos vídeos, não comentamos e não enviamos
                mensagens em seu nome.
              </p>
              <p>
                Você pode desconectar a qualquer momento nas configurações da sua conta. A partir
                daí paramos de ler novos dados e removemos os dados já lidos conforme a{' '}
                <Link to="/privacidade">Política de Privacidade</Link>.
              </p>
            </>
          ),
        },
        {
          id: 't5',
          titulo: '5. Planos e pagamento',
          conteudo: (
            <>
              <p>
                Há um plano gratuito com o mês atual e planos pagos com histórico completo e
                relatórios por período, por {VALOR_PLANO}. A cobrança é recorrente e você pode
                cancelar quando quiser; o acesso continua até o fim do período já pago.
              </p>
              <p>
                Mudanças de preço são avisadas por e-mail com pelo menos {PRAZO_AVISO} de
                antecedência.
              </p>
            </>
          ),
        },
        {
          id: 't6',
          titulo: '6. Uso permitido',
          conteudo: (
            <p>
              Use o ShopScanner para acompanhar o seu próprio desempenho. Não é permitido tentar
              acessar dados de outras pessoas, automatizar coleta em massa, revender o acesso nem
              usar o serviço para qualquer finalidade ilícita.
            </p>
          ),
        },
        {
          id: 't7',
          titulo: '7. Encerramento da conta',
          conteudo: (
            <p>
              Você pode apagar a sua conta a qualquer momento nas configurações. Podemos encerrar
              contas que descumpram estes termos, sempre com aviso prévio por e-mail, salvo em casos
              de fraude ou ordem judicial.
            </p>
          ),
        },
        {
          id: 't8',
          titulo: '8. Alterações e contato',
          conteudo: (
            <p>
              Se mudarmos estes termos, avisamos por e-mail e atualizamos a data no topo da página.
              Dúvidas sobre qualquer ponto: escreva para{' '}
              <a href={`mailto:${EMAIL_CONTATO}`}>{EMAIL_CONTATO}</a>. Aplica-se a lei brasileira e
              fica eleito o foro de {COMARCA}.
            </p>
          ),
        },
      ]}
    />
  );
}
