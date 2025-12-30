import os

base_dir = os.getcwd()

# ==============================================================================
# 1. HEADER ESTÁNDAR (Diseño Original Exacto + Enlaces Funcionales)
# ==============================================================================
# Copiado de tu feed.html pero con los onclicks corregidos
HEADER_HTML = """
    <div class="barra">
        <button onclick="window.location.href='perfil.html'" title="Perfil">
            <img src="imagenes/perfil.jpg" id="headerAvatar" alt="Perfil">
        </button>
        <button onclick="window.location.href='feed.html'" title="Inicio">
            <img src="imagenes/inicio.jpg" alt="Inicio">
        </button>
        
        <button class="btn-notificacion" onclick="window.location.href='notificaciones.html'" title="Notificaciones">
            <img src="imagenes/notificaciones.png" alt="Notificaciones">
            <span id="badgeNotis" class="badge">0</span>
        </button>

        <button onclick="window.location.href='comunidades.html'" title="Comunidades">
            <img src="imagenes/comunidad.png" alt="Comunidades">
        </button>

        <div class="busqueda" style="position:relative;">
            <input type="text" placeholder="Buscar en RSCUA..." id="inputBusquedaGlobal">
            <button><img src="imagenes/busqueda.jpg" alt="Buscar"></button>
            <div id="searchResults" class="search-results"></div>
        </div>

        <button onclick="window.location.href='eventos.html'" title="Eventos">
            <img src="imagenes/IconoEvento.png" alt="Eventos">
        </button>
        
        <button onclick="window.location.href='mensajeria.html'" title="Mensajes">
            <img src="imagenes/chats.png" alt="Mensajes">
        </button>
        
        <button onclick="window.location.href='configuracion.html'" title="Configuración">
            <img src="imagenes/configuracion.jpg" alt="Configuración">
        </button>

        <button onclick="logout()" title="Cerrar Sesión">
            <img src="imagenes/salida.jpg" alt="Salir">
        </button>
    </div>
"""

# ==============================================================================
# 2. SCRIPT DE BÚSQUEDA (Para que funcione en todas las páginas)
# ==============================================================================
SEARCH_SCRIPT = """
    <script>
        // Lógica de búsqueda global
        const inputB = document.getElementById('inputBusquedaGlobal');
        const resultsB = document.getElementById('searchResults');
        let timeoutB;
        
        if(inputB) {
            inputB.addEventListener('input', (e) => {
                clearTimeout(timeoutB);
                const q = e.target.value.trim();
                if(!q) { resultsB.style.display='none'; return; }
                
                timeoutB = setTimeout(async () => {
                    const t = localStorage.getItem("token");
                    if(!t) return;
                    try {
                        const r = await fetch(`http://localhost:8000/directorios/buscar?q=${q}`, {headers:{"Authorization":`Bearer ${t}`}});
                        if(r.ok) {
                            const d = await r.json();
                            resultsB.innerHTML = '';
                            if(d.length === 0) {
                                resultsB.innerHTML = '<div style="padding:10px; color:#666;">Sin resultados</div>';
                            } else {
                                d.forEach(i => {
                                    if(i.tipo === 'USUARIO') {
                                        resultsB.innerHTML += `<div class="search-item" onclick="window.location.href='perfil.html?u=${i.subtitulo.replace('@','')}'" style="padding:10px; border-bottom:1px solid #eee; cursor:pointer; display:flex; align-items:center;"><img src="imagenes/perfil.jpg" style="width:30px; height:30px; border-radius:50%; margin-right:10px;"><span>${i.titulo}</span></div>`;
                                    }
                                });
                            }
                            resultsB.style.display = 'block';
                        }
                    } catch(e){}
                }, 300);
            });
        }
        document.addEventListener('click', (e) => { if(!e.target.closest('.busqueda')) resultsB.style.display='none'; });
        function logout(){localStorage.clear(); window.location.href="login.html";}
    </script>
"""

# ==============================================================================
# 3. RECONSTRUCCIÓN DE HTMLs
# ==============================================================================

