const API_URL = "http://localhost:8000";

document.addEventListener("DOMContentLoaded", () => {
    cargarContactos();
    actualizarBadge();
    if(typeof io !== 'undefined' && !socketGeneral) conectarSocketGeneral();
});

async function cargarContactos() {
    const token = localStorage.getItem("token");
    if (!token) window.location.href = "login.html";

    try {
        const res = await fetch(`${API_URL}/chat/contactos`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const contactos = await res.json();
        
        const contenedor = document.getElementById("listaConversaciones");
        contenedor.innerHTML = "";

        if (contactos.length === 0) {
            contenedor.innerHTML = "<p>No tienes contactos aún.</p>";
            return;
        }

        contactos.forEach(c => {
            const html = `
                <div class="comunidad-item">
                    <div class="comunidad-info">
                        <h2>${c.nombre} ${c.apellido}</h2>
                        <p>@${c.username}</p>
                    </div>
                    <div class="acciones">
                        <button class="unirse" onclick="irAlChat('${c.username}')">Ir al chat</button>
                    </div>
                </div>
            `;
            contenedor.innerHTML += html;
        });

    } catch (e) { console.error(e); }
}

function irAlChat(username) {
    localStorage.setItem("chatDestino", username);
    window.location.href = "chat.html";
}

// --- LÓGICA DE BADGE Y SOCKETS (Preservada del repo) ---
let socketGeneral;
function conectarSocketGeneral() {
    if(typeof socket !== 'undefined') socketGeneral = socket;
    else {
        socketGeneral = io("http://localhost:8000", { transports: ['websocket', 'polling'] });
        const token = localStorage.getItem("token");
        if(token) {
            fetch("http://localhost:8000/auth/me", {headers:{"Authorization":`Bearer ${token}`}})
            .then(r=>r.json()).then(u => {
                socketGeneral.emit('identify', { username: u.username });
            });
        }
    }
    if(socketGeneral) {
        socketGeneral.on('new_notification', () => {
            incrementarBadge();
        });
    }
}

async function actualizarBadge() {
    const token = localStorage.getItem("token");
    if(!token) return;
    try {
        const res = await fetch("http://localhost:8000/notificaciones/", { headers: { "Authorization": `Bearer ${token}` } });
        if(res.ok) {
            const notis = await res.json();
            const noLeidas = notis.filter(n => !n.leido).length;
            const badge = document.getElementById("badgeNotis");
            if(noLeidas > 0) {
                badge.style.display = "block";
                badge.innerText = noLeidas > 99 ? "99+" : noLeidas;
            } else { badge.style.display = "none"; }
        }
    } catch(e) {}
}

function incrementarBadge() {
    const badge = document.getElementById("badgeNotis");
    let val = parseInt(badge.innerText) || 0;
    val++;
    badge.innerText = val > 99 ? "99+" : val;
    badge.style.display = "block";
}
