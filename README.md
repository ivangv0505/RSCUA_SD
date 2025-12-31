# RSCUA_SD:

Este proyecto adapta el proyecto "RSCUA" aplicando **11 conceptos fundamentales de Sistemas Distribuidos**

## Arquitectura y Tecnologías
El sistema sigue una arquitectura **Cliente-Servidor** con modularidad lógica:
* **Servidor (Backend):** Python FastAPI (Asíncrono) + PostgreSQL.
* **Cliente (Frontend):** JavaScript Vanilla (Cliente Ligero).
* **Middleware:** Socket.IO para paso de mensajes y eventos en tiempo real.

---

## Justificación Teórica (Mapeo de Conceptos)

El sistema cumple con los requisitos de la rúbrica y el temario del curso de la uea "Sistemas Distribuidos". A continuación se detalla dónde se encuentra cada concepto en el código:

| Concepto de SD | Archivo / Implementación | Justificación Técnica |
| :--- | :--- | :--- |
| **1. Arquitectura Cliente-Servidor** | `app/main.py` vs `static/` | Separación estricta: Backend (API REST) y Frontend (Archivos estáticos). |
| **2. Comunicación Síncrona (REST)** | `app/modulos/autenticacion/rutas.py` | El Login espera respuesta (Bloqueante/Request-Reply). |
| **3. Comunicación Asíncrona (MOM)** | `app/modulos/mensajeria/socket.py` | Chat y Notificaciones usan paso de mensajes asíncrono (No bloqueante). |
| **4. Concurrencia (I/O)** | `async def` / `await` en `rutas.py` | Uso de `asyncio` para manejar múltiples conexiones concurrentes sin hilos pesados. |
| **5. Antiflooding (Difusión)** | `socket.py` -> `broadcast_comunidad` | Implementa supresión de eco (no enviar al emisor) y control de IDs duplicados. |
| **6. Relojes Lógicos (Lamport)** | `app/modulos/autenticacion/modelos.py` | Campo `token_version` ordena eventos (Login < CambioPass) para invalidar sesiones. |
| **7. Servicio de Nombres** | `app/modulos/directorios/rutas.py` | Endpoint `/buscar` resuelve "Nombre de Usuario" a "Recurso/ID". |
| **8. Transparencia de Ubicación** | `app/db.py` (SQLAlchemy) | El ORM oculta la dirección física y puerto de la base de datos al código de negocio. |
| **9. Middleware** | `app/main.py` (CORSMiddleware) | Intercepta peticiones HTTP para gestionar seguridad y acceso cruzado. |
| **10. Stateless (Sin Estado)** | `rutas.py` (Uso de JWT) | El servidor no guarda sesiones en RAM; escalabilidad horizontal permitida. |
| **11. Interoperabilidad** | `/auth/google` | Comunicación con sistema externo (Google Identity) mediante estándares abiertos. |

---

##  Instalación y Ejecución

### Requisitos
* Python 3.9+
* PostgreSQL

### Pasos
1.  **Instalar dependencias:**
    ```bash
    pip install -r requirements.txt
    ```

2.  **Configurar Base de Datos:**
    Asegurarse de tener PostgreSQL corriendo y ajuste la URL en `app/db.py`.

3.  **Ejecutar Servidor:**
    ```bash
    uvicorn app.main:app --reload
    ```

4.  **Acceso:**
    Abrir navegador en: `http://localhost:8000/static/login.html`
