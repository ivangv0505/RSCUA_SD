const API_URL = "http://localhost:8000";

document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData();
    formData.append("username", form.username.value);
    formData.append("password", form.password.value);

    // Deshabilitar botón para evitar doble click
    const btn = form.querySelector("button");
    btn.disabled = true;
    btn.innerText = "Cargando...";
    document.getElementById("mensajeError").style.display = "none";

    try {
        const response = await fetch(`${API_URL}/auth/token`, {
            method: "POST",
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            // Guardar token y usuario
            localStorage.setItem("token", data.access_token);
            localStorage.setItem("usuario", form.username.value);
            
            alert("Iniciaste sesión. Bienvenido a RSCUA");
            // Aquí redirigiremos al Feed
            window.location.href = "feed.html"; 
        } else {
            const errorData = await response.json();
            mostrarError(errorData.detail || "Credenciales incorrectas");
        }
    } catch (error) {
        console.error("Error:", error);
        mostrarError("Error de conexión con el servidor");
    } finally {
        btn.disabled = false;
        btn.innerText = "Ingresar";
    }
});

function mostrarError(msg) {
    const el = document.getElementById("mensajeError");
    el.innerText = "ERROR " + msg;
    el.style.display = "block";
}
