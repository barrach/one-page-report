import { Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

/**
 * Lembrete de trocar a senha que veio no e-mail de boas-vindas.
 *
 * Não é dispensável de propósito. Uma senha enviada por e-mail fica na caixa
 * de entrada de quem a recebeu — e na de quem tiver acesso a ela — para
 * sempre; enquanto ela for a senha em uso, o acesso não é só da pessoa. O
 * aviso some sozinho na hora em que a troca acontece.
 *
 * Fora do papel: no PDF do relatório isto não tem nada que fazer.
 */
const AvisoSenhaProvisoria = () => {
  const { senhaProvisoria } = useAuth();
  if (!senhaProvisoria) return null;

  return (
    <div
      className="print:hidden mx-3 sm:mx-5 mt-3 rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap"
      data-html2canvas-ignore
    >
      <p className="text-sm text-foreground flex items-center gap-2 min-w-0">
        <KeyRound className="h-4 w-4 text-amber-600 dark:text-amber-500 shrink-0" />
        <span>
          Você está usando a <strong>senha provisória</strong> que recebeu por e-mail.
          Defina uma senha sua.
        </span>
      </p>
      <Link
        to="/configuracoes"
        className="text-sm font-semibold text-primary hover:underline shrink-0"
      >
        Trocar agora
      </Link>
    </div>
  );
};

export default AvisoSenhaProvisoria;
