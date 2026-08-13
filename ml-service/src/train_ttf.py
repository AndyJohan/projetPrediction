"""Entrainement optimise du classifieur d'intervalles de panne (horizon 15 jours)."""

import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, f1_score

try:
    from .common import (
        HORIZON_HOURS,
        INTERVAL_MODEL_FILENAME,
        TARGET_HOURS,
        TARGET_INTERVAL,
        filter_horizon_dataset,
        get_feature_columns,
        get_ml_root,
        load_dataset,
        split_by_equipment,
    )
except ImportError:
    from common import (
        HORIZON_HOURS,
        INTERVAL_MODEL_FILENAME,
        TARGET_HOURS,
        TARGET_INTERVAL,
        filter_horizon_dataset,
        get_feature_columns,
        get_ml_root,
        load_dataset,
        split_by_equipment,
    )


INTERVAL_SCHEMES = [
    {
        "name": "0-3j / 3-7j / 7-15j",
        "bounds": [(0, 72), (72, 168), (168, 360)],
        "labels": {0: "0-3 jours", 1: "3-7 jours", 2: "7-15 jours"},
    },
    {
        "name": "0-2j / 2-7j / 7-15j",
        "bounds": [(0, 48), (48, 168), (168, 360)],
        "labels": {0: "0-2 jours", 1: "2-7 jours", 2: "7-15 jours"},
    },
    {
        "name": "0-3j / 3-10j / 10-15j",
        "bounds": [(0, 72), (72, 240), (240, 360)],
        "labels": {0: "0-3 jours", 1: "3-10 jours", 2: "10-15 jours"},
    },
]

PARAM_GRID = [
    {"max_depth": 10, "min_samples_leaf": 3},
    {"max_depth": 10, "min_samples_leaf": 5},
    {"max_depth": 12, "min_samples_leaf": 5},
]

RANDOM_STATES_VALIDATION = [42, 84]
PREDICTION_MODES = ["argmax"]


def assign_interval_target_with_scheme(df: pd.DataFrame, scheme: dict) -> pd.DataFrame:
    resultat = df.copy()
    conditions = []

    for classe, (borne_min, borne_max) in enumerate(scheme["bounds"]):
        if classe == 0:
            conditions.append(resultat[TARGET_HOURS].le(borne_max))
        else:
            conditions.append(
                resultat[TARGET_HOURS].gt(borne_min)
                & resultat[TARGET_HOURS].le(borne_max)
            )

    resultat[TARGET_INTERVAL] = np.select(conditions, [0, 1, 2], default=2).astype(int)
    return resultat


def filtrer_features_constantes(df_horizon: pd.DataFrame, features: list[str]) -> list[str]:
    features_utiles = [
        feature for feature in features if df_horizon[feature].nunique(dropna=False) > 1
    ]
    features_supprimees = [feature for feature in features if feature not in features_utiles]

    if features_supprimees:
        print("\n--- Features supprimees car constantes/inutiles ---")
        for feature in features_supprimees:
            print(f"- {feature}")

    return features_utiles


def creer_random_forest(
    max_depth: int,
    min_samples_leaf: int,
    random_state: int = 42,
    n_estimators: int = 200,
) -> RandomForestClassifier:
    return RandomForestClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        min_samples_leaf=min_samples_leaf,
        max_features="sqrt",
        class_weight="balanced_subsample",
        random_state=random_state,
        n_jobs=-1,
    )


def predire_classes(modele, X: pd.DataFrame, mode: str) -> np.ndarray:
    if mode == "argmax":
        return modele.predict(X).astype(int)

    probabilites = modele.predict_proba(X)
    classes = modele.classes_.astype(int)
    score_ordinal = probabilites @ classes
    return np.clip(np.rint(score_ordinal), classes.min(), classes.max()).astype(int)


