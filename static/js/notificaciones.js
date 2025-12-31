// Script de gestión de la interfaz de notificaciones.  Incluye la carga
// asíncrona de notificaciones, su marcado como leídas y la eliminación
// completa mediante una animación suave.  También soporta un nuevo tipo de
// notificación "MENSAJE".

const API_URL = "http://localhost:8000";

document.addEventListener("DOMContentLoaded", () => {
    cargarNotificaciones();
});

async function cargarNotificaciones() {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "login.html";
        return;
    }
    try {
        const res = await fetch(`${API_URL}/notificaciones/`, {
            headers: { "Authorization": `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Error al cargar");
        const notis = await res.json();
        const contenedor = document.getElementById("listaNotificaciones");
        contenedor.innerHTML = "";
        if (notis.length === 0) {
            contenedor.innerHTML = "<p style='text-align:center; padding:20px; color:#777;'>No tienes notificaciones nuevas.</p>";
            return;
        }
        notis.forEach(n => {
            const claseLeido = n.leido ? '' : 'no-leido';
            // Determinar icono según el tipo
            let iconoHtml = '';
            if (n.tipo === 'LIKE') {
                iconoHtml = '<img src="imagenes/like.jpg" alt="Like" style="width: 28px; height: 28px; object-fit: contain;">';
            } else if (n.tipo === 'COMENTARIO') {
                iconoHtml = '<img src="imagenes/comentar.jpg" alt="Comentario" style="width: 28px; height: 28px; object-fit: contain;">';
            } else if (n.tipo === 'MENSAJE') {
                // Icono de chat para notificaciones de mensajes.  Utiliza el ícono global de mensajería de la UI.
                iconoHtml = '<img src="imagenes/chats.png" alt="Mensaje" style="width: 28px; height: 28px; object-fit: contain;">';
            } else {
                iconoHtml = '<img src="imagenes/like.jpg" alt="Notificación" style="width: 28px; height: 28px; object-fit: contain;">';
            }
            const nombreMostrar = n.usuario_origen ? `${n.usuario_origen.nombre} ${n.usuario_origen.apellido}` : "Usuario";
            const html = `
                <div class="noti-item ${claseLeido}" onclick="marcarLeida(${n.id}, this)">
                    <img src="imagenes/perfil.jpg" class="noti-avatar" onerror="this.src='imagenes/perfil.jpg'">
                    <div class="noti-texto">
                        <h4>${nombreMostrar}</h4>
                        <p>${n.contenido}</p>
                        <span class="noti-fecha">${new Date(n.fecha).toLocaleString()}</span>
                    </div>
                    <div class="noti-icon" style="display:flex; align-items:center;">${iconoHtml}</div>
                    <button class="noti-delete" onclick="borrarNotificacion(event, ${n.id})" style="margin-left:auto; background:none; border:none; color:#999; cursor:pointer; font-size:20px;">&times;</button>
                </div>
            `;
            contenedor.innerHTML += html;
        });
    } catch (e) {
        console.error(e);
        const contenedor = document.getElementById("listaNotificaciones");
        if (contenedor) {
            contenedor.innerHTML = "<p style='text-align:center; color:red;'>Error de conexión.</p>";
        }
    }
}

// ANIMACIÓN DE CLIC: marca la notificación como leída y aplica transparencia
async function marcarLeida(id, elementoHTML) {
    if (elementoHTML) {
        elementoHTML.style.transition = "all 0.3s ease";
        elementoHTML.style.opacity = "0.5";
        elementoHTML.classList.remove("no-leido");
        elementoHTML.style.pointerEvents = "none";
    }
    const token = localStorage.getItem("token");
    try {
        await fetch(`${API_URL}/notificaciones/leer/${id}`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${token}` },
        });
    } catch (e) {
        console.error(e);
    }
}

// Elimina completamente una notificación con una animación de desvanecido
async function borrarNotificacion(event, id) {
    // Evitar que el clic marque como leída
    event.stopPropagation();
    const elementoHTML = event.target.closest('.noti-item');
    if (elementoHTML) {
        elementoHTML.style.transition = "opacity 0.3s ease, transform 0.3s ease";
        elementoHTML.style.opacity = "0";
        elementoHTML.style.transform = "translateX(100px)";
        setTimeout(() => {
            if (elementoHTML && elementoHTML.parentElement) {
                elementoHTML.parentElement.removeChild(elementoHTML);
            }
        }, 300);
    }
    const token = localStorage.getItem("token");
    try {
        await fetch(`${API_URL}/notificaciones/${id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` },
        });
    } catch (e) {
        console.error(e);
    }
}