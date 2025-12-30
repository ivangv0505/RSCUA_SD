const API_URL = "http://localhost:8000";
let socket;
let miUsuario = "";
let archivoSeleccionado = null;

// Variables para modales
let postAEditarId = null;
let postAEliminarId = null;

document.addEventListener("DOMContentLoaded", async () => {
    await verificarSesion();
    conectarSocket();
    cargarFeed();
    actualizarBadge(); // <--- ESTO FALTABA: Cargar badge al inicio
    
    // Cerrar menús al hacer click fuera
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
        if(res.ok) { 
            const u = await res.json(); 
            miUsuario = u.username; 
        }
    } catch(e) {}
}

function conectarSocket() {
    if(typeof io !== 'undefined') {
        socket = io(API_URL, { transports: ['websocket', 'polling'] });
        socket.on('connect', () => {
            console.log("Conectado al socket");
            socket.emit('identify', { username: miUsuario });
        });

        // <--- ESTO FALTABA: Escuchar notificaciones en tiempo real
        socket.on('notification_received', (data) => {
            console.log("Nueva notificación recibida");
            actualizarBadge(); // Actualizar el numerito
        });
    }
}

// --- FUNCIÓN PARA EL BADGE ROJO ---
async function actualizarBadge() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API_URL}/notificaciones/`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
            const notis = await res.json();
            // Contamos solo las que tienen leido = false
            const noLeidas = notis.filter(n => !n.leido).length;
            const badge = document.getElementById("badgeNotis");
            
            if (badge) {
                badge.innerText = noLeidas;
                // Si es 0, lo ocultamos o lo ponemos transparente (opcional)
                badge.style.display = noLeidas > 0 ? 'flex' : 'none'; 
            }
        }
    } catch (e) { console.error("Error badge", e); }
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

function irPerfil(username) {
    window.location.href = `perfil.html?u=${username}`;
}

function renderizarPost(post, usuarioLogueado) {
    const fecha = new Date(post.fecha).toLocaleString();
    const nombreAutor = post.usuario ? `${post.usuario.nombre} ${post.usuario.apellido}` : "Usuario";
    const usernameAutor = post.usuario ? post.usuario.username : "";
    
    const filtroLike = post.ya_di_like ? "filter: hue-rotate(330deg) saturate(500%);" : "";
    const clickPerfil = `onclick="irPerfil('${usernameAutor}')" style="cursor:pointer;"`;

    let menuHTML = "";
    if (usuarioLogueado === usernameAutor) {
        menuHTML = `<div class="menu-container">
                <button class="menu-btn" onclick="toggleMenu(${post.id})">
                    <img src="imagenes/options.jpg" style="width:20px;">
                </button>
                <div id="menu-${post.id}" class="menu-dropdown">
                    <button onclick="abrirModalEditar(${post.id}, '${post.texto.replace(/'/g, "\\'")}')">Editar</button>
                    <button class="btn-delete" onclick="abrirModalEliminar(${post.id})">Eliminar</button>
                </div>
            </div>`;
    }

    return `
        <div class="publicacion" id="post-${post.id}">
            ${menuHTML}
            <div class="post-header">
                <img src="imagenes/perfil.jpg" class="post-avatar" ${clickPerfil}>
                <div class="post-info">
                    <h4 ${clickPerfil}>${nombreAutor}</h4>
                    <span>${fecha} · ${post.privacidad}</span>
                </div>
            </div>
            <div class="post-content">${post.texto}</div>
            ${post.imagen_url ? `<img src="${post.imagen_url}" class="post-image" onerror="this.style.display='none'">` : ''}
            
            <div class="post-actions">
                <button class="action-btn" onclick="darLike(this, ${post.id}, '${usernameAutor}')">
                    <img src="imagenes/like.jpg" style="width:20px; height:20px; margin-right:5px; vertical-align:middle; ${filtroLike}">
                    <span id="likes-count-${post.id}">${post.likes > 0 ? post.likes : ''}</span> Me gusta
                </button>
                <button class="action-btn"><img src="imagenes/comentar.jpg" style="width:20px; margin-right:5px;"> Comentar</button>
                <button class="action-btn"><img src="imagenes/compartir.jpg" style="width:20px; margin-right:5px;"> Compartir</button>
            </div>
        </div>
    `;
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
    } catch(e) { console.error("Error likes", e); }
}

function toggleMenu(id) {
    document.querySelectorAll('.menu-dropdown').forEach(m => m.classList.remove('show'));
    const m = document.getElementById(`menu-${id}`);
    if(m) m.classList.toggle('show');
}

function manejarArchivo(input) { 
    if (input.files && input.files[0]) { 
        archivoSeleccionado = input.files[0]; 
        const r = new FileReader(); 
        r.onload = (e) => { 
            document.getElementById('imgPreview').src = e.target.result; 
            document.getElementById('previewContainer').style.display = 'block'; 
        }; 
        r.readAsDataURL(input.files[0]); 
    } 
}

function quitarImagen() { 
    archivoSeleccionado = null; 
    document.getElementById('fileInput').value = ""; 
    document.getElementById('previewContainer').style.display = 'none'; 
}

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
            method:"POST", 
            headers:{"Content-Type":"application/json", "Authorization":`Bearer ${token}`},
            body: JSON.stringify({texto:txt, imagen_url:url, privacidad:priv})
        });
        
        document.getElementById("textoPost").value=""; 
        quitarImagen(); 
        cargarFeed();
        
    } catch(e){ console.error(e); } 
}

function abrirModalEliminar(id){ postAEliminarId=id; document.getElementById('modalEliminar').style.display='flex'; }
function cerrarModalEliminar(){ document.getElementById('modalEliminar').style.display='none'; }

async function confirmarEliminar(){ 
    if(!postAEliminarId)return; 
    await fetch(`${API_URL}/publicaciones/${postAEliminarId}`, {method:"DELETE", headers:{"Authorization":`Bearer ${localStorage.getItem("token")}`}}); 
    document.getElementById(`post-${postAEliminarId}`).remove(); 
    cerrarModalEliminar(); 
}

function abrirModalEditar(id, txt){ 
    postAEditarId=id; 
    document.getElementById('textoEditarInput').value=txt; 
    document.getElementById('modalEditarPost').style.display='flex'; 
}
function cerrarModalEditar(){ document.getElementById('modalEditarPost').style.display='none'; }

async function confirmarEditar(){ 
    const txt=document.getElementById('textoEditarInput').value; 
    await fetch(`${API_URL}/publicaciones/${postAEditarId}`, {
        method:"PUT", 
        headers:{"Content-Type":"application/json", "Authorization":`Bearer ${localStorage.getItem("token")}`}, 
        body:JSON.stringify({texto:txt})
    }); 
    location.reload(); 
}

function logout(){ localStorage.clear(); window.location.href="login.html"; }