def calculer_metriques(y_true: pd.Series, y_pred: np.ndarray) -> dict:
    y_array = y_true.to_numpy()
    exact = (y_array == y_pred).mean()
    adjacent = (np.abs(y_array - y_pred) <= 1).mean()
    macro_f1 = f1_score(y_array, y_pred, labels=[0, 1, 2], average="macro", zero_division=0)
    weighted_f1 = f1_score(y_array, y_pred, labels=[0, 1, 2], average="weighted", zero_division=0)
    middle_f1 = f1_score(y_array, y_pred, labels=[1], average="macro", zero_division=0)
    severe_error = (np.abs(y_array - y_pred) == 2).mean()
    business_score = (0.45 * adjacent) + (0.30 * exact) + (0.20 * macro_f1) + (0.05 * middle_f1)

    return {
        "exact": exact,
        "adjacent": adjacent,
        "macro_f1": macro_f1,
        "weighted_f1": weighted_f1,
        "middle_f1": middle_f1,
        "severe_error": severe_error,
        "business_score": business_score,
    }


def optimiser_configuration(df_horizon_base: pd.DataFrame, features: list[str]) -> dict:
    resultats = []

    print("\n--- Validation multi-splits des intervalles ---")
    for scheme_index, scheme in enumerate(INTERVAL_SCHEMES):
        df_horizon = assign_interval_target_with_scheme(df_horizon_base, scheme)
        print(f"Schema teste : {scheme['name']}")

        for params in PARAM_GRID:
            for prediction_mode in PREDICTION_MODES:
                metriques_splits = []

                for random_state in RANDOM_STATES_VALIDATION:
                    df_train, df_test, _, _ = split_by_equipment(
                        df_horizon,
                        random_state=random_state,
                    )

                    X_train = df_train[features]
                    y_train = df_train[TARGET_INTERVAL]
                    X_test = df_test[features]
                    y_test = df_test[TARGET_INTERVAL]

                    modele = creer_random_forest(
                        max_depth=params["max_depth"],
                        min_samples_leaf=params["min_samples_leaf"],
                        random_state=random_state,
                        n_estimators=120,
                    )
                    modele.fit(X_train, y_train)
                    y_pred = predire_classes(modele, X_test, prediction_mode)
                    metriques_splits.append(calculer_metriques(y_test, y_pred))

                resultats.append(
                    {
                        "scheme_index": scheme_index,
                        "scheme_name": scheme["name"],
                        "prediction_mode": prediction_mode,
                        **params,
                        "exact": np.mean([m["exact"] for m in metriques_splits]),
                        "adjacent": np.mean([m["adjacent"] for m in metriques_splits]),
                        "macro_f1": np.mean([m["macro_f1"] for m in metriques_splits]),
                        "weighted_f1": np.mean([m["weighted_f1"] for m in metriques_splits]),
                        "middle_f1": np.mean([m["middle_f1"] for m in metriques_splits]),
                        "severe_error": np.mean([m["severe_error"] for m in metriques_splits]),
                        "business_score": np.mean([m["business_score"] for m in metriques_splits]),
                    }
                )

    df_resultats = pd.DataFrame(resultats)
    df_resultats = df_resultats.sort_values(
        by=["business_score", "adjacent", "exact", "middle_f1"],
        ascending=False,
    )

    print("\n--- Top 10 configurations intervalle ---")
    print(
        df_resultats[
            [
                "scheme_name",
                "prediction_mode",
                "max_depth",
                "min_samples_leaf",
                "exact",
                "adjacent",
                "macro_f1",
                "middle_f1",
                "severe_error",
                "business_score",
            ]
        ].head(10)
    )

    return df_resultats.iloc[0].to_dict()


def afficher_importances(nom_modele: str, modele, features: list[str]) -> None:
    print(f"\n--- Importance des variables ({nom_modele}) ---")
    importances = modele.feature_importances_
    indices = np.argsort(importances)[::-1]
    for rang, indice in enumerate(indices, start=1):
        print(f"{rang}. {features[indice]} : {importances[indice] * 100:.2f} %")


