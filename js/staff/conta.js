import { nhost } from '../nhost.js';
import { state } from './state.js';

export function initContaListeners() {
  document.getElementById("btn-guardar-conta").addEventListener("click", async () => {
    const btn = document.getElementById("btn-guardar-conta");
    const passwordAtual = document.getElementById("conta-password-atual").value;
    const novoUsername = document.getElementById("conta-novo-username").value.trim();
    const novaPassword = document.getElementById("conta-nova-password").value;
    const confirmarPassword = document.getElementById("conta-confirmar-password").value;

    if (!passwordAtual) { alert("Introduz a tua password atual para confirmar a alteração."); return; }
    if (!novoUsername && !novaPassword) { alert("Preenche o novo username e/ou a nova password."); return; }
    if (novaPassword && novaPassword !== confirmarPassword) { alert("As passwords não coincidem."); return; }

    const alteracoes = {};
    if (novoUsername) alteracoes.username = novoUsername;
    if (novaPassword) alteracoes.password = novaPassword;

    btn.disabled = true;
    btn.textContent = "A guardar...";

    const mutation = `
      mutation AlterarConta($id: uuid!, $passwordAtual: String!, $obj: barbeiros_set_input!) {
        update_barbeiros(where: { id: { _eq: $id }, password: { _eq: $passwordAtual } }, _set: $obj) {
          affected_rows
        }
      }
    `;
    const response = await nhost.graphql.request(mutation, { id: state.barbeiroId, passwordAtual, obj: alteracoes });

    if (response.error) {
      console.error("Erro ao alterar conta:", response.error);
      alert("Erro ao guardar alterações.");
      btn.disabled = false;
      btn.textContent = "💾 Guardar alterações";
      return;
    }

    const affected = response.data?.update_barbeiros?.affected_rows || 0;
    if (affected === 0) {
      alert("Password atual incorreta. Nenhuma alteração foi feita.");
      btn.disabled = false;
      btn.textContent = "💾 Guardar alterações";
      return;
    }

    alert("Dados atualizados com sucesso! Vais ter de fazer login novamente.");
    localStorage.removeItem("barbeiro");
    window.location.href = "login.html";
  });

  document.querySelectorAll(".toggle-password").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      if (input.type === "password") { input.type = "text"; btn.textContent = "🙈"; }
      else { input.type = "password"; btn.textContent = "👁️"; }
    });
  });
}