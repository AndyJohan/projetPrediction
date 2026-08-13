import joblib
import numpy as np
import pandas as pd
from pathlib import Path

from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

try:
    from .common import get_feature_columns
except ImportError:
    from common import get_feature_columns


STATUT_LABELS = {
    0: "Sain",
    1: "Risque",
}

SEUILS_A_TESTER = [0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70]
RANDOM_STATES_VALIDATION = [21, 42, 84]
MIN_RECALL_RISQUE = 0.60

PARAM_GRID = [
    {"max_depth": 10, "min_samples_leaf": 3},
    {"max_depth": 10, "min_samples_leaf": 5},
    {"max_depth": 12, "min_samples_leaf": 3},
    {"max_depth": 12, "min_samples_leaf": 5},
    {"max_depth": 15, "min_samples_leaf": 5},
    {"max_depth": 15, "min_samples_leaf": 10},
]


def charger_dataset(chemin_csv):
    if not chemin_csv.exists():
        raise FileNotFoundError(
            f"Le dataset est introuvable : {chemin_csv}. Avez-vous execute pipeline.py ?"
        )

    df = pd.read_csv(chemin_csv)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    return df


def _resolve_dataset_path(dossier_parent: Path) -> Path:
    chemin_entree = dossier_parent / "dataset_pipeline.csv"
    if not chemin_entree.exists():
        chemin_entree = dossier_parent / "dataset_pipeline_export.csv"
    return chemin_entree


def creer_random_forest(max_depth, min_samples_leaf, random_state=42, n_estimators=150):
    return RandomForestClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        min_samples_leaf=min_samples_leaf,
        max_features="sqrt",
        class_weight="balanced_subsample",
        random_state=random_state,
        n_jobs=-1,
    )


def filtrer_features_constantes(df_trainable, features):
    features_utiles = [
        feature for feature in features if df_trainable[feature].nunique(dropna=False) > 1
    ]
    features_supprimees = [feature for feature in features if feature not in features_utiles]

    if features_supprimees:
        print("\n--- Features supprimees car constantes/inutiles ---")
        for feature in features_supprimees:
            print(f"- {feature}")

    return features_utiles


def calculer_metriques(y_true, proba_risque, seuil):
    y_pred = (proba_risque >= seuil).astype(int)
    matrice = confusion_matrix(y_true, y_pred, labels=[0, 1])
    tn, fp, fn, tp = matrice.ravel()

    precision_risque = tp / max(tp + fp, 1)
    recall_risque = tp / max(tp + fn, 1)
    f1_risque = (2 * precision_risque * recall_risque) / max(
        precision_risque + recall_risque,
        1e-12,
    )
    beta = 2
    f2_risque = ((1 + beta**2) * precision_risque * recall_risque) / max(
        (beta**2 * precision_risque) + recall_risque,
        1e-12,
    )
    accuracy = (tp + tn) / max(tp + tn + fp + fn, 1)

    return {
        "seuil": seuil,
        "precision_risque": precision_risque,
        "recall_risque": recall_risque,
        "f1_risque": f1_risque,
        "f2_risque": f2_risque,
        "accuracy": accuracy,
        "faux_risques": fp,
        "risques_rates": fn,
        "vrais_risques": tp,
        "vrais_sains": tn,
    }


def split_by_equipment(df, random_state):
    id_equipements = df["equipement_id"].unique()
    eq_train, eq_test = train_test_split(
        id_equipements,
        test_size=0.20,
        random_state=random_state,
    )

    df_train = df[df["equipement_id"].isin(eq_train)]
    df_test = df[df["equipement_id"].isin(eq_test)]
    return df_train, df_test, eq_train, eq_test


