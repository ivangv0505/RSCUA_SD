const API_URL = "http://localhost:8000";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("form");
    
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            
            try {
                const res = await fetch(`${API_URL}/auth/token`, {
                    method: "POST",
                    body: formData
                });

                const data = await res.json();

                if (res.ok) {
                    // 1. Guardar Token
                    localStorage.setItem("token", data.access_token);
                    
                    // 2. REDIRECCIÓN DIRECTA (Sin alert)
                    window.location.href = "feed.html"; 
                } else {
                    // Aquí sí dejamos el alert (o un mensaje en rojo) para saber si falló
                    alert(data.detail || "Usuario o contraseña incorrectos");
                }
            } catch (error) {
                console.error("Error:", error);
                alert("Error de conexión con el servidor");
            }
        });
    }
});
