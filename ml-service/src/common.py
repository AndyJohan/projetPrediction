from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split

try:
    from .sensor_features import SENSOR_FEATURE_COLUMNS
except ImportError:
    from sensor_features import SENSOR_FEATURE_COLUMNS


TARGET_HOURS = "heures_jusqu_a_prochaine_panne"
TARGET_INTERVAL = "intervalle_panne"
HORIZON_HOURS = 360
SEUIL_RISQUE = 0.40

RISK_MODEL_FILENAME = "rf_risk_status_classifier.joblib"
INTERVAL_MODEL_FILENAME = "rf_failure_interval_classifier.joblib"

INTERVAL_LABELS = {
    0: "0-3 jours",
    1: "3-7 jours",
    2: "7-15 jours",
}

INTERVAL_BOUNDS_HOURS = {
    0: (0, 72),
    1: (72, 168),
    2: (168, 360),
}

COMMENT_WINDOW_FEATURES = [
    "comment_hs_30j",
    "comment_liaison_30j",
    "comment_reset_30j",
    "comment_sans_intervention_30j",
    "comment_perturbation_30j",
]

EQUIPMENT_FEATURES = [
    "intervalle_median_pannes_jours",
    "mtbf_jours",
    "taux_panne_mois",
    "tendance_pannes",
]

ROLLING_FEATURES = [
    "jours_depuis_derniere_panne",
    "pannes_dernieres_1j",
    "pannes_dernieres_2j",
    "pannes_7_derniers_jours",
    "pannes_14_derniers_jours",
    "pannes_30_derniers_jours",
    "pannes_90_derniers_jours",
]

TEMPORAL_FEATURES = [
    "jour_semaine",
    "est_weekend",
    "mois",
]

METADATA_COLUMNS = {
    "timestamp",
    "panne_id",
    "heure",
    "dates",
    "commentaires",
    "equipement_id",
    "nomEquipement",
    "panne_reelle",
    "prochaine_panne_timestamp",
    TARGET_HOURS,
    "target_risque",
    TARGET_INTERVAL,
}


def get_ml_root() -> Path:
    return Path(__file__).resolve().parent.parent


def resolve_dataset_path() -> Path:
    root = get_ml_root()
    primary = root / "dataset_pipeline.csv"
    if primary.exists():
        return primary

    fallback = root / "dataset_pipeline_export.csv"
    if fallback.exists():
        return fallback

    raise FileNotFoundError(
        "Dataset introuvable. Executez d'abord : python src/pipeline.py"
    )


def load_dataset() -> pd.DataFrame:
    path = resolve_dataset_path()
    df = pd.read_csv(path)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    return df.sort_values(by="timestamp").reset_index(drop=True)


def get_feature_columns(df: pd.DataFrame) -> list[str]:
    cat_features = [col for col in df.columns if col.startswith("cat_")]
    colonnes_connues = [
        *TEMPORAL_FEATURES,
        *ROLLING_FEATURES,
        *EQUIPMENT_FEATURES,
        *COMMENT_WINDOW_FEATURES,
        *SENSOR_FEATURE_COLUMNS,
        *cat_features,
    ]
    return [colonne for colonne in colonnes_connues if colonne in df.columns]


def hours_to_interval(heures: float) -> int:
    if heures <= 72:
        return 0
    if heures <= 168:
        return 1
    return 2


def interval_midpoint_hours(interval_id: int) -> float:
    borne_min, borne_max = INTERVAL_BOUNDS_HOURS[interval_id]
    return (borne_min + borne_max) / 2


def assign_interval_target(df: pd.DataFrame) -> pd.DataFrame:
    resultat = df.copy()
    resultat[TARGET_INTERVAL] = resultat[TARGET_HOURS].apply(hours_to_interval).astype(int)
    return resultat


def filter_horizon_dataset(df: pd.DataFrame, horizon_hours: int = HORIZON_HOURS) -> pd.DataFrame:
    resultat = df.dropna(subset=[TARGET_HOURS]).copy()
    resultat = resultat[resultat[TARGET_HOURS].ge(0)]
    resultat = resultat[resultat[TARGET_HOURS].le(horizon_hours)]
    return assign_interval_target(resultat)


def split_by_equipment(
    df: pd.DataFrame,
    test_size: float = 0.20,
    random_state: int = 42,
) -> tuple[pd.DataFrame, pd.DataFrame, list, list]:
    equipment_ids = df["equipement_id"].unique()
    train_ids, test_ids = train_test_split(
        equipment_ids,
        test_size=test_size,
        random_state=random_state,
    )

    df_train = df[df["equipement_id"].isin(train_ids)]
    df_test = df[df["equipement_id"].isin(test_ids)]
    return df_train, df_test, train_ids, test_ids
