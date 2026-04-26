from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models, schemas

router = APIRouter(prefix="/patients", tags=["Patients"])


@router.post("/", response_model=schemas.PatientOut, status_code=status.HTTP_201_CREATED)
def create_patient(payload: schemas.PatientCreate, db: Session = Depends(get_db)):
    if db.query(models.Patient).filter(models.Patient.contact_email == payload.contact_email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    patient = models.Patient(**payload.model_dump())
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


@router.get("/", response_model=List[schemas.PatientOut])
def list_patients(db: Session = Depends(get_db)):
    return db.query(models.Patient).all()


@router.get("/{patient_id}", response_model=schemas.PatientOut)
def get_patient(patient_id: int, db: Session = Depends(get_db)):
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.put("/{patient_id}", response_model=schemas.PatientOut)
def update_patient(patient_id: int, payload: schemas.PatientUpdate, db: Session = Depends(get_db)):
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(patient, field, value)
    db.commit()
    db.refresh(patient)
    return patient


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient(patient_id: int, db: Session = Depends(get_db)):
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    db.delete(patient)
    db.commit()


# ── Patient Symptoms ──────────────────────────────────────────────────────────

@router.post(
    "/{patient_id}/symptoms",
    response_model=schemas.PatientSymptomOut,
    status_code=status.HTTP_201_CREATED,
    tags=["Patient Symptoms"],
)
def report_symptom(patient_id: int, payload: schemas.PatientSymptomCreate, db: Session = Depends(get_db)):
    if not db.query(models.Patient).filter(models.Patient.id == patient_id).first():
        raise HTTPException(status_code=404, detail="Patient not found")
    if not db.query(models.Symptom).filter(models.Symptom.id == payload.symptom_id).first():
        raise HTTPException(status_code=404, detail="Symptom not found")
    entry = models.PatientSymptom(patient_id=patient_id, **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get(
    "/{patient_id}/symptoms",
    response_model=List[schemas.PatientSymptomOut],
    tags=["Patient Symptoms"],
)
def list_patient_symptoms(patient_id: int, db: Session = Depends(get_db)):
    if not db.query(models.Patient).filter(models.Patient.id == patient_id).first():
        raise HTTPException(status_code=404, detail="Patient not found")
    return (
        db.query(models.PatientSymptom)
        .filter(models.PatientSymptom.patient_id == patient_id)
        .all()
    )


@router.delete(
    "/{patient_id}/symptoms/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Patient Symptoms"],
)
def remove_patient_symptom(patient_id: int, entry_id: int, db: Session = Depends(get_db)):
    entry = (
        db.query(models.PatientSymptom)
        .filter(
            models.PatientSymptom.id == entry_id,
            models.PatientSymptom.patient_id == patient_id,
        )
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Record not found")
    db.delete(entry)
    db.commit()


# ── Assessments ───────────────────────────────────────────────────────────────

@router.post(
    "/{patient_id}/assessments",
    response_model=schemas.AssessmentOut,
    status_code=status.HTTP_201_CREATED,
    tags=["Assessments"],
)
def create_assessment(patient_id: int, payload: schemas.AssessmentCreate, db: Session = Depends(get_db)):
    if not db.query(models.Patient).filter(models.Patient.id == patient_id).first():
        raise HTTPException(status_code=404, detail="Patient not found")
    assessment = models.Assessment(patient_id=patient_id, **payload.model_dump())
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return assessment


@router.get(
    "/{patient_id}/assessments",
    response_model=List[schemas.AssessmentOut],
    tags=["Assessments"],
)
def list_assessments(patient_id: int, db: Session = Depends(get_db)):
    if not db.query(models.Patient).filter(models.Patient.id == patient_id).first():
        raise HTTPException(status_code=404, detail="Patient not found")
    return db.query(models.Assessment).filter(models.Assessment.patient_id == patient_id).all()
