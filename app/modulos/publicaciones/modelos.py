from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from enum import Enum

class Privacidad(str, Enum):
    PUBLICO = "PUBLICO"
    AMIGOS = "AMIGOS"
    PRIVADO = "PRIVADO"

if TYPE_CHECKING:
    from app.modulos.autenticacion.modelos import Usuario

class PublicacionBase(SQLModel):
    texto: str
    imagen_url: Optional[str] = None
    etiquetas: Optional[str] = None
    privacidad: Privacidad = Field(default=Privacidad.PUBLICO)

class Publicacion(PublicacionBase, table=True):
    __tablename__ = "publicaciones"
    id: Optional[int] = Field(default=None, primary_key=True)
    fecha: datetime = Field(default_factory=datetime.now) 
    usuario_id: int = Field(foreign_key="usuarios.id")
    usuario: Optional["Usuario"] = Relationship(back_populates="publicaciones")

class PublicacionCreate(PublicacionBase):
    pass

class Reaccion(SQLModel, table=True):
    __tablename__ = "reacciones"
    id: Optional[int] = Field(default=None, primary_key=True)
    usuario_id: int = Field(foreign_key="usuarios.id")
    publicacion_id: int = Field(foreign_key="publicaciones.id")
    fecha: datetime = Field(default_factory=datetime.now)

# --- NUEVO MODELO COMENTARIO ---
class Comentario(SQLModel, table=True):
    __tablename__ = "comentarios"
    id: Optional[int] = Field(default=None, primary_key=True)
    texto: str
    fecha: datetime = Field(default_factory=datetime.now)
    usuario_id: int = Field(foreign_key="usuarios.id")
    publicacion_id: int = Field(foreign_key="publicaciones.id")
    
    # Relaciones (opcionales para cargas complejas, pero útiles)
    # usuario: Optional["Usuario"] = Relationship() 

class ComentarioRead(SQLModel):
    id: int
    texto: str
    fecha: datetime
    usuario_id: int
    nombre_usuario: str
    username: str

class UsuarioMini(SQLModel):
    username: str
    nombre: str
    apellido: str

class PublicacionReadWithUser(PublicacionBase):
    id: int
    fecha: datetime
    usuario: Optional[UsuarioMini] = None
    likes: int = 0
    comentarios: int = 0 # Agregamos contador
    ya_di_like: bool = False

class PublicacionUpdate(SQLModel):
    texto: Optional[str] = None
    imagen_url: Optional[str] = None
    privacidad: Optional[Privacidad] = None
