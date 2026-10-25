import React from 'react';
import { bandeiraDoPais, nomeDoPais } from '@/constants/nacionalidades';
import TagSoDomingo from '@/components/common/TagSoDomingo';

/**
 * O nome da pessoa com a bandeira do país ao lado, quando ela é estrangeira.
 *
 * Só quem se inscreveu sem CPF tem nacionalidade — para o resto (brasileiro
 * com CPF) isto renderiza exatamente o nome, sem nada em volta. Foi pedido
 * assim para os organizadores acharem rápido quem é de fora nas listas.
 *
 * A bandeira sai do código ISO via Unicode, sem imagem e sem CDN. No Windows
 * o emoji de bandeira não é desenhado e aparecem as duas letras (AR, PT) —
 * continua servindo para identificar, e o `title` sempre traz o nome do país
 * por extenso.
 */
// soDomingo (20261025c): a etiqueta "Só Domingo" logo depois do nome.
const NomeComBandeira = ({ nome, nacionalidade, soDomingo = false, className = '' }) => {
  if (!nacionalidade && !soDomingo) return <>{nome}</>;

  const bandeira = nacionalidade ? bandeiraDoPais(nacionalidade) : null;
  const pais = nacionalidade ? nomeDoPais(nacionalidade) : null;

  return (
    <span className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
      {nacionalidade && (
        <span
          title={`Estrangeiro — ${pais}`}
          aria-label={`Estrangeiro, ${pais}`}
          className="shrink-0 text-[0.95em] leading-none"
        >
          {bandeira || nacionalidade}
        </span>
      )}
      <span>{nome}</span>
      {soDomingo && <TagSoDomingo />}
    </span>
  );
};

export default NomeComBandeira;
