from typing import Optional
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime

class MensajeBase(SQLModel):
    contenido: str
    fecha: datetime = Field(default_factory=datetime.now)
    leido: bool = False

class Mensaje(MensajeBase, table=True):
    __tablename__ = "mensajes"
    id: Optional[int] = Field(default=None, primary_key=True)
    
    remitente_id: int = Field(foreign_key="usuarios.id")
    destinatario_id: int = Field(foreign_key="usuarios.id")

class MensajeCreate(MensajeBase):
    destinatario_username: str
