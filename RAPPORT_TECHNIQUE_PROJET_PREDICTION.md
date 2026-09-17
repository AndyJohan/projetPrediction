# Rapport technique - ProjetPrediction

## 1. Introduction generale

ProjetPrediction est une application de maintenance predictive destinee a exploiter l'historique des pannes d'equipements afin d'identifier les equipements les plus exposes a un risque de defaillance. Le projet ne se limite pas a une interface de consultation : il met en place une chaine complete allant de l'import de donnees historiques jusqu'a l'affichage de predictions metier dans un tableau de bord.

L'objectif principal est le suivant : transformer des donnees de pannes passees en indicateurs decisionnels permettant de prioriser la maintenance. Le systeme cherche a repondre a deux questions complementaires :

- un equipement presente-t-il un risque de panne dans les 15 prochains jours ?
- si le risque est eleve, dans quel intervalle temporel la panne est-elle susceptible d'arriver ?

Cette approche correspond a une logique de maintenance predictive. Contrairement a une maintenance corrective, qui intervient apres la panne, ou a une maintenance preventive fixe, qui intervient selon un calendrier constant, la maintenance predictive cherche a adapter l'action a l'etat reel et au comportement historique des equipements.

Le projet est organise en trois grands sous-systemes :

- `front` : application React pour l'affichage, la navigation, les tableaux de bord, les cartes de risque et les pages metier.
- `back` : API NestJS pour l'orchestration, la securite, l'import de donnees, les requetes PostgreSQL et l'appel au service de prediction.
- `ml-service` : service Python dedie au pipeline de donnees, a l'entrainement des modeles et a l'inference.

Le point le plus important du projet est la partie prediction, portee principalement par les fichiers suivants :

- `ml-service/src/pipeline.py`
- `ml-service/src/train.py`
- `ml-service/src/train_ttf.py`
- `ml-service/src/predict.py`
- `back/src/modules/maintenance/maintenance.controller.ts`
- `back/src/modules/maintenance/inference.service.ts`
- `front/src/components/MaintenanceDashboard.tsx`

## 2. Vue d'ensemble de l'architecture

### 2.1 Architecture logique

L'architecture generale suit une separation claire des responsabilites.

Le frontend React est responsable de l'experience utilisateur. Il consomme les API du backend et presente les informations sous forme de pages : accueil, historique, carte, assistant, support, parametres et maintenance predictive.

Le backend NestJS joue le role de couche metier et d'orchestrateur. Il expose des routes REST, valide les donnees d'entree, interagit avec PostgreSQL via TypeORM, importe les fichiers Excel, construit les payloads de prediction et appelle le script Python d'inference.

Le service Python contient la logique analytique. Il charge les donnees de pannes, construit une frise temporelle journaliere par equipement, produit les variables explicatives, entraine deux modeles Random Forest et realise les predictions a partir d'un payload JSON.

Le flux global peut etre resume ainsi :

1. Des fichiers Excel de suivi de pannes sont importes.
2. Le backend extrait les equipements, les dates, les heures et les commentaires.
3. Les donnees sont stockees dans PostgreSQL dans les tables `equipements` et `Pannes`.
4. Le pipeline Python lit ces donnees et cree un dataset journalier.
5. Deux modeles sont entraines et sauvegardes en `.joblib`.
6. Le backend appelle `predict.py` pour obtenir une prediction.
7. La prediction est sauvegardee dans la table `predictions`.
8. Le frontend affiche les equipements en surveillance ou a risque.

### 2.2 Technologies utilisees

Le projet combine plusieurs technologies :

- React 19 pour le frontend.
- React Router pour la navigation.
- Axios pour les appels HTTP.
- NestJS 11 pour le backend.
- TypeORM pour la persistance.
- PostgreSQL comme base de donnees relationnelle.
- Python avec pandas, numpy et scikit-learn pour le machine learning.
- joblib pour la serialisation des modeles.
- xlsx pour l'import des fichiers Excel.

Cette combinaison est coherente avec une application metier de prediction : NestJS assure une API structuree et maintenable, PostgreSQL conserve les donnees historisees, et Python apporte l'ecosysteme scientifique necessaire a la modelisation.

## 3. Organisation du projet

### 3.1 Repertoire frontend

Le dossier `front` contient l'application React. Les fichiers importants sont :

- `front/src/App.js` : definition des routes principales.
- `front/src/components/MaintenanceDashboard.tsx` : tableau de bord de maintenance predictive.
- `front/src/components/EquipmentRiskCard.tsx` : carte d'affichage d'un equipement a risque.
- `front/src/pages/HistoriquePage.js` : page d'analyse de l'historique.
- `front/src/pages/CartePage.js` : page cartographique.
- `front/src/pages/AssistantPage.js` : assistant metier.
- `front/src/services/httpClient.js` : client HTTP centralise.

Le frontend ne contient pas la logique de machine learning. Il affiche les sorties produites par le backend et le service Python : statut predit, probabilite de risque, confiance, intervalle estime et dates probables de panne.

### 3.2 Repertoire backend

Le dossier `back` contient l'API NestJS. Les modules principaux sont :

