// URL de la API backend
const API_URL = "http://localhost:8000";

// Variables de usuario y sockets
let socket;
let chatDestino = localStorage.getItem("chatDestino");
let miUsuario = "";
let miUsuarioId = null;

// Variables para P2P
let conexionP2P = null;
let canalDatos = null;
let conexionP2PActiva = false;
let esIniciador = false;

// Al cargar el DOM inicial
document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "login.html";
        return;
    }
    // Obtener datos del usuario para identificar en el socket
    try {
        const res = await fetch(`${API_URL}/auth/me`, { headers: { "Authorization": `Bearer ${token}` } });
        if (!res.ok) throw new Error("Sesión inválida");
        const user = await res.json();
        miUsuario = user.username;
        miUsuarioId = user.id;
    } catch (e) {
        return;
    }
    // Conectar al socket de la aplicación
    conectarSocket();
    // Cargar lista de contactos en el lateral
    cargarContactosLateral();
    // Abrir el chat almacenado si existe
    if (chatDestino) abrirChat(chatDestino);
    // Enviar mensaje con Enter
    document.getElementById("inputTexto").addEventListener("keypress", (e) => {
        if (e.key === "Enter") enviarMensaje();
    });
    // Agregar botón de difusión para broadcast antiflooding
    agregarBotonDifusion();
    // Cerrar menús de opciones al hacer clic fuera
    window.onclick = (e) => {
        if (!e.target.closest('.msg-options-btn')) {
            document.querySelectorAll('.msg-dropdown').forEach(m => m.style.display = 'none');
        }
    };
});

// Conecta al servidor Socket.IO y configura eventos
function conectarSocket() {
    socket = io(API_URL, { transports: ['websocket', 'polling'] });
    socket.on('connect', () => {
        console.log("Conectado al socket");
        socket.emit('identify', { username: miUsuario });
    });
    // Recibir mensajes privados (cuando no hay P2P activo)
    socket.on('new_message', (data) => {
        // Si el remitente coincide con el chat abierto, mostrar en pantalla
        if (data.remitente === chatDestino) {
            agregarBurbujaMensaje(data.contenido, false, null);
        } else {
            // Destacar el contacto con un indicador rojo
            const contacto = document.querySelector(`li[data-user="${data.remitente}"]`);
            if (contacto) {
                contacto.style.fontWeight = "bold";
                contacto.innerText += " 🔴";
            }
        }
    });
    // Recibir mensajes de difusión (broadcast)
    socket.on('mensaje_comunidad', (data) => {
        agregarBurbujaGlobal(data.remitente, data.contenido);
    });
    // Manejar señalización P2P
    socket.on('p2p_signal', (data) => {
        // Solo procesar señales del contacto con el que se intenta conectar
        if (data.origen !== chatDestino) return;
        // Si no existe conexión aún, configurarla
        if (!conexionP2P) {
            configurarConexionP2P();
        }
        const signal = data.signal;
        if (signal.sdp) {
            // Establecer la descripción remota
            conexionP2P.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                // Si recibimos una oferta, creamos una respuesta y la enviamos
                if (signal.sdp.type === 'offer') {
                    conexionP2P.createAnswer().then(answer => conexionP2P.setLocalDescription(answer)).then(() => {
                        socket.emit('p2p_signal', {
                            origen: miUsuario,
                            destino: data.origen,
                            signal: { sdp: conexionP2P.localDescription }
                        });
                    });
                }
            });
        } else if (signal.candidate) {
            // Agregar candidato ICE recibido
            conexionP2P.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
    });
    // Escuchar notificaciones globales para actualizar el badge
    socket.on('new_notification', () => {
        incrementarBadge();
    });
}

// Configura un objeto RTCPeerConnection y sus manejadores
function configurarConexionP2P() {
    // Configuración de ICE servers (usar STUN público de Google)
    conexionP2P = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    // Enviar candidatos ICE al otro par
    conexionP2P.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('p2p_signal', {
                origen: miUsuario,
                destino: chatDestino,
                signal: { candidate: event.candidate }
            });
        }
    };
    // Recibir canal de datos creado por el otro par
    conexionP2P.ondatachannel = (event) => {
        canalDatos = event.channel;
        configurarCanalDatos();
    };
}

// Configura el canal de datos para enviar y recibir mensajes
function configurarCanalDatos() {
    canalDatos.onopen = () => {
        conexionP2PActiva = true;
        console.log('Canal P2P abierto');
    };
    canalDatos.onclose = () => {
        conexionP2PActiva = false;
        console.log('Canal P2P cerrado');
    };
    canalDatos.onmessage = (event) => {
        agregarBurbujaMensaje(event.data, false, null);
    };
}