def optimiser_hyperparametres_et_seuil(df_trainable, features, target):
    resultats_par_cle = {}

    print("\n--- Validation multi-splits par equipement ---")
    for params in PARAM_GRID:
        print(
            f"Validation params max_depth={params['max_depth']}, "
            f"min_samples_leaf={params['min_samples_leaf']}"
        )

        for random_state in RANDOM_STATES_VALIDATION:
            df_train, df_test, _, _ = split_by_equipment(df_trainable, random_state)
            X_train = df_train[features]
            y_train = df_train[target]
            X_test = df_test[features]
            y_test = df_test[target]

            modele = creer_random_forest(
                max_depth=params["max_depth"],
                min_samples_leaf=params["min_samples_leaf"],
                random_state=random_state,
                n_estimators=100,
            )
            modele.fit(X_train, y_train)
            proba_risque = modele.predict_proba(X_test)[:, 1]

            for seuil in SEUILS_A_TESTER:
                cle = (params["max_depth"], params["min_samples_leaf"], seuil)
                resultats_par_cle.setdefault(cle, []).append(
                    calculer_metriques(y_test, proba_risque, seuil)
                )

    resultats = []
    for (max_depth, min_samples_leaf, seuil), metriques_splits in resultats_par_cle.items():
        resultats.append(
            {
                "max_depth": max_depth,
                "min_samples_leaf": min_samples_leaf,
                "seuil": seuil,
                "precision_risque": np.mean([m["precision_risque"] for m in metriques_splits]),
                "recall_risque": np.mean([m["recall_risque"] for m in metriques_splits]),
                "f1_risque": np.mean([m["f1_risque"] for m in metriques_splits]),
                "f2_risque": np.mean([m["f2_risque"] for m in metriques_splits]),
                "accuracy": np.mean([m["accuracy"] for m in metriques_splits]),
                "faux_risques": np.mean([m["faux_risques"] for m in metriques_splits]),
                "risques_rates": np.mean([m["risques_rates"] for m in metriques_splits]),
            }
        )

    df_resultats = pd.DataFrame(resultats)
    candidats = df_resultats[df_resultats["recall_risque"] >= MIN_RECALL_RISQUE].copy()

    if candidats.empty:
        candidats = df_resultats.copy()
        print(
            "\nAucun candidat n'atteint le recall minimal souhaite. "
            "Selection du meilleur F2 disponible."
        )

    candidats = candidats.sort_values(
        by=["f2_risque", "precision_risque", "recall_risque"],
        ascending=False,
    )
    meilleur = candidats.iloc[0].to_dict()

    print("\n--- Top 10 configurations ---")
    colonnes = [
        "max_depth",
        "min_samples_leaf",
        "seuil",
        "precision_risque",
        "recall_risque",
        "f1_risque",
        "f2_risque",
        "accuracy",
        "faux_risques",
        "risques_rates",
    ]
    print(df_resultats.sort_values(by="f2_risque", ascending=False)[colonnes].head(10))

    return meilleur


def evaluer_modele(nom_modele, modele, X_test, y_test, seuil):
    print(f"\n--- Evaluation {nom_modele} ---")
    proba_risque = modele.predict_proba(X_test)[:, 1]
    y_pred = (proba_risque >= seuil).astype(int)

    classes = sorted(STATUT_LABELS)
    noms_classes = [STATUT_LABELS[classe] for classe in classes]

    print(f"Seuil de decision Risque : {seuil:.2f}")
    print("\n--- Rapport de classification binaire ---")
    print(
        classification_report(
            y_test,
            y_pred,
            labels=classes,
            target_names=noms_classes,
            zero_division=0,
        )
    )

    print("\n--- Matrice de confusion ---")
    matrice = confusion_matrix(y_test, y_pred, labels=classes)
    print(pd.DataFrame(matrice, index=noms_classes, columns=noms_classes))

    print("\n--- Analyse par seuil sur le jeu de test final ---")
    lignes = [calculer_metriques(y_test, proba_risque, seuil_test) for seuil_test in SEUILS_A_TESTER]
    df_seuils = pd.DataFrame(lignes)
    print(
        df_seuils[
            [
                "seuil",
                "precision_risque",
                "recall_risque",
                "f1_risque",
                "f2_risque",
                "faux_risques",
                "risques_rates",
            ]
        ]
    )


def afficher_importances(nom_modele, modele, features):
    print(f"\n--- Importance des variables ({nom_modele}) ---")
    importances = modele.feature_importances_
    indices = np.argsort(importances)[::-1]
    for rang, indice in enumerate(indices, start=1):
        print(f"{rang}. {features[indice]} : {importances[indice] * 100:.2f}%")


def predire_statuts(modele, X, seuil):
    probabilites = modele.predict_proba(X)
    proba_risque = probabilites[:, 1]
    classes_predites = (proba_risque >= seuil).astype(int)
    confiance = probabilites[np.arange(len(classes_predites)), classes_predites]
    libelles = [STATUT_LABELS[classe] for classe in classes_predites]

    return classes_predites, libelles, confiance, proba_risque


def afficher_distribution(y, titre):
    print(f"\n--- {titre} ---")
    distribution = y.value_counts().sort_index()
    for classe, libelle in STATUT_LABELS.items():
        effectif = int(distribution.get(classe, 0))
        pourcentage = (effectif / len(y)) * 100 if len(y) > 0 else 0
        print(f"Classe {classe} ({libelle}) : {effectif} lignes ({pourcentage:.2f}%)")


