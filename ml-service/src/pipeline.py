import pandas as pd
from pathlib import Path

try:
    from .comment_features import COMMENT_CATEGORIES, enrichir_pannes_commentaires, ajouter_fenetres_commentaires
    from .database import get_pannes_data
    from .equipment_stats import ajouter_stats_equipement, ajouter_tendance_pannes
    from .sensor_features import ajouter_features_capteurs
except ImportError:
    from comment_features import COMMENT_CATEGORIES, enrichir_pannes_commentaires, ajouter_fenetres_commentaires
    from database import get_pannes_data
    from equipment_stats import ajouter_stats_equipement, ajouter_tendance_pannes
    from sensor_features import ajouter_features_capteurs


GRANULARITE = "D"


def charger_donnees():
    df_brut = get_pannes_data()

    if df_brut is None:
        raise RuntimeError("Impossible de recuperer les donnees depuis la base de donnees.")

    if df_brut.empty:
        raise RuntimeError("La base de donnees ne contient aucune panne a traiter.")

    return df_brut


def nettoyage(df_brut):
    colonnes_obligatoires = {"dates", "heure", "equipement_id", "categorie"}
    colonnes_manquantes = colonnes_obligatoires.difference(df_brut.columns)

    if colonnes_manquantes:
        raise ValueError(f"Colonnes manquantes dans les donnees: {sorted(colonnes_manquantes)}")

    df_propre = df_brut.copy()
    df_propre["equipement_id"] = pd.to_numeric(df_propre["equipement_id"], errors="coerce")
    df_propre["heure"] = df_propre["heure"].fillna("00:00:00")
    df_propre["timestamp"] = pd.to_datetime(
        df_propre["dates"].astype(str) + " " + df_propre["heure"].astype(str),
        errors="coerce",
    )
    df_propre = df_propre.dropna(subset=["timestamp", "equipement_id"])
    df_propre["equipement_id"] = df_propre["equipement_id"].astype(int)
    df_propre = df_propre.sort_values(by=["equipement_id", "timestamp"])

    return enrichir_pannes_commentaires(df_propre)


def resampling(df_propre):
    blocs_equipements = []
    horizon_fin = max(
        pd.Timestamp.now().floor(GRANULARITE),
        df_propre["timestamp"].max().floor(GRANULARITE),
    )

    colonnes_commentaires = list(COMMENT_CATEGORIES.keys())
    agregations = {
        "panne_id": "first",
        "heure": "first",
        "dates": "first",
        "commentaires": "first",
        "equipement_id": "first",
        "nomEquipement": "first",
        "categorie": "first",
        **{colonne: "max" for colonne in colonnes_commentaires},
    }

    for equip_id, groupe in df_propre.groupby("equipement_id"):
        groupe = groupe.sort_values("timestamp").copy()
        nom_equipement = groupe["nomEquipement"].dropna().iloc[0] if groupe["nomEquipement"].notna().any() else pd.NA
        categorie = groupe["categorie"].dropna().iloc[0] if groupe["categorie"].notna().any() else pd.NA

        groupe["timestamp"] = groupe["timestamp"].dt.floor(GRANULARITE)
        groupe = groupe.set_index("timestamp")
        groupe = groupe.groupby(level=0).agg(agregations)

        index_journalier = pd.date_range(
            start=groupe.index.min(),
            end=horizon_fin,
            freq=GRANULARITE,
            name="timestamp",
        )
        frise = groupe.reindex(index_journalier)
        frise["panne_reelle"] = frise["panne_id"].notna().astype(int)
        frise["equipement_id"] = equip_id
        frise["nomEquipement"] = nom_equipement
        frise["categorie"] = categorie

        for colonne in colonnes_commentaires:
            frise[colonne] = frise[colonne].fillna(0).astype(int)

        blocs_equipements.append(frise)

    if not blocs_equipements:
        raise RuntimeError("Aucune frise journaliere n'a pu etre creee.")

    return pd.concat(blocs_equipements).reset_index()


def ajouter_jours_depuis_derniere_panne(df_features):
    df_calc = df_features.sort_values(by=["equipement_id", "timestamp"]).copy()
    df_calc["dernier_timestamp_panne"] = df_calc["timestamp"].where(df_calc["panne_reelle"].eq(1))
    df_calc["dernier_timestamp_panne"] = df_calc.groupby("equipement_id")["dernier_timestamp_panne"].ffill()
    df_calc["jours_depuis_derniere_panne"] = (
        df_calc["timestamp"] - df_calc["dernier_timestamp_panne"]
    ).dt.total_seconds().div(86400).fillna(30)

    return df_calc.drop(columns=["dernier_timestamp_panne"]).sort_values(by=["equipement_id", "timestamp"])


