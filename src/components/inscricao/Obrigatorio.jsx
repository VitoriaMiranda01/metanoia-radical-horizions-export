import React from 'react';

/**
 * Asterisco vermelho ao lado do nome de um campo obrigatorio do formulario
 * de inscricao (pedido da usuaria, 2026-11-05). Puramente visual -- nao
 * muda nenhuma validacao; cada campo continua obrigatorio (ou nao)
 * exatamente como antes. aria-hidden porque o navegador ja anuncia os
 * campos nativos com o atributo `required`; os poucos campos obrigatorios
 * que nao sao um <input>/<select> nativo (ex.: o seletor de igreja) ja
 * avisam a falta ao enviar o formulario, como faziam antes desta mudanca.
 */
const Obrigatorio = () => <span className="text-red-500" aria-hidden="true"> *</span>;

export default Obrigatorio;
