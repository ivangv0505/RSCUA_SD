// Búsqueda global reutilizable (mismo estilo que feed)
const API_URL_SEARCH = (typeof API_URL !== "undefined") ? API_URL : "http://localhost:8000";
let estiloBusquedaInyectado = false;

document.addEventListener("DOMContentLoaded", () => {
    inicializarBusquedaGlobal();
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

    document.addEventListener("click", (e) => {
        if (wrap && !wrap.contains(e.target)) {
            resultBox.style.display = "none";
        }
    });
}

async function realizarBusqueda(query, resultBox) {
    const token = localStorage.getItem("token");
    try {
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
