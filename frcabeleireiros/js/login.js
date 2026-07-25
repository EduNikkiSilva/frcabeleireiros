import { nhost } from './nhost.js';

async function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const query = `
    query LoginBarbeiro($u: String!, $p: String!) {
      barbeiros(where: {
        username: { _eq: $u },
        password: { _eq: $p }
      }) {
        id
        nome
        username
      }
    }
  `;

  const response = await nhost.graphql.request(query, { u: username, p: password });

  const user = response.data.barbeiros[0];

  if (!user) {
    alert("Credenciais inválidas");
    return;
  }

  localStorage.setItem("barbeiro", JSON.stringify(user));
  window.location.href = "dashboard.html";
}

document.getElementById("login-btn").addEventListener("click", login);