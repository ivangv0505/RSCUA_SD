const API_URL = "http://localhost:8000";
let miUsuario = "";
let socket;
let postAEditarId = null;

document.addEventListener("DOMContentLoaded", async () => {
    await verificarSesion(); // Primero verificamos quién soy
    
    // Detectar si vemos perfil ajeno
    const urlParams = new URLSearchParams(window.location.search);
    const usuarioUrl = urlParams.get('u');
    const usuarioVer = usuarioUrl || miUsuario;

    conectarSocket(); // <--- NUEVO: Conectar para recibir notis
    actualizarBadge(); // <--- NUEVO: Cargar numerito inicial
    
    // Cargar datos
    cargarDatosUsuario(usuarioVer);
    cargarPublicacionesDe(usuarioVer);

    // Cerrar menús al hacer click fuera
    window.onclick = (e) => { 
        if(!e.target.closest('.menu-btn')) {
            document.querySelectorAll('.menu-dropdown').forEach(m => m.style.display = 'none');
        }
    }
});

async function verificarSesion() {
    const token = localStorage.getItem("token");
    if (!token) window.location.href = "login.html";
    try {
        const res = await fetch(`${API_URL}/auth/me`, { headers: { "Authorization": `Bearer ${token}` } });
        if(res.ok) { 
            const u = await res.json(); 
            miUsuario = u.username; 
        }
    } catch(e) {}
}

// --- LÓGICA DE NOTIFICACIONES (Igual que en Feed) ---
function conectarSocket() {
    if(typeof io !== 'undefined') {
        socket = io(API_URL, { transports: ['websocket', 'polling'] });
        socket.on('connect', () => socket.emit('identify', { username: miUsuario }));
        socket.on('notification_received', () => actualizarBadge());
    }
}

async function actualizarBadge() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_URL}/notificaciones/`, { headers: { "Authorization": `Bearer ${token}` } });
        if (res.ok) {
            const notis = await res.json();
            const noLeidas = notis.filter(n => !n.leido).length;
            const badge = document.getElementById("badgeNotis");
            if (badge) {
                badge.innerText = noLeidas;
                badge.style.display = noLeidas > 0 ? 'flex' : 'none';
            }
        }
    } catch (e) { console.error(e); }
}

// --- CARGA DE DATOS ---
async function cargarDatosUsuario(username) {
    const token = localStorage.getItem("token");
    // Determinar si mostrar botón editar
    if(username === miUsuario) {
        document.querySelector(".btn-editar").style.display = "inline-block";
    } else {
        document.querySelector(".btn-editar").style.display = "none";
    }

    try {
        // Usamos el endpoint de perfil público que creamos antes
        const res = await fetch(`${API_URL}/directorios/perfil/${username}`, { 
            headers: { "Authorization": `Bearer ${token}` } 
        });
        
        if(res.ok) {
            const user = await res.json();
            document.getElementById("nombreCompleto").innerText = `${user.nombre} ${user.apellido}`;
            document.getElementById("usernameDisplay").innerText = `@${user.username}`;
            document.getElementById("bioDisplay").innerText = user.descripcion || "Sin descripción.";
            // Si el endpoint devuelve contadores, usarlos:
            if(user.posts_count !== undefined) {
                document.getElementById("contadorPosts").innerHTML = `<strong>${user.posts_count}</strong> Publicaciones`;
            }
        }
    } catch(e) {}
}

async function cargarPublicacionesDe(username) {
    const token = localStorage.getItem("token");
    const contenedor = document.getElementById("misPublicaciones");
    
    try {
        const res = await fetch(`${API_URL}/publicaciones/`, { headers: { "Authorization": `Bearer ${token}` } });
        const posts = await res.json();
        const susPosts = posts.filter(p => p.usuario.username === username);
        
        // Actualizar contador local si el endpoint de perfil no lo hizo
        if(document.getElementById("contadorPosts").innerText === "0 Publicaciones") {
             document.getElementById("contadorPosts").innerHTML = `<strong>${susPosts.length}</strong> Publicaciones`;
        }

        contenedor.innerHTML = "";
        if (susPosts.length === 0) {
            contenedor.innerHTML = "<p style='text-align:center; padding:20px; color:#777;'>Sin publicaciones.</p>";
            return;
        }

        susPosts.forEach(p => {
            const fecha = new Date(p.fecha).toLocaleString();
            
            // Solo mostrar menú si soy el dueño
            let menuHTML = "";
            if(miUsuario === p.usuario.username) {
                menuHTML = `
                    <div class="menu-container">
                        <button class="menu-btn" onclick="toggleMenu(${p.id})">
                            <img src="imagenes/options.jpg" style="width:20px;">
                        </button>
                        <div id="menu-${p.id}" class="menu-dropdown">
                            <button onclick="abrirModalEditar(${p.id}, '${p.texto.replace(/'/g, "\\'")}')">Editar</button>
                            <button class="btn-delete" onclick="eliminarPost(${p.id})">Eliminar</button>
                        </div>
                    </div>`;
            }

            const html = `
                <div class="publicacion" id="post-${p.id}">
                    ${menuHTML}
                    <div class="post-header">
                        <img src="imagenes/perfil.jpg" class="post-avatar">
                        <div class="post-info">
                            <h4>${p.usuario.nombre} ${p.usuario.apellido}</h4>
                            <span>${fecha} · ${p.privacidad}</span>
                        </div>
                    </div>
                    <div class="post-content">${p.texto}</div>
                    ${p.imagen_url ? `<img src="${p.imagen_url}" class="post-image" onerror="this.style.display='none'">` : ''}
                    <div class="post-actions">
                        <button class="action-btn"><img src="imagenes/like.jpg"> ${p.likes || ''} Me gusta</button>
                        <button class="action-btn"><img src="imagenes/comentar.jpg"> Comentar</button>
                        <button class="action-btn"><img src="imagenes/compartir.jpg"> Compartir</button>
                    </div>
                </div>
            `;
            contenedor.innerHTML += html;
        });
    } catch(e) {}
}

// --- FUNCIONES AUXILIARES ---
function toggleMenu(id) {
    document.querySelectorAll('.menu-dropdown').forEach(m => m.style.display = 'none');
    document.getElementById(`menu-${id}`).style.display = 'block';
}

async function eliminarPost(id) {
    if(!confirm("¿Eliminar?")) return;
    const token = localStorage.getItem("token");
    await fetch(`${API_URL}/publicaciones/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
    location.reload();
}

