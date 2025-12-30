const API_URL = "http://localhost:8000";

document.addEventListener("DOMContentLoaded", () => {
    cargarContactos();
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
    // Guardamos el usuario destino para abrirlo directo en el chat
    localStorage.setItem("chatDestino", username);
    window.location.href = "chat.html";
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