def entrainer_modele():
    dossier_parent = Path(__file__).resolve().parent.parent
    chemin_entree = _resolve_dataset_path(dossier_parent)

    print(f"--- Chargement des donnees depuis : {chemin_entree.name} ---")
    df = charger_dataset(chemin_entree)
    df = df.sort_values(by="timestamp").reset_index(drop=True)

    target = "target_risque"
    features = get_feature_columns(df)

    for colonne in [*features, target, "equipement_id", "timestamp"]:
        if colonne not in df.columns:
            raise KeyError(f"La colonne '{colonne}' est absente du dataset. Relancez pipeline.py !")

    df_trainable = df.dropna(subset=[target]).copy()
    df_trainable[target] = df_trainable[target].astype(int)
    features = filtrer_features_constantes(df_trainable, features)

    print(f"Nombre total de lignes dans le dataset : {len(df)}")
    print(f"Nombre total de lignes utilisees pour l'entrainement : {len(df_trainable)}")
    afficher_distribution(df_trainable[target], "Distribution de la cible target_risque")

    meilleur = optimiser_hyperparametres_et_seuil(df_trainable, features, target)
    meilleur_seuil = float(meilleur["seuil"])
    meilleur_max_depth = int(meilleur["max_depth"])
    meilleur_min_samples_leaf = int(meilleur["min_samples_leaf"])

    print("\n--- Configuration retenue ---")
    print(f"max_depth : {meilleur_max_depth}")
    print(f"min_samples_leaf : {meilleur_min_samples_leaf}")
    print(f"seuil risque : {meilleur_seuil:.2f}")
    print(f"F2 moyen validation : {meilleur['f2_risque']:.4f}")
    print(f"Precision risque moyenne : {meilleur['precision_risque']:.4f}")
    print(f"Recall risque moyen : {meilleur['recall_risque']:.4f}")

    df_train, df_test, eq_train, eq_test = split_by_equipment(df_trainable, random_state=42)
    X_train = df_train[features]
    y_train = df_train[target]
    X_test = df_test[features]
    y_test = df_test[target]
    timestamps_test = df_test["timestamp"]

    print(f"\nEquipements entrainement final : {len(eq_train)} | Equipements test final : {len(eq_test)}")
    print(f"Lignes d'entrainement final : {len(X_train)} | Lignes de test final : {len(X_test)}")
    afficher_distribution(y_test, "Distribution de la cible dans le jeu de test final")

    print("\n--- Entrainement du RandomForest final ---")
    modele_final = creer_random_forest(
        max_depth=meilleur_max_depth,
        min_samples_leaf=meilleur_min_samples_leaf,
        random_state=42,
    )
    modele_final.fit(X_train, y_train)
    print("RandomForest entraine avec succes !")

    print("\n--- Evaluation des performances finales ---")
    evaluer_modele("RandomForestClassifier", modele_final, X_test, y_test, meilleur_seuil)
    afficher_importances("RandomForestClassifier", modele_final, features)

    classes_predites, libelles, confiance, proba_risque = predire_statuts(
        modele_final,
        X_test,
        meilleur_seuil,
    )
    apercu_predictions = pd.DataFrame(
        {
            "timestamp_reference": timestamps_test.reset_index(drop=True).dt.strftime("%Y-%m-%d %H:%M:%S"),
            "classe_predite": classes_predites,
            "statut_predit": libelles,
            "confiance": np.round(confiance, 4),
            "probabilite_risque": np.round(proba_risque, 4),
        }
    )
    print("\n--- Apercu des statuts predits avec RandomForest ---")
    print(apercu_predictions.head(10))

    dossier_modeles = dossier_parent / "models"
    dossier_modeles.mkdir(exist_ok=True)

    metadata = {
        "features": features,
        "target": target,
        "model_type": "binary_classifier",
        "algorithm": "RandomForestClassifier",
        "classes": STATUT_LABELS,
        "risk_horizon_hours": 360,
        "risk_threshold": meilleur_seuil,
        "selected_params": {
            "n_estimators": 150,
            "max_depth": meilleur_max_depth,
            "min_samples_leaf": meilleur_min_samples_leaf,
            "max_features": "sqrt",
            "class_weight": "balanced_subsample",
        },
        "validation": {
            "random_states": RANDOM_STATES_VALIDATION,
            "thresholds_tested": SEUILS_A_TESTER,
            "selection_metric": "F2 risque avec recall minimal",
            "min_recall_risque": MIN_RECALL_RISQUE,
        },
        "feature_importances": {
            feature: float(importance)
            for feature, importance in zip(features, modele_final.feature_importances_)
        },
        "prediction_fields": [
            "predictedStatus",
            "predictedStatusLabel",
            "confidence",
            "riskProbability",
        ],
        "prediction_rule": "Classe 1 Risque si une panne est prevue sous 15 jours et si la probabilite de risque atteint le seuil optimise.",
    }

    chemin_modele_rf = dossier_modeles / "rf_risk_status_classifier.joblib"
    joblib.dump({"model": modele_final, **metadata}, chemin_modele_rf)

    print(f"\nRandomForest sauvegarde dans : {chemin_modele_rf}")


if __name__ == "__main__":
    entrainer_modele()