- `MaintenanceModule` : prediction et suivi des risques.
- `ImportModule` : import Excel vers PostgreSQL.
- `HistoriqueModule` : statistiques historiques.
- `PredictionModule` : fonctionnalites liees aux predictions existantes.
- `CarteModule` : donnees pour la visualisation geographique.
- `AssistantModule` : assistant conversationnel.
- `ParametreModule` : gestion des parametres.
- `HealthModule` : verification de disponibilite.

L'application charge la configuration via `ConfigModule`, se connecte a PostgreSQL avec `TypeOrmModule`, et active un garde global `ApiKeyGuard`. Cela indique une volonte de proteger les routes API avec une cle applicative.

### 3.3 Repertoire machine learning

Le dossier `ml-service` porte le coeur analytique :

- `database.py` lit les pannes et les equipements depuis PostgreSQL.
- `pipeline.py` transforme les pannes brutes en dataset d'apprentissage.
- `comment_features.py` extrait des signaux depuis les commentaires.
- `equipment_stats.py` calcule les statistiques historiques par equipement.
- `sensor_features.py` integre des logs capteurs si disponibles.
- `common.py` centralise les constantes et les colonnes de features.
- `train.py` entraine le classifieur binaire de risque.
- `train_ttf.py` entraine le classifieur d'intervalle temporel.
- `predict.py` charge les modeles et produit une prediction JSON.

## 4. Modele de donnees

### 4.1 Entite Equipement

L'entite `Equipement` correspond a la table `equipements`. Elle contient :

- `id` : identifiant technique.
- `nomEquipement` : nom de l'equipement.
- `nombrePannes` : compteur de pannes historise.
- `categorie` : categorie metier, par exemple `COM`, `SURV`, `MET`, `RESEAU`.
- relation `pannes` : liste des pannes associees.

Une contrainte d'unicite existe sur le couple `nomEquipement` et `categorie`. Cela evite de creer plusieurs fois le meme equipement dans une meme categorie lors des imports.

### 4.2 Entite Panne

L'entite `Panne` correspond a la table `Pannes`. Elle contient :

- `id` : identifiant de panne.
- `heure` : heure de survenue, nullable.
- `dates` : date de survenue, nullable.
- `commentaires` : commentaire associe a la panne.
- relation `equipement` : equipement concerne.

Ces donnees constituent la matiere premiere de la prediction. La date et l'heure permettent de reconstruire une chronologie, tandis que les commentaires apportent un signal qualitatif exploite dans les variables textuelles.

### 4.3 Entite Prediction

L'entite `Prediction` correspond a la table `predictions`. Elle sauvegarde a la fois :

- les features envoyees au modele ;
- la sortie du modele binaire ;
- la sortie du modele d'intervalle, si elle existe ;
- le payload complet en JSON ;
- le resultat complet en JSON ;
- la date de creation.

Cette table est importante pour l'auditabilite. Elle permet de comprendre pourquoi une prediction a ete produite, avec quelles variables, a quelle date, et avec quel score de risque. Dans un contexte industriel, cette tracabilite est essentielle pour analyser les alertes, corriger les seuils et suivre la performance du systeme.

## 5. Import et preparation des donnees

### 5.1 Import Excel

Le backend importe des fichiers Excel via `back/src/modules/import/import.service.ts`. Le service lit les feuilles du classeur, detecte les mois, identifie les colonnes d'equipements, extrait les colonnes `heure` et `panne`, puis insere les pannes dans PostgreSQL.

Les controles principaux sont :

- limitation du nombre de feuilles lues ;
- limitation du nombre de lignes et colonnes ;
- detection des entetes ;
- validation des dates calendaires ;
- normalisation des noms d'equipements ;
- limitation de la longueur des commentaires ;
- extraction automatique de la categorie depuis le nom du fichier ou depuis les options d'import.

L'import ne prend en compte que les cellules de panne dont la valeur numerique est egale a `1`. Cela signifie que le dataset final represente des evenements de panne observes, et non tous les jours de fonctionnement.

### 5.2 Passage d'evenements a serie temporelle

Un point fondamental du projet est que les pannes brutes sont des evenements ponctuels. Or, pour entrainer un modele de prediction, il faut des observations regulieres de l'etat des equipements. Le pipeline transforme donc les evenements en une frise journaliere.

Dans `pipeline.py`, la fonction `resampling` cree, pour chaque equipement, un index journalier entre la premiere panne connue et l'horizon final. Chaque jour devient une ligne. Si une panne existe ce jour-la, `panne_reelle` vaut `1`; sinon, il vaut `0`.

Cette etape est capitale. Sans elle, le modele n'apprendrait que sur les jours de panne, ce qui rendrait impossible la comparaison entre un etat normal et un etat proche de la panne. La frise journaliere donne au modele des exemples positifs et negatifs.

### 5.3 Nettoyage des donnees

La fonction `nettoyage` impose la presence des colonnes :

- `dates`
- `heure`
- `equipement_id`
- `categorie`

Elle convertit les identifiants d'equipements en nombres, construit un timestamp a partir de la date et de l'heure, supprime les lignes non exploitables, trie les donnees par equipement et par date, puis enrichit les commentaires.

Cette phase reduit les risques d'erreurs de modelisation : un timestamp invalide ou un equipement absent casserait la logique temporelle et pourrait provoquer des cibles erronees.

