// Búsqueda global reutilizable (mismo estilo que feed)
// Este archivo proporciona funcionalidad para un buscador desplegable en
// la barra de navegación y también soporta una página dedicada de
// resultados (busqueda.html). El buscador funciona de forma asíncrona
// consumiendo el endpoint `/directorios/buscar` del backend.

const API_URL_SEARCH = (typeof API_URL !== "undefined") ? API_URL : "http://localhost:8000";
let estiloBusquedaInyectado = false;

document.addEventListener("DOMContentLoaded", () => {
    // Inicializa el buscador flotante que se muestra como un dropdown en todas
    // las páginas. Esto crea un contenedor para resultados y escucha los
    // eventos de input.
    inicializarBusquedaGlobal();
    // Inicializa la lógica de redirección a la página de búsqueda y la
    // ejecución de consultas en busqueda.html. Esta función se ejecuta en
    // todas las páginas, pero sólo actúa si existen los elementos
    // correspondientes (botón de la lupa, input y contenedor de resultados).
    inicializarBusquedaPagina();
});

function inicializarBusquedaGlobal() {
    const input = document.getElementById("inputBusquedaGlobal");
    if (!input) return;

    let resultBox = document.getElementById("searchResults");
    const wrap = input.closest(".busqueda");
    if (!resultBox && wrap) {
        resultBox = document.createElement("div");
        resultBox.id = "searchResults";
        resultBox.className = "search-results";
        resultBox.style.display = "none";
        wrap.appendChild(resultBox);
    }
    if (!resultBox) return;

    // Inyecta estilos una sola vez para evitar duplicados
    if (!estiloBusquedaInyectado) {
        const style = document.createElement("style");
        style.innerHTML = `
            .busqueda { position: relative; }
            .search-results {
                position: absolute; top: 100%; left: 0; right: 0;
                background: white; border: 1px solid #ccc; border-radius: 0 0 10px 10px;
                max-height: 420px; overflow-y: auto; z-index: 2000;
                box-shadow: 0 12px 24px rgba(0,0,0,0.18);
            }
            .search-item {
                padding: 12px; border-bottom: 1px solid #f1f1f1; cursor: pointer;
                display: flex; align-items: center; gap: 10px; text-align: left;
            }
            .search-item:hover { background: #f8f9fa; }
            .search-item img { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; }
            .search-info b { display: block; font-size: 14px; color: #222; }
            .search-info span { font-size: 12px; color: #888; text-transform: uppercase; font-weight: bold; }
            .badge-tipo { font-size: 11px; padding: 4px 7px; border-radius: 6px; margin-left: auto; letter-spacing: 0.3px; }
            .tipo-usuario { background: #e8f1ff; color: #2a7ae4; }
            .tipo-post { background: #fff1e6; color: #ef6c00; }
        `;
        document.head.appendChild(style);
        estiloBusquedaInyectado = true;
    }

    let timeoutSearch;
    input.addEventListener("input", (e) => {
        clearTimeout(timeoutSearch);
        const q = e.target.value.trim();
        if (!q) { resultBox.style.display = "none"; return; }
        timeoutSearch = setTimeout(() => realizarBusqueda(q, resultBox), 250);
    });

    // Oculta la lista de resultados si se hace clic fuera de ella
    document.addEventListener("click", (e) => {
        if (wrap && !wrap.contains(e.target)) {
            resultBox.style.display = "none";
        }
    });
}

/**
 * Inicializa la funcionalidad de la página de búsqueda dedicada y la
 * redirección desde la barra de búsqueda. Esta función busca el botón de
 * búsqueda dentro del contenedor `.busqueda` y añade manejadores para
 * redirigir a `busqueda.html` con el parámetro `q`. Si la página actual
 * contiene un elemento con id `listaResultados`, se interpretará como la
 * página de resultados y se realizará una búsqueda inicial.
 */
function inicializarBusquedaPagina() {
    const input = document.getElementById("inputBusquedaGlobal");
    const buscWrap = input ? input.closest(".busqueda") : null;
    const botonBuscar = buscWrap ? buscWrap.querySelector("button") : null;

    // Asigna eventos de redirección al botón de la lupa y a la tecla Enter
    if (input && botonBuscar) {
        botonBuscar.addEventListener("click", () => {
            const q = input.value.trim();
            if (q) {
                window.location.href = `busqueda.html?q=${encodeURIComponent(q)}`;
            }
        });
        input.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                const q = input.value.trim();
                if (q) {
                    window.location.href = `busqueda.html?q=${encodeURIComponent(q)}`;
                }
            }
        });
    }

    // Si la página contiene el contenedor de lista de resultados, ejecuta la búsqueda
    const resultContainer = document.getElementById("listaResultados");
    if (resultContainer) {
        const params = new URLSearchParams(window.location.search);
        const qParam = params.get("q") || "";
        // Prefill del campo de búsqueda
        if (input) input.value = qParam;
        // Realiza la búsqueda y renderiza los resultados en el contenedor
        if (qParam) {
            realizarBusqueda(qParam, resultContainer);
        }
    }
}

async function realizarBusqueda(query, resultBox) {
    const token = localStorage.getItem("token");
    try {
        // Realiza la petición al backend
        //un fetch es una función para hacer peticiones HTTP asincronas
        const res = await fetch(`${API_URL_SEARCH}/directorios/buscar?q=${encodeURIComponent(query)}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            console.debug("Busqueda resultados", data.length);
            renderizarResultados(data, resultBox);
        } else {
            console.error("Busqueda error status:", res.status);
            renderizarResultados([], resultBox);
        }
    } catch (e) {
        console.error("Busqueda fetch error:", e);
        renderizarResultados([], resultBox);
    }
}

function renderizarResultados(items, resultBox) {
    resultBox.innerHTML = "";
    if (!items || items.length === 0) {
        resultBox.innerHTML = "<div style='padding:15px; color:#777;'>Sin coincidencias</div>";
    } else {
        items.forEach(item => {
            const div = document.createElement("div");
            div.className = "search-item";
            const badgeClass = item.tipo === "USUARIO" ? "tipo-usuario" : "tipo-post";
            const subt = item.subtitulo || "";
            div.innerHTML = `
                <img src="${item.imagen || 'imagenes/perfil.jpg'}" onerror="this.src='imagenes/perfil.jpg'">
                <div class="search-info">
                    <b>${item.titulo || ""}</b>
                    <span>${subt}</span>
                </div>
                <span class="badge-tipo ${badgeClass}">${item.tipo}</span>
            `;
            div.onclick = () => {
                if (item.tipo === "USUARIO") {
                    window.location.href = `perfil.html?u=${subt.replace('@','')}`;
                } else {
                    window.location.href = `feed.html#post-${item.id}`;
                }
                resultBox.style.display = "none";
            };
            resultBox.appendChild(div);
        });
    }
    resultBox.style.display = "block";
}