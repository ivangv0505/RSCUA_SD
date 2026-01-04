"""
Módulo de sockets para la mensajería y notificaciones en tiempo real.

Define eventos de Socket.IO para la comunicación privada (unicast), difusión
global (broadcast) y la generación de notificaciones. Las notificaciones se
persisten en la base de datos y se envían a los clientes conectados.
"""

import socketio
from app.db import engine
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.modulos.mensajeria.modelos import Mensaje
from app.modulos.autenticacion.modelos import Usuario
from app.modulos.notificaciones.modelos import Notificacion
from datetime import datetime
import uuid


# Instancia del servidor Socket.IO.  `cors_allowed_origins='*'` se utiliza
# para permitir conexiones desde cualquier origen, facilitando la
# transparencia de acceso en un sistema distribuido.
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

# Mapa de usuarios conectados: {username: sid}.  Este mapa permite enviar
# mensajes directamente a un usuario si está conectado.
usuarios_conectados: dict[str, str] = {}

# Cache de mensajes procesados para aplicar un control antiflooding en
# difusiones.  Se almacenan identificadores de eventos ya procesados.
mensajes_procesados_ids: set[str] = set()


@sio.event
async def connect(sid, environ):
    """Se ejecuta al establecerse una nueva conexión de cliente."""
    print(f"Cliente conectado: {sid}")


@sio.event
async def identify(sid, data):
    """
    Identifica al usuario asociando su nombre de usuario con el SID del
    cliente.  Esto se debe ejecutar inmediatamente después de la conexión
    para poder enrutar los mensajes correctamente.
    """
    username = data.get('username')
    if username:
        usuarios_conectados[username] = sid
        print(f"Usuario identificado: {username} ({sid})")


@sio.event
async def disconnect(sid):
    """Se ejecuta cuando un cliente se desconecta; limpia el mapa."""
    for user, s in list(usuarios_conectados.items()):
        if s == sid:
            del usuarios_conectados[user]
            break
    print(f"Cliente desconectado: {sid}")


# COMUNICACIÓN UNICAST (Chat Privado) 
@sio.event
async def send_message(sid, data):
    """
    Maneja el envío de mensajes privados entre dos usuarios.  Además de
    persistir el mensaje en la base de datos y reenviarlo al destinatario
    conectado, genera una notificación tipo "MENSAJE" para que quede
    registrada.
    """
    remitente_user = data.get('remitente')
    destinatario_user = data.get('destinatario')
    contenido = data.get('contenido')
    print(f"Unicast: {remitente_user} -> {destinatario_user}")
    async with AsyncSession(engine) as session:
        try:
            # Localizar usuarios en la base de datos
            q1 = select(Usuario).where(Usuario.username == remitente_user)
            u1 = (await session.execute(q1)).scalar_one_or_none()
            q2 = select(Usuario).where(Usuario.username == destinatario_user)
            u2 = (await session.execute(q2)).scalar_one_or_none()
            if u1 and u2:
                # Persistir el mensaje
                nuevo_mensaje = Mensaje(
                    remitente_id=u1.id,
                    destinatario_id=u2.id,
                    contenido=contenido,
                )
                session.add(nuevo_mensaje)
                await session.commit()
                # Notificar al destinatario si está en línea
                dest_sid = usuarios_conectados.get(destinatario_user)
                if dest_sid:
                    await sio.emit(
                        'new_message',
                        {
                            'remitente': remitente_user,
                            'contenido': contenido,
                            'fecha': str(datetime.utcnow()),
                        },
                        room=dest_sid,
                    )
                # Crear notificación de tipo MENSAJE
                try:
                    contenido_noti = f"Nuevo mensaje de {remitente_user}"
                    noti = Notificacion(
                        usuario_destino_id=u2.id,
                        usuario_origen_id=u1.id,
                        tipo='MENSAJE',
                        contenido=contenido_noti,
                        referencia_id=nuevo_mensaje.id,
                    )
                    session.add(noti)
                    await session.commit()
                    # Emitir notificación al destinatario conectado
                    if dest_sid:
                        await sio.emit(
                            'new_notification',
                            {
                                'tipo': 'MENSAJE',
                                'origen': remitente_user,
                                'contenido': contenido_noti,
                            },
                            room=dest_sid,
                        )
                except Exception as e:
                    print(f"Error creando notificación de mensaje: {e}")
        except Exception as e:
            print(f"Error unicast: {e}")
            await session.rollback()


