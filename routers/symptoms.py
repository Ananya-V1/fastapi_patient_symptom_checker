from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models, schemas

router = APIRouter(prefix="/symptoms", tags=["Symptoms"])


@router.post("/", response_model=schemas.SymptomOut, status_code=status.HTTP_201_CREATED)
def create_symptom(payload: schemas.SymptomCreate, db: Session = Depends(get_db)):
    if db.query(models.Symptom).filter(models.Symptom.name == payload.name).first():
        raise HTTPException(status_code=409, detail="Symptom already exists")
    symptom = models.Symptom(**payload.model_dump())
    db.add(symptom)
    db.commit()
    db.refresh(symptom)
    return symptom


@router.get("/", response_model=List[schemas.SymptomOut])
def list_symptoms(db: Session = Depends(get_db)):
    return db.query(models.Symptom).all()


@router.get("/{symptom_id}", response_model=schemas.SymptomOut)
def get_symptom(symptom_id: int, db: Session = Depends(get_db)):
    symptom = db.query(models.Symptom).filter(models.Symptom.id == symptom_id).first()
    if not symptom:
        raise HTTPException(status_code=404, detail="Symptom not found")
    return symptom


@router.delete("/{symptom_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_symptom(symptom_id: int, db: Session = Depends(get_db)):
    symptom = db.query(models.Symptom).filter(models.Symptom.id == symptom_id).first()
    if not symptom:
        raise HTTPException(status_code=404, detail="Symptom not found")
    db.delete(symptom)
    db.commit()
