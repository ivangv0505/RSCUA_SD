const API_URL = "http://localhost:8000";
let miUsuario = "";

// Variables para edición
let postAEditarId = null;

document.addEventListener("DOMContentLoaded", () => {
    cargarPerfil();
    
    // Cerrar menús al hacer click fuera
    window.onclick = (e) => { 
        if(!e.target.closest('.menu-btn')) {
            document.querySelectorAll('.menu-dropdown').forEach(m => m.classList.remove('show'));
        }
    }
});

async function cargarPerfil() {
    const token = localStorage.getItem("token");
    if (!token) { window.location.href = "login.html"; return; }

    try {
        const res = await fetch(`${API_URL}/auth/me`, { headers: { "Authorization": `Bearer ${token}` } });
        if (!res.ok) throw new Error("Sesión expirada");
        const user = await res.json();
        miUsuario = user.username;

        document.getElementById("nombreCompleto").innerText = `${user.nombre} ${user.apellido}`;
        document.getElementById("usernameDisplay").innerText = `@${user.username}`;
        // Si tuvieras bio en backend: document.getElementById("bioDisplay").innerText = user.descripcion;

        cargarMisPublicaciones(user.username);
    } catch(e) { console.error(e); }
}

async function cargarMisPublicaciones(username) {
    const token = localStorage.getItem("token");
    const contenedor = document.getElementById("misPublicaciones");
    
    try {
        const res = await fetch(`${API_URL}/publicaciones/`, { headers: { "Authorization": `Bearer ${token}` } });
        const posts = await res.json();
        const misPosts = posts.filter(p => p.usuario && p.usuario.username === username);
        
        document.getElementById("contadorPosts").innerHTML = `<strong>${misPosts.length}</strong> Publicaciones`;
        contenedor.innerHTML = "";

        if (misPosts.length === 0) {
            contenedor.innerHTML = "<p style='text-align:center; padding:20px; color:#777;'>Aún no has publicado nada.</p>";
            return;
        }

        misPosts.forEach(p => {
            const fecha = new Date(p.fecha).toLocaleString();
            
            // ESTILO EXACTO DEL FEED (Iconos limpios, sin emojis texto)
            const html = `
                <div class="publicacion" id="post-${p.id}">
                    
                    <div class="menu-container">
                        <button class="menu-btn" onclick="toggleMenu(${p.id})">
                            <img src="imagenes/options.jpg" style="width:20px;">
                        </button>
                        <div id="menu-${p.id}" class="menu-dropdown">
                            <button onclick="abrirModalEditar(${p.id}, '${p.texto.replace(/'/g, "\\'")}')">Editar</button>
                            <button class="btn-delete" onclick="abrirModalEliminar(${p.id})">Eliminar</button>
                        </div>
                    </div>

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
                        <button class="action-btn">
                            <img src="imagenes/like.jpg" style="width:20px; height:20px; margin-right:5px; vertical-align:middle;">
                            ${p.likes > 0 ? p.likes : ''} Me gusta
                        </button>
                        <button class="action-btn">
                            <img src="imagenes/comentar.jpg" style="width:20px; height:20px; margin-right:5px; vertical-align:middle;">
                            Comentar
                        </button>
                        <button class="action-btn">
                            <img src="imagenes/compartir.jpg" style="width:20px; height:20px; margin-right:5px; vertical-align:middle;">
                            Compartir
                        </button>
                    </div>
                </div>
            `;
            contenedor.innerHTML += html;
        });

    } catch(e) { console.error(e); }
}

// --- Lógica de Menús y Modales (Idéntica al Feed) ---
function toggleMenu(id) {
    document.querySelectorAll('.menu-dropdown').forEach(m => m.classList.remove('show'));
    const menu = document.getElementById(`menu-${id}`);
    if (menu) menu.classList.toggle('show');
}

let postAEliminarId = null;

function abrirModalEliminar(id) {
    postAEliminarId = id;
    document.getElementById('modalEliminar').style.display = 'flex';
}

function cerrarModalEliminar() {
    document.getElementById('modalEliminar').style.display = 'none';
}

async function confirmarEliminar() {
    if (!postAEliminarId) return;
    const token = localStorage.getItem("token");
    
    try {
        const res = await fetch(`${API_URL}/publicaciones/${postAEliminarId}`, {
            method: "DELETE", headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (res.ok) {
            // Recargar solo la lista
            const user = document.getElementById("usernameDisplay").innerText.replace("@","");
            cargarMisPublicaciones(user);
            cerrarModalEliminar();
        } else {
            alert("Error al eliminar (Revisa consola)");
        }
    } catch(e) { console.error(e); }
}

function abrirModalEditar(id, texto) {
    postAEditarId = id;
    document.getElementById('textoEditarInput').value = texto;
    document.getElementById('modalEditarPost').style.display = 'flex';
}

function cerrarModalEditar() {
    document.getElementById('modalEditarPost').style.display = 'none';
}

async function confirmarEditar() {
    const txt = document.getElementById('textoEditarInput').value;
    const token = localStorage.getItem("token");
    await fetch(`${API_URL}/publicaciones/${postAEditarId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ texto: txt })
    });
    location.reload();
}

// Funciones Perfil (Bio)
function abrirEditor() { document.getElementById("modalEditarPerfil").style.display = "flex"; }
function cerrarEditor() { document.getElementById("modalEditarPerfil").style.display = "none"; }