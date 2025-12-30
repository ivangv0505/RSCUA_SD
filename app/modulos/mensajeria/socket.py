import socketio
from app.db import engine
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.modulos.mensajeria.modelos import Mensaje
from app.modulos.autenticacion.modelos import Usuario
from app.modulos.notificaciones.modelos import Notificacion
from datetime import datetime


# Instancia del servidor Socket.IO
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

# Mapa de usuarios conectados: {username: sid}
usuarios_conectados = {}

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
    for user, s in list(usuarios_conectados.items()):
        if s == sid:
            del usuarios_conectados[user]
            break
    print(f"Cliente desconectado: {sid}")

@sio.event
async def send_message(sid, data):
    remitente_user = data.get('remitente')
    destinatario_user = data.get('destinatario')
    contenido = data.get('contenido')
    
    print(f"Mensaje de {remitente_user} para {destinatario_user}: {contenido}")

    # Usamos AsyncSession con el motor asíncrono
    async with AsyncSession(engine) as session:
        try:
            # Buscar IDs de los usuarios
            q1 = select(Usuario).where(Usuario.username == remitente_user)
            r1 = await session.execute(q1)
            u1 = r1.scalar_one_or_none()
            
            q2 = select(Usuario).where(Usuario.username == destinatario_user)
            r2 = await session.execute(q2)
            u2 = r2.scalar_one_or_none()
            
            if u1 and u2:
                # Crear y guardar mensaje
                nuevo_mensaje = Mensaje(remitente_id=u1.id, destinatario_id=u2.id, contenido=contenido)
                session.add(nuevo_mensaje)
                await session.commit()
                
                # Enviar al destinatario (si está conectado)
                dest_sid = usuarios_conectados.get(destinatario_user)
                if dest_sid:
                    await sio.emit('new_message', {
                        'remitente': remitente_user,
                        'contenido': contenido,
                        'fecha': str(datetime.utcnow())
                    }, room=dest_sid)
                    print(f"Enviado a socket {dest_sid}")
                else:
                    print(f"Destinatario {destinatario_user} no conectado (guardado en BD)")
            else:
                print("Error: Usuario remitente o destinatario no encontrado")
                
        except Exception as e:
            print(f"Error procesando mensaje: {e}")
            await session.rollback()



@sio.event
async def send_notification(sid, data):
    # data = { tipo: 'LIKE', origen: 'ivan', destino: 'juan', post_id: 123 }
    tipo = data.get('tipo')
    origen_user = data.get('origen')
    destino_user = data.get('destino')
    post_id = data.get('post_id')
    
    if origen_user == destino_user: return # No notificarse a sí mismo

    async with AsyncSession(engine) as session:
        try:
            # Buscar IDs
            u1 = (await session.execute(select(Usuario).where(Usuario.username == origen_user))).scalar_one_or_none()
            u2 = (await session.execute(select(Usuario).where(Usuario.username == destino_user))).scalar_one_or_none()
            
            if u1 and u2:
                texto = f"le ha gustado tu publicación" if tipo == 'LIKE' else "ha comentado tu publicación"
                
                # Guardar Notificación
                nueva_noti = Notificacion(
                    usuario_destino_id=u2.id,
                    usuario_origen_id=u1.id,
                    tipo=tipo,
                    contenido=texto,
                    referencia_id=post_id
                )
                session.add(nueva_noti)
                await session.commit()
                
                # Enviar Push si está conectado
                dest_sid = usuarios_conectados.get(destino_user)
                if dest_sid:
                    await sio.emit('new_notification', {
                        'tipo': tipo,
                        'origen': origen_user,
                        'contenido': texto
                    }, room=dest_sid)
                    print(f"Notificación enviada a {destino_user}")
        except Exception as e:
            print(f"Error notificación: {e}")
