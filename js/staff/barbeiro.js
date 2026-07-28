// js/staff/barbeiro.js
import { nhost } from '../nhost.js';
import { state } from './state.js';

export async function carregarBarbeiro() {
  const query = `
    query GetBarbeiro($id: uuid!) {
      barbeiros(where: { id: { _eq: $id } }) {
        nome
        username
        foto
      }
    }
  `;
  const response = await nhost.graphql.request(query, { id: state.barbeiroId });

  if (response.error) {
    console.error("Erro ao carregar barbeiro:", response.error);
    return;
  }

  const data = response.data?.barbeiros?.[0];
  if (data) {
    document.getElementById("bemvindo").textContent = "Olá, " + data.nome + " 👋";

    const contaUsername = document.getElementById("conta-username-atual");
    if (contaUsername) contaUsername.textContent = data.username;

    const contaAvatar = document.getElementById("conta-avatar");
    const contaAvatarFoto = document.getElementById("conta-avatar-foto");

    if (data.foto && contaAvatarFoto) {
      contaAvatarFoto.src = data.foto;
      contaAvatarFoto.style.display = "block";
      if (contaAvatar) contaAvatar.style.display = "none";
    } else if (contaAvatar) {
      contaAvatar.textContent = data.nome.charAt(0);
    }

    // definir o botão de logout com segurança
    const logoutFoto = document.getElementById("logout-foto");
    if (logoutFoto) {
      if (data.foto) {
        logoutFoto.src = data.foto;
        logoutFoto.style.display = "block";
      } else {
        logoutFoto.style.display = "none";
      }
    }
  }
}