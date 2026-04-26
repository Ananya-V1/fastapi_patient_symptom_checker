"""
Seed the database with fake patients, their reported symptoms, and assessments.
Run with:  python seed.py
"""
import random
from datetime import datetime, timedelta
from faker import Faker
from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
from models import Patient, Symptom, PatientSymptom, Assessment

fake = Faker()
fake_in = Faker("en_IN")
random.seed(42)

SYMPTOMS = [
    ("Fever", "Elevated body temperature above 38°C", "general"),
    ("Cough", "Persistent dry or productive cough", "respiratory"),
    ("Shortness of Breath", "Difficulty breathing or feeling breathless", "respiratory"),
    ("Chest Pain", "Tightness or pain in the chest area", "cardiac"),
    ("Headache", "Pain or pressure in the head", "neurological"),
    ("Fatigue", "Unusual tiredness or lack of energy", "general"),
    ("Nausea", "Urge to vomit or queasy feeling", "gastrointestinal"),
    ("Vomiting", "Forceful expulsion of stomach contents", "gastrointestinal"),
    ("Diarrhea", "Loose or watery stools occurring frequently", "gastrointestinal"),
    ("Sore Throat", "Pain or irritation in the throat", "respiratory"),
    ("Runny Nose", "Excess mucus discharge from the nose", "respiratory"),
    ("Dizziness", "Feeling of lightheadedness or vertigo", "neurological"),
    ("Muscle Aches", "Soreness or pain in muscles", "musculoskeletal"),
    ("Joint Pain", "Pain or swelling in one or more joints", "musculoskeletal"),
    ("Rash", "Visible skin irritation or discoloration", "dermatological"),
    ("Abdominal Pain", "Pain or cramping in the stomach area", "gastrointestinal"),
    ("Loss of Appetite", "Reduced desire to eat", "general"),
    ("Chills", "Feeling cold with shivering", "general"),
    ("Sweating", "Excessive perspiration especially at night", "general"),
    ("Back Pain", "Pain in the lower, middle, or upper back", "musculoskeletal"),
]

RECOMMENDED_ACTIONS = ["monitor_at_home", "visit_clinic", "go_to_er", "schedule_followup"]

# Bias: mild severity → home; high severity → ER
def recommended_action_for(max_severity: int) -> str:
    if max_severity >= 9:
        return random.choices(["go_to_er", "visit_clinic"], weights=[70, 30])[0]
    if max_severity >= 7:
        return random.choices(["visit_clinic", "schedule_followup"], weights=[60, 40])[0]
    if max_severity >= 4:
        return random.choices(["monitor_at_home", "schedule_followup", "visit_clinic"], weights=[40, 40, 20])[0]
    return "monitor_at_home"


def random_past_datetime(days_back: int = 180) -> datetime:
    return datetime.utcnow() - timedelta(
        days=random.randint(0, days_back),
        hours=random.randint(0, 23),
        minutes=random.randint(0, 59),
    )


def seed():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        # ── Symptoms ──────────────────────────────────────────────────────────
        print("Seeding symptoms...")
        symptom_objects: list[Symptom] = []
        for name, desc, cat in SYMPTOMS:
            existing = db.query(Symptom).filter(Symptom.name == name).first()
            if existing:
                symptom_objects.append(existing)
            else:
                s = Symptom(name=name, description=desc, category=cat)
                db.add(s)
                db.flush()
                symptom_objects.append(s)
        db.commit()
        print(f"  {len(symptom_objects)} symptoms ready.")

        # ── Patients ──────────────────────────────────────────────────────────
        print("Seeding 100 patients...")
        seen_emails: set[str] = set()
        patients_created = 0

        while patients_created < 100:
            email = fake.unique.email()
            if email in seen_emails:
                continue
            seen_emails.add(email)

            gender = random.choice(["male", "female", "other"])
            created_at = random_past_datetime(365)

            patient = Patient(
                name=fake.name(),
                age=random.randint(5, 90),
                gender=gender,
                contact_email=email,
                created_at=created_at,
            )
            db.add(patient)
            db.flush()

            # ── Patient Symptoms (1–5 per patient) ────────────────────────────
            num_symptoms = random.randint(1, 5)
            chosen_symptoms = random.sample(symptom_objects, k=num_symptoms)
            severities = []

            for symptom in chosen_symptoms:
                severity = random.randint(1, 10)
                severities.append(severity)
                ps = PatientSymptom(
                    patient_id=patient.id,
                    symptom_id=symptom.id,
                    severity=severity,
                    duration_days=random.randint(1, 14),
                    reported_at=created_at + timedelta(hours=random.randint(1, 48)),
                )
                db.add(ps)

            # ── Assessment (80 % of patients get one) ─────────────────────────
            if random.random() < 0.8:
                max_sev = max(severities)
                action = recommended_action_for(max_sev)
                assessment = Assessment(
                    patient_id=patient.id,
                    notes=fake.sentence(nb_words=12),
                    recommended_action=action,
                    created_at=created_at + timedelta(hours=random.randint(2, 72)),
                )
                db.add(assessment)

            patients_created += 1
            if patients_created % 10 == 0:
                db.commit()
                print(f"  {patients_created}/100 committed...")

        db.commit()

        # ── 50 Indian Patients ────────────────────────────────────────────────
        print("Seeding 50 Indian patients...")
        indian_created = 0

        while indian_created < 50:
            email = fake_in.unique.email()
            if db.query(Patient).filter(Patient.contact_email == email).first():
                continue

            gender = random.choice(["male", "female", "other"])
            created_at = random_past_datetime(365)

            patient = Patient(
                name=fake_in.name(),
                age=random.randint(5, 90),
                gender=gender,
                contact_email=email,
                created_at=created_at,
            )
            db.add(patient)
            db.flush()

            num_symptoms = random.randint(1, 5)
            chosen_symptoms = random.sample(symptom_objects, k=num_symptoms)
            severities = []

            for symptom in chosen_symptoms:
                severity = random.randint(1, 10)
                severities.append(severity)
                ps = PatientSymptom(
                    patient_id=patient.id,
                    symptom_id=symptom.id,
                    severity=severity,
                    duration_days=random.randint(1, 14),
                    reported_at=created_at + timedelta(hours=random.randint(1, 48)),
                )
                db.add(ps)

            if random.random() < 0.8:
                max_sev = max(severities)
                action = recommended_action_for(max_sev)
                assessment = Assessment(
                    patient_id=patient.id,
                    notes=fake.sentence(nb_words=12),
                    recommended_action=action,
                    created_at=created_at + timedelta(hours=random.randint(2, 72)),
                )
                db.add(assessment)

            indian_created += 1
            if indian_created % 10 == 0:
                db.commit()
                print(f"  {indian_created}/50 committed...")

        db.commit()
        print("Done! Database seeded successfully.")

    except Exception as exc:
        db.rollback()
        raise exc
    finally:
        db.close()


if __name__ == "__main__":
    seed()
