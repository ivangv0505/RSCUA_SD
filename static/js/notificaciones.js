const API_URL = "http://localhost:8000";

document.addEventListener("DOMContentLoaded", () => {
    cargarNotificaciones();
});

async function cargarNotificaciones() {
    const token = localStorage.getItem("token");
    if (!token) { window.location.href = "login.html"; return; }

    try {
        const res = await fetch(`${API_URL}/notificaciones/`, {
            headers: { "Authorization": `Bearer ${token}` }
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
            
            let iconoHtml = '';
            if (n.tipo === 'LIKE') {
                iconoHtml = '<img src="imagenes/like.jpg" alt="Like" style="width: 28px; height: 28px; object-fit: contain;">';
            } else {
                iconoHtml = '<img src="imagenes/comentar.jpg" alt="Comentario" style="width: 28px; height: 28px; object-fit: contain;">';
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
                </div>
            `;
            contenedor.innerHTML += html;
        });

    } catch(e) { 
        console.error(e);
        contenedor.innerHTML = "<p style='text-align:center; color:red;'>Error de conexión.</p>";
    }
}

//ANIMACIÓN DE CLIC 
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
            method: "PUT", headers: { "Authorization": `Bearer ${token}` }
        });
    } catch(e) { console.error(e); }
}