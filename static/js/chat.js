const API_URL = "http://localhost:8000";
let socket;
let chatDestino = localStorage.getItem("chatDestino"); // Usuario con el que hablo
let miUsuario = "";   // Mi username
let miUsuarioId = null; // MI ID (Nuevo: Para distinguir mensajes propios)

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Obtener mi usuario E ID
    const token = localStorage.getItem("token");
    if (!token) window.location.href = "login.html";
    
    try {
        const res = await fetch(`${API_URL}/auth/me`, { headers: { "Authorization": `Bearer ${token}` } });
        if (!res.ok) throw new Error("Sesión inválida");
        
        const user = await res.json();
        miUsuario = user.username;
        miUsuarioId = user.id; // ¡Guardamos el ID!
        
        console.log(`✅ Identificado como: ${miUsuario} (ID: ${miUsuarioId})`);

    } catch(e) { 
        console.error(e);
        // window.location.href = "login.html"; // Descomentar en producción
        return;
    }

    // 2. Conectar Socket
    conectarSocket();

    // 3. Cargar lista de contactos
    cargarContactosLateral();

    // 4. Si venimos redirigidos, abrir ese chat
    if (chatDestino) {
        abrirChat(chatDestino);
    }
    
    // Enter para enviar
    document.getElementById("inputTexto").addEventListener("keypress", function(event) {
        if (event.key === "Enter") enviarMensaje();
    });
});

function conectarSocket() {
    socket = io(API_URL, {
        transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
        console.log("🔌 Conectado al servidor de chat");
        socket.emit('identify', { username: miUsuario });
    });

    // Escuchar mensajes entrantes
    socket.on('new_message', (data) => {
        if (data.remitente === chatDestino) {
            // Es mensaje del que tengo abierto: agregarlo visualmente como RECIBIDO
            agregarBurbujaMensaje(data.contenido, false);
        } else {
            console.log(`🔔 Mensaje nuevo de ${data.remitente}`);
            // Aquí podrías poner un puntito rojo en la lista de contactos
        }
    });
}

async function cargarContactosLateral() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_URL}/chat/contactos`, { headers: { "Authorization": `Bearer ${token}` } });
        const contactos = await res.json();
        
        const lista = document.getElementById("listaContactos");
        lista.innerHTML = "";
        
        contactos.forEach(c => {
            const li = document.createElement("li");
            li.innerText = `${c.nombre} ${c.apellido}`;
            li.onclick = () => abrirChat(c.username);
            
            // Resaltar chat activo
            if(c.username === chatDestino) li.style.backgroundColor = "#e0e0e0";
            
            lista.appendChild(li);
        });
    } catch(e) { console.error("Error cargando contactos", e); }
}

async function abrirChat(username) {
    chatDestino = username;
    localStorage.setItem("chatDestino", username); // Persistir selección
    
    document.getElementById("nombreContacto").innerText = username;
    const chatBox = document.getElementById("mensajesChat");
    chatBox.innerHTML = "<p class='sistema'>Cargando historial...</p>";

    // Resaltar visualmente en la lista
    cargarContactosLateral(); 

    // Cargar historial
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_URL}/chat/historial/${username}`, { headers: { "Authorization": `Bearer ${token}` } });
        const mensajes = await res.json();
        
        chatBox.innerHTML = ""; // Limpiar
        
        if (mensajes.length === 0) {
            chatBox.innerHTML = "<p class='sistema'>No hay mensajes previos. ¡Saluda! 👋</p>";
        }

        mensajes.forEach(m => {
            // --- CORRECCIÓN DE VISUALIZACIÓN ---
            // Comparamos el remitente_id del mensaje con miUsuarioId
            const esMio = (m.remitente_id === miUsuarioId);
            
            const p = document.createElement("p");
            p.innerText = m.contenido;
            
            if (esMio) {
                p.className = 'mio'; // Clase CSS para alinear a la derecha
            }
            
            chatBox.appendChild(p);
        });
        
        // Scroll al final
        chatBox.scrollTop = chatBox.scrollHeight;
        
    } catch(e) { console.error(e); chatBox.innerHTML = "<p class='sistema'>Error al cargar.</p>"; }
}

function enviarMensaje() {
    const input = document.getElementById('inputTexto');
    const texto = input.value.trim();
    if (!texto || !chatDestino) return;

    // 1. Emitir al servidor (Socket)
    socket.emit('send_message', {
        remitente: miUsuario,
        destinatario: chatDestino,
        contenido: texto
    });

    // 2. Agregar visualmente como MÍO (Optimista)
    agregarBurbujaMensaje(texto, true);
    
    input.value = "";
}

function agregarBurbujaMensaje(texto, esMio) {
    const chat = document.getElementById('mensajesChat');
    const p = document.createElement('p');
    p.innerText = texto;
    
    if (esMio) {
        p.className = 'mio';
    }
    
    chat.appendChild(p);
    chat.scrollTop = chat.scrollHeight;
}

// --- LÓGICA DE BADGE DE NOTIFICACIONES ---
document.addEventListener("DOMContentLoaded", () => {
    actualizarBadge();
    
    // Conectar socket para escuchar nuevas notis en tiempo real
    if(typeof io !== 'undefined' && !socket) {
        conectarSocketGeneral(); 
    }
});

let socketGeneral;

