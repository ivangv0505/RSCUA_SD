from typing import Optional
from sqlmodel import SQLModel, Field
from enum import Enum

class TemaEnum(str, Enum):
    CLARO = "CLARO"
    OSCURO = "OSCURO"

class IdiomaEnum(str, Enum):
    ES = "ES"
    EN = "EN"
    FR = "FR"

class PrivacidadEnum(str, Enum):
    ALTA = "ALTA"
    MEDIA = "MEDIA"
    BAJA = "BAJA"

class Configuracion(SQLModel, table=True):
    __tablename__ = "configuracion"
    id: Optional[int] = Field(default=None, primary_key=True)
    usuario_id: int = Field(foreign_key="usuarios.id", unique=True)
    tema: TemaEnum = Field(default=TemaEnum.CLARO)
    idioma: IdiomaEnum = Field(default=IdiomaEnum.ES)
    # CORRECCIÓN CRÍTICA: Valor por defecto para evitar crash por NULL
    privacidad: PrivacidadEnum = Field(default=PrivacidadEnum.MEDIA)

class ConfiguracionUpdate(SQLModel):
    tema: Optional[TemaEnum] = None
    idioma: Optional[IdiomaEnum] = None
    privacidad: Optional[PrivacidadEnum] = None
