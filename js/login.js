import { nhost } from './nhost.js';

const msg = document.getElementById("msg");
const loginBtn = document.getElementById("login-btn");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");

async function login() {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  msg.textContent = "";

  if (!username || !password) {
    msg.textContent = "Preenche o username e a password.";
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "A entrar...";

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

  try {
    const response = await nhost.graphql.request(query, { u: username, p: password });
    const user = response.data?.barbeiros?.[0];

    if (!user) {
      msg.textContent = "Credenciais inválidas. Verifica o username e a password.";
      loginBtn.disabled = false;
      loginBtn.textContent = "Entrar";
      return;
    }

    localStorage.setItem("barbeiro", JSON.stringify(user));
    window.location.href = "dashboard.html";
  } catch (err) {
    console.error("Erro ao fazer login:", err);
    msg.textContent = "Erro ao ligar ao servidor. Tenta novamente.";
    loginBtn.disabled = false;
    loginBtn.textContent = "Entrar";
  }
}

document.getElementById("login-btn").addEventListener("click", login);

// Permitir Enter para submeter, em qualquer um dos campos
[usernameInput, passwordInput].forEach(input => {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      login();
    }
  });
});

// Mostrar/ocultar password
document.getElementById("toggle-password").addEventListener("click", () => {
  const isPassword = passwordInput.type === "password";
  passwordInput.type = isPassword ? "text" : "password";
  document.getElementById("toggle-password").textContent = isPassword ? "🙈" : "👁️";
});