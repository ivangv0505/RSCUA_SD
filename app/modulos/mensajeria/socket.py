import socketio
from app.db import engine
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.modulos.mensajeria.modelos import Mensaje
from app.modulos.autenticacion.modelos import Usuario
from app.modulos.notificaciones.modelos import Notificacion
from datetime import datetime
import uuid

# Instancia del servidor Socket.IO
# cors_allowed_origins='*' permite conexiones desde cualquier origen (Transparencia de acceso)
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

# Mapa de usuarios conectados: {username: sid}
usuarios_conectados = {}

# Cache de mensajes procesados para ANTIFLOODING (Simulación)
mensajes_procesados_ids = set()

@sio.event
async def connect(sid, environ):
    print(f"Cliente conectado: {sid}")

@sio.event
async def identify(sid, data):
    username = data.get('username')
    if username:
        usuarios_conectados[username] = sid
        print(f"Usuario identificado: {username} ({sid})")

@sio.event
async def disconnect(sid):
    # Eliminar usuario desconectado para mantener consistencia
    for user, s in list(usuarios_conectados.items()):
        if s == sid:
            del usuarios_conectados[user]
            break
    print(f"Cliente desconectado: {sid}")

# --- COMUNICACIÓN UNICAST (Chat Privado) ---
@sio.event
async def send_message(sid, data):
    remitente_user = data.get('remitente')
    destinatario_user = data.get('destinatario')
    contenido = data.get('contenido')
    
    print(f"Unicast: {remitente_user} -> {destinatario_user}")

    async with AsyncSession(engine) as session:
        try:
            q1 = select(Usuario).where(Usuario.username == remitente_user)
            u1 = (await session.execute(q1)).scalar_one_or_none()
            
            q2 = select(Usuario).where(Usuario.username == destinatario_user)
            u2 = (await session.execute(q2)).scalar_one_or_none()
            
            if u1 and u2:
                nuevo_mensaje = Mensaje(remitente_id=u1.id, destinatario_id=u2.id, contenido=contenido)
                session.add(nuevo_mensaje)
                await session.commit()
                
                dest_sid = usuarios_conectados.get(destinatario_user)
                if dest_sid:
                    await sio.emit('new_message', {
                        'remitente': remitente_user,
                        'contenido': contenido,
                        'fecha': str(datetime.utcnow())
                    }, room=dest_sid)
        except Exception as e:
            print(f"Error unicast: {e}")
            await session.rollback()

# --- COMUNICACIÓN BROADCAST (Difusión con ANTIFLOODING) ---
@sio.event
async def broadcast_comunidad(sid, data):
    """
    Envía un mensaje a TODOS los usuarios conectados.
    Implementa ANTIFLOODING: 
    1. Verifica ID único del mensaje para no procesar duplicados.
    2. Supresión de Eco: No envía el mensaje de vuelta al remitente.
    """
    remitente = data.get('remitente')
    contenido = data.get('contenido')
    msg_id = data.get('id') or str(uuid.uuid4()) # Identificador único del evento

    # 1. Control de Flooding: Verificar si ya procesamos este evento
    if msg_id in mensajes_procesados_ids:
        print(f"Antiflooding: Mensaje {msg_id} descartado (ya procesado).")
        return
    
    mensajes_procesados_ids.add(msg_id)
    print(f"Broadcast de {remitente}: {contenido}")

    # 2. Difusión a todos los nodos conectados EXCEPTO al remitente (Supresión de Eco)
    for user, user_sid in usuarios_conectados.items():
        if user_sid != sid: # Antiflooding: No regresar al origen
            await sio.emit('mensaje_comunidad', {
                'remitente': remitente,
                'contenido': contenido,
                'fecha': str(datetime.utcnow()),
                'tipo': 'ANUNCIO_GLOBAL'
            }, room=user_sid)

@sio.event
async def send_notification(sid, data):
    # Lógica de notificaciones (Pub/Sub simple)
    tipo = data.get('tipo')
    origen_user = data.get('origen')
    destino_user = data.get('destino')
    
    if origen_user == destino_user: return 

    dest_sid = usuarios_conectados.get(destino_user)
    if dest_sid:
        await sio.emit('new_notification', {
            'tipo': tipo,
            'origen': origen_user,
            'contenido': f"Interacción de {origen_user}"
        }, room=dest_sid)
