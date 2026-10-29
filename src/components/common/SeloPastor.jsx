import React from 'react';
import { Church, Crown, ShieldCheck, Code2 } from 'lucide-react';
import { tituloPastor } from '@/utils/pastor';
import { useSeloOrganizacao } from '@/services/selosOrganizacao';
import { cn } from '@/lib/utils';

// Selos da organizacao (15/10/2026): NAO estao na ficha do equipante -- vem
// da tabela selos_organizacao (ver services/selosOrganizacao.js).
export const SELOS = {
  pastor_diretor: {
    titulo: (p) => (p?.sexo === 'Feminino' ? 'Pastora Diretora' : 'Pastor Diretor'),
    Icone: Crown, cor: 'text-amber-400', cheio: true
  },
  diretor: { titulo: (p) => (p?.sexo === 'Feminino' ? 'Diretora' : 'Diretor'), Icone: ShieldCheck, cor: 'text-violet-400' },
  dev: { titulo: () => 'Dev (desenvolvedor do sistema)', Icone: Code2, cor: 'text-emerald-400' },
  dev_rosa: { titulo: () => 'Dev (desenvolvedor do sistema)', Icone: Code2, cor: 'text-pink-400' }
};

/**
 * Iconezinhos ao lado do nome (Patrick, 13/10/2026):
 *  - pastor(a) ou pastor(a) auxiliar: igreja azul ("Cargo na Igreja", ver
 *    utils/pastor.js);
 *  - Pastor(a) Diretor(a): coroa dourada -- no lugar da igreja;
 *  - Diretoria: escudo roxo; Dev: </> verde.
 * Ao parar o mouse aparece o titulo. Quem nao tem nada: nada aparece.
 */
const SeloPastor = ({ pessoa, className }) => {
  const selo = SELOS[useSeloOrganizacao(pessoa?.id)];
  const pastorDiretor = selo === SELOS.pastor_diretor;
  const titulo = pastorDiretor ? null : tituloPastor(pessoa);
  if (!titulo && !selo) return null;
  return (
    <>
      {titulo && (
        <span data-dica={titulo} aria-label={titulo} role="img"
          className={cn('inline-flex shrink-0 text-sky-400', className)}>
          <Church className="h-3.5 w-3.5" />
        </span>
      )}
      {selo && (
        <span data-dica={selo.titulo(pessoa)} aria-label={selo.titulo(pessoa)} role="img"
          className={cn('inline-flex shrink-0', selo.cor, className)}>
          <selo.Icone className="h-3.5 w-3.5" fill={selo.cheio ? 'currentColor' : 'none'} />
        </span>
      )}
    </>
  );
};

export default SeloPastor;