## 6. Feature engineering

Le feature engineering est la transformation la plus importante avant l'apprentissage. Le modele Random Forest ne travaille pas directement sur les pannes brutes ; il travaille sur un vecteur numerique representant l'etat d'un equipement a une date donnee.

### 6.1 Variables temporelles

Le pipeline cree :

- `jour_semaine` : jour de la semaine, de 0 a 6.
- `est_weekend` : indicateur binaire.
- `mois` : mois de l'annee.

Ces variables peuvent capturer des effets calendaires. Par exemple, certains equipements peuvent etre davantage sollicites pendant certaines periodes, ou certaines pannes peuvent apparaitre plus souvent selon les cycles d'exploitation.

### 6.2 Variables de recence et de frequence

Le pipeline calcule plusieurs variables de fenetres glissantes :

- `jours_depuis_derniere_panne`
- `pannes_dernieres_1j`
- `pannes_dernieres_2j`
- `pannes_7_derniers_jours`
- `pannes_14_derniers_jours`
- `pannes_30_derniers_jours`
- `pannes_90_derniers_jours`

Ces variables representent la memoire recente de l'equipement. Elles sont construites avec des fenetres fermees a gauche (`closed="left"`), ce qui signifie que la panne du jour courant n'est pas utilisee pour predire le jour courant. Ce detail est important pour eviter une fuite de donnees.

La variable `jours_depuis_derniere_panne` exprime la recence du dernier incident. Un equipement qui vient de tomber en panne plusieurs fois peut indiquer une instabilite persistante. A l'inverse, un equipement sans panne depuis longtemps peut etre soit stable, soit expose a une usure accumulee selon les donnees observees.

### 6.3 Statistiques historiques par equipement

Le fichier `equipment_stats.py` ajoute :

- `intervalle_median_pannes_jours`
- `mtbf_jours`
- `taux_panne_mois`
- `tendance_pannes`

Le `mtbf_jours` correspond a une approximation du Mean Time Between Failures, c'est-a-dire le temps moyen entre deux pannes. C'est une notion classique en fiabilite industrielle. Plus le MTBF est faible, plus l'equipement presente historiquement une frequence de panne elevee.

La mediane des intervalles est complementaire a la moyenne. Elle est moins sensible aux valeurs extremes. Si un equipement a une longue periode sans panne puis plusieurs pannes rapprochees, la moyenne peut etre trompeuse, alors que la mediane donne une mesure plus robuste.

La variable `tendance_pannes` compare le taux de panne recent sur 7 jours avec le taux de panne sur 30 jours :

```text
tendance_pannes = pannes_7_derniers_jours / 7 - pannes_30_derniers_jours / 30
```

Une valeur positive signifie que le rythme de panne s'accelere a court terme. C'est un signal tres utile pour la maintenance predictive, car il detecte une degradation recente.

### 6.4 Variables issues des commentaires

Le fichier `comment_features.py` analyse les commentaires avec des expressions regulieres. Il detecte plusieurs categories :

- `comment_hs` : hors service, HS.
- `comment_liaison` : liaison, VSAT, reseau, AMHS, Synergy, SMT, AFTN.
- `comment_reset` : reset, redemarrage, reboot, relance.
- `comment_sans_intervention` : incident resolu sans intervention.
- `comment_perturbation` : perturbation, intermittence, instabilite.

Ensuite, le pipeline calcule des compteurs sur 30 jours :

- `comment_hs_30j`
- `comment_liaison_30j`
- `comment_reset_30j`
- `comment_sans_intervention_30j`
- `comment_perturbation_30j`

Ces variables transforment du texte libre en signaux numeriques. C'est une forme simple mais pertinente de traitement du langage naturel. Elle est adaptee lorsque les commentaires suivent un vocabulaire metier recurrent.

### 6.5 Variables capteurs et logs

Le fichier `sensor_features.py` prevoit l'integration de logs capteurs. Les colonnes attendues sont :

- `log_erreurs_7j`
- `log_alertes_7j`
- `log_cpu_moyen_7j`
- `log_mem_moyen_7j`

Les donnees peuvent venir de la table `capteurs_logs` ou d'un CSV `ml-service/data/capteurs_logs.csv`. Si elles sont absentes, les colonnes sont initialisees a `0.0`. Ce choix rend le pipeline robuste : il peut fonctionner avec ou sans donnees capteurs.

Sur le plan predictive, ces variables seraient tres importantes si elles etaient alimentees en continu. Les logs systeme et capteurs sont souvent des precurseurs de panne plus fins que l'historique des incidents declares.

### 6.6 Encodage des categories

Les categories d'equipements sont encodees avec `pd.get_dummies`, ce qui produit des colonnes du type :

- `cat_COM`
- `cat_SURV`
- `cat_MET`
- `cat_RESEAU`
- `cat_AUTRE`

Lors de l'inference, `predict.py` reconstruit ces colonnes en mettant `1` sur la categorie du payload et `0` sur les autres. Cela garantit que le vecteur d'entree respecte les colonnes apprises par le modele.

## 7. Construction de la cible predictive

### 7.1 Notion de cible

En apprentissage supervise, un modele apprend a partir d'exemples etiquetes. Chaque ligne d'apprentissage contient :