def evaluer_intervalles(
    nom_modele: str,
    modele,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    labels: dict[int, str],
    prediction_mode: str,
) -> pd.DataFrame:
    print(f"\n--- Evaluation {nom_modele} ---")
    y_pred = predire_classes(modele, X_test, prediction_mode)
    classes = sorted(labels)
    noms_classes = [labels[c] for c in classes]

    print(f"Mode de prediction : {prediction_mode}")
    print("\n--- Rapport de classification par intervalle ---")
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

    metriques = calculer_metriques(y_test, y_pred)
    print(f"\nPrecision intervalle exact : {metriques['exact'] * 100:.1f} %")
    print(f"Precision intervalle adjacent (+/- 1 classe) : {metriques['adjacent'] * 100:.1f} %")
    print(f"Erreurs graves (saut de 2 classes) : {metriques['severe_error'] * 100:.1f} %")
    print(f"F1 macro : {metriques['macro_f1']:.3f}")
    print(f"F1 classe centrale : {metriques['middle_f1']:.3f}")

    return pd.DataFrame(
        {
            "intervalle_reel": y_test.reset_index(drop=True),
            "intervalle_pred": y_pred,
            "intervalle_reel_libelle": [labels[int(v)] for v in y_test],
            "intervalle_pred_libelle": [labels[int(v)] for v in y_pred],
            "exact": y_test.to_numpy() == y_pred,
            "adjacent": np.abs(y_test.to_numpy() - y_pred) <= 1,
        }
    )


def afficher_distribution_intervalles(df_horizon: pd.DataFrame, labels: dict[int, str]) -> None:
    print("\n--- Distribution des intervalles ---")
    distribution = df_horizon[TARGET_INTERVAL].value_counts().sort_index()
    for classe, libelle in labels.items():
        effectif = int(distribution.get(classe, 0))
        pourcentage = (effectif / len(df_horizon)) * 100 if len(df_horizon) else 0
        print(f"  {libelle} : {effectif} ({pourcentage:.1f} %)")