// Inicia la negociación P2P enviando una oferta al destinatario
function iniciarConexionP2P() {
    if (!chatDestino) return;
    if (conexionP2PActiva) {
        alert('Ya hay una conexión P2P activa.');
        return;
    }
    esIniciador = true;
    configurarConexionP2P();
    // Crear canal de datos cuando iniciamos la oferta
    canalDatos = conexionP2P.createDataChannel('chat');
    configurarCanalDatos();
    // Crear la oferta
    conexionP2P.createOffer().then(offer => conexionP2P.setLocalDescription(offer)).then(() => {
        socket.emit('p2p_signal', {
            origen: miUsuario,
            destino: chatDestino,
            signal: { sdp: conexionP2P.localDescription }
        });
    });
}

// Carga la lista de contactos en la barra lateral
async function cargarContactosLateral() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_URL}/chat/contactos`, { headers: { "Authorization": `Bearer ${token}` } });
        const contactos = await res.json();
        const lista = document.getElementById("listaContactos");
        if (lista) {
            lista.innerHTML = "";
            contactos.forEach(c => {
                const li = document.createElement("li");
                li.innerText = `${c.nombre} ${c.apellido}`;
                li.setAttribute("data-user", c.username);
                li.onclick = () => abrirChat(c.username);
                li.style.cursor = "pointer";
                li.style.padding = "10px";
                li.style.borderBottom = "1px solid #eee";
                if (c.username === chatDestino) li.style.backgroundColor = "#e0e0e0";
                lista.appendChild(li);
            });
        }
    } catch (e) {
        /* Ignorar errores */
    }
}

// Abre una conversación con un usuario concreto y carga su historial
async function abrirChat(username) {
    chatDestino = username;
    localStorage.setItem("chatDestino", username);
    const nombreEl = document.getElementById("nombreContacto");
    if (nombreEl) nombreEl.innerText = username;
    const chatBox = document.getElementById("mensajesChat");
    chatBox.innerHTML = "<p style='text-align:center; color:#999'>Cargando...</p>";
    // Reiniciar P2P si existía una conexión anterior
    if (conexionP2P) {
        conexionP2P.close();
        conexionP2P = null;
        canalDatos = null;
        conexionP2PActiva = false;
    }
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
    } catch (e) {
        /* Ignorar errores */
    }
}

// Enviar un mensaje ya sea mediante P2P (si está activa) o mediante el servidor
function enviarMensaje() {
    const input = document.getElementById('inputTexto');
    const texto = input.value.trim();
    if (!texto || !chatDestino) return;
    // Si la conexión P2P está activa y el canal abierto, enviar directamente
    if (conexionP2PActiva && canalDatos && canalDatos.readyState === 'open') {
        canalDatos.send(texto);
        agregarBurbujaMensaje(texto, true, null);
        input.value = "";
        return;
    }
    // Fallback: envío normal a través del servidor
    socket.emit('send_message', { remitente: miUsuario, destinatario: chatDestino, contenido: texto });
    setTimeout(() => abrirChat(chatDestino), 200);
    input.value = "";
}

// Agrega una burbuja de mensaje al chat (privado)
function agregarBurbujaMensaje(texto, esMio, id) {
    const chat = document.getElementById('mensajesChat');
    const container = document.createElement('div');
    container.style.display = "flex";
    container.style.justifyContent = esMio ? "flex-end" : "flex-start";
    container.style.width = "100%";
    container.style.marginBottom = "8px";
    if (id) container.id = `msg-${id}`;
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

// Agrega una burbuja de mensaje global (difusión)
function agregarBurbujaGlobal(remitente, texto) {
    const chat = document.getElementById('mensajesChat');
    const container = document.createElement('div');
    container.style.display = "flex";
    container.style.justifyContent = "center";
    container.style.width = "100%";
    container.style.marginBottom = "15px";
    const p = document.createElement('div');
    p.style.backgroundColor = "#fff3cd";
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

// Agrega el botón de difusión (mantiene la lógica original de broadcast)
function agregarBotonDifusion() {
    const input = document.getElementById("inputTexto");
    const parent = input.parentElement;
    const btn = document.createElement("button");
    btn.innerHTML = "📢";
    btn.title = "Difundir a toda la comunidad (Antiflooding)";
    btn.style.marginLeft = "10px";
    btn.style.cursor = "pointer";
    btn.style.backgroundColor = "#ffc107";
    btn.style.border = "none";
    btn.style.borderRadius = "50%";
    btn.style.width = "40px";
    btn.style.height = "40px";
    btn.style.fontSize = "1.2em";
    btn.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
    btn.onmousedown = () => btn.style.transform = "scale(0.95)";
    btn.onmouseup = () => btn.style.transform = "scale(1)";
    btn.onclick = () => {
        const texto = prompt("📢 Escribe el mensaje para TODA la comunidad:");
        if (texto && texto.trim() !== "") {
            socket.emit('broadcast_comunidad', {
                remitente: miUsuario,
                contenido: texto
            });
            agregarBurbujaGlobal("Tú (Difusión)", texto);
        }
    };
    parent.appendChild(btn);
}

// Actualiza el badge de notificaciones (copiado de mensajeria.js)
function incrementarBadge() {
    const badge = document.getElementById("badgeNotis");
    let val = parseInt(badge.innerText) || 0;
    val++;
    badge.innerText = val > 99 ? "99+" : val;
    badge.style.display = "block";
}