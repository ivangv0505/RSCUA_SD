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