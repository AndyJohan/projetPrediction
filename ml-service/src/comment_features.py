import re

import pandas as pd

COMMENT_CATEGORIES = {
    "comment_hs": re.compile(r"(?i)\b(h/s|hs|hors service)\b"),
    "comment_liaison": re.compile(r"(?i)(liaison|vsat|r[eé]seau|amhs|synergy|smt|aftn)"),
    "comment_reset": re.compile(r"(?i)(reset|red[eé]marr|reboot|relance)"),
    "comment_sans_intervention": re.compile(r"(?i)(sans intervention|ok sans)"),
    "comment_perturbation": re.compile(r"(?i)(perturbation|intermittence|instable)"),
}


def normaliser_commentaire(texte) -> str:
    if pd.isna(texte):
        return ""
    return str(texte).strip()


def classifier_commentaire(texte: str) -> dict[str, int]:
    commentaire = normaliser_commentaire(texte)
    return {
        categorie: int(bool(pattern.search(commentaire)))
        for categorie, pattern in COMMENT_CATEGORIES.items()
    }


def enrichir_pannes_commentaires(df_pannes: pd.DataFrame) -> pd.DataFrame:
    resultat = df_pannes.copy()
    for categorie in COMMENT_CATEGORIES:
        resultat[categorie] = 0

    for index, ligne in resultat.iterrows():
        flags = classifier_commentaire(ligne.get("commentaires", ""))
        for categorie, valeur in flags.items():
            resultat.at[index, categorie] = valeur

    return resultat


def ajouter_fenetres_commentaires(df_frise: pd.DataFrame, fenetre_jours: int = 30) -> pd.DataFrame:
    resultat = df_frise.copy()
    colonnes_commentaires = list(COMMENT_CATEGORIES.keys())

    for categorie in colonnes_commentaires:
        if categorie not in resultat.columns:
            resultat[categorie] = 0

    for categorie in colonnes_commentaires:
        nom_fenetre = f"{categorie}_{fenetre_jours}j"
        resultat[nom_fenetre] = (
            resultat.groupby("equipement_id")[categorie]
            .transform(lambda serie: serie.rolling(window=fenetre_jours, closed="left", min_periods=1).sum())
            .fillna(0)
        )
        resultat = resultat.drop(columns=[categorie])

    return resultat
