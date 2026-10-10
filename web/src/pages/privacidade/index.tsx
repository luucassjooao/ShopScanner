import { PaginaLegal } from '@/components/publico';
import {
  EMAIL_CONTATO,
  ENCARREGADO,
  PRAZO_EXCLUSAO,
  PRAZO_RESPOSTA,
  PROCESSADOR_PAGAMENTO,
  PROVEDOR_EMAIL,
  PROVEDOR_NUVEM,
} from '@/lib/textos';

export function Privacidade() {
  return (
    <PaginaLegal
      titulo="Política de Privacidade"
      atualizadoEm="Atualizada em 22/09/2026"
      intro="Esta política explica quais dados o ShopScanner coleta, por que coleta e o que você pode fazer com eles. Ela segue a Lei Geral de Proteção de Dados (Lei nº 13.709/2018)."
      outra={{ para: '/termos', rotulo: 'Termos de Uso' }}
      secoes={[
        {
          id: 'p1',
          titulo: '1. Resumo',
          conteudo: (
            <p>
              Lemos os seus dados de comissão e de publicações apenas depois da sua autorização,
              usamos esses dados só para montar o seu painel, não vendemos nada para ninguém e
              apagamos tudo quando você pedir.
            </p>
          ),
        },
        {
          id: 'p2',
          titulo: '2. Dados que você fornece',
          conteudo: (
            <p>
              Nome, e-mail e senha no cadastro. Se você assinar um plano pago, os dados de cobrança
              são tratados pelo processador de pagamento {PROCESSADOR_PAGAMENTO}; não guardamos o
              número do seu cartão.
            </p>
          ),
        },
        {
          id: 'p3',
          titulo: '3. Dados lidos do TikTok',
          conteudo: (
            <>
              <p>
                Depois que você autoriza a conexão, lemos apenas: identificação pública do seu
                perfil de creator, lista de publicações com métricas de desempenho, pedidos
                atribuídos a essas publicações e valores de comissão com o respectivo status
                (liquidado, a liquidar, aguardando pagamento, reembolsado ou retido).
              </p>
              <p>
                Não temos acesso a mensagens privadas, à sua senha da plataforma nem aos dados
                pessoais de quem comprou.
              </p>
            </>
          ),
        },
        {
          id: 'p4',
          titulo: '4. Como usamos os dados',
          conteudo: (
            <p>
              Para montar e atualizar o seu painel, gerar os relatórios do seu período, enviar
              avisos sobre a sua conta e melhorar o produto com métricas agregadas que não
              identificam ninguém. Não usamos os seus dados para treinar modelos nem para
              publicidade.
            </p>
          ),
        },
        {
          id: 'p5',
          titulo: '5. Com quem compartilhamos',
          conteudo: (
            <p>
              Apenas com os fornecedores necessários para o serviço funcionar: hospedagem em{' '}
              {PROVEDOR_NUVEM}, envio de e-mail em {PROVEDOR_EMAIL} e o processador de pagamento.
              Todos atuam como operadores e seguem contrato de confidencialidade. Nunca vendemos os
              seus dados.
            </p>
          ),
        },
        {
          id: 'p6',
          titulo: '6. Por quanto tempo guardamos',
          conteudo: (
            <p>
              Enquanto a sua conta existir. Se você desconectar o TikTok ou apagar a conta,
              removemos os dados em até {PRAZO_EXCLUSAO}. Registros fiscais e de acesso são mantidos
              pelo prazo exigido por lei.
            </p>
          ),
        },
        {
          id: 'p7',
          titulo: '7. Os seus direitos pela LGPD',
          conteudo: (
            <p>
              Você pode confirmar se tratamos os seus dados, acessá-los, corrigi-los, pedir a
              portabilidade, revogar o consentimento e solicitar a exclusão. O pedido pode ser feito
              direto nas configurações da conta ou por e-mail, e respondemos em até {PRAZO_RESPOSTA}
              .
            </p>
          ),
        },
        {
          id: 'p8',
          titulo: '8. Segurança, cookies e contato',
          conteudo: (
            <>
              <p>
                Os dados trafegam por conexão criptografada e ficam guardados com acesso restrito à
                equipe que precisa deles. Usamos apenas cookies necessários para manter você
                conectada e medir o uso do produto de forma agregada.
              </p>
              <p>
                Encarregado de dados: {ENCARREGADO} —{' '}
                <a href={`mailto:${EMAIL_CONTATO}`}>{EMAIL_CONTATO}</a>.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