# COMUNICACIÓN BROADCAST (Difusión con ANTIFLOODING)
@sio.event
async def broadcast_comunidad(sid, data):
    """
    Envía un mensaje de difusión a todos los usuarios conectados excepto al
    remitente.  Implementa un control de flooding mediante la verificación
    de identificadores únicos de mensaje y su almacenamiento temporal.
    """
    remitente = data.get('remitente')
    contenido = data.get('contenido')
    msg_id = data.get('id') or str(uuid.uuid4())
    # Control antiflooding: ignorar mensajes ya procesados
    if msg_id in mensajes_procesados_ids:
        print(f"Antiflooding: Mensaje {msg_id} descartado (ya procesado).")
        return
    mensajes_procesados_ids.add(msg_id)
    print(f"Broadcast de {remitente}: {contenido}")
    # Difundir mensaje a todos excepto al emisor
    for user, user_sid in usuarios_conectados.items():
        if user_sid != sid:
            await sio.emit(
                'mensaje_comunidad',
                {
                    'remitente': remitente,
                    'contenido': contenido,
                    'fecha': str(datetime.utcnow()),
                    'tipo': 'ANUNCIO_GLOBAL',
                },
                room=user_sid,
            )


@sio.event
async def send_notification(sid, data):
    """
    Evento genérico para generar y enviar notificaciones.  Se utiliza tanto
    desde el frontend para emitir eventos de "LIKE" o "COMENTARIO" como
    internamente para reutilizar la lógica de persistencia.  También sirve de
    punto central para construir el contenido del mensaje a partir del tipo.
    """
    tipo = data.get('tipo')
    origen_user = data.get('origen')
    destino_user = data.get('destino')
    referencia_id = data.get('post_id')
    # No notificar si el origen y el destino son el mismo usuario
    if origen_user == destino_user:
        return
    # Determinar texto a mostrar según el tipo
    if tipo == 'LIKE':
        mensaje_emit = f"{origen_user} le dio like a tu publicación"
    elif tipo == 'COMENTARIO':
        mensaje_emit = f"{origen_user} comentó tu publicación"
    elif tipo == 'MENSAJE':
        mensaje_emit = f"Nuevo mensaje de {origen_user}"
    else:
        mensaje_emit = f"Interacción de {origen_user}"
    # Persistir notificación en base de datos
    async with AsyncSession(engine) as session:
        try:
            q1 = select(Usuario).where(Usuario.username == origen_user)
            u1 = (await session.execute(q1)).scalar_one_or_none()
            q2 = select(Usuario).where(Usuario.username == destino_user)
            u2 = (await session.execute(q2)).scalar_one_or_none()
            if u1 and u2:
                nueva_noti = Notificacion(
                    usuario_destino_id=u2.id,
                    usuario_origen_id=u1.id,
                    tipo=tipo,
                    contenido=mensaje_emit,
                    referencia_id=referencia_id,
                )
                session.add(nueva_noti)
                await session.commit()
        except Exception as e:
            print(f"Error creando notificación: {e}")
            await session.rollback()
    # Enviar notificación al destinatario si está conectado
    dest_sid = usuarios_conectados.get(destino_user)
    if dest_sid:
        await sio.emit(
            'new_notification',
            {
                'tipo': tipo,
                'origen': origen_user,
                'contenido': mensaje_emit,
            },
            room=dest_sid,
        )


#SEÑALIZACIÓN P2P 
@sio.event 
async def p2p_signal(sid, data):
    """
    Maneja mensajes de señalización WebRTC para establecer conexiones
    peer‑to‑peer entre clientes. El cliente emisor envía una señal que
    contiene una oferta/answer SDP o un candidato ICE. El servidor
    reenvía esta señal al destinatario correspondiente utilizando su
    SID actual. No se persisten datos en la base de datos ya que la
    negociación WebRTC es efímera.

    Argumentos:
        sid: Identificador de sesión del emisor.
        data: Diccionario con los campos:
            - origen: nombre de usuario de quien envía la señal
            - destino: nombre de usuario del destinatario
            - signal: objeto con la señal SDP o ICE
    """
    origen = data.get('origen')
    destino = data.get('destino')
    signal = data.get('signal')
    if not destino or not signal:
        return
    # Buscar el SID del destinatario conectado
    dest_sid = usuarios_conectados.get(destino)
    if dest_sid:
        # Reenviar la señal al destinatario con el nombre del emisor
        await sio.emit('p2p_signal', {'origen': origen, 'signal': signal}, room=dest_sid)