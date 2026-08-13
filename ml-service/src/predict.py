import json
import sys
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd


STATUT_LABELS = {
    0: "Sain",
    1: "Risque",
}


def charger_artifact(nom_fichier):
    dossier_ml = Path(__file__).resolve().parent.parent
    chemin_modele = dossier_ml / "models" / nom_fichier

    if not chemin_modele.exists():
        raise FileNotFoundError(f"Modele introuvable: {chemin_modele}")

    return joblib.load(chemin_modele)


def lire_payload():
    if len(sys.argv) < 2:
        raise ValueError("Argument JSON manquant.")

    try:
        return json.loads(sys.argv[1])
    except json.JSONDecodeError as exc:
        raise ValueError(f"JSON invalide: {exc}") from exc


def normaliser_categorie(payload):
    return str(payload.get("categorie", "")).strip().upper()


def lire_equipement_id(payload):
    equipement_id = payload.get("equipement_id")

    if equipement_id in (None, ""):
        return None

    try:
        return int(equipement_id)
    except (TypeError, ValueError) as exc:
        raise ValueError("Champ equipement_id invalide.") from exc


def construire_vecteur_features(payload, features):
    categorie = normaliser_categorie(payload)
    ligne = {}

    for feature in features:
        if feature.startswith("cat_"):
            ligne[feature] = 1 if feature == f"cat_{categorie}" else 0
            continue

        if feature not in payload:
            raise ValueError(f"Champ numerique manquant: {feature}")

        ligne[feature] = float(payload[feature])

    return pd.DataFrame([ligne], columns=features)


def extraire_proba_classe(modele, probabilites, classe):
    classes = list(modele.classes_)
    if classe not in classes:
        raise ValueError(f"Classe {classe} absente du modele.")
    return float(probabilites[classes.index(classe)])


def predire_risque(payload, risk_artifact):
    modele = risk_artifact["model"]
    features = risk_artifact["features"]
    seuil_risque = float(risk_artifact.get("risk_threshold", 0.40))

    X = construire_vecteur_features(payload, features)
    probabilites = modele.predict_proba(X)[0]
    probabilite_risque = extraire_proba_classe(modele, probabilites, 1)
    classe_predite = int(probabilite_risque >= seuil_risque)
    confiance = probabilite_risque if classe_predite == 1 else 1 - probabilite_risque

    return {
        "X": X,
        "classe_predite": classe_predite,
        "statut_predit": STATUT_LABELS[classe_predite],
        "confiance": round(float(confiance), 4),
        "probabilite_risque": round(probabilite_risque, 4),
        "risk_threshold": seuil_risque,
        "triggerAlert": bool(classe_predite == 1),
    }


def convertir_labels_intervalle(labels):
    return {int(key): value for key, value in labels.items()}


def predire_intervalle(X, payload, interval_artifact):
    modele = interval_artifact["model"]
    probabilites = modele.predict_proba(X)[0]
    prediction_mode = interval_artifact.get("prediction_mode", "argmax")
    labels = convertir_labels_intervalle(interval_artifact["interval_labels"])
    bounds = interval_artifact["interval_bounds_hours"]

    if prediction_mode == "ordinal_expected":
        classes = modele.classes_.astype(int)
        intervalle_id = int(np.clip(np.rint(probabilites @ classes), classes.min(), classes.max()))
    else:
        intervalle_id = int(modele.classes_[np.argmax(probabilites)])

    classe_index = list(modele.classes_).index(intervalle_id)
    confiance = float(probabilites[classe_index])
    borne_min, borne_max = bounds[intervalle_id]
    heure_estimee = (float(borne_min) + float(borne_max)) / 2

    timestamp_reference = pd.to_datetime(
        payload.get("timestamp_reference") or datetime.now().isoformat()
    )
    date_debut = timestamp_reference + pd.to_timedelta(float(borne_min), unit="h")
    date_fin = timestamp_reference + pd.to_timedelta(float(borne_max), unit="h")
    date_estimee = timestamp_reference + pd.to_timedelta(heure_estimee, unit="h")

    return {
        "intervalle_id": intervalle_id,
        "intervalle_libelle": labels[intervalle_id],
        "confiance": round(confiance, 4),
        "heures_min": float(borne_min),
        "heures_max": float(borne_max),
        "heures_estimees": round(heure_estimee, 2),
        "date_debut": date_debut.floor("s").isoformat(),
        "date_fin": date_fin.floor("s").isoformat(),
        "date_estimee": date_estimee.floor("s").isoformat(),
    }


def predire():
    payload = lire_payload()
    risk_artifact = charger_artifact("rf_risk_status_classifier.joblib")
    interval_artifact = charger_artifact("rf_failure_interval_classifier.joblib")

    if risk_artifact["features"] != interval_artifact["features"]:
        raise ValueError("Les features des modeles risque et intervalle ne correspondent pas.")

    prediction_risque = predire_risque(payload, risk_artifact)
    X = prediction_risque.pop("X")

    resultat = {
        **prediction_risque,
        "equipement_id": lire_equipement_id(payload),
        "categorie": normaliser_categorie(payload),
        "estimation_prochaine_panne": None,
    }

    if prediction_risque["triggerAlert"]:
        resultat["estimation_prochaine_panne"] = predire_intervalle(X, payload, interval_artifact)

    return resultat


if __name__ == "__main__":
    try:
        print(json.dumps(predire(), ensure_ascii=False))
    except Exception as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
