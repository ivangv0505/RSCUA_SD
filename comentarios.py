import os

base_dir = os.getcwd()

# ==============================================================================
# 1. MODELOS: Agregar Tabla 'Comentario'
# ==============================================================================
# Ruta: app/modulos/publicaciones/modelos.py
modelos_path = os.path.join(base_dir, "app/modulos/publicaciones/modelos.py")
modelos_code = """from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from enum import Enum

class Privacidad(str, Enum):
    PUBLICO = "PUBLICO"
    AMIGOS = "AMIGOS"
    PRIVADO = "PRIVADO"

if TYPE_CHECKING:
    from app.modulos.autenticacion.modelos import Usuario

class PublicacionBase(SQLModel):
    texto: str
    imagen_url: Optional[str] = None
    etiquetas: Optional[str] = None
    privacidad: Privacidad = Field(default=Privacidad.PUBLICO)

class Publicacion(PublicacionBase, table=True):
    __tablename__ = "publicaciones"
    id: Optional[int] = Field(default=None, primary_key=True)
    fecha: datetime = Field(default_factory=datetime.now) 
    usuario_id: int = Field(foreign_key="usuarios.id")
    usuario: Optional["Usuario"] = Relationship(back_populates="publicaciones")

class PublicacionCreate(PublicacionBase):
    pass

class Reaccion(SQLModel, table=True):
    __tablename__ = "reacciones"
    id: Optional[int] = Field(default=None, primary_key=True)
    usuario_id: int = Field(foreign_key="usuarios.id")
    publicacion_id: int = Field(foreign_key="publicaciones.id")
    fecha: datetime = Field(default_factory=datetime.now)

# --- NUEVO MODELO COMENTARIO ---
class Comentario(SQLModel, table=True):
    __tablename__ = "comentarios"
    id: Optional[int] = Field(default=None, primary_key=True)
    texto: str
    fecha: datetime = Field(default_factory=datetime.now)
    usuario_id: int = Field(foreign_key="usuarios.id")
    publicacion_id: int = Field(foreign_key="publicaciones.id")
    
    # Relaciones (opcionales para cargas complejas, pero útiles)
    # usuario: Optional["Usuario"] = Relationship() 

class ComentarioRead(SQLModel):
    id: int
    texto: str
    fecha: datetime
    usuario_id: int
    nombre_usuario: str
    username: str

class UsuarioMini(SQLModel):
    username: str
    nombre: str
    apellido: str

class PublicacionReadWithUser(PublicacionBase):
    id: int
    fecha: datetime
    usuario: Optional[UsuarioMini] = None
    likes: int = 0
    comentarios: int = 0 # Agregamos contador
    ya_di_like: bool = False

class PublicacionUpdate(SQLModel):
    texto: Optional[str] = None
    imagen_url: Optional[str] = None
    privacidad: Optional[Privacidad] = None
"""

