const API_URL = "http://localhost:8000";

// Lógica visual para seleccionar género
function seleccionarGenero(valor, elemento) {
    document.getElementById("sexoInput").value = valor;
    
    // Quitar clase 'selected' a todos
    document.querySelectorAll('.gender-card').forEach(card => card.classList.remove('selected'));
    
    // Agregar clase al seleccionado
    elemento.classList.add('selected');
}

document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const form = e.target;
    
    // Validar Género
    if (!form.sexo.value) {
        mostrarError("Por favor selecciona tu género");
        return;
    }

    // Convertir fecha a formato ISO string completo si es necesario
    const fecha = new Date(form.fecnac.value);
    
    const datosUsuario = {
        nombre: form.nombre.value,
        apellido: form.apellido.value,
        username: form.username.value,
        email: form.email.value,
        password: form.password.value,
        sexo: form.sexo.value,
        fecnac: fecha.toISOString(), // Enviamos formato ISO compatible con Python
        phone: "5555555555" // Teléfono default o agregar campo si quieres
    };

    try {
        const btn = form.querySelector(".btn-submit");
        btn.disabled = true;
        btn.innerText = "Registrando...";

        const response = await fetch(`${API_URL}/auth/registrar`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(datosUsuario)
        });

        if (response.ok) {
            alert("✅ ¡Cuenta creada con éxito! Ahora inicia sesión.");
            window.location.href = "login.html";
        } else {
            const error = await response.json();
            mostrarError(error.detail || "Error al registrarse");
        }
    } catch (error) {
        console.error(error);
        mostrarError("No se pudo conectar con el servidor");
    } finally {
        const btn = form.querySelector(".btn-submit");
        btn.disabled = false;
        btn.innerText = "Registrarse";
    }
});

function mostrarError(msg) {
    const el = document.getElementById("mensajeError");
    el.innerText = "⚠️ " + msg;
    el.style.display = "block";
}