def entrainer_modele_intervalle() -> Path:
    print("=== Modele 2 : intervalle de panne optimise ===")
    print(f"Horizon d'entrainement limite a {HORIZON_HOURS} h ({HORIZON_HOURS / 24:.0f} jours)")

    df = load_dataset()
    features = get_feature_columns(df)
    df_horizon_base = filter_horizon_dataset(df, HORIZON_HOURS)

    if df_horizon_base.empty:
        raise RuntimeError("Aucune ligne dans l'horizon 15 jours.")

    features = filtrer_features_constantes(df_horizon_base, features)

    print(f"Lignes totales dataset : {len(df)}")
    print(f"Lignes dans l'horizon <= 15 j : {len(df_horizon_base)}")
    print(f"Lignes exclues (> 15 j ou sans cible) : {len(df) - len(df_horizon_base)}")

    meilleure_config = optimiser_configuration(df_horizon_base, features)
    scheme = INTERVAL_SCHEMES[int(meilleure_config["scheme_index"])]
    labels = scheme["labels"]
    prediction_mode = str(meilleure_config["prediction_mode"])

    df_horizon = assign_interval_target_with_scheme(df_horizon_base, scheme)
    afficher_distribution_intervalles(df_horizon, labels)

    print("\n--- Configuration retenue ---")
    print(f"Schema : {scheme['name']}")
    print(f"Mode prediction : {prediction_mode}")
    print(f"max_depth : {int(meilleure_config['max_depth'])}")
    print(f"min_samples_leaf : {int(meilleure_config['min_samples_leaf'])}")
    print(f"Exact moyen validation : {meilleure_config['exact'] * 100:.1f} %")
    print(f"Adjacent moyen validation : {meilleure_config['adjacent'] * 100:.1f} %")
    print(f"F1 macro moyen validation : {meilleure_config['macro_f1']:.3f}")
    print(f"F1 classe centrale moyen validation : {meilleure_config['middle_f1']:.3f}")

    df_train, df_test, eq_train, eq_test = split_by_equipment(df_horizon, random_state=42)
    X_train = df_train[features]
    y_train = df_train[TARGET_INTERVAL]
    X_test = df_test[features]
    y_test = df_test[TARGET_INTERVAL]

    print(f"\nEquipements entrainement : {len(eq_train)} | test : {len(eq_test)}")
    print(f"Lignes entrainement : {len(X_train)} | test : {len(X_test)}")

    print("\n--- Entrainement RandomForestClassifier (intervalles optimise) ---")
    modele = creer_random_forest(
        max_depth=int(meilleure_config["max_depth"]),
        min_samples_leaf=int(meilleure_config["min_samples_leaf"]),
        random_state=42,
    )
    modele.fit(X_train, y_train)
    print("Entrainement termine.")

    rapport = evaluer_intervalles(
        "Classifieur d'intervalles optimise",
        modele,
        X_test,
        y_test,
        labels,
        prediction_mode,
    )
    rapport.insert(0, "equipement_id", df_test["equipement_id"].reset_index(drop=True))
    rapport.insert(1, "timestamp_reference", df_test["timestamp"].reset_index(drop=True).dt.strftime("%Y-%m-%d %H:%M:%S"))
    rapport.insert(2, "heures_reelles", df_test[TARGET_HOURS].reset_index(drop=True).round(2))
    afficher_importances("Classifieur d'intervalles optimise", modele, features)

    root = get_ml_root()
    models_dir = root / "models"
    results_dir = root / "results"
    models_dir.mkdir(exist_ok=True)
    results_dir.mkdir(exist_ok=True)

    rapport.to_csv(results_dir / "ttf_interval_test_predictions.csv", index=False, encoding="utf-8-sig")
    print(f"\nPredictions de test exportees : {results_dir / 'ttf_interval_test_predictions.csv'}")

    metadata = {
        "model": modele,
        "features": features,
        "target": TARGET_INTERVAL,
        "source_target_hours": TARGET_HOURS,
        "model_type": "failure_interval_classifier",
        "algorithm": "RandomForestClassifier",
        "horizon_hours": HORIZON_HOURS,
        "interval_scheme_name": scheme["name"],
        "interval_bounds_hours": scheme["bounds"],
        "interval_labels": labels,
        "prediction_mode": prediction_mode,
        "selected_params": {
            "n_estimators": 250,
            "max_depth": int(meilleure_config["max_depth"]),
            "min_samples_leaf": int(meilleure_config["min_samples_leaf"]),
            "max_features": "sqrt",
            "class_weight": "balanced_subsample",
        },
        "validation": {
            "random_states": RANDOM_STATES_VALIDATION,
            "schemes_tested": [scheme_item["name"] for scheme_item in INTERVAL_SCHEMES],
            "prediction_modes_tested": PREDICTION_MODES,
            "selection_metric": "business_score = 0.45 adjacent + 0.30 exact + 0.20 macro_f1 + 0.05 middle_f1",
            "best_exact": float(meilleure_config["exact"]),
            "best_adjacent": float(meilleure_config["adjacent"]),
            "best_macro_f1": float(meilleure_config["macro_f1"]),
            "best_middle_f1": float(meilleure_config["middle_f1"]),
        },
        "feature_importances": {
            feature: float(importance)
            for feature, importance in zip(features, modele.feature_importances_)
        },
        "pipeline": {
            "step_1": "rf_risk_status_classifier.joblib",
            "step_2": "rf_failure_interval_classifier.joblib (si risque eleve)",
            "rule": "L'intervalle n'est predit que si l'etape 1 detecte un risque sous 15 jours.",
        },
        "split": {
            "method": "by_equipment_id",
            "test_size": 0.20,
            "random_state": 42,
            "train_equipment_count": len(eq_train),
            "test_equipment_count": len(eq_test),
        },
    }

    model_path = models_dir / INTERVAL_MODEL_FILENAME
    joblib.dump(metadata, model_path)
    print(f"Modele sauvegarde : {model_path}")
    return model_path


if __name__ == "__main__":
    entrainer_modele_intervalle()