# ==============================================================================
# 2. RUTAS: Endpoints para Comentar y Listar
# ==============================================================================
# Ruta: app/modulos/publicaciones/rutas.py
rutas_path = os.path.join(base_dir, "app/modulos/publicaciones/rutas.py")
rutas_code = """from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, delete, func
from sqlalchemy.orm import selectinload
import shutil
import os
from pathlib import Path
import uuid

from app.db import get_session
from .modelos import Publicacion, PublicacionCreate, PublicacionReadWithUser, PublicacionUpdate, Reaccion, Comentario, ComentarioRead
from app.modulos.autenticacion.rutas import get_current_user
from app.modulos.autenticacion.modelos import Usuario

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
UPLOAD_DIR = BASE_DIR / "static" / "imagenes" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/subir-imagen")
async def subir_imagen(file: UploadFile = File(...)):
    try:
        file_extension = file.filename.split(".")[-1]
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = UPLOAD_DIR / unique_filename
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"url": f"imagenes/uploads/{unique_filename}"}
    except Exception:
        raise HTTPException(status_code=500, detail="Error subiendo imagen")

@router.post("/", response_model=PublicacionReadWithUser)
async def crear_publicacion(post_in: PublicacionCreate, user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    nueva_pub = Publicacion(**post_in.dict(), usuario_id=user.id)
    session.add(nueva_pub)
    await session.commit()
    await session.refresh(nueva_pub)
    return nueva_pub

@router.get("/", response_model=List[PublicacionReadWithUser])
async def obtener_feed(user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    query = select(Publicacion).options(selectinload(Publicacion.usuario)).order_by(Publicacion.fecha.desc())
    result = await session.execute(query)
    posts = result.scalars().all()
    
    feed_response = []
    for p in posts:
        # Contar likes
        q_likes = select(func.count()).select_from(Reaccion).where(Reaccion.publicacion_id == p.id)
        likes_count = (await session.execute(q_likes)).one()[0]
        
        # Contar comentarios
        q_coms = select(func.count()).select_from(Comentario).where(Comentario.publicacion_id == p.id)
        coms_count = (await session.execute(q_coms)).one()[0]
        
        # Estado Like
        q_me = select(Reaccion).where(Reaccion.publicacion_id == p.id, Reaccion.usuario_id == user.id)
        me_like = (await session.execute(q_me)).scalar_one_or_none()
        
        dto = PublicacionReadWithUser(
            id=p.id, fecha=p.fecha, texto=p.texto, imagen_url=p.imagen_url, privacidad=p.privacidad,
            usuario=p.usuario,
            likes=likes_count,
            comentarios=coms_count,
            ya_di_like=bool(me_like)
        )
        feed_response.append(dto)
    return feed_response

@router.post("/{id}/like")
async def toggle_like(id: int, user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    query = select(Reaccion).where(Reaccion.publicacion_id == id, Reaccion.usuario_id == user.id)
    result = await session.execute(query)
    existing_like = result.scalar_one_or_none()
    
    if existing_like:
        await session.delete(existing_like)
        await session.commit()
        accion = "DISLIKE"
    else:
        nuevo_like = Reaccion(publicacion_id=id, usuario_id=user.id)
        session.add(nuevo_like)
        await session.commit()
        accion = "LIKE"
    return {"accion": accion}

# --- NUEVOS ENDPOINTS COMENTARIOS ---

@router.post("/{id}/comentar")
async def crear_comentario(id: int, payload: dict, user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    texto = payload.get("texto")
    if not texto: raise HTTPException(status_code=400, detail="Texto vacío")
    
    nuevo_comentario = Comentario(texto=texto, usuario_id=user.id, publicacion_id=id)
    session.add(nuevo_comentario)
    await session.commit()
    await session.refresh(nuevo_comentario)
    
    return {"ok": True, "id": nuevo_comentario.id}

@router.get("/{id}/comentarios", response_model=List[ComentarioRead])
async def listar_comentarios(id: int, session: AsyncSession = Depends(get_session)):
    # Traemos comentarios + datos de usuario (join manual o selectinload si configurado)
    query = select(Comentario).where(Comentario.publicacion_id == id).order_by(Comentario.fecha.asc())
    comentarios = (await session.execute(query)).scalars().all()
    
    res = []
    for c in comentarios:
        user = await session.get(Usuario, c.usuario_id)
        res.append(ComentarioRead(
            id=c.id, texto=c.texto, fecha=c.fecha,
            usuario_id=c.usuario_id,
            nombre_usuario=f"{user.nombre} {user.apellido}",
            username=user.username
        ))
    return res

# --- OTROS ---
@router.delete("/{id}")
async def eliminar_publicacion(id: int, user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    post = await session.get(Publicacion, id)
    if not post: raise HTTPException(status_code=404)
    if post.usuario_id != user.id: raise HTTPException(status_code=403)
    
    # Borrar dependencias
    await session.execute(delete(Reaccion).where(Reaccion.publicacion_id == id))
    await session.execute(delete(Comentario).where(Comentario.publicacion_id == id)) # Borrar comentarios también
    
    await session.delete(post)
    await session.commit()
    return {"ok": True}

@router.put("/{id}")
async def editar_publicacion(id: int, up: PublicacionUpdate, user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    post = await session.get(Publicacion, id)
    if not post or post.usuario_id != user.id: raise HTTPException(status_code=403)
    if up.texto: post.texto = up.texto
    session.add(post)
    await session.commit()
    return post
"""

# ==============================================================================
# 3. CSS: Estilos para la sección de Comentarios (FeedStyle.css)
# ==============================================================================
css_path = os.path.join(base_dir, "static/css/FeedStyle.css")
# Leemos el actual y agregamos al final
css_extra = """
/* --- ESTILOS DE COMENTARIOS --- */
.seccion-comentarios {
    background-color: #f8f9fa;
    border-top: 1px solid #eee;
    padding: 10px 15px;
    display: none; /* Oculto por defecto */
    animation: fadeIn 0.3s ease;
}

.seccion-comentarios.mostrar {
    display: block;
}

.lista-comentarios {
    max-height: 200px;
    overflow-y: auto;
    margin-bottom: 10px;
}

.comentario-item {
    display: flex;
    gap: 10px;
    margin-bottom: 10px;
    font-size: 13px;
}

.comentario-avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    object-fit: cover;
}

.comentario-bubble {
    background: #fff;
    border: 1px solid #e0e0e0;
    padding: 8px 12px;
    border-radius: 12px;
    border-top-left-radius: 0;
    flex: 1;
}

.comentario-bubble strong {
    display: block;
    color: #262626;
    margin-bottom: 2px;
    font-size: 12px;
}

.input-comentario-container {
    display: flex;
    gap: 10px;
}

.input-comentario {
    flex: 1;
    border: 1px solid #ddd;
    border-radius: 20px;
    padding: 8px 12px;
    outline: none;
    font-size: 13px;
}

.btn-enviar-comentario {
    background: transparent;
    border: none;
    color: #0095f6;
    font-weight: bold;
    cursor: pointer;
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
"""

