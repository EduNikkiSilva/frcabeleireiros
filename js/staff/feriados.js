import { nhost } from '../nhost.js';
import { state } from './state.js';

function calcularPascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

function formatarData(date) {
  return date.toISOString().split("T")[0];
}

function adicionarDias(date, dias) {
  const nova = new Date(date);
  nova.setDate(nova.getDate() + dias);
  return nova;
}

function gerarFeriados(ano) {
  const pascoa = calcularPascoa(ano);
  return [
    `${ano}-01-01`, `${ano}-04-25`, `${ano}-05-01`, `${ano}-06-10`,
    `${ano}-08-15`, `${ano}-10-05`, `${ano}-11-01`, `${ano}-12-01`,
    `${ano}-12-08`, `${ano}-12-25`,
    formatarData(adicionarDias(pascoa, -2)), // Sexta-feira Santa
    formatarData(pascoa),                     // Domingo de Páscoa
    formatarData(adicionarDias(pascoa, 60)), // Corpo de Deus
    formatarData(adicionarDias(pascoa, 16))  // Mércoles (Castelo Branco)
  ];
}

export const feriados = [
  ...gerarFeriados(new Date().getFullYear()),
  ...gerarFeriados(new Date().getFullYear() + 1)
];

let feriasRanges = [];

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
  } catch (err) {
    console.warn('carregarFeriasRanges error:', err);
    feriasRanges = [];
  }
}