import { state } from './state.js';
import { carregarBarbeiro } from './barbeiro.js';
import { carregarReservas } from './reservas.js';
import { carregarFerias, iniciarFlatpickrFerias } from './ferias.js';
import { carregarPausas, iniciarFlatpickrPausa } from './pausas.js';
import { carregarFeriasRanges } from './feriados.js';
import { iniciarFlatpickrManual } from './marcacaoManual.js';
import { verificarOwner } from './dados.js';

export async function checkSession() {
  const user = JSON.parse(localStorage.getItem("barbeiro"));

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  state.barbeiroId = user.id;

  await carregarBarbeiro();
  await carregarReservas();
  await carregarFerias();
  await carregarPausas();
  await carregarFeriasRanges();
  iniciarFlatpickrManual();
  iniciarFlatpickrFerias();
  iniciarFlatpickrPausa();
  await verificarOwner();
}

export function initLogoutListener() {
  document.getElementById("logout-btn").addEventListener("click", () => {
    localStorage.removeItem("barbeiro");
    window.location.href = "login.html";
  });
}

let inactivityTimer;

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    alert("Sessão terminada por inatividade.");
    localStorage.removeItem("barbeiro");
    window.location.href = "login.html";
  }, 5 * 60 * 1000);
}

export function initInactivityTimer() {
  ["mousemove", "mousedown", "keypress", "touchstart", "scroll"].forEach(event => {
    document.addEventListener(event, resetInactivityTimer);
  });
  resetInactivityTimer();
}