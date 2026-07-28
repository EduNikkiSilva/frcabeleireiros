// js/staff/feriados.js
import { nhost } from '../nhost.js';
import { state } from './state.js';

export const feriados = [
  "2026-01-01","2026-04-25","2026-05-01","2026-06-10",
  "2026-08-15","2026-10-05","2026-11-01","2026-12-01",
  "2026-12-08","2026-12-25"
];

let feriasRanges = [];

// verifica se uma Date (ou string) está dentro de algum intervalo de férias
export function estaEmFerias(date) {
  if (!date) return false;
  const d = new Date(date);
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return feriasRanges.some(r => {
    const inicio = new Date(r.data_inicio);
    const fim = new Date(r.data_fim);
    const start = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    const end = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());
    return dt >= start && dt <= end;
  });
}

// carrega os intervalos de férias do backend para uso nos pickers
export async function carregarFeriasRanges() {
  try {
    if (!state || !state.barbeiroId) {
      feriasRanges = [];
      return;
    }
    const query = `
      query Ferias($id: uuid!) {
        ferias(where: { barbeiro_id: { _eq: $id } }) {
          data_inicio
          data_fim
        }
      }
    `;
    const resp = await nhost.graphql.request(query, { id: state.barbeiroId });
    feriasRanges = resp?.data?.ferias || [];
    console.log('carregarFeriasRanges: loaded', feriasRanges);
  } catch (err) {
    console.warn('carregarFeriasRanges error:', err);
    feriasRanges = [];
  }
}