# ==============================================================================
# 4. JS: Lógica en 'feed.js' (Toggle, Cargar, Enviar + Notificación)
# ==============================================================================
js_feed_path = os.path.join(base_dir, "static/js/feed.js")
js_feed_code = """const API_URL = "http://localhost:8000";
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
                <button onclick="abrirModalEditar(${post.id}, '${post.texto.replace(/'/g, "\\'")}')">Editar</button>
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

// --- BÚSQUEDA ---
const inputBusqueda = document.querySelector('.busqueda input');
let resultBox = document.querySelector('.search-results');
if (!resultBox && inputBusqueda) { 
    resultBox = document.createElement('div'); resultBox.className = 'search-results'; resultBox.style.display = 'none';
    document.querySelector('.busqueda').appendChild(resultBox);
    const styleSearch = document.createElement('style');
    styleSearch.innerHTML = `
        .busqueda { position: relative; }
        .search-results { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #ccc; max-height: 400px; overflow-y: auto; z-index: 2000; }
        .search-item { padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; display: flex; align-items: center; gap: 10px; }
        .search-item:hover { background: #f5f5f5; }
        .search-item img { width: 35px; height: 35px; border-radius: 5px; object-fit: cover; }
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
        const res = await fetch(`${API_URL}/directorios/buscar?q=${query}`, { headers: { "Authorization": `Bearer ${token}` } });
        if (res.ok) { const data = await res.json(); renderizarResultados(data); }
    } catch (e) {}
}
function renderizarResultados(items) {
    resultBox.innerHTML = '';
    if (items.length === 0) { resultBox.innerHTML = '<div style="padding:15px; color:#777;">Sin coincidencias</div>'; } else {
        items.forEach(item => {
            const div = document.createElement('div'); div.className = 'search-item';
            div.innerHTML = `<img src="${item.imagen || 'imagenes/perfil.jpg'}" onerror="this.src='imagenes/perfil.jpg'"><div class="search-info"><b>${item.titulo}</b><span>${item.subtitulo}</span></div>`;
            div.onclick = () => { if (item.tipo === 'USUARIO') window.location.href = `perfil.html?u=${item.subtitulo.replace('@','')}`; resultBox.style.display = 'none'; };
            resultBox.appendChild(div);
        });
    }
    resultBox.style.display = 'block';
}
document.addEventListener('click', (e) => { if (document.querySelector('.busqueda') && !document.querySelector('.busqueda').contains(e.target)) { if(resultBox) resultBox.style.display = 'none'; } });
"""

def implementar_comentarios():
    # 1. Update Models
    with open(modelos_path, "w", encoding="utf-8") as f: f.write(modelos_code)
    print("✅ Modelos actualizados (Tabla Comentarios).")

    # 2. Update Routes
    with open(rutas_path, "w", encoding="utf-8") as f: f.write(rutas_code)
    print("✅ Rutas actualizadas (Endpoints Comentarios).")

    # 3. Update CSS (Append)
    # Check if CSS already has it to avoid duplicates, but assuming it doesn't
    with open(css_path, "r", encoding="utf-8") as f: content = f.read()
    if "seccion-comentarios" not in content:
        with open(css_path, "a", encoding="utf-8") as f: f.write(css_extra)
        print("✅ CSS actualizado (Estilos Comentarios).")
    else:
        print("ℹ️ CSS ya tenía estilos de comentarios.")

    # 4. Update JS
    with open(js_feed_path, "w", encoding="utf-8") as f: f.write(js_feed_code)
    print("✅ JS Feed actualizado (Lógica Comentarios).")

    print("\n👉 LISTO. Ejecuta: uvicorn app.main:app --reload")
    print("   El sistema creará la tabla 'comentarios' automáticamente al iniciar.")

if __name__ == "__main__":
    implementar_comentarios()