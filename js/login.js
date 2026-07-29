import { nhost } from './nhost.js';

const msg = document.getElementById("msg");
const loginBtn = document.getElementById("login-btn");
const loginBtnLabel = document.getElementById("login-btn-label");
const loginCard = document.querySelector(".login-card");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");

function mostrarErro(texto) {
  msg.textContent = texto;
  loginCard.classList.remove("shake");
  void loginCard.offsetWidth; // reinicia a animação mesmo em erros consecutivos
  loginCard.classList.add("shake");
}

function setLoading(loading) {
  loginBtn.disabled = loading;
  loginBtnLabel.innerHTML = loading
    ? '<span class="btn-spinner"></span>A entrar...'
    : "Entrar";
}

async function login() {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  msg.textContent = "";

  if (!username || !password) {
    mostrarErro("Preenche o username e a password.");
    return;
  }

  setLoading(true);

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
      mostrarErro("Credenciais inválidas. Verifica o username e a password.");
      setLoading(false);
      return;
    }

    localStorage.setItem("barbeiro", JSON.stringify(user));
    document.body.classList.add("leaving");
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 280);
  } catch (err) {
    console.error("Erro ao fazer login:", err);
    mostrarErro("Erro ao ligar ao servidor. Tenta novamente.");
    setLoading(false);
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