- un vecteur de variables explicatives `x` ;
- une cible observee `y`.

Dans ce projet, une ligne correspond a un equipement a une date donnee. La question est : une panne va-t-elle arriver bientot apres cette date ?

### 7.2 Cible binaire `target_risque`

La fonction `etape_4_target_labeling` construit la cible principale. Pour chaque ligne de la frise journaliere, elle cherche la prochaine panne de l'equipement avec un remplissage vers l'arriere (`bfill`). Ensuite, elle calcule :

```text
heures_jusqu_a_prochaine_panne =
    prochaine_panne_timestamp - timestamp_courant
```

Puis elle definit :

```text
target_risque = 1 si heures_jusqu_a_prochaine_panne <= 360
target_risque = 0 sinon
```

360 heures correspondent a 15 jours. La cible signifie donc :

```text
1 = une panne est observee dans les 15 prochains jours
0 = aucune panne observee dans les 15 prochains jours
```

Cette formulation est tres importante. Le modele ne predit pas une panne instantanee ; il estime le risque d'apparition d'une panne dans un horizon futur fixe.

### 7.3 Cible d'intervalle

Le deuxieme modele, entraine par `train_ttf.py`, ne travaille que sur les lignes dont la prochaine panne est dans l'horizon de 15 jours. Il classe ensuite le delai avant panne dans un intervalle.

Trois schemas sont testes :

- `0-3j / 3-7j / 7-15j`
- `0-2j / 2-7j / 7-15j`
- `0-3j / 3-10j / 10-15j`

L'objectif n'est plus seulement de dire "risque" ou "sain", mais d'indiquer si la panne est plutot imminente, proche ou plus lointaine dans l'horizon de 15 jours.

## 8. Theorie detaillee de la prediction

### 8.1 Maintenance corrective, preventive et predictive

La maintenance corrective intervient apres la panne. Elle est simple a organiser, mais elle peut entrainer des arrets de service, des couts eleves et une perte de disponibilite.

La maintenance preventive intervient selon un calendrier fixe. Elle reduit certains risques, mais elle peut conduire a intervenir trop tot sur des equipements encore sains ou trop tard sur des equipements qui se degradent rapidement.

La maintenance predictive utilise les donnees pour estimer l'etat futur d'un equipement. Elle cherche a declencher l'intervention quand le risque devient significatif. Son avantage est de mieux aligner les ressources de maintenance avec le risque reel.

Dans ce projet, la maintenance predictive repose sur l'historique de pannes, les statistiques de frequence, les tendances recentes, les commentaires d'incidents et, potentiellement, les logs capteurs.

### 8.2 Formulation mathematique du probleme

On dispose d'un ensemble de donnees :

```text
D = {(x_i, y_i)} pour i = 1 ... n
```

Chaque `x_i` est un vecteur de features :

```text
x_i = [
  jour_semaine,
  est_weekend,
  mois,
  jours_depuis_derniere_panne,
  pannes_7_derniers_jours,
  mtbf_jours,
  tendance_pannes,
  commentaires,
  categorie,
  ...
]
```

Chaque `y_i` est une cible :

- pour le modele 1 : `0` ou `1` ;
- pour le modele 2 : `0`, `1` ou `2` selon l'intervalle de panne.

Le but est d'apprendre une fonction :

```text
f(x) = y
```

ou, plus precisement pour la classification probabiliste :

```text
P(y = 1 | x)
```

Cela signifie : quelle est la probabilite qu'une panne survienne dans les 15 prochains jours, sachant l'etat observe de l'equipement ?

### 8.3 Classification supervisee

Le probleme est un probleme de classification supervisee. Il est "supervise" parce que l'on connait les bonnes reponses dans l'historique : on sait, pour une date passee, si une panne est arrivee dans les 15 jours suivants.

Le modele apprend des relations entre les variables et la cible. Par exemple, il peut apprendre que :

- un nombre eleve de pannes recentes augmente le risque ;
- une tendance positive des pannes indique une degradation ;
- certains mots dans les commentaires sont associes a une future panne ;
- certaines categories d'equipements ont des comportements differents ;
- un MTBF faible caracterise des equipements instables.

Il ne s'agit pas d'une regle unique ecrite manuellement. Le modele combine de nombreux signaux et apprend des seuils internes a partir des donnees.

### 8.4 Arbre de decision

Un arbre de decision est un modele qui decoupe l'espace des donnees avec des conditions successives. Exemple :

```text
si pannes_7_derniers_jours > 1.5
  si tendance_pannes > 0.1
    alors risque
  sinon
    alors surveillance faible
sinon
  si jours_depuis_derniere_panne > 60
    alors ...
```

Chaque noeud de l'arbre choisit une variable et un seuil pour separer au mieux les classes. Le but est de creer des groupes de plus en plus homogenes.

L'impurete de Gini est souvent utilisee :

```text
Gini = 1 - somme(p_k^2)
```

`p_k` represente la proportion de la classe `k` dans un noeud. Si un noeud contient presque uniquement des exemples "Risque", son impurete est faible. Si un noeud contient un melange equivalent de "Sain" et "Risque", son impurete est forte.

Les arbres de decision sont interpretables, mais ils peuvent etre instables : un petit changement dans les donnees peut produire un arbre different.

