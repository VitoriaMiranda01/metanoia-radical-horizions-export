import React from 'react';
import { Church, Crown, ShieldCheck, Code2 } from 'lucide-react';
import { tituloPastor, ehPastorDiretor } from '@/utils/pastor';
import { cn } from '@/lib/utils';

// Selo interno (14/10/2026, coluna equipantes.selo_interno): controle da
// organizacao, nao vem da inscricao. 'diretor' = Diretoria; 'dev' = quem
// desenvolve o sistema.
const SELOS_INTERNOS = {
  diretor: { titulo: (p) => (p?.sexo === 'Feminino' ? 'Diretora' : 'Diretor'), Icone: ShieldCheck, cor: 'text-violet-400' },
  dev: { titulo: () => 'Dev (desenvolvedor do sistema)', Icone: Code2, cor: 'text-emerald-400' }
};

/**
 * Iconezinhos ao lado do nome (Patrick, 13/10/2026):
 *  - pastor(a) ou pastor(a) auxiliar: igreja azul ("Cargo na Igreja", ver
 *    utils/pastor.js);
 *  - Pastor(a) Diretor(a): coroa dourada (equipantes.pastor_diretor);
 *  - Diretoria: escudo roxo; Dev: </> verde (equipantes.selo_interno).
 * Ao parar o mouse aparece o titulo. Quem nao tem nada: nada aparece. Uma
 * pessoa pode ter dois (ex.: pastor e dev).
 */
const SeloPastor = ({ pessoa, className }) => {
  const titulo = tituloPastor(pessoa);
  const interno = SELOS_INTERNOS[pessoa?.selo_interno];
  if (!titulo && !interno) return null;
  const diretor = ehPastorDiretor(pessoa);
  return (
    <>
      {titulo && (
        <span data-dica={titulo} aria-label={titulo} role="img"
          className={cn('inline-flex shrink-0', diretor ? 'text-amber-400' : 'text-sky-400', className)}>
          {diretor ? <Crown className="h-3.5 w-3.5" fill="currentColor" /> : <Church className="h-3.5 w-3.5" />}
        </span>
      )}
      {interno && (
        <span data-dica={interno.titulo(pessoa)} aria-label={interno.titulo(pessoa)} role="img"
          className={cn('inline-flex shrink-0', interno.cor, className)}>
          <interno.Icone className="h-3.5 w-3.5" />
        </span>
      )}
    </>
  );
};

export default SeloPastor;
