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
    cargarContactosLateral(); // Función original de tu repo
    if (chatDestino) abrirChat(chatDestino);
    
    document.getElementById("inputTexto").addEventListener("keypress", (e) => {
        if (e.key === "Enter") enviarMensaje();
    });

    // Cerrar menús
    window.onclick = (e) => {
        if (!e.target.closest('.msg-options-btn')) {
            document.querySelectorAll('.msg-dropdown').forEach(m => m.style.display = 'none');
        }
    }
});

function conectarSocket() {
    socket = io(API_URL, { transports: ['websocket', 'polling'] });
    socket.on('connect', () => { socket.emit('identify', { username: miUsuario }); });

    socket.on('new_message', (data) => {
        if (data.remitente === chatDestino) {
            agregarBurbujaMensaje(data.contenido, false, null);
        }
    });

    socket.on('mensaje_eliminado', (data) => {
        const el = document.getElementById(`msg-${data.id}`);
        if (el) el.remove();
    });

    socket.on('mensaje_editado', (data) => {
        const el = document.getElementById(`msg-${data.id}`);
        if (el) {
            const p = el.querySelector('.msg-text');
            if(p) p.innerText = data.contenido;
        }
    });
}

// Mantenemos tu función de carga lateral original
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
                li.onclick = () => abrirChat(c.username);
                if(c.username === chatDestino) li.style.backgroundColor = "#e0e0e0";
                lista.appendChild(li);
            });
        }
    } catch(e) {}
}

async function abrirChat(username) {
    chatDestino = username;
    localStorage.setItem("chatDestino", username);
    document.getElementById("nombreContacto").innerText = username;
    const chatBox = document.getElementById("mensajesChat");
    chatBox.innerHTML = "<p>Cargando...</p>";

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

    socket.emit('send_message', { remitente: miUsuario, destinatario: chatDestino, contenido: texto });
    socket.emit('send_notification', { type: 'MENSAJE', origen: miUsuario, destino: chatDestino });

    // Refresco rápido para obtener ID
    setTimeout(() => abrirChat(chatDestino), 300); 
    input.value = "";
}

// --- FUNCIÓN MODIFICADA CON MENÚ DE 3 PUNTOS ---
function agregarBurbujaMensaje(texto, esMio, id) {
    const chat = document.getElementById('mensajesChat');
    const container = document.createElement('div');
    container.style.display = "flex";
    container.style.justifyContent = esMio ? "flex-end" : "flex-start";
    container.style.width = "100%";
    container.style.marginBottom = "5px";
    if(id) container.id = `msg-${id}`;

    const p = document.createElement('div'); // Usamos div para contenedor relativo
    p.className = esMio ? 'mensaje mio' : 'mensaje';
    // Estilos inline base para asegurar que se vea bien
    p.style.backgroundColor = esMio ? "#d1e7dd" : "#e0e0e0";
    p.style.padding = "10px 15px";
    p.style.borderRadius = "20px";
    p.style.maxWidth = "70%";
    p.style.position = "relative";
    
    // Texto
    const span = document.createElement("span");
    span.className = "msg-text";
    span.innerText = texto;
    p.appendChild(span);

    // Menú (Solo si es mío)
    if (esMio && id) {
        const btn = document.createElement("img");
        btn.src = "imagenes/options.jpg";
        btn.className = "msg-options-btn";
        btn.style.width = "15px";
        btn.style.height = "15px";
        btn.style.position = "absolute";
        btn.style.top = "-5px";
        btn.style.right = "-5px";
        btn.style.cursor = "pointer";
        btn.style.borderRadius = "50%";
        btn.style.border = "1px solid white";
        btn.style.display = "none"; // Oculto por defecto

        // Mostrar al hover
        p.onmouseenter = () => btn.style.display = "block";
        p.onmouseleave = () => { if(dropdown.style.display!=='block') btn.style.display="none"; };

        const dropdown = document.createElement("div");
        dropdown.className = "msg-dropdown";
        dropdown.style.display = "none";
        dropdown.style.position = "absolute";
        dropdown.style.right = "0";
        dropdown.style.top = "15px";
        dropdown.style.background = "white";
        dropdown.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
        dropdown.style.zIndex = "100";
        dropdown.innerHTML = `
            <div style="padding:5px; cursor:pointer;" onclick="iniciarEdicion(${id}, '${texto}')">Editar</div>
            <div style="padding:5px; cursor:pointer; color:red;" onclick="eliminarMensaje(${id})">Eliminar</div>
        `;

        btn.onclick = (e) => {
            e.stopPropagation();
            dropdown.style.display = (dropdown.style.display==='block')?'none':'block';
        };

        p.appendChild(btn);
        p.appendChild(dropdown);
    }

    container.appendChild(p);
    chat.appendChild(container);
    chat.scrollTop = chat.scrollHeight;
}

async function eliminarMensaje(id) {
    if(!confirm("¿Borrar?")) return;
    try { await fetch(`${API_URL}/chat/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` } }); } catch(e){}
}

async function iniciarEdicion(id, txt) {
    const nuevo = prompt("Editar:", txt);
    if(nuevo && nuevo!==txt) {
        try { 
            await fetch(`${API_URL}/chat/${id}`, { 
                method: "PUT", 
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
                body: JSON.stringify({contenido: nuevo}) 
            }); 
        } catch(e){}
    }
}
