import os

import pandas as pd
import psycopg2


def get_conn_params():
    password = os.getenv("DB_PASSWORD")
    if not password:
        raise RuntimeError("DB_PASSWORD doit etre configure dans l'environnement.")

    return {
        "host": os.getenv("DB_HOST", "localhost"),
        "database": os.getenv("DB_NAME", "prediction"),
        "user": os.getenv("DB_USER", "prediction_app"),
        "password": password,
        "port": int(os.getenv("DB_PORT", "5432")),
    }


def get_pannes_data():
    conn_params = get_conn_params()

    try:
        conn = psycopg2.connect(**conn_params)

        query_pannes = """
            SELECT "ID" as panne_id, heure, dates, commentaires, equipement_id
            FROM "Pannes";
        """
        query_equipements = """
            SELECT "ID" as equipement_id, "nomEquipement", categorie
            FROM "equipements";
        """

        df_pannes = pd.read_sql_query(query_pannes, conn)
        df_equipements = pd.read_sql_query(query_equipements, conn)
        conn.close()

        df_pannes["equipement_id"] = pd.to_numeric(
            df_pannes["equipement_id"],
            errors="coerce",
        ).astype("Int64")
        df_equipements["equipement_id"] = pd.to_numeric(
            df_equipements["equipement_id"],
            errors="coerce",
        ).astype("Int64")

        df = df_pannes.merge(df_equipements, on="equipement_id", how="left")

        equipements_sans_categorie = sorted(
            df.loc[df["categorie"].isna(), "equipement_id"]
            .dropna()
            .astype(int)
            .unique()
            .tolist()
        )
        print(f"Equipements sans categorie apres merge : {equipements_sans_categorie}")

        return df

    except Exception as e:
        print(f"Erreur lors de la connexion a la base de donnees : {e}")
        return None


def get_capteurs_logs():
    """Charge les logs capteurs si la table existe, sinon retourne None."""
    conn_params = get_conn_params()

    query = """
        SELECT
            equipement_id,
            timestamp::date AS timestamp,
            erreurs,
            alertes,
            cpu_moyen,
            mem_moyen
        FROM capteurs_logs;
    """

    try:
        conn = psycopg2.connect(**conn_params)
        df = pd.read_sql_query(query, conn)
        conn.close()
        if df.empty:
            return None
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        return df
    except Exception:
        return None


if __name__ == "__main__":
    print("Tentative de recuperation des donnees...")
    data = get_pannes_data()
    if data is not None:
        print("Connexion reussie !")
        print(f"Nombre de lignes recuperees : {len(data)}")
        print(data.head())