# FEED.HTML (Tu original + Header corregido)
feed_path = os.path.join(base_dir, "static/feed.html")
feed_content = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Feed - RSCUA</title>
    <link rel="stylesheet" href="css/HeaderStyle.css">
    <link rel="stylesheet" href="css/FeedStyle.css">
    <style>
        body {{ padding-top: 100px; }}
        .search-results {{ position: absolute; top: 45px; left:0; width: 100%; background: white; border: 1px solid #ccc; z-index: 2000; max-height: 300px; overflow-y: auto; display:none; border-radius: 0 0 5px 5px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
    </style>
</head>
<body>
    {HEADER_HTML}

    <div class="Historias">
        <div class="crear-historia"><button>+ Nueva Historia</button></div>
        <div class="lista-historias">
            <ul>
                <li><img src="imagenes/Historia-1.jpeg" onerror="this.style.display='none'"></li>
                <li><img src="imagenes/Historia-2.jpeg" onerror="this.style.display='none'"></li>
                <li><img src="imagenes/Historia-3.jpeg" onerror="this.style.display='none'"></li>
                <li><img src="imagenes/Historia-4.jpeg" onerror="this.style.display='none'"></li>
                <li><img src="imagenes/Historia-5.jpeg" onerror="this.style.display='none'"></li>
            </ul>
        </div>
    </div>

    <div class="crear-publicacion-container">
        <img src="imagenes/perfil.jpg" class="post-avatar" id="avatarInput">
        <div style="width: 100%; display: flex; flex-direction: column;">
            <textarea id="textoPost" rows="2" placeholder="¿Qué estás pensando?" style="border:none; outline:none; resize:none; font-family: Arial;"></textarea>
            <div id="previewContainer" class="preview-container" style="display:none; position:relative; margin-top:10px;">
                <img id="imgPreview" class="preview-image" style="width:100%; max-height:300px; object-fit:contain;">
                <button class="btn-remove-img" onclick="quitarImagen()" style="position:absolute; top:5px; right:5px;">×</button>
            </div>
            <div class="herramientas-publicacion">
                <div class="left-tools">
                    <input type="file" id="fileInput" accept="image/*" style="display: none;" onchange="manejarArchivo(this)">
                    <button class="btn-upload-img" onclick="document.getElementById('fileInput').click()" title="Agregar foto">
                        <img src="imagenes/foto.jpg" style="width:24px; height:24px; object-fit:contain;">
                    </button>
                    <select id="privacidadSelect" class="select-privacidad">
                        <option value="PUBLICO">🌎 Público</option>
                        <option value="AMIGOS">👥 Amigos</option>
                        <option value="PRIVADO">🔒 Solo yo</option>
                    </select>
                </div>
                <button class="btn-publicar" onclick="crearPublicacion()">Publicar</button>
            </div>
        </div>
    </div>

    <div class="feed-publicaciones" id="contenedorFeed">
        <p style="text-align: center;">Cargando publicaciones...</p>
    </div>

    <div id="modalEditarPost" class="modal-overlay">
        <div class="modal-box">
            <h3>Editar Publicación</h3>
            <textarea id="textoEditarInput" rows="4"></textarea>
            <div class="modal-buttons">
                <button class="btn-modal btn-cancel" onclick="cerrarModalEditar()">Cancelar</button>
                <button class="btn-modal btn-confirm" onclick="confirmarEditar()">Guardar</button>
            </div>
        </div>
    </div>
    <div id="modalEliminar" class="modal-overlay">
        <div class="modal-box">
            <h3>¿Eliminar publicación?</h3>
            <p>Esta acción no se puede deshacer.</p>
            <div class="modal-buttons">
                <button class="btn-modal btn-cancel" onclick="cerrarModalEliminar()">Cancelar</button>
                <button class="btn-modal btn-danger" onclick="confirmarEliminar()">Eliminar</button>
            </div>
        </div>
    </div>

    <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
    <script src="js/feed.js"></script>
    {SEARCH_SCRIPT}
</body>
</html>
"""

# COMUNIDADES.HTML (Diseño recuperado de IU_Comunidades.jsp)
comunidades_path = os.path.join(base_dir, "static/comunidades.html")
comunidades_content = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Comunidades</title>
    <link rel="stylesheet" href="css/HeaderStyle.css">
    <style>
        body {{ padding-top: 100px; font-family: Arial, sans-serif; background-color: #f9f9f9; }}
        .comunidades {{ margin: 20px 50px; padding: 20px 30px; border: 1px solid #ccc; border-radius: 15px; background-color: white; box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.1); }}
        .comunidades h1 {{ font-size: 28px; margin-bottom: 20px; }}
        .comunidad-item {{ display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; padding: 15px; border: 1px solid #ccc; border-radius: 10px; background-color: #f9f9f9; transition: transform 0.3s ease; }}
        .comunidad-item:hover {{ transform: scale(1.01); }}
        .acciones button {{ padding: 10px 15px; font-size: 16px; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px; }}
        .btn-unirse {{ background-color: #0095f6; color: white; }}
        .btn-reportar {{ background-color: #ddd; color: black; }}
        .search-results {{ position: absolute; top: 45px; left:0; width: 100%; background: white; border: 1px solid #ccc; z-index: 2000; max-height: 300px; overflow-y: auto; display:none; }}
    </style>
</head>
<body>
    {HEADER_HTML}

    <div class="comunidades">
        <h1>Explora Comunidades</h1>
        <div class="comunidad-item">
            <div class="comunidad-info"><h2>Tecnología</h2><p>Comunidad de tecnología y desarrollo</p></div>
            <div class="acciones"><button class="btn-unirse">Unirse</button><button class="btn-reportar">Reportar</button></div>
        </div>
        <div class="comunidad-item">
            <div class="comunidad-info"><h2>Libros</h2><p>Amantes de la lectura</p></div>
            <div class="acciones"><button class="btn-unirse">Unirse</button><button class="btn-reportar">Reportar</button></div>
        </div>
        <div class="comunidad-item">
            <div class="comunidad-info"><h2>Gaming</h2><p>Videojuegos y eSports</p></div>
            <div class="acciones"><button class="btn-unirse">Unirse</button><button class="btn-reportar">Reportar</button></div>
        </div>
    </div>
    {SEARCH_SCRIPT}
</body>
</html>
"""

# EVENTOS.HTML (Diseño recuperado de IU_Eventos.jsp)
eventos_path = os.path.join(base_dir, "static/eventos.html")
eventos_content = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Eventos</title>
    <link rel="stylesheet" href="css/HeaderStyle.css">
    <link rel="stylesheet" href="css/EvetosStyle.css">
    <style>
        body {{ padding-top: 100px; font-family: Arial, sans-serif; text-align:center; }}
        .botones-eventos {{ display: flex; justify-content: center; gap: 40px; margin-top: 50px; flex-wrap: wrap; }}
        .boton-evento {{ display: flex; flex-direction: column; align-items: center; text-decoration: none; color: #333; width: 150px; transition: transform 0.3s; }}
        .boton-evento:hover {{ transform: scale(1.1); }}
        .boton-evento img {{ width: 100px; height: 100px; border-radius: 50%; object-fit: cover; box-shadow: 0 4px 8px rgba(0,0,0,0.2); }}
        .boton-evento span {{ margin-top: 10px; font-weight: bold; font-size: 18px; }}
        .search-results {{ position: absolute; top: 45px; left:0; width: 100%; background: white; border: 1px solid #ccc; z-index: 2000; max-height: 300px; overflow-y: auto; display:none; text-align: left; }}
    </style>
</head>
<body>
    {HEADER_HTML}

    <h1>Eventos</h1>
    <div class="botones-eventos">
        <a href="crear_evento.html" class="boton-evento">
            <img src="imagenes/Crearevento.jpg" onerror="this.src='imagenes/inicio.jpg'">
            <span>Crear Evento</span>
        </a>
        <a href="#" class="boton-evento">
            <img src="imagenes/ubicacion.jpg" onerror="this.src='imagenes/inicio.jpg'">
            <span>Eventos cercanos</span>
        </a>
        <a href="#" class="boton-evento">
            <img src="imagenes/calendariodib.jpg" onerror="this.src='imagenes/inicio.jpg'">
            <span>Buscar por fecha</span>
        </a>
    </div>
    {SEARCH_SCRIPT}
</body>
</html>
"""

# CONFIGURACION.HTML (Diseño recuperado de IU_Configuracion.jsp)
config_path = os.path.join(base_dir, "static/configuracion.html")
config_content = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Configuración</title>
    <link rel="stylesheet" href="css/HeaderStyle.css">
    <style>
        body {{ padding-top: 100px; font-family: Arial, sans-serif; transition: background 0.3s, color 0.3s; }}
        body.oscuro {{ background-color: #2e2e2e; color: #D3D3D3; }}
        
        .configuraciones {{ margin: 20px 50px; padding: 20px 30px; border: 1px solid #ccc; border-radius: 15px; box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.1); background: white; }}
        body.oscuro .configuraciones {{ background-color: #333; border-color: #555; }}
        
        .configuraciones h1 {{ font-size: 32px; margin-bottom: 20px; }}
        
        .config-btn {{ display: flex; align-items: center; margin: 15px 0; background: transparent; border: none; font-size: 18px; cursor: pointer; padding: 10px; border-radius: 10px; width: 100%; text-align: left; color: inherit; transition: 0.3s; }}
        .config-btn:hover {{ background-color: #f0f0f0; transform: scale(1.01); }}
        body.oscuro .config-btn:hover {{ background-color: #555; }}
        .config-btn img {{ margin-right: 15px; width: 50px; height: 50px; border-radius: 50%; }}

        .panel {{ display: none; padding: 20px; border: 1px solid #ccc; border-radius: 10px; background-color: #f9f9f9; margin-top: 10px; }}
        body.oscuro .panel {{ background-color: #3a3a3a; border-color: #555; }}
        .panel button {{ margin: 10px; padding: 10px 20px; font-size: 16px; border: none; border-radius: 5px; cursor: pointer; background-color: #ddd; }}
        body.oscuro .panel button {{ background-color: #555; color: white; }}
        .search-results {{ position: absolute; top: 45px; left:0; width: 100%; background: white; border: 1px solid #ccc; z-index: 2000; max-height: 300px; overflow-y: auto; display:none; }}
    </style>
</head>
<body>
    {HEADER_HTML}

    <div class="configuraciones">
        <h1>Configuración</h1>

        <button class="config-btn" onclick="toggle('panel-tema')">
            <img src="imagenes/tema.png"> Cambiar Tema
        </button>
        <div id="panel-tema" class="panel">
            <h2>Selecciona el tema:</h2>
            <button onclick="guardarConfig('tema', 'OSCURO')">Modo Oscuro</button>
            <button onclick="guardarConfig('tema', 'CLARO')">Modo Claro</button>
        </div>

        <button class="config-btn">
            <img src="imagenes/perfil.jpg"> Cambiar nombre de usuario
        </button>
        <button class="config-btn">
            <img src="imagenes/contrasenia.jpg"> Cambiar contraseña
        </button>
        <button class="config-btn">
            <img src="imagenes/foto.jpg"> Cambiar foto de perfil
        </button>

        <button class="config-btn" onclick="toggle('panel-idioma')">
            <img src="imagenes/idioma.jpg"> Cambiar Idioma
        </button>
        <div id="panel-idioma" class="panel">
            <h2>Selecciona el idioma:</h2>
            <button onclick="guardarConfig('idioma', 'ES')">Español</button>
            <button onclick="guardarConfig('idioma', 'EN')">Inglés</button>
            <button onclick="guardarConfig('idioma', 'FR')">Francés</button>
        </div>

        <button class="config-btn">
            <img src="imagenes/informacion.jpg"> Cambiar información principal
        </button>
        <button class="config-btn">
            <img src="imagenes/privacidad.jpg"> Cambiar privacidad de la cuenta
        </button>
    </div>

    <script>
        const API = "http://localhost:8000";
        function toggle(id) {{
            const el = document.getElementById(id);
            el.style.display = el.style.display === 'none' ? 'block' : 'none';
        }}
        async function guardarConfig(clave, valor) {{
            const t = localStorage.getItem("token");
            try {{
                const res = await fetch(`${{API}}/configuracion/`, {{
                    method: "PUT",
                    headers: {{ "Content-Type": "application/json", "Authorization": `Bearer ${{t}}` }},
                    body: JSON.stringify({{ [clave]: valor }})
                }});
                if(res.ok) {{
                    if(clave==='tema') aplicarTema(valor);
                    alert("Guardado");
                }}
            }} catch(e) {{}}
        }}
        function aplicarTema(t) {{
            if(t==='OSCURO') document.body.classList.add('oscuro');
            else document.body.classList.remove('oscuro');
        }}
        // Init
        const t = localStorage.getItem("token");
        if(t) fetch(`${{API}}/configuracion/`, {{headers:{{"Authorization":`Bearer ${{t}}`}}}}).then(r=>r.json()).then(d=>aplicarTema(d.tema));
    </script>
    {SEARCH_SCRIPT}
</body>
</html>
"""

def aplicar_consistencia():
    with open(feed_path, "w", encoding="utf-8") as f: f.write(feed_content)
    with open(comunidades_path, "w", encoding="utf-8") as f: f.write(comunidades_content)
    with open(eventos_path, "w", encoding="utf-8") as f: f.write(eventos_content)
    with open(config_path, "w", encoding="utf-8") as f: f.write(config_content)
    
    print("✅ Interfaz unificada con diseño ORIGINAL.")
    print("1. El header es IDÉNTICO en todas las páginas (iconos, clases, buscador).")
    print("2. Los enlaces del menú ahora funcionan (Comunidad, Eventos, Config).")
    print("3. La búsqueda funciona en todas las páginas.")
    print("👉 RECARGA EL NAVEGADOR PARA VER LOS CAMBIOS.")

if __name__ == "__main__":
    aplicar_consistencia()