def etape_3_feature_engineering(df_frise, df_pannes):
    df_features = df_frise.copy()
    df_features = df_features.sort_values(by=["equipement_id", "timestamp"])

    df_features["jour_semaine"] = df_features["timestamp"].dt.dayofweek
    df_features["est_weekend"] = (df_features["jour_semaine"] >= 5).astype(int)
    df_features["mois"] = df_features["timestamp"].dt.month

    equipements_sans_cat = df_features[df_features["categorie"].isna()]["equipement_id"].unique()
    if len(equipements_sans_cat) > 0:
        print(f"\n⚠️ ALERTE PIPELINE : equipements sans categorie : {equipements_sans_cat}")

    df_features["categorie"] = df_features["categorie"].fillna("Inconnue")
    df_features = ajouter_jours_depuis_derniere_panne(df_features)
    df_features = pd.get_dummies(df_features, columns=["categorie"], prefix="cat")

    fenetres_jours = {
        "pannes_dernieres_1j": 1,
        "pannes_dernieres_2j": 2,
        "pannes_7_derniers_jours": 7,
        "pannes_14_derniers_jours": 14,
        "pannes_30_derniers_jours": 30,
        "pannes_90_derniers_jours": 90,
    }

    for nom_colonne, fenetre in fenetres_jours.items():
        df_features[nom_colonne] = (
            df_features.groupby("equipement_id")["panne_reelle"]
            .transform(lambda serie: serie.rolling(window=fenetre, closed="left", min_periods=1).sum())
            .fillna(0)
        )

    df_features = ajouter_stats_equipement(df_features, df_pannes)
    df_features = ajouter_tendance_pannes(df_features)
    df_features = ajouter_fenetres_commentaires(df_features, fenetre_jours=30)
    df_features = ajouter_features_capteurs(df_features)

    return df_features


def etape_4_target_labeling(df_features):
    df_final = df_features.copy()
    df_final = df_final.sort_values(by=["equipement_id", "timestamp"])

    df_final["prochaine_panne_timestamp"] = df_final["timestamp"].where(df_final["panne_reelle"].eq(1))
    df_final["prochaine_panne_timestamp"] = df_final.groupby("equipement_id")["prochaine_panne_timestamp"].bfill()

    df_final["heures_jusqu_a_prochaine_panne"] = (
        df_final["prochaine_panne_timestamp"] - df_final["timestamp"]
    ).dt.total_seconds().div(3600)

    df_final["target_risque"] = (
        df_final["heures_jusqu_a_prochaine_panne"].notna()
        & df_final["heures_jusqu_a_prochaine_panne"].le(360)
    ).astype(int)

    return df_final


def finaliser_dataset(df_final):
    dataset = df_final.copy()
    dataset["panne_id"] = dataset["panne_id"].fillna(0).astype(int)
    dataset["heure"] = dataset["heure"].fillna(dataset["timestamp"].dt.strftime("%H:%M:%S"))
    dataset["dates"] = dataset["dates"].fillna(dataset["timestamp"].dt.date.astype(str))
    dataset["commentaires"] = dataset["commentaires"].fillna("Aucune panne")
    dataset["nomEquipement"] = dataset["nomEquipement"].fillna("Inconnu")
    dataset["target_risque"] = dataset["target_risque"].astype(int)
    return dataset


def executer_pipeline():
    df_brut = charger_donnees()
    df_pannes = nettoyage(df_brut)
    df_frise = resampling(df_pannes)
    df_features = etape_3_feature_engineering(df_frise, df_pannes)
    df_final = etape_4_target_labeling(df_features)
    return finaliser_dataset(df_final)


if __name__ == "__main__":
    dataset = executer_pipeline()
    export_path = Path(__file__).resolve().parent.parent / "dataset_pipeline.csv"

    try:
        dataset.to_csv(export_path, index=False, encoding="utf-8-sig")
    except PermissionError:
        export_path = Path(__file__).resolve().parent.parent / "dataset_pipeline_export.csv"
        dataset.to_csv(export_path, index=False, encoding="utf-8-sig")

    print("\nPipeline execute avec succes.")
    print(f"Granularite : journaliere ({GRANULARITE})")
    print(f"Nombre de lignes generees : {len(dataset)}")
    print(f"Dataset exporte dans : {export_path}")
    print("\nApercu :")
    print(dataset[["timestamp", "equipement_id", "jours_depuis_derniere_panne", "heures_jusqu_a_prochaine_panne", "target_risque"]].head(10))
