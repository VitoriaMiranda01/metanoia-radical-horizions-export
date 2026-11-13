import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Editar ou cadastrar igreja (Configuracoes > Todas as igrejas cadastradas,
 * Patrick, 08/10/2026).
 *
 *  - Editar: codigo, nome e pastor. O codigo nao pode ser de outra igreja
 *    (o servidor confere de novo). A 84 - DIVERSOS so muda o pastor.
 *  - Cadastrar: codigo (ja vem o proximo livre), nome e pastor obrigatorios.
 *  - Nos dois: "Fichas liberadas" (acampantes que a igreja pode inscrever;
 *    vazio = 0, opcional desde 13/11/2026) e "Fixo" (o numero nao zera na
 *    virada de edicao). Pedido do Patrick, 13/11/2026.
 *
 * igreja: { codigo, nome, pastor, fixa, limite, fichas_fixas } para editar;
 * null para cadastrar. (fixa = a 84 - DIVERSOS, que e do sistema.)
 * codigosEmUso: Map(numero -> "NN - NOME") de todas as igrejas, para avisar
 * na hora que o codigo ja e de outra.
 */
const IgrejaDialog = ({ aberto, igreja, proximoCodigo, codigosEmUso, onSalvar, onFechar }) => {
  const editando = !!igreja;
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [pastor, setPastor] = useState('');
  const [limite, setLimite] = useState('');
  const [fichasFixas, setFichasFixas] = useState(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setCodigo(editando ? igreja.codigo : String(proximoCodigo || ''));
    setNome(editando ? igreja.nome : '');
    setPastor(editando ? igreja.pastor || '' : '');
    setLimite(editando && igreja.limite != null ? String(igreja.limite) : '');
    setFichasFixas(editando ? !!igreja.fichas_fixas : false);
    setErro('');
    setSalvando(false);
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  // Codigo de outra igreja: avisa enquanto digita.
  const conflito = useMemo(() => {
    const n = Number(String(codigo).trim());
    if (!Number.isInteger(n) || n < 1) return null;
    if (editando && n === Number(igreja.codigo)) return null;
    return codigosEmUso?.get(n) || null;
  }, [codigo, codigosEmUso, editando, igreja]);

  const fixa = editando && igreja.fixa;

  const salvar = async () => {
    const cod = String(codigo).trim();
    if (!/^\d{1,3}$/.test(cod) || Number(cod) < 1 || Number(cod) > 899) {
      setErro('O código precisa ser um número de 1 a 899.');
      return;
    }
    if (conflito) {
      setErro(`O código ${cod} já é de outra igreja (${conflito}).`);
      return;
    }
    if (nome.trim().length < 3) {
      setErro('Escreva o nome da igreja.');
      return;
    }
    const lim = limite === '' ? 0 : Number(limite);
    if (!Number.isInteger(lim) || lim < 0 || lim > 1000) {
      setErro('Fichas liberadas: de 0 a 1000 (vazio = 0).');
      return;
    }
    if (!editando) {
      if (pastor.trim().length < 3) {
        setErro('Escreva o nome do pastor.');
        return;
      }
    }
    setSalvando(true);
    setErro('');
    const r = await onSalvar({ codigo: cod, nome: nome.trim(), pastor: pastor.trim(), fichas: lim, fichasFixas });
    if (!r?.success) {
      setErro(r?.error || 'Não foi possível salvar.');
      setSalvando(false);
    }
  };

  const enter = (e) => { if (e.key === 'Enter') salvar(); };
  const campo = 'bg-white/5 border-white/10 text-white placeholder:text-gray-400';

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && !salvando && onFechar()}>
      <DialogContent className="bg-zinc-900 border border-white/10 text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar igreja' : 'Adicionar nova igreja'}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {editando
              ? `${igreja.codigo} - ${igreja.nome}`
              : 'A igreja entra na lista dos formulários na hora. O acesso do parceiro fica trancado até ser liberado em Senhas dos Parceiros.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-[6.5rem_1fr] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ig-codigo" className="text-gray-300">Código</Label>
              <Input
                id="ig-codigo" inputMode="numeric" value={codigo} disabled={fixa || salvando}
                onChange={(e) => { setCodigo(e.target.value.replace(/\D/g, '').slice(0, 3)); setErro(''); }}
                onKeyDown={enter}
                className={`${campo} tabular-nums ${conflito ? 'border-red-500/60' : ''}`}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ig-nome" className="text-gray-300">Nome da igreja</Label>
              <Input
                id="ig-nome" value={nome} disabled={fixa || salvando} autoFocus={!editando}
                onChange={(e) => { setNome(e.target.value.toUpperCase()); setErro(''); }}
                onKeyDown={enter}
                placeholder="Ex.: ASSEMBLEIA DE DEUS ..."
                className={campo}
              />
            </div>
          </div>
          {conflito && <p className="-mt-2 text-xs text-red-300">Este código já é de {conflito}.</p>}
          {fixa && (
            <p className="-mt-2 text-xs text-amber-300">
              A 84 - DIVERSOS é usada pelo sistema: só o pastor pode ser alterado.
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ig-pastor" className="text-gray-300">
              Nome do pastor{editando && <span className="text-gray-400 font-normal"> (opcional)</span>}
            </Label>
            <Input
              id="ig-pastor" value={pastor} disabled={salvando} autoFocus={editando && fixa}
              onChange={(e) => { setPastor(e.target.value); setErro(''); }}
              onKeyDown={enter}
              placeholder="Ex.: Pr. João da Silva"
              className={campo}
            />
          </div>

          <div className="rounded-md border border-white/10 bg-white/[0.03] p-3 space-y-2">
            <div className="flex items-end gap-3">
              <div className="space-y-1.5 w-32 shrink-0">
                <Label htmlFor="ig-limite" className="text-gray-300">Fichas liberadas</Label>
                <Input
                  id="ig-limite" inputMode="numeric" value={limite} disabled={salvando}
                  onChange={(e) => { setLimite(e.target.value.replace(/\D/g, '').slice(0, 4)); setErro(''); }}
                  onKeyDown={enter}
                  placeholder="0"
                  data-dica="Quantos acampantes esta igreja pode inscrever. Vazio = 0 (o formulário não aceita acampante desta igreja)."
                  className={`${campo} tabular-nums`}
                />
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm text-gray-200 cursor-pointer select-none">
                <input
                  type="checkbox" checked={fichasFixas} disabled={salvando}
                  onChange={(e) => setFichasFixas(e.target.checked)}
                  className="h-4 w-4 accent-emerald-500"
                />
                📌 Fixo (não zera na virada de edição)
              </label>
            </div>
            <p className="text-[11px] text-gray-400">
              Sem marcar "Fixo", as fichas voltam a 0 na mudança de edição e o parceiro pede de novo.
              Aprovar uma solicitação de fichas troca este número pelo aprovado.
            </p>
            {editando && Number.isInteger(igreja.inscritos) && limite !== '' && igreja.inscritos > Number(limite) && (
              <p className="text-[11px] text-amber-300">
                A igreja já tem {igreja.inscritos} acampantes: ninguém é apagado, só não entram novos.
              </p>
            )}
          </div>

          {editando && !fixa && (
            <p className="text-xs text-gray-400">
              Trocar o código ou o nome atualiza as inscrições, as fichas liberadas e a conta do parceiro.
              Se o código mudar, o parceiro passa a entrar com o código novo.
            </p>
          )}
        </div>

        {erro && <p className="text-sm text-red-400">{erro}</p>}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <Button
            type="button" variant="ghost" onClick={onFechar} disabled={salvando}
            className="text-gray-300 hover:text-white hover:bg-white/10"
          >
            Cancelar
          </Button>
          <Button
            type="button" onClick={salvar} disabled={salvando || !!conflito}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {salvando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            {editando ? 'Salvar' : 'Adicionar igreja'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default IgrejaDialog;
