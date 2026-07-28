export function mostrarMensagem(texto) {
  const msg = document.createElement("div");
  msg.textContent = texto;
  msg.style.position = "fixed";
  msg.style.bottom = "25px";
  msg.style.right = "25px";
  msg.style.background = "#111827";
  msg.style.color = "white";
  msg.style.padding = "12px 18px";
  msg.style.borderRadius = "8px";
  msg.style.boxShadow = "0 10px 25px rgba(0,0,0,0.25)";
  msg.style.opacity = "0";
  msg.style.transition = "opacity 0.3s ease";

  document.body.appendChild(msg);

  setTimeout(() => msg.style.opacity = "1", 50);
  setTimeout(() => {
    msg.style.opacity = "0";
    setTimeout(() => msg.remove(), 300);
  }, 2000);
}