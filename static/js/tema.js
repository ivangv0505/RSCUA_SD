
(function() {
    const API_URL = "http://localhost:8000";
    
    // 1. Aplicar instantáneamente si ya lo conocemos (evita pantallazo blanco)
    const localTheme = localStorage.getItem("tema");
    if (localTheme === 'OSCURO') {
        document.body.classList.add('oscuro');
    }

    // 2. Sincronizar con base de datos (por si cambiaste en otro dispositivo)
    const token = localStorage.getItem("token");
    if (token) {
        fetch(`${API_URL}/configuracion/`, { 
            headers: { "Authorization": `Bearer ${token}` } 
        })
        .then(r => r.json())
        .then(config => {
            if (config.tema === 'OSCURO') {
                document.body.classList.add('oscuro');
                localStorage.setItem("tema", "OSCURO");
            } else {
                document.body.classList.remove('oscuro');
                localStorage.setItem("tema", "CLARO");
            }
        })
        .catch(() => {});
    }
})();
