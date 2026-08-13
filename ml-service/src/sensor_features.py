from pathlib import Path

import pandas as pd

try:
    from .database import get_capteurs_logs
except ImportError:
    from database import get_capteurs_logs

SENSOR_FEATURE_COLUMNS = [
    "log_erreurs_7j",
    "log_alertes_7j",
    "log_cpu_moyen_7j",
    "log_mem_moyen_7j",
]

SENSOR_CSV_COLUMNS = [
    "equipement_id",
    "timestamp",
    "erreurs",
    "alertes",
    "cpu_moyen",
    "mem_moyen",
]


def _chemin_csv_capteurs() -> Path:
    return Path(__file__).resolve().parent.parent / "data" / "capteurs_logs.csv"


def charger_donnees_capteurs() -> pd.DataFrame | None:
    donnees = get_capteurs_logs()
    if donnees is not None and not donnees.empty:
        return donnees

    chemin_csv = _chemin_csv_capteurs()
    if chemin_csv.exists():
        csv = pd.read_csv(chemin_csv)
        if csv.empty:
            return None
        csv["timestamp"] = pd.to_datetime(csv["timestamp"]).dt.floor("D")
        csv["equipement_id"] = pd.to_numeric(csv["equipement_id"], errors="coerce").astype("Int64")
        return csv.dropna(subset=["equipement_id", "timestamp"])

    return None


def ajouter_features_capteurs(df_frise: pd.DataFrame) -> pd.DataFrame:
    resultat = df_frise.sort_values(by=["equipement_id", "timestamp"]).copy()
    capteurs = charger_donnees_capteurs()

    for colonne in SENSOR_FEATURE_COLUMNS:
        resultat[colonne] = 0.0

    if capteurs is None or capteurs.empty:
        print(
            "Capteurs/logs indisponibles : colonnes log_* initialisees a 0. "
            "Ajoutez la table capteurs_logs ou data/capteurs_logs.csv."
        )
        return resultat

    capteurs = capteurs.copy()
    capteurs["equipement_id"] = capteurs["equipement_id"].astype(int)
    capteurs = capteurs.sort_values(by=["equipement_id", "timestamp"])

    mapping = {
        "erreurs": "log_erreurs_7j",
        "alertes": "log_alertes_7j",
        "cpu_moyen": "log_cpu_moyen_7j",
        "mem_moyen": "log_mem_moyen_7j",
    }

    blocs = []
    for equip_id, frise in resultat.groupby("equipement_id"):
        frise = frise.sort_values("timestamp").copy()
        logs_equip = capteurs[capteurs["equipement_id"] == equip_id]

        if logs_equip.empty:
            blocs.append(frise)
            continue

        fusion = pd.merge_asof(
            frise,
            logs_equip.drop(columns=["equipement_id"]),
            on="timestamp",
            direction="backward",
        )

        for source, cible in mapping.items():
            if source in fusion.columns:
                fusion[cible] = (
                    fusion.groupby("equipement_id")[source]
                    .transform(lambda serie: serie.rolling(window=7, closed="left", min_periods=1).mean())
                    .fillna(0)
                )

        blocs.append(fusion)

    return pd.concat(blocs).sort_values(by=["equipement_id", "timestamp"])
