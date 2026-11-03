import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMinhasPermissoes } from '@/services/permissoesService';

/**
 * Permissoes do organizador logado (03/11/2026). Uma leitura por conta,
 * compartilhada entre menu, guardas de rota e botoes; cada tela que monta
 * refaz a leitura em segundo plano, entao uma caixa marcada/desmarcada em
 * Configuracoes vale na proxima tela aberta, sem sair do site.
 *
 * Sem resposta do banco = sem permissao (o banco recusaria do mesmo jeito).
 */
let cache = { chave: null, dados: null, promessa: null };
const ouvintes = new Set();

const carregar = (chave) => {
  if (cache.chave === chave && cache.promessa) return cache.promessa;
  const promessa = fetchMinhasPermissoes()
    .catch(() => ({ maximo: false, permissoes: [] }))
    .then((dados) => {
      if (cache.chave === chave) {
        cache = { chave, dados, promessa: null };
        ouvintes.forEach((f) => f());
      }
      return dados;
    });
  cache = { chave, dados: cache.chave === chave ? cache.dados : null, promessa };
  return promessa;
};

export const usePermissoes = () => {
  const { organizadorUser, user } = useAuth();
  const ehOrganizador = !!organizadorUser
    || ['organizador', 'organizador-aprovador'].includes(user?.role);
  const chave = ehOrganizador ? String(organizadorUser?.id || user?.id || 'organizador') : null;
  const [, forcar] = useState(0);

  useEffect(() => {
    const aoMudar = () => forcar((n) => n + 1);
    ouvintes.add(aoMudar);
    if (chave) carregar(chave);
    return () => { ouvintes.delete(aoMudar); };
  }, [chave]);

  const dados = chave && cache.chave === chave ? cache.dados : null;
  const maximo = dados?.maximo === true;
  const lista = dados?.permissoes || [];
  const pode = (p) => maximo || lista.includes(p);

  return {
    carregando: !!chave && !dados,
    maximo,
    permissoes: lista,
    pode,
    podeAlgum: (ps) => ps.some(pode),
  };
};
