const API_URL = "http://localhost:8000";
let socket;
let chatDestino = localStorage.getItem("chatDestino");
let miUsuario = "";
let miUsuarioId = null;

document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("token");
    if (!token) { window.location.href = "login.html"; return; }
    
    try {
        const res = await fetch(`${API_URL}/auth/me`, { headers: { "Authorization": `Bearer ${token}` } });
        if (!res.ok) throw new Error("Sesión inválida");
        const user = await res.json();
        miUsuario = user.username;
        miUsuarioId = user.id; 
    } catch(e) { return; }

    conectarSocket();
    cargarContactosLateral();
    if (chatDestino) abrirChat(chatDestino);
    
    // Configurar envío con Enter
    document.getElementById("inputTexto").addEventListener("keypress", (e) => {
        if (e.key === "Enter") enviarMensaje();
    });

    // INYECTAR BOTÓN DE DIFUSIÓN (ANTIFLOODING) ---
    agregarBotonDifusion();

    // Cerrar menús al hacer clic fuera
    window.onclick = (e) => {
        if (!e.target.closest('.msg-options-btn')) {
            document.querySelectorAll('.msg-dropdown').forEach(m => m.style.display = 'none');
        }
    }
});

function conectarSocket() {
    socket = io(API_URL, { transports: ['websocket', 'polling'] });
    
    socket.on('connect', () => { 
        console.log("Conectado al socket");
        socket.emit('identify', { username: miUsuario }); 
    });

    // Escuchar mensajes privados
    socket.on('new_message', (data) => {
        if (data.remitente === chatDestino) {
            agregarBurbujaMensaje(data.contenido, false, null);
        } else {
            // Feedback visual discreto
            const contacto = document.querySelector(`li[data-user="${data.remitente}"]`);
            if(contacto) {
                contacto.style.fontWeight = "bold";
                contacto.innerText += " 🔴";
            }
        }
    });

    // Escuchar DIFUSIÓN (Broadcast)
    socket.on('mensaje_comunidad', (data) => {
        agregarBurbujaGlobal(data.remitente, data.contenido);
    });
}

// --- FUNCIÓN NUEVA: BOTÓN VISUAL ---
function agregarBotonDifusion() {
    const input = document.getElementById("inputTexto");
    const parent = input.parentElement; // El contenedor del input (ej. .input-area)

    // Crear botón visualmente atractivo
    const btn = document.createElement("button");
    btn.innerHTML = "📢"; 
    btn.title = "Difundir a toda la comunidad (Antiflooding)";
    btn.style.marginLeft = "10px";
    btn.style.cursor = "pointer";
    btn.style.backgroundColor = "#ffc107"; // Amarillo alerta
    btn.style.border = "none";
    btn.style.borderRadius = "50%";
    btn.style.width = "40px";
    btn.style.height = "40px";
    btn.style.fontSize = "1.2em";
    btn.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
    btn.style.transition = "transform 0.1s";

    btn.onmousedown = () => btn.style.transform = "scale(0.95)";
    btn.onmouseup = () => btn.style.transform = "scale(1)";
    
    btn.onclick = () => {
        const texto = prompt("📢 Escribe el mensaje para TODA la comunidad:");
        if (texto && texto.trim() !== "") {
            // Emitir evento de difusión al backend
            socket.emit('broadcast_comunidad', { 
                remitente: miUsuario, 
                contenido: texto 
            });
            // Mostrar mi propio mensaje inmediatamente
            agregarBurbujaGlobal("Tú (Difusión)", texto);
        }
    };

    // Insertar el botón junto al input
    parent.appendChild(btn);
}

//RESTO DE TU LÓGICA DE CONTACTOS Y CHAT ...
async function cargarContactosLateral() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_URL}/chat/contactos`, { headers: { "Authorization": `Bearer ${token}` } });
        const contactos = await res.json();
        const lista = document.getElementById("listaContactos");
        if(lista) {
            lista.innerHTML = "";
            contactos.forEach(c => {
                const li = document.createElement("li");
                li.innerText = `${c.nombre} ${c.apellido}`;
                li.setAttribute("data-user", c.username); // Para buscarlo luego
                li.onclick = () => abrirChat(c.username);
                li.style.cursor = "pointer";
                li.style.padding = "10px";
                li.style.borderBottom = "1px solid #eee";
                if(c.username === chatDestino) li.style.backgroundColor = "#e0e0e0";
                lista.appendChild(li);
            });
        }
    } catch(e) {}
}

async function abrirChat(username) {
    chatDestino = username;
    localStorage.setItem("chatDestino", username);
    const nombreEl = document.getElementById("nombreContacto");
    if(nombreEl) nombreEl.innerText = username;
    
    const chatBox = document.getElementById("mensajesChat");
    chatBox.innerHTML = "<p style='text-align:center; color:#999'>Cargando...</p>";

    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_URL}/chat/historial/${username}`, { headers: { "Authorization": `Bearer ${token}` } });
        const mensajes = await res.json();
        chatBox.innerHTML = "";
        
        mensajes.forEach(m => {
            const esMio = (m.remitente_id === miUsuarioId);
            agregarBurbujaMensaje(m.contenido, esMio, m.id);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    } catch(e) {}
}

function enviarMensaje() {
    const input = document.getElementById('inputTexto');
    const texto = input.value.trim();
    if (!texto || !chatDestino) return;

    // Envío Unicast (Privado)
    socket.emit('send_message', { remitente: miUsuario, destinatario: chatDestino, contenido: texto });
    
    setTimeout(() => abrirChat(chatDestino), 200); 
    input.value = "";
}

// Burbuja Normal
function agregarBurbujaMensaje(texto, esMio, id) {
    const chat = document.getElementById('mensajesChat');
    const container = document.createElement('div');
    container.style.display = "flex";
    container.style.justifyContent = esMio ? "flex-end" : "flex-start";
    container.style.width = "100%";
    container.style.marginBottom = "8px";
    if(id) container.id = `msg-${id}`;

    const p = document.createElement('div');
    p.className = esMio ? 'mensaje mio' : 'mensaje';
    p.style.backgroundColor = esMio ? "#d1e7dd" : "#ffffff";
    p.style.border = "1px solid #ddd";
    p.style.padding = "10px 15px";
    p.style.borderRadius = "15px";
    p.style.maxWidth = "70%";
    
    const span = document.createElement("span");
    span.innerText = texto;
    p.appendChild(span);
    
    container.appendChild(p);
    chat.appendChild(container);
    chat.scrollTop = chat.scrollHeight;
}

// Burbuja Global (La Demo de Antiflooding)
function agregarBurbujaGlobal(remitente, texto) {
    const chat = document.getElementById('mensajesChat');
    const container = document.createElement('div');
    container.style.display = "flex";
    container.style.justifyContent = "center";
    container.style.width = "100%";
    container.style.marginBottom = "15px";

    const p = document.createElement('div');
    p.style.backgroundColor = "#fff3cd"; // Color aviso
    p.style.color = "#856404";
    p.style.border = "1px solid #ffeeba";
    p.style.padding = "10px 20px";
    p.style.borderRadius = "50px";
    p.style.fontSize = "0.9em";
    p.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
    
    p.innerHTML = `<strong>📢 ${remitente}:</strong> ${texto}`;

    container.appendChild(p);
    chat.appendChild(container);
    chat.scrollTop = chat.scrollHeight;
}
