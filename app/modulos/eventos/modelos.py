from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime

if TYPE_CHECKING:
    from app.modulos.autenticacion.modelos import Usuario

class EventoBase(SQLModel):
    titulo: str
    descripcion: str
    fecha: datetime
    lugar: str
    tipo: str
    categoria: str
    imagen_url: Optional[str] = None

class Evento(EventoBase, table=True):
    __tablename__ = "eventos"
    id: Optional[int] = Field(default=None, primary_key=True)
    organizador_id: int = Field(foreign_key="usuarios.id")
    
    organizador: Optional["Usuario"] = Relationship(back_populates="eventos")

class EventoCreate(EventoBase):
    pass
