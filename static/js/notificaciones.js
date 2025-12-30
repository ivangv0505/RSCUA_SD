const API_URL = "http://localhost:8000";

document.addEventListener("DOMContentLoaded", () => {
    // Iniciamos la carga inmediatamente
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
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error("Error al cargar notificaciones");
        
        const notis = await res.json();
        const contenedor = document.getElementById("listaNotificaciones");
        contenedor.innerHTML = "";

        if (notis.length === 0) {
            contenedor.innerHTML = "<p style='text-align:center; padding:20px'>No tienes notificaciones nuevas.</p>";
            return;
        }

        notis.forEach(n => {
            const claseLeido = n.leido ? '' : 'no-leido';
            const icono = n.tipo === 'LIKE' ? '❤️' : '💬';
            
            // Usamos el objeto usuario si viene, sino un texto genérico
            const nombreMostrar = n.usuario_origen ? `${n.usuario_origen.nombre} ${n.usuario_origen.apellido}` : "Usuario";

            const html = `
                <div class="noti-item ${claseLeido}" onclick="marcarLeida(${n.id})">
                    <img src="imagenes/perfil.jpg" class="noti-avatar" onerror="this.src='imagenes/perfil.jpg'">
                    <div class="noti-texto">
                        <h4>${nombreMostrar}</h4>
                        <p>${n.contenido}</p>
                        <span class="noti-fecha">${new Date(n.fecha).toLocaleString()}</span>
                    </div>
                    <div class="noti-icon">${icono}</div>
                </div>
            `;
            contenedor.innerHTML += html;
        });

    } catch(e) { 
        console.error(e);
        document.getElementById("listaNotificaciones").innerHTML = "<p style='text-align:center; color:red;'>Error de conexión.</p>";
    }
}

async function marcarLeida(id) {
    const token = localStorage.getItem("token");
    try {
        await fetch(`${API_URL}/notificaciones/leer/${id}`, {
            method: "PUT", headers: { "Authorization": `Bearer ${token}` }
        });
        cargarNotificaciones(); // Recargar para actualizar visualmente
    } catch(e) { console.error(e); }
}