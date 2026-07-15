// Valores padrão de "normalidade" para a ação rápida "Sem alterações".
// O botão preenche a seção com estes valores para o profissional só editar o
// que destoa — todos os campos seguem editáveis (texto livre).
//
// TODO (validar com Caio — optometria): confirmar os textos qualitativos de
// normalidade por exame. São pontos de partida conservadores, não verdade
// clínica definitiva. Campos numéricos/medidas ficam em branco de propósito.

import type { FichaClinica } from '@/types/clinical'

// Biomicroscopia "normal" por estrutura (OD = OE).
const BIOMICRO_OLHO = {
  sobrancelha: 'Normal',
  palpebra: 'Normal',
  cilios: 'Normal',
  cornea: 'Transparente',
  iris: 'Normal',
  conjuntiva: 'Normal',
  esclera: 'Normal',
  cristalino: 'Transparente',
  pupilas: 'Isocóricas e fotorreagentes',
}

// Reflexos pupilares "normais" (presentes em ambos os olhos).
const REFLEXOS_OLHO = {
  fotomotor: 'Presente',
  consensual: 'Presente',
  acomodativo: 'Presente',
}

// Oftalmoscopia "normal" — campos qualitativos preenchidos; medidas (escavação,
// relação A/V, dioptria da lente) ficam em branco para o profissional medir.
const OFTALMO_OLHO = {
  dioptria_lente: '',
  bruckner: 'Simétrico',
  pupila: 'Normal',
  escavacao: '',
  relacao_av: '',
  macula: 'Brilho foveal presente',
  fixacao: 'Central',
}

/**
 * Mapa de preenchimento "normal" por chave de FichaClinica. Só as seções de
 * exame que costumam ser normais têm entrada — as demais não exibem o botão.
 * `observacoes` é deliberadamente omitido: o merge preserva o que já existe.
 */
export const NORMAIS: Partial<Record<keyof FichaClinica, Record<string, unknown>>> = {
  biomicroscopia: {
    od: { ...BIOMICRO_OLHO },
    oe: { ...BIOMICRO_OLHO },
  },
  reflexos_pupilares: {
    od: { ...REFLEXOS_OLHO },
    oe: { ...REFLEXOS_OLHO },
  },
  oftalmoscopia: {
    od: { ...OFTALMO_OLHO },
    oe: { ...OFTALMO_OLHO },
  },
  avaliacao_motora: {
    duccoes: { resultado: 'normal', observacao: '' },
    versoes: { resultado: 'normal', observacao: '' },
  },
  campos_visuais: {
    od: { resultado: 'normal', observacao: '' },
    oe: { resultado: 'normal', observacao: '' },
  },
}
