from fastapi import FastAPI, Depends
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func
from sqlalchemy.orm import Session
from database import engine, Base, get_db
from models import Patient, Symptom, PatientSymptom, Assessment
from routers import patients, symptoms

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Patient Symptom Checker API",
    description="REST API for recording patient symptoms and generating assessments.",
    version="1.0.0",
)

app.include_router(patients.router)
app.include_router(symptoms.router)


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok"}


@app.get("/stats", tags=["Stats"])
def get_stats(db: Session = Depends(get_db)):
    assessments_by_action = dict(
        db.query(Assessment.recommended_action, func.count(Assessment.id))
        .group_by(Assessment.recommended_action)
        .all()
    )
    symptoms_by_category = dict(
        db.query(Symptom.category, func.count(Symptom.id))
        .group_by(Symptom.category)
        .all()
    )
    return {
        "total_patients": db.query(func.count(Patient.id)).scalar(),
        "total_symptoms": db.query(func.count(Symptom.id)).scalar(),
        "total_patient_symptoms": db.query(func.count(PatientSymptom.id)).scalar(),
        "total_assessments": db.query(func.count(Assessment.id)).scalar(),
        "assessments_by_action": assessments_by_action,
        "symptoms_by_category": symptoms_by_category,
    }


app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", include_in_schema=False)
def serve_ui():
    return FileResponse("static/index.html")