### 8.5 Random Forest

Le projet utilise `RandomForestClassifier`. Une foret aleatoire est un ensemble d'arbres de decision. Au lieu de construire un seul arbre, elle en construit beaucoup, puis agrege leurs predictions.

Le principe repose sur deux sources de diversite :

- chaque arbre est entraine sur un echantillon bootstrap des donnees ;
- a chaque separation, l'arbre ne considere qu'un sous-ensemble aleatoire de variables.

Pour une classification binaire, chaque arbre vote ou produit une probabilite. La foret agrege ces votes :

```text
P(risque | x) = moyenne des probabilites produites par les arbres
```

Dans ce projet, le Random Forest est bien adapte car :

- les relations entre variables et pannes sont probablement non lineaires ;
- les variables sont heterogenes : temps, frequences, categories, commentaires, logs ;
- le modele gere bien les interactions entre variables ;
- il est robuste au bruit ;
- il fournit des importances de variables ;
- il demande moins de normalisation qu'un modele lineaire ou un reseau de neurones.

### 8.6 Desequilibre des classes

Dans un probleme de panne, les classes sont souvent desequilibrees. Il y a generalement beaucoup plus de jours sans panne que de jours proches d'une panne. Si l'on entraine un modele naivement, il peut apprendre a predire presque toujours "Sain" et obtenir une bonne accuracy apparente.

Pour limiter ce probleme, le projet utilise :

```text
class_weight = "balanced_subsample"
```

Cela donne plus de poids aux classes minoritaires dans chaque echantillon d'arbre. Cette decision est importante car le cout metier d'un risque manque peut etre eleve.

### 8.7 Probabilite et seuil de decision

Le modele ne retourne pas uniquement une classe. Il retourne une probabilite de risque :

```text
probabilite_risque = P(panne dans 15 jours | x)
```

Pour transformer cette probabilite en statut, il faut un seuil :

```text
si probabilite_risque >= seuil
  statut = Risque
sinon
  statut = Sain
```

Le seuil n'est pas neutre. Un seuil bas detecte plus de risques mais augmente les fausses alertes. Un seuil haut reduit les fausses alertes mais peut rater des pannes.

Le projet teste plusieurs seuils :

```text
0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70
```

La selection se fait en cherchant un bon compromis avec une contrainte minimale de rappel :

```text
recall_risque >= 0.60
```

Puis le score F2 est privilegie. Le F2 donne plus de poids au rappel qu'a la precision.

### 8.8 Precision, rappel, F1 et F2

Pour comprendre l'evaluation, il faut definir les quatre cas possibles :

- vrai positif : le modele predit "Risque" et une panne arrive bien dans l'horizon.
- faux positif : le modele predit "Risque" mais aucune panne n'arrive dans l'horizon.
- faux negatif : le modele predit "Sain" alors qu'une panne arrive dans l'horizon.
- vrai negatif : le modele predit "Sain" et aucune panne n'arrive dans l'horizon.

La precision mesure la qualite des alertes :

```text
precision = vrais_positifs / (vrais_positifs + faux_positifs)
```

Le rappel mesure la capacite a detecter les vrais risques :

```text
rappel = vrais_positifs / (vrais_positifs + faux_negatifs)
```

Le F1 est une moyenne harmonique de precision et rappel :

```text
F1 = 2 * precision * rappel / (precision + rappel)
```

Le F2 donne plus d'importance au rappel :

```text
F2 = 5 * precision * rappel / (4 * precision + rappel)
```

Dans une application de maintenance, le rappel est souvent prioritaire. Un faux positif peut generer une verification inutile ; un faux negatif peut laisser une panne arriver sans alerte.

### 8.9 Validation par equipement

Le projet separe les donnees par `equipement_id`, et non par lignes aleatoires. Cela signifie que certains equipements sont dans l'entrainement et d'autres dans le test.

Cette strategie est plus exigeante et plus realiste qu'un split aleatoire simple. Si l'on melangeait aleatoirement les lignes, le modele pourrait voir une partie de l'historique d'un equipement en entrainement et une autre partie en test. Il risquerait alors de beneficier indirectement d'informations propres a cet equipement.

Le split par equipement teste une question plus forte :

```text
Le modele generalise-t-il a des equipements non vus pendant l'entrainement ?
```

Cette decision renforce la credibilite methodologique du projet.

### 8.10 Modele en cascade

Le projet utilise une architecture predictive en deux etapes :

1. Modele binaire : detection du risque sous 15 jours.
2. Modele d'intervalle : estimation de la fenetre probable de panne si le risque est declenche.

Cette architecture est pertinente. Elle evite de demander au modele d'intervalle de predire un delai pour des cas ou aucune panne proche n'est detectee. Le deuxieme modele se concentre uniquement sur les situations a risque.

En production, cette logique se traduit ainsi :

- si le modele 1 predit "Sain", aucune estimation temporelle n'est affichee ;
- si le modele 1 predit "Risque", le modele 2 estime l'intervalle de panne.

### 8.11 Classification d'intervalle

Le deuxieme modele transforme un probleme de regression temporelle en probleme de classification ordinale. Au lieu de predire un nombre exact d'heures avant panne, il predit une classe :