function conectarSocketGeneral() {
    // Si ya existe socket global (del chat o feed), usarlo, sino crear uno
    if(typeof socket !== 'undefined') socketGeneral = socket;
    else {
        socketGeneral = io("http://localhost:8000", { transports: ['websocket', 'polling'] });
        // Identificarse para recibir eventos
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
            console.log("🔔 Nueva notificación recibida!");
            incrementarBadge();
            // Si estamos en la página de notificaciones, recargar la lista
            if(window.location.pathname.includes("notificaciones.html")) {
                cargarNotificaciones();
            }
        });
    }
}

async function actualizarBadge() {
    const token = localStorage.getItem("token");
    if(!token) return;
    
    try {
        // Consultar conteo real al backend (Endpoint simple que cuenta no leídas)
        // Como no tenemos endpoint de conteo, traemos todas y filtramos en cliente (rápido para demo)
        const res = await fetch("http://localhost:8000/notificaciones/", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if(res.ok) {
            const notis = await res.json();
            const noLeidas = notis.filter(n => !n.leido).length;
            const badge = document.getElementById("badgeNotis");
            
            if(noLeidas > 0) {
                badge.style.display = "block";
                badge.innerText = noLeidas > 99 ? "99+" : noLeidas;
            } else {
                badge.style.display = "none";
            }
        }
    } catch(e) {}
}

function incrementarBadge() {
    const badge = document.getElementById("badgeNotis");
    let val = parseInt(badge.innerText) || 0;
    val++;
    badge.innerText = val > 99 ? "99+" : val;
    badge.style.display = "block";
    
    // Animación de rebote
    badge.style.transform = "scale(1.5)";
    setTimeout(() => badge.style.transform = "scale(1)", 200);
}


// --- BÚSQUEDA AVANZADA (Concepto: Pattern Matching) ---
const inputBusqueda = document.querySelector('.busqueda input');

// Crear contenedor si no existe
let resultBox = document.querySelector('.search-results');
if (!resultBox) {
    resultBox = document.createElement('div');
    resultBox.className = 'search-results';
    resultBox.style.display = 'none';
    document.querySelector('.busqueda').appendChild(resultBox);
}

// Estilos
const styleSearch = document.createElement('style');
styleSearch.innerHTML = `
    .busqueda { position: relative; }
    .search-results {
        position: absolute; top: 100%; left: 0; right: 0;
        background: white; border: 1px solid #ccc; border-radius: 0 0 10px 10px;
        max-height: 400px; overflow-y: auto; z-index: 2000;
        box-shadow: 0 10px 20px rgba(0,0,0,0.2);
    }
    .search-item {
        padding: 10px; border-bottom: 1px solid #eee; cursor: pointer;
        display: flex; align-items: center; gap: 10px; text-align: left;
    }
    .search-item:hover { background: #f5f5f5; }
    .search-item img { width: 35px; height: 35px; border-radius: 5px; object-fit: cover; }
    .search-info b { display: block; font-size: 14px; color: #333; }
    .search-info span { font-size: 12px; color: #888; text-transform: uppercase; font-weight: bold; }
    .badge-tipo { font-size: 10px; padding: 2px 5px; border-radius: 4px; margin-left: auto; }
    .tipo-usuario { background: #e3f2fd; color: #1565c0; }
    .tipo-post { background: #fff3e0; color: #ef6c00; }
`;
document.head.appendChild(styleSearch);

let timeoutSearch;
inputBusqueda.addEventListener('input', (e) => {
    clearTimeout(timeoutSearch);
    const q = e.target.value.trim();
    if (!q) { resultBox.style.display = 'none'; return; }
    timeoutSearch = setTimeout(() => realizarBusqueda(q), 300);
});

async function realizarBusqueda(query) {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_URL}/directorios/buscar?q=${query}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            renderizarResultados(data);
        }
    } catch (e) {}
}

function renderizarResultados(items) {
    resultBox.innerHTML = '';
    if (items.length === 0) {
        resultBox.innerHTML = '<div style="padding:15px; color:#777;">Sin coincidencias</div>';
    } else {
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'search-item';
            
            const badgeClass = item.tipo === 'USUARIO' ? 'tipo-usuario' : 'tipo-post';
            
            div.innerHTML = `
                <img src="${item.imagen}" onerror="this.src='imagenes/perfil.jpg'">
                <div class="search-info">
                    <b>${item.titulo}</b>
                    <span>${item.subtitulo}</span>
                </div>
                <span class="badge-tipo ${badgeClass}">${item.tipo}</span>
            `;
            
            div.onclick = () => {
                if (item.tipo === 'USUARIO') {
                    // Ir al perfil (o chat)
                    // Como no tenemos vista de perfil ajeno, vamos al chat directo
                    localStorage.setItem("chatDestino", item.subtitulo.replace('@',''));
                    window.location.href = "mensajeria.html";
                } else {
                    // Es un post: scrollear a él si está en pantalla o alertar
                    alert(`Has localizado el Recurso (Post) ID: ${item.id}`);
                    // Aquí podríamos redirigir a una vista de "Detalle de Post"
                }
                resultBox.style.display = 'none';
            };
            resultBox.appendChild(div);
        });
    }
    resultBox.style.display = 'block';
}

document.addEventListener('click', (e) => {
    if (!document.querySelector('.busqueda').contains(e.target)) {
        resultBox.style.display = 'none';
    }
});
