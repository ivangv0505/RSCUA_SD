const API_URL = "http://localhost:8000";

document.addEventListener("DOMContentLoaded", () => {
    // Lógica Login Normal
    const form = document.getElementById("loginForm");
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            try {
                const res = await fetch(`${API_URL}/auth/token`, { method: "POST", body: formData });
                const data = await res.json();
                if (res.ok) {
                    localStorage.setItem("token", data.access_token);
                    window.location.href = "feed.html";
                } else {
                    mostrarError(data.detail || "Usuario o contraseña incorrectos");
                }
            } catch (error) { mostrarError("Error de conexión"); }
        });
    }
});

// Función global que llama Google al terminar el login
async function handleGoogleResponse(response) {
    try {
        console.log("Token de Google recibido, enviando al backend...");
        const res = await fetch(`${API_URL}/auth/google`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: response.credential })
        });

        const data = await res.json();

        if (res.ok) {
            localStorage.setItem("token", data.access_token);
            window.location.href = "feed.html";
        } else {
            mostrarError("Error login Google: " + (data.detail || "Falló"));
        }
    } catch (e) {
        console.error(e);
        mostrarError("Error de conexión con el servidor");
    }
}

function mostrarError(msg) {
    const p = document.getElementById("mensajeError");
    if(p) {
        p.innerText = msg;
        p.style.display = "block";
    } else {
        alert(msg);
    }
}
