import numpy as np
import pandas as pd


def ajouter_stats_equipement(df_frise: pd.DataFrame, df_pannes: pd.DataFrame) -> pd.DataFrame:
    resultat = df_frise.sort_values(by=["equipement_id", "timestamp"]).copy()
    evenements = (
        df_pannes[["equipement_id", "timestamp"]]
        .drop_duplicates()
        .sort_values(by=["equipement_id", "timestamp"])
        .copy()
    )
    evenements["interval_jours"] = (
        evenements.groupby("equipement_id")["timestamp"].diff().dt.total_seconds().div(86400)
    )

    evenements["intervalle_median_pannes_jours"] = evenements.groupby("equipement_id")[
        "interval_jours"
    ].transform(lambda serie: serie.shift(1).expanding().median())
    evenements["mtbf_jours"] = evenements.groupby("equipement_id")["interval_jours"].transform(
        lambda serie: serie.shift(1).expanding().mean()
    )

    premieres_pannes = evenements.groupby("equipement_id")["timestamp"].transform("min")
    evenements["mois_depuis_premiere_panne"] = (
        (evenements["timestamp"] - premieres_pannes).dt.total_seconds().div(86400 * 30).clip(lower=1 / 30)
    )
    evenements["rang_panne"] = evenements.groupby("equipement_id").cumcount()
    evenements["taux_panne_mois"] = evenements["rang_panne"] / evenements["mois_depuis_premiere_panne"]

    colonnes_stats = [
        "equipement_id",
        "timestamp",
        "intervalle_median_pannes_jours",
        "mtbf_jours",
        "taux_panne_mois",
    ]
    stats = evenements[colonnes_stats].dropna(subset=["timestamp"]).copy()
    stats["timestamp"] = pd.to_datetime(stats["timestamp"]).dt.floor("D")

    blocs = []
    for equip_id, frise in resultat.groupby("equipement_id"):
        stats_equip = stats[stats["equipement_id"] == equip_id].sort_values("timestamp")
        frise = frise.sort_values("timestamp").copy()

        if stats_equip.empty:
            frise["intervalle_median_pannes_jours"] = np.nan
            frise["mtbf_jours"] = np.nan
            frise["taux_panne_mois"] = 0.0
        else:
            fusion = pd.merge_asof(
                frise,
                stats_equip.drop(columns=["equipement_id"]),
                on="timestamp",
                direction="backward",
            )
            frise = fusion

        blocs.append(frise)

    enrichi = pd.concat(blocs).sort_values(by=["equipement_id", "timestamp"])
    enrichi["intervalle_median_pannes_jours"] = enrichi["intervalle_median_pannes_jours"].fillna(30)
    enrichi["mtbf_jours"] = enrichi["mtbf_jours"].fillna(30)
    enrichi["taux_panne_mois"] = enrichi["taux_panne_mois"].fillna(0)
    return enrichi


def ajouter_tendance_pannes(df_features: pd.DataFrame) -> pd.DataFrame:
    resultat = df_features.copy()
    taux_7j = resultat["pannes_7_derniers_jours"] / 7
    taux_30j = resultat["pannes_30_derniers_jours"] / 30
    resultat["tendance_pannes"] = (taux_7j - taux_30j).fillna(0)
    return resultat
