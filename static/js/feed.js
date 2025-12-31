const API_URL = "http://localhost:8000";
let socket;
let miUsuario = "";
let archivoSeleccionado = null;
let postAEditarId = null;
let postAEliminarId = null;

document.addEventListener("DOMContentLoaded", async () => {
    await verificarSesion();
    conectarSocket();
    cargarFeed();
    actualizarBadge();
    
    window.onclick = (e) => { 
        if(!e.target.closest('.menu-btn')) {
            document.querySelectorAll('.menu-dropdown').forEach(m => m.classList.remove('show'));
        }
    }
});

async function verificarSesion() {
    const token = localStorage.getItem("token");
    if (!token) window.location.href = "login.html";
    try {
        const res = await fetch(`${API_URL}/auth/me`, { headers: { "Authorization": `Bearer ${token}` } });
        if(res.ok) { const u = await res.json(); miUsuario = u.username; }
    } catch(e) {}
}

function conectarSocket() {
    if(typeof io !== 'undefined') {
        socket = io(API_URL, { transports: ['websocket', 'polling'] });
        socket.on('connect', () => { socket.emit('identify', { username: miUsuario }); });
        socket.on('notification_received', () => { actualizarBadge(); });
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
    } catch (e) {}
}

async function cargarFeed() {
    const contenedor = document.getElementById("contenedorFeed");
    const token = localStorage.getItem("token");
    try {
        const response = await fetch(`${API_URL}/publicaciones/`, { headers: { "Authorization": `Bearer ${token}` } });
        if (response.ok) {
            const posts = await response.json();
            contenedor.innerHTML = ""; 
            if (posts.length === 0) contenedor.innerHTML = "<p class='sin-publicaciones'>No hay publicaciones.</p>";
            posts.forEach(post => { contenedor.innerHTML += renderizarPost(post, miUsuario); });
        }
    } catch (error) { console.error(error); }
}

function irPerfil(username) { window.location.href = `perfil.html?u=${username}`; }

// --- RENDERIZADO DEL POST CON COMENTARIOS ---
function renderizarPost(post, usuarioLogueado) {
    const fecha = new Date(post.fecha).toLocaleString();
    const nombreAutor = post.usuario ? `${post.usuario.nombre} ${post.usuario.apellido}` : "Usuario";
    const usernameAutor = post.usuario ? post.usuario.username : "";
    const filtroLike = post.ya_di_like ? "filter: hue-rotate(330deg) saturate(500%);" : "";
    
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
                <img src="imagenes/perfil.jpg" class="post-avatar" onclick="irPerfil('${usernameAutor}')" style="cursor:pointer;">
                <div class="post-info">
                    <h4 onclick="irPerfil('${usernameAutor}')" style="cursor:pointer;">${nombreAutor}</h4>
                    <span>${fecha} · ${post.privacidad}</span>
                </div>
            </div>
            <div class="post-content">${post.texto}</div>
            ${post.imagen_url ? `<img src="${post.imagen_url}" class="post-image" onerror="this.style.display='none'">` : ''}
            
            <div class="post-actions">
                <button class="action-btn" onclick="darLike(this, ${post.id}, '${usernameAutor}')">
                    <img src="imagenes/like.jpg" style="width:20px; margin-right:5px; ${filtroLike}">
                    <span id="likes-count-${post.id}">${post.likes > 0 ? post.likes : ''}</span> Me gusta
                </button>
                <button class="action-btn" onclick="toggleComentarios(${post.id})">
                    <img src="imagenes/comentar.jpg" style="width:20px; margin-right:5px;">
                    <span id="coms-count-${post.id}">${post.comentarios > 0 ? post.comentarios : ''}</span> Comentar
                </button>
                <button class="action-btn"><img src="imagenes/compartir.jpg" style="width:20px; margin-right:5px;"> Compartir</button>
            </div>

            <div id="seccion-comentarios-${post.id}" class="seccion-comentarios">
                <div class="lista-comentarios" id="lista-comentarios-${post.id}">
                    </div>
                <div class="input-comentario-container">
                    <input type="text" id="input-comentario-${post.id}" class="input-comentario" placeholder="Escribe un comentario...">
                    <button class="btn-enviar-comentario" onclick="enviarComentario(${post.id}, '${usernameAutor}')">Publicar</button>
                </div>
            </div>
        </div>
    `;
}

// --- LÓGICA DE COMENTARIOS ---
function toggleComentarios(id) {
    const sec = document.getElementById(`seccion-comentarios-${id}`);
    if (sec.style.display === 'block') {
        sec.style.display = 'none';
    } else {
        sec.style.display = 'block';
        cargarComentarios(id);
    }
}

async function cargarComentarios(id) {
    const token = localStorage.getItem("token");
    const lista = document.getElementById(`lista-comentarios-${id}`);
    try {
        const res = await fetch(`${API_URL}/publicaciones/${id}/comentarios`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
            const comentarios = await res.json();
            lista.innerHTML = "";
            comentarios.forEach(c => {
                lista.innerHTML += `
                    <div class="comentario-item">
                        <img src="imagenes/perfil.jpg" class="comentario-avatar">
                        <div class="comentario-bubble">
                            <strong onclick="irPerfil('${c.username}')" style="cursor:pointer;">${c.nombre_usuario}</strong>
                            <span>${c.texto}</span>
                        </div>
                    </div>
                `;
            });
        }
    } catch(e) {}
}

async function enviarComentario(postId, ownerUsername) {
    const input = document.getElementById(`input-comentario-${postId}`);
    const texto = input.value.trim();
    if (!texto) return;
    
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_URL}/publicaciones/${postId}/comentar`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ texto: texto })
        });
        
        if (res.ok) {
            input.value = "";
            cargarComentarios(postId); // Recargar lista
            
            // Actualizar contador visualmente
            const span = document.getElementById(`coms-count-${postId}`);
            let val = parseInt(span.innerText) || 0;
            span.innerText = val + 1;

            // ENVIAR NOTIFICACIÓN POR SOCKET
            if (miUsuario !== ownerUsername) {
                socket.emit('send_notification', {
                    tipo: 'COMENTARIO', // El backend 'socket.py' traducirá esto a "ha comentado..."
                    origen: miUsuario,
                    destino: ownerUsername,
                    post_id: postId
                });
            }
        }
    } catch(e) { console.error(e); }
}

