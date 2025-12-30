const API_URL = "http://localhost:8000";
let socket;
let miUsuario = "";
let archivoSeleccionado = null;

// Variables de modales
let postAEliminarId = null;
let postAEditarId = null;

document.addEventListener("DOMContentLoaded", async () => {
    await verificarSesion(); // Ahora es async para esperar el usuario
    conectarSocket(); // Conectar socket al inicio
    cargarFeed();
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

function conectarSocket() {
    if(typeof io !== 'undefined') {
        socket = io(API_URL, { transports: ['websocket', 'polling'] });
        socket.on('connect', () => socket.emit('identify', { username: miUsuario }));
    }
}

async function cargarFeed() {
    const contenedor = document.getElementById("contenedorFeed");
    const token = localStorage.getItem("token");

    try {
        const response = await fetch(`${API_URL}/publicaciones/`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            const posts = await response.json();
            contenedor.innerHTML = ""; 
            if (posts.length === 0) contenedor.innerHTML = "<p class='sin-publicaciones'>No hay publicaciones.</p>";
            
            posts.forEach(post => {
                contenedor.innerHTML += renderizarPost(post, miUsuario);
            });
        }
    } catch (error) { console.error(error); }
}

function renderizarPost(post, usuarioLogueado) {
    const fecha = new Date(post.fecha).toLocaleString();
    const nombreAutor = post.usuario ? `${post.usuario.nombre} ${post.usuario.apellido}` : "Usuario";
    const usernameAutor = post.usuario ? post.usuario.username : "";
    
    // Configurar botón de Like (Color y Acción)
    // Si ya le di like, ponemos icono rojo o estilo diferente
    const likeIconColor = post.ya_di_like ? "filter: sepia(1) saturate(10000%) hue-rotate(330deg);" : ""; 
    // Truco CSS rápido para colorear imagen negra a roja, o mejor usar clases si tenemos iconos SVG
    
    // Botón de Like con evento onclick
    const likeBtn = `
        <button class="action-btn" onclick="darLike(this, ${post.id}, '${usernameAutor}')">
            <img src="imagenes/like.jpg" style="width:20px; height:20px; margin-right:5px; vertical-align:middle; ${likeIconColor}">
            <span id="likes-count-${post.id}">${post.likes > 0 ? post.likes : ''}</span> Me gusta
        </button>
    `;

    // ... (Resto del renderizado igual que antes) ...
    let menuHTML = "";
    if (usuarioLogueado === usernameAutor) {
        menuHTML = `<div class="menu-container">
                <button class="menu-btn" onclick="toggleMenu(${post.id})"><img src="imagenes/options.jpg" style="width:20px;"></button>
                <div id="menu-${post.id}" class="menu-dropdown">
                    <button onclick="abrirModalEditar(${post.id}, '${post.texto.replace(/'/g, "\'")}')">Editar</button>
                    <button class="btn-delete" onclick="abrirModalEliminar(${post.id})">Eliminar</button>
                </div>
            </div>`;
    }

    return `
        <div class="publicacion" id="post-${post.id}">
            ${menuHTML}
            <div class="post-header">
                <img src="imagenes/perfil.jpg" class="post-avatar">
                <div class="post-info">
                    <h4>${nombreAutor}</h4>
                    <span>${fecha} · ${post.privacidad}</span>
                </div>
            </div>
            <div class="post-content">${post.texto}</div>
            ${post.imagen_url ? `<img src="${post.imagen_url}" class="post-image" onerror="this.style.display='none'">` : ''}
            
            <div class="post-actions">
                ${likeBtn}
                <button class="action-btn"><img src="imagenes/comentar.jpg" style="width:20px; height:20px; margin-right:5px;"> Comentar</button>
                <button class="action-btn"><img src="imagenes/compartir.jpg" style="width:20px; height:20px; margin-right:5px;"> Compartir</button>
            </div>
        </div>
    `;
}

// --- FUNCIÓN DAR LIKE (Conectada a Backend y Socket) ---
async function darLike(btn, postId, ownerUsername) {
    const token = localStorage.getItem("token");
    const img = btn.querySelector('img');
    const span = btn.querySelector('span');
    
    // Efecto visual inmediato (Optimista)
    img.style.transform = "scale(1.3)";
    setTimeout(() => img.style.transform = "scale(1)", 200);

    try {
        const res = await fetch(`${API_URL}/publicaciones/${postId}/like`, {
            method: "POST", headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (res.ok) {
            const data = await res.json();
            
            // Actualizar contador visualmente
            let currentLikes = parseInt(span.innerText) || 0;
            
            if (data.accion === "LIKE") {
                // Se dio like
                img.style.filter = "sepia(1) saturate(10000%) hue-rotate(330deg)"; // Rojo
                span.innerText = currentLikes + 1;
                
                // NOTIFICACIÓN: Solo si el like es nuevo y no es a mí mismo
                if(socket && miUsuario !== ownerUsername) {
                    socket.emit('send_notification', {
                        tipo: 'LIKE',
                        origen: miUsuario,
                        destino: ownerUsername,
                        post_id: postId
                    });
                }
            } else {
                // Se quitó like (Dislike)
                img.style.filter = ""; // Normal
                span.innerText = currentLikes > 0 ? currentLikes - 1 : "";
            }
        }
    } catch(e) { console.error(e); }
}

// ... (Resto de funciones de crear, modales, etc. que ya teníamos)
// Copiar aquí las funciones manejarArchivo, quitarImagen, crearPublicacion, toggleMenu, abrirModal...
// Para no hacer el script kilométrico, asumimos que se mantienen o se agregan.
// (En la implementación real del script python abajo, escribiré el archivo completo para que no falte nada)

function manejarArchivo(input) { if (input.files && input.files[0]) { archivoSeleccionado = input.files[0]; const r = new FileReader(); r.onload = (e) => { document.getElementById('imgPreview').src = e.target.result; document.getElementById('previewContainer').style.display = 'block'; }; r.readAsDataURL(input.files[0]); } }
function quitarImagen() { archivoSeleccionado = null; document.getElementById('fileInput').value = ""; document.getElementById('previewContainer').style.display = 'none'; }
async function crearPublicacion() {
    const txt = document.getElementById("textoPost").value;
    const priv = document.getElementById("privacidadSelect").value;
    const token = localStorage.getItem("token");
    if(!txt && !archivoSeleccionado) return;
    document.querySelector(".btn-publicar").disabled = true;
    try {
        let url = null;
        if(archivoSeleccionado) {
            const fd = new FormData(); fd.append("file", archivoSeleccionado);
            const r = await fetch(`${API_URL}/publicaciones/subir-imagen`, {method:"POST", body:fd});
            url = (await r.json()).url;
        }
        await fetch(`${API_URL}/publicaciones/`, {
            method:"POST", headers:{"Content-Type":"application/json", "Authorization":`Bearer ${token}`},
            body: JSON.stringify({texto:txt, imagen_url:url, privacidad:priv})
        });
        document.getElementById("textoPost").value=""; quitarImagen(); cargarFeed();
    } catch(e){} finally { document.querySelector(".btn-publicar").disabled = false; }
}
function toggleMenu(id) { document.getElementById(`menu-${id}`).classList.toggle('show'); }
window.onclick = (e) => { if(!e.target.closest('.menu-btn')) document.querySelectorAll('.menu-dropdown').forEach(m=>m.classList.remove('show')); }
function abrirModalEliminar(id){ postAEliminarId=id; document.getElementById('modalEliminar').style.display='flex'; }
function cerrarModalEliminar(){ document.getElementById('modalEliminar').style.display='none'; }
async function confirmarEliminar(){ if(!postAEliminarId)return; await fetch(`${API_URL}/publicaciones/${postAEliminarId}`, {method:"DELETE", headers:{"Authorization":`Bearer ${localStorage.getItem("token")}`}}); document.getElementById(`post-${postAEliminarId}`).remove(); cerrarModalEliminar(); }
function abrirModalEditar(id, txt){ postAEditarId=id; document.getElementById('textoEditarInput').value=txt; document.getElementById('modalEditarPost').style.display='flex'; }
function cerrarModalEditar(){ document.getElementById('modalEditarPost').style.display='none'; }
async function confirmarEditar(){ const txt=document.getElementById('textoEditarInput').value; await fetch(`${API_URL}/publicaciones/${postAEditarId}`, {method:"PUT", headers:{"Content-Type":"application/json", "Authorization":`Bearer ${localStorage.getItem("token")}`}, body:JSON.stringify({texto:txt})}); location.reload(); }
function logout(){ localStorage.clear(); window.location.href="login.html"; }

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


