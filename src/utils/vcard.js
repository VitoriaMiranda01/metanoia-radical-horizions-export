/**
 * Arquivo de contatos (.vcf) para a lider importar no telefone (iOS e Android)
 * e adicionar quem nao consegue entrar pelo link direto no grupo (21/10/2026).
 * vCard 3.0, uma ficha por pessoa; o sufixo (ex.: "Metanoia Cozinha") junta
 * todos na agenda e facilita achar na hora de adicionar ao grupo.
 */

const limpar = (texto) => String(texto || '').replace(/[\r\n]+/g, ' ').replace(/([,;\\])/g, '\\$1').trim();

export const gerarVCard = (contatos, sufixo) => contatos
  .filter((c) => c.numero)
  .map((c) => {
    const nome = limpar(c.nome);
    const rotulo = sufixo ? `${nome} - ${limpar(sufixo)}` : nome;
    return [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${rotulo}`,
      `N:${rotulo};;;;`,
      `TEL;TYPE=CELL:+${c.numero}`,
      'ORG:Metanoia Radical Serra',
      'END:VCARD'
    ].join('\r\n');
  })
  .join('\r\n') + '\r\n';

export const baixarVcf = (texto, nomeArquivo) => {
  const blob = new Blob([texto], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nomeArquivo.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9-_]+/g, '-')}.vcf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};