async function darLike(btn, postId, ownerUsername) {
    const token = localStorage.getItem("token");
    const img = btn.querySelector('img');
    const span = btn.querySelector('span');
    img.style.transform = "scale(1.3)";
    setTimeout(() => img.style.transform = "scale(1)", 200);

    try {
        const res = await fetch(`${API_URL}/publicaciones/${postId}/like`, {
            method: "POST", headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            let currentLikes = parseInt(span.innerText) || 0;
            if (data.accion === "LIKE") {
                img.style.filter = "hue-rotate(330deg) saturate(500%)";
                span.innerText = currentLikes + 1;
                if(socket && miUsuario !== ownerUsername) {
                    socket.emit('send_notification', {
                        tipo: 'LIKE',
                        origen: miUsuario,
                        destino: ownerUsername,
                        post_id: postId
                    });
                }
            } else {
                img.style.filter = "";
                span.innerText = currentLikes > 0 ? currentLikes - 1 : "";
            }
        }
    } catch(e) {}
}

// (Resto de funciones: crearPublicacion, modals, logout... se mantienen igual pero necesarias en el archivo)
function toggleMenu(id) {
    document.querySelectorAll('.menu-dropdown').forEach(m => m.classList.remove('show'));
    const m = document.getElementById(`menu-${id}`);
    if(m) m.classList.toggle('show');
}
function manejarArchivo(input) { 
    if (input.files && input.files[0]) { 
        archivoSeleccionado = input.files[0]; 
        const r = new FileReader(); 
        r.onload = (e) => { document.getElementById('imgPreview').src = e.target.result; document.getElementById('previewContainer').style.display = 'block'; }; 
        r.readAsDataURL(input.files[0]); 
    } 
}
function quitarImagen() { archivoSeleccionado = null; document.getElementById('fileInput').value = ""; document.getElementById('previewContainer').style.display = 'none'; }
async function crearPublicacion() {
    const txt = document.getElementById("textoPost").value;
    const priv = document.getElementById("privacidadSelect").value;
    const token = localStorage.getItem("token");
    if(!txt && !archivoSeleccionado) return;
    try {
        let url = null;
        if(archivoSeleccionado) {
            const fd = new FormData(); 
            fd.append("file", archivoSeleccionado);
            const r = await fetch(`${API_URL}/publicaciones/subir-imagen`, {method:"POST", body:fd});
            url = (await r.json()).url;
        }
        await fetch(`${API_URL}/publicaciones/`, {
            method:"POST", headers:{"Content-Type":"application/json", "Authorization":`Bearer ${token}`},
            body: JSON.stringify({texto:txt, imagen_url:url, privacidad:priv})
        });
        document.getElementById("textoPost").value=""; quitarImagen(); cargarFeed();
    } catch(e){} 
}
function abrirModalEliminar(id){ postAEliminarId=id; document.getElementById('modalEliminar').style.display='flex'; }
function cerrarModalEliminar(){ document.getElementById('modalEliminar').style.display='none'; }
async function confirmarEliminar(){ if(!postAEliminarId)return; await fetch(`${API_URL}/publicaciones/${postAEliminarId}`, {method:"DELETE", headers:{"Authorization":`Bearer ${localStorage.getItem("token")}`}}); document.getElementById(`post-${postAEliminarId}`).remove(); cerrarModalEliminar(); }
function abrirModalEditar(id, txt){ postAEditarId=id; document.getElementById('textoEditarInput').value=txt; document.getElementById('modalEditarPost').style.display='flex'; }
function cerrarModalEditar(){ document.getElementById('modalEditarPost').style.display='none'; }
async function confirmarEditar(){ const txt=document.getElementById('textoEditarInput').value; await fetch(`${API_URL}/publicaciones/${postAEditarId}`, { method:"PUT", headers:{"Content-Type":"application/json", "Authorization":`Bearer ${localStorage.getItem("token")}`}, body:JSON.stringify({texto:txt}) }); location.reload(); }
function logout(){ localStorage.clear(); window.location.href="login.html"; }