function abrirModalEditar(id, txt) {
    postAEditarId = id;
    document.getElementById('textoEditarInput').value = txt;
    document.getElementById('modalEditarPost').style.display = 'flex';
}
function cerrarModalEditar() { document.getElementById('modalEditarPost').style.display = 'none'; }

async function confirmarEditar() {
    const txt = document.getElementById('textoEditarInput').value;
    const token = localStorage.getItem("token");
    await fetch(`${API_URL}/publicaciones/${postAEditarId}`, {
        method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify({ texto: txt })
    });
    location.reload();
}

const inputBusqueda = document.querySelector('.busqueda input');

// Crear contenedor de resultados si no existe
let resultBox = document.querySelector('.search-results');
if (!resultBox && inputBusqueda) { // Validación extra por si no encuentra el input
    resultBox = document.createElement('div');
    resultBox.className = 'search-results';
    resultBox.style.display = 'none';
    document.querySelector('.busqueda').appendChild(resultBox);

    // Inyectar estilos necesarios para la lista desplegable
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
}

let timeoutSearch;
if (inputBusqueda) {
    inputBusqueda.addEventListener('input', (e) => {
        clearTimeout(timeoutSearch);
        const q = e.target.value.trim();
        if (!q) { resultBox.style.display = 'none'; return; }
        timeoutSearch = setTimeout(() => realizarBusqueda(q), 300);
    });
}

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
                <img src="${item.imagen || 'imagenes/perfil.jpg'}" onerror="this.src='imagenes/perfil.jpg'">
                <div class="search-info">
                    <b>${item.titulo}</b>
                    <span>${item.subtitulo}</span>
                </div>
                <span class="badge-tipo ${badgeClass}">${item.tipo}</span>
            `;
            
            div.onclick = () => {
                if (item.tipo === 'USUARIO') {
                    // Redirigir al perfil del usuario encontrado
                    window.location.href = `perfil.html?u=${item.subtitulo.replace('@','')}`;
                } else {
                    alert(`Has localizado el Post ID: ${item.id}`);
                }
                resultBox.style.display = 'none';
            };
            resultBox.appendChild(div);
        });
    }
    resultBox.style.display = 'block';
}

document.addEventListener('click', (e) => {
    if (document.querySelector('.busqueda') && !document.querySelector('.busqueda').contains(e.target)) {
        if(resultBox) resultBox.style.display = 'none';
    }
});

function abrirEditor() { document.getElementById("modalEditarPerfil").style.display = 'flex'; }
function cerrarEditor() { document.getElementById("modalEditarPerfil").style.display = 'none'; }
function guardarPerfil() { alert("Pendiente"); cerrarEditor(); }