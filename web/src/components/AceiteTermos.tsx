import { Link } from 'react-router';
import { useSession, useUpdateProfile } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VERSAO_TERMOS } from '@/lib/textos';

/**
 * Quem cria a conta pelo Google não passa pelo formulário, então nasce com
 * `acceptedTermsVersion: null`. O aceite é pedido no primeiro acesso, antes de usar
 * o app — mas sem trancar a saída: dá para sair sem aceitar.
 */
export function AceiteTermos() {
  const sessao = useSession();
  const salvar = useUpdateProfile();
  const pendente = sessao.data ? sessao.data.user.acceptedTermsVersion === null : false;

  return (
    <Dialog open={pendente}>
      <DialogContent fecharVisivel={false} className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Falta aceitar os termos</DialogTitle>
        </DialogHeader>
        <p className="text-[15px] leading-relaxed text-texto-secundario">
          Você entrou pelo Google, então ainda não passou por esta parte. Para usar o ShopScanner,
          confirme que leu e aceita os <Link to="/termos">Termos de Uso</Link> e a{' '}
          <Link to="/privacidade">Política de Privacidade</Link>.
        </p>
        {salvar.error ? (
          <p role="alert" className="text-sm text-status-reembolsado">
            {salvar.error.message}
          </p>
        ) : null}
        <Button
          disabled={salvar.isPending}
          onClick={() => salvar.mutate({ acceptedTermsVersion: VERSAO_TERMOS })}
        >
          {salvar.isPending ? 'Salvando…' : 'Li e aceito'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
