import os

base_dir = os.getcwd()

# ==============================================================================
# 1. BACKEND: Rutas Limpias + Funciones de Edición
# ==============================================================================
# Restauramos get_contactos/historial ORIGINALES y solo agregamos DELETE/PUT
rutas_path = os.path.join(base_dir, "app/modulos/mensajeria/rutas.py")
rutas_code = """from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, or_, and_
from app.db import get_session
from app.modulos.autenticacion.rutas import get_current_user
from app.modulos.autenticacion.modelos import Usuario
from .modelos import Mensaje
from app.modulos.mensajeria.socket import sio
from pydantic import BaseModel

router = APIRouter()

class MensajeEdit(BaseModel):
    contenido: str

# --- ORIGINAL DEL REPO (Para que funcione la carga) ---
@router.get("/historial/{otro_username}")
async def obtener_historial(otro_username: str, user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    q_otro = select(Usuario).where(Usuario.username == otro_username)
    res_otro = await session.execute(q_otro)
    otro_user = res_otro.scalar_one_or_none()
    
    if not otro_user:
        return []

    query = select(Mensaje).where(
        or_(
            and_(Mensaje.remitente_id == user.id, Mensaje.destinatario_id == otro_user.id),
            and_(Mensaje.remitente_id == otro_user.id, Mensaje.destinatario_id == user.id)
        )
    ).order_by(Mensaje.fecha.asc())
    
    mensajes = await session.execute(query)
    return mensajes.scalars().all()

@router.get("/contactos")
async def obtener_contactos(user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    # Devuelve usuarios simples, tal como espera tu JS original
    query = select(Usuario).where(Usuario.id != user.id)
    result = await session.execute(query)
    return result.scalars().all()

# --- AGREGADOS PARA FUNCIONALIDAD (Sin romper lo anterior) ---
@router.delete("/{mensaje_id}")
async def eliminar_mensaje(mensaje_id: int, user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    mensaje = await session.get(Mensaje, mensaje_id)
    if not mensaje or mensaje.remitente_id != user.id:
        raise HTTPException(status_code=403, detail="No permitido")
    
    await session.delete(mensaje)
    await session.commit()
    await sio.emit("mensaje_eliminado", {"id": mensaje_id})
    return {"ok": True}

@router.put("/{mensaje_id}")
async def editar_mensaje(mensaje_id: int, datos: MensajeEdit, user: Usuario = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    mensaje = await session.get(Mensaje, mensaje_id)
    if not mensaje or mensaje.remitente_id != user.id:
        raise HTTPException(status_code=403, detail="No permitido")
    
    mensaje.contenido = datos.contenido
    session.add(mensaje)
    await session.commit()
    await sio.emit("mensaje_editado", {"id": mensaje_id, "contenido": datos.contenido})
    return {"ok": True}
"""

# ==============================================================================
# 2. FRONTEND: Mensajería.js ORIGINAL (Restauración Total)
# ==============================================================================
# Copiado textual de tu repo para asegurar compatibilidad 100%
js_mensajeria_path = os.path.join(base_dir, "static/js/mensajeria.js")
js_mensajeria_code = """const API_URL = "http://localhost:8000";

document.addEventListener("DOMContentLoaded", () => {
    cargarContactos();
    actualizarBadge();
    if(typeof io !== 'undefined' && !socketGeneral) conectarSocketGeneral();
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
    localStorage.setItem("chatDestino", username);
    window.location.href = "chat.html";
}

// --- LÓGICA DE BADGE Y SOCKETS (Preservada del repo) ---
let socketGeneral;
function conectarSocketGeneral() {
    if(typeof socket !== 'undefined') socketGeneral = socket;
    else {
        socketGeneral = io("http://localhost:8000", { transports: ['websocket', 'polling'] });
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
            incrementarBadge();
        });
    }
}

async function actualizarBadge() {
    const token = localStorage.getItem("token");
    if(!token) return;
    try {
        const res = await fetch("http://localhost:8000/notificaciones/", { headers: { "Authorization": `Bearer ${token}` } });
        if(res.ok) {
            const notis = await res.json();
            const noLeidas = notis.filter(n => !n.leido).length;
            const badge = document.getElementById("badgeNotis");
            if(noLeidas > 0) {
                badge.style.display = "block";
                badge.innerText = noLeidas > 99 ? "99+" : noLeidas;
            } else { badge.style.display = "none"; }
        }
    } catch(e) {}
}

function incrementarBadge() {
    const badge = document.getElementById("badgeNotis");
    let val = parseInt(badge.innerText) || 0;
    val++;
    badge.innerText = val > 99 ? "99+" : val;
    badge.style.display = "block";
}
"""

# ==============================================================================
# 3. FRONTEND: Chat.js MODIFICADO (Solo funciones de renderizado)
# ==============================================================================
# Mantenemos la estructura original pero inyectamos el menú de 3 puntos
js_chat_path = os.path.join(base_dir, "static/js/chat.js")
js_chat_code = """const API_URL = "http://localhost:8000";
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
"""

def aplicar_arreglo_hibrido():
    with open(rutas_path, "w", encoding="utf-8") as f: f.write(rutas_code)
    with open(js_mensajeria_path, "w", encoding="utf-8") as f: f.write(js_mensajeria_code)
    with open(js_chat_path, "w", encoding="utf-8") as f: f.write(js_chat_code)
    
    print("✅ SISTEMA REPARADO")
    print("1. Mensajería: Restaurada al estilo original del repo (Carga correcta).")
    print("2. Chat: Funcionalidad de 'Tres Puntos' (Editar/Eliminar) integrada.")
    print("👉 REINICIA: uvicorn app.main:app --reload")

if __name__ == "__main__":
    aplicar_arreglo_hibrido()