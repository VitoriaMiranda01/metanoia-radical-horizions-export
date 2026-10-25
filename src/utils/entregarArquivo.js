/**
 * Entrega um arquivo gerado no navegador (25/10/2026, Patrick: salvar no
 * celular). No celular abre a folha de compartilhamento do aparelho ("Salvar em
 * Arquivos", Drive, WhatsApp...); no computador, ou se o navegador nao
 * suportar, baixa normalmente. Cancelar a folha nao e erro.
 */
const ehCelular = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const entregarArquivo = async (blob, nome) => {
  try {
    if (ehCelular() && navigator.canShare && navigator.share) {
      const arquivo = new File([blob], nome, { type: blob.type });
      if (navigator.canShare({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], title: nome });
        return;
      }
    }
  } catch (e) {
    if (e?.name === 'AbortError') return;
    console.warn('entregarArquivo: compartilhar falhou, baixando', e);
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};
