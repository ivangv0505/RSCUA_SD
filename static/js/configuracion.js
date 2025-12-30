const API_URL = "http://localhost:8000";

document.addEventListener("DOMContentLoaded", () => {
    cargarConfiguracion();
});

async function cargarConfiguracion() {
    const token = localStorage.getItem("token");
    if(!token) return;
    try {
        const res = await fetch(`${API_URL}/configuracion/`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if(res.ok) {
            const config = await res.json();
            aplicarTema(config.tema);
            document.getElementById("select-idioma").value = config.idioma;
        }
    } catch(e) {}
}

function togglePanel(id) {
    const p = document.getElementById(id);
    p.style.display = p.style.display === 'none' ? 'block' : 'none';
}

async function guardarConfig(clave, valor) {
    const token = localStorage.getItem("token");
    const body = {};
    body[clave] = valor;
    
    try {
        const res = await fetch(`${API_URL}/configuracion/`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(body)
        });
        if(res.ok) {
            if(clave === 'tema') aplicarTema(valor);
            alert("Configuración guardada");
        }
    } catch(e) { console.error(e); }
}

function guardarIdioma() {
    const val = document.getElementById("select-idioma").value;
    guardarConfig('idioma', val);
}

function aplicarTema(tema) {
    if(tema === 'OSCURO') {
        document.body.classList.add('oscuro');
    } else {
        document.body.classList.remove('oscuro');
    }
}