- classe 0 : panne tres proche ;
- classe 1 : panne proche ;
- classe 2 : panne dans la fin de l'horizon.

Cette approche est souvent plus robuste qu'une regression exacte. En maintenance, il est rarement necessaire de savoir si une panne arrivera dans exactement 94 heures. Il est plus utile de savoir si elle est probable dans les 3 prochains jours, dans la semaine, ou plus tard.

Le projet evalue ce modele avec une metrique metier :

```text
business_score =
  0.45 * adjacent
  + 0.30 * exact
  + 0.20 * macro_f1
  + 0.05 * middle_f1
```

Cette formule reconnait qu'une erreur d'une classe est moins grave qu'une erreur de deux classes. Par exemple, predire `3-7 jours` au lieu de `0-3 jours` est moins grave que predire `7-15 jours` au lieu de `0-3 jours`.

### 8.12 Calibration et interpretation des probabilites

Le Random Forest produit des probabilites issues de la proportion de votes ou de probabilites des arbres. Ces probabilites sont utiles pour classer les risques, mais elles ne sont pas toujours parfaitement calibrees. Une probabilite de 0.70 ne garantit pas necessairement que 70 % des cas similaires tomberont en panne.

Pour une version industrielle avancee, on pourrait ajouter une calibration :

- Platt scaling ;
- isotonic regression ;
- courbes de calibration ;
- Brier score.

Le projet actuel utilise deja un seuil optimise, ce qui est une bonne premiere etape. La calibration serait une amelioration pour rendre les scores encore plus interpretables.

## 9. Entrainement des modeles

### 9.1 Entrainement du modele de risque

Le script `train.py` entraine le classifieur binaire. Les principales etapes sont :

1. Chargement du dataset produit par `pipeline.py`.
2. Recuperation des colonnes de features via `get_feature_columns`.
3. Suppression des features constantes.
4. Validation multi-splits par equipement.
5. Recherche d'hyperparametres.
6. Recherche de seuil de decision.
7. Entrainement final.
8. Evaluation sur le test final.
9. Export des predictions de test.
10. Sauvegarde du modele et des metadonnees.

La grille d'hyperparametres teste notamment :

- `max_depth`
- `min_samples_leaf`

Le nombre d'arbres final est de 150 pour le modele de risque. Le modele sauvegarde aussi :

- la liste des features ;
- la cible ;
- le type de modele ;
- l'algorithme ;
- les classes ;
- l'horizon de risque ;
- le seuil retenu ;
- les parametres selectionnes ;
- les importances de variables ;
- les regles de prediction.

Ces metadonnees sont indispensables pour garantir que l'inference utilise exactement les memes colonnes que l'entrainement.

### 9.2 Entrainement du modele d'intervalle

Le script `train_ttf.py` entraine le classifieur d'intervalle. Il filtre d'abord le dataset pour conserver uniquement les lignes dont la prochaine panne est dans l'horizon de 360 heures.

Il teste plusieurs schemas d'intervalles et plusieurs configurations de Random Forest. La configuration retenue est celle qui maximise le `business_score`.

Le modele sauvegarde :

- les features ;
- la cible `intervalle_panne` ;
- les bornes horaires des intervalles ;
- les labels lisibles ;
- le mode de prediction ;
- les metriques de validation ;
- les importances de variables ;
- la methode de split.

Le fichier de sortie attendu est :

```text
ml-service/models/rf_failure_interval_classifier.joblib
```

### 9.3 Artefacts produits

Les modeles sauvegardes sont :

- `rf_risk_status_classifier.joblib`
- `rf_failure_interval_classifier.joblib`

Les resultats de test sont exportes dans `ml-service/results`, par exemple :

- `test_prediction.csv`
- `ttf_interval_test_predictions.csv`

Ces fichiers permettent d'analyser les predictions hors production et de comparer les performances entre differentes versions d'entrainement.

## 10. Inference et integration backend

### 10.1 Script Python d'inference

Le fichier `predict.py` est le point d'entree de l'inference. Il :

1. lit le payload JSON passe en argument ;
2. charge le modele de risque ;
3. charge le modele d'intervalle ;
4. verifie que les deux modeles utilisent la meme liste de features ;
5. construit un DataFrame d'une ligne ;
6. calcule la probabilite de risque ;
7. applique le seuil optimise ;
8. appelle le modele d'intervalle si le risque est declenche ;
9. retourne un JSON.

La sortie contient notamment :

- `classe_predite`
- `statut_predit`
- `confiance`
- `probabilite_risque`
- `risk_threshold`
- `triggerAlert`
- `categorie`
- `estimation_prochaine_panne`

Si le risque est declenche, `estimation_prochaine_panne` contient :

- l'identifiant de l'intervalle ;
- le libelle ;
- la confiance ;
- les heures minimales et maximales ;
- une date de debut ;
- une date de fin ;
- une date estimee.

### 10.2 Service NestJS d'inference

Le fichier `inference.service.ts` lance le script Python via `spawn`. Il applique plusieurs protections :

- validation des champs numeriques obligatoires ;
- validation de la categorie ;
- limite de concurrence ;
- timeout ;
- limite de taille de sortie standard ;
- limite de taille de sortie d'erreur ;
- parsing strict de la reponse JSON.

