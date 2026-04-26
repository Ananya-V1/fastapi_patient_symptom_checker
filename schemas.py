from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field
from enum import Enum


class GenderEnum(str, Enum):
    male = "male"
    female = "female"
    other = "other"


class RecommendedActionEnum(str, Enum):
    monitor_at_home = "monitor_at_home"
    visit_clinic = "visit_clinic"
    go_to_er = "go_to_er"
    schedule_followup = "schedule_followup"


# ── Symptom ──────────────────────────────────────────────────────────────────

class SymptomCreate(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    category: Optional[str] = Field(None, max_length=50)


class SymptomOut(SymptomCreate):
    id: int

    model_config = {"from_attributes": True}


# ── Patient ───────────────────────────────────────────────────────────────────

class PatientCreate(BaseModel):
    name: str = Field(..., max_length=100)
    age: int = Field(..., ge=0, le=150)
    gender: GenderEnum
    contact_email: EmailStr


class PatientUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    age: Optional[int] = Field(None, ge=0, le=150)
    gender: Optional[GenderEnum] = None
    contact_email: Optional[EmailStr] = None


class PatientOut(PatientCreate):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Patient Symptom ───────────────────────────────────────────────────────────

class PatientSymptomCreate(BaseModel):
    symptom_id: int
    severity: int = Field(..., ge=1, le=10)
    duration_days: int = Field(1, ge=1)


class PatientSymptomOut(BaseModel):
    id: int
    symptom: SymptomOut
    severity: int
    duration_days: int
    reported_at: datetime

    model_config = {"from_attributes": True}


# ── Assessment ────────────────────────────────────────────────────────────────

class AssessmentCreate(BaseModel):
    notes: Optional[str] = None
    recommended_action: RecommendedActionEnum


class AssessmentOut(AssessmentCreate):
    id: int
    patient_id: int
    created_at: datetime

    model_config = {"from_attributes": True}