Ces protections sont importantes car l'inference Python est appelee comme un processus externe. Sans timeout et limite de concurrence, une surcharge ou un script bloque pourrait affecter la disponibilite de l'API.

### 10.3 Construction automatique du payload

Le backend peut construire un payload pour un equipement stocke en base. Dans `maintenance.controller.ts`, la methode `buildPayload` recalcule les variables necessaires a partir des pannes historiques :

- jour de semaine ;
- week-end ;
- mois ;
- jours depuis derniere panne ;
- compteurs de pannes dans les fenetres ;
- mediane des intervalles ;
- MTBF ;
- taux de panne mensuel ;
- tendance ;
- compteurs de commentaires ;
- categorie ;
- timestamp de reference.

Cette logique permet de rafraichir les risques pour les equipements de la base sans que l'utilisateur ait a fournir manuellement toutes les features.

### 10.4 Couche metier de surveillance

Le backend ajoute une interpretation metier au-dessus de la prediction ML. Le modele retourne un seuil de risque, mais le backend introduit aussi un statut `Surveillance`.

La constante actuelle est :

```text
surveillance = 0.1
```

La logique est :

- si la probabilite depasse le seuil ML, statut `Risque` ;
- sinon, si elle depasse le seuil de surveillance, statut `Surveillance` ;
- sinon, statut `Sain`.

Cette couche est utile pour l'exploitation. Elle permet de montrer des equipements qui ne sont pas encore en risque fort mais qui meritent une attention.

### 10.5 Routes principales de maintenance

Le module maintenance expose notamment :

- `POST /maintenance/predict` : prediction pour un payload donne et sauvegarde en base.
- `GET /maintenance/equipment-risks` : recuperation des dernieres predictions en alerte.
- `POST /maintenance/equipment-risks/refresh` : recalcul des risques sur les equipements stockes.

La route de refresh trie les equipements par nombre de pannes decroissant, produit les predictions, sauvegarde les resultats, puis retourne les equipements en surveillance ou a risque.

## 11. Frontend et restitution decisionnelle

### 11.1 Tableau de bord de maintenance

Le composant `MaintenanceDashboard.tsx` affiche le tableau de bord des risques. Il charge les equipements a risque via :

```text
GET /maintenance/equipment-risks?limit=12
```

Il permet aussi de rafraichir les predictions via :

```text
POST /maintenance/equipment-risks/refresh?limit=12
```

Le frontend affiche :

- le nom de l'equipement ;
- la categorie ;
- le statut ;
- la probabilite de risque ;
- la confiance ;
- l'intervalle probable si disponible.

Cette presentation transforme une sortie statistique en action metier. L'utilisateur n'a pas besoin d'interpreter un fichier CSV ou une matrice de confusion : il voit directement les equipements a surveiller.

### 11.2 Historique et analyse

Le module historique fournit :

- une tendance journaliere sur un mois ;
- une repartition par categorie ;
- un top des equipements les plus touches ;
- le dernier incident ;
- une liste detaillee des pannes.

Ces elements completent la prediction. Ils permettent a l'utilisateur de comprendre le contexte : une alerte predictive est plus credible si elle peut etre reliee a une tendance historique.

### 11.3 Assistant et autres modules

Le projet contient aussi des modules d'assistant, de carte, de support et de parametres. Ils ne portent pas directement le modele ML, mais ils participent a l'experience globale :

- l'assistant peut expliquer ou contextualiser les informations ;
- la carte peut donner une lecture spatiale ;
- les parametres peuvent adapter l'application ;
- le support aide l'utilisateur a signaler ou comprendre des problemes.

## 12. Securite, robustesse et exploitation

### 12.1 Securite API

Le backend active un garde global `ApiKeyGuard`. Cela signifie que les routes sont protegees par une cle API, sauf exceptions eventuelles. C'est important pour eviter des appels non autorises aux endpoints de prediction ou d'import.

### 12.2 Validation des entrees

La validation est presente a plusieurs niveaux :

- validation des fichiers Excel importes ;
- validation des categories ;
- validation des dates ;
- validation des payloads de prediction ;
- validation des champs numeriques ;
- validation de la reponse Python.

Cette defensive programming reduit les erreurs silencieuses et protege la qualite des predictions.

### 12.3 Robustesse de l'inference

L'appel Python est encadre par :

- `ML_INFERENCE_TIMEOUT_MS`
- `ML_MAX_CONCURRENCY`
- `ML_MAX_OUTPUT_BYTES`
- `ML_SERVICE_DIR`
- `ML_PYTHON_PATH`

Ces variables d'environnement rendent le systeme configurable en production. Elles permettent d'adapter le timeout, le chemin Python ou le nombre d'inferences paralleles sans modifier le code.

### 12.4 Auditabilite

La table `predictions` stocke le payload et le resultat complet. Cela permet de repondre a plusieurs questions :

- quelles donnees ont ete envoyees au modele ?
- quelle probabilite a ete calculee ?
- quel seuil a ete applique ?
- quel intervalle a ete estime ?
- quand la prediction a-t-elle ete produite ?

Cette auditabilite est un point fort pour un systeme de maintenance predictive.

## 13. Forces du projet

Le projet presente plusieurs forces techniques et methodologiques :

- architecture separee entre frontend, backend et ML ;
- pipeline de donnees clair ;
- transformation des evenements en serie temporelle journaliere ;
- construction explicite de la cible predictive ;
- modele binaire interpretable par probabilite ;
- modele secondaire pour l'intervalle de panne ;
- split par equipement, plus robuste qu'un split aleatoire simple ;
- optimisation du seuil selon un objectif metier ;
- sauvegarde des metadonnees du modele ;
- integration backend robuste avec timeout et controle de concurrence ;
- historisation des predictions ;
- dashboard oriente decision.

La partie prediction est particulierement interessante car elle ne se contente pas d'un score brut. Elle structure la decision en deux niveaux : detection du risque, puis temporalisation du risque.

## 14. Limites actuelles

### 14.1 Limites liees aux donnees

Le modele depend fortement de la qualite de l'historique. Si les pannes sont mal saisies, incompletes ou heterogenes, les cibles et les features seront affectees.

Les commentaires sont exploites par mots-cles. Cette approche est simple et robuste, mais elle ne comprend pas le sens complet d'une phrase. Deux commentaires differents peuvent exprimer le meme probleme sans utiliser les mots prevus.

Les donnees capteurs sont optionnelles. Si elles ne sont pas alimentees, les colonnes de logs restent a zero. Le modele repose alors principalement sur les pannes historiques et les commentaires.

### 14.2 Limites methodologiques

L'horizon de 15 jours est un choix fixe. Il est coherent pour la maintenance predictive, mais il peut ne pas convenir a tous les types d'equipements. Certains equipements necessitent une anticipation plus courte, d'autres une anticipation plus longue.

La cible binaire transforme un probleme temporel continu en classification. C'est pratique, mais cela simplifie la realite : une panne dans 1 jour et une panne dans 14 jours sont toutes deux classees comme `Risque`.

Le modele d'intervalle corrige en partie cette limite, mais il reste discretise. Il ne predit pas un temps exact avant panne.

### 14.3 Limites operationnelles

Le backend lance actuellement un processus Python pour l'inference. Cette approche est simple et fonctionnelle, mais pour une forte charge, on pourrait envisager :

- un microservice Python HTTP dedie ;
- une file de jobs ;
- un cache des predictions ;
- une planification periodique des recalculs ;
- un systeme de monitoring des temps d'inference.

## 15. Ameliorations recommandees

### 15.1 Ameliorations machine learning

Plusieurs pistes peuvent renforcer la prediction :

- tester XGBoost, LightGBM ou HistGradientBoosting ;
- calibrer les probabilites ;
- comparer avec une regression de temps avant panne ;
- ajouter une validation temporelle stricte ;
- mesurer les performances par categorie d'equipement ;
- suivre la derive des donnees dans le temps ;
- ajouter des explications locales avec SHAP ;
- enregistrer les versions de datasets et de modeles.

### 15.2 Ameliorations donnees

Le projet gagnerait a integrer plus de signaux :

- logs capteurs reels ;
- duree d'indisponibilite ;
- criticite de l'equipement ;
- site ou localisation ;
- conditions environnementales ;
- type d'intervention ;
- pieces remplacees ;
- historique des maintenances preventives.

Ces variables permettraient de distinguer une panne isolee d'une degradation structurelle.

### 15.3 Ameliorations backend et production

Pour industrialiser davantage :

- exposer un endpoint de metriques ML ;
- versionner les modeles charges ;
- journaliser les erreurs Python avec plus de detail cote serveur ;
- ajouter une strategie de retry controlee ;
- separer l'inference dans un service permanent ;
- ajouter des tests automatises sur `buildPayload` ;
- ajouter des tests d'integration sur `/maintenance/predict`.

### 15.4 Ameliorations frontend

Cote interface :

- afficher l'historique des predictions d'un equipement ;
- montrer les variables qui ont le plus influence le risque ;
- filtrer par categorie ;
- trier par probabilite, date estimee ou criticite ;
- distinguer visuellement `Surveillance` et `Risque` ;
- afficher la date de reference utilisee pour la prediction.

## 16. Conclusion

ProjetPrediction est une application complete de maintenance predictive. Elle couvre toute la chaine : ingestion des donnees, stockage, transformation, apprentissage, inference, historisation et restitution utilisateur.

La partie prediction est le coeur du projet. Elle repose sur une demarche methodologique solide :

- creation d'une frise journaliere par equipement ;
- construction d'une cible de panne sous 15 jours ;
- entrainement d'un Random Forest avec gestion du desequilibre ;
- optimisation du seuil avec priorite au rappel ;
- validation par equipement ;
- ajout d'un second modele pour l'intervalle de panne ;
- integration dans une API securisee ;
- affichage dans un tableau de bord operationnel.

Le systeme est deja structure pour produire des alertes exploitables. Sa principale valeur est de transformer l'historique de pannes en aide a la decision : quels equipements surveiller, lesquels prioriser, et dans quel delai une intervention peut etre envisagee.

Avec l'ajout de donnees capteurs reelles, de calibration probabiliste et d'un suivi de performance en production, le projet pourrait evoluer vers une plateforme predictive encore plus robuste et industrialisable.
