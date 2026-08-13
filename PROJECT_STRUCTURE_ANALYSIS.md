# ProjetPrediction - Comprehensive Architecture Analysis

## Executive Summary

**ProjetPrediction** is a predictive maintenance system for African equipment monitoring with three main components:
- **Frontend (React)**: Dashboard for equipment monitoring, predictive maintenance, and IA assistance
- **Backend (NestJS)**: RESTful API for data management, ML inference, and operational support
- **ML Service (Python)**: Machine learning models for failure prediction and risk classification

---

## 1. FRONTEND PAGES ANALYSIS

### 1.1 HistoriquePage.js
**Purpose**: View and analyze historical equipment failure data with filters and trends
- **Main Functionality**:
  - Display failure trends over time (daily, monthly views)
  - Category-based filtering (COM, SURV, MET, RESEAU)
  - Export historical summary to PDF
  - Show equipment-specific failure statistics
  
- **Key Components Used**:
  - `ImportToolbar` - Import historical CSV data
  - Custom SVG charts for trend visualization
  
- **State Management & Hooks**:
  - `useHistoriqueData` - Custom hook for fetching historical data
  - `useState` - Local state for filters (month, year, category)
  - `useMemo` - Memoized trend calculations
  - `useEffect` - Data fetching on filter changes
  
- **API Calls**:
  - GET `/historique/summary` - Fetch summary statistics
  - GET `/historique/details` - Get detailed failure records
  - POST `/import/upload` - Upload CSV files
  - GET `/historique` - Default historical view

---

### 1.2 PredictionPage.js
**Purpose**: Predictive maintenance dashboard showing equipment risk levels
- **Main Functionality**:
  - Display 15-day failure risk predictions for equipment
  - Visual risk indicators (Sain/Healthy, Risque/Risk status)
  - Equipment categorization
  
- **Key Components Used**:
  - `MaintenanceDashboard` (TSX) - Core dashboard component
  
- **State Management**:
  - Props-based component (minimal local state)
  - Demo equipment list hardcoded
  
- **API Calls**:
  - POST `/maintenance/predict` - Get risk predictions for equipment

---

### 1.3 CartePage.js
**Purpose**: Interactive map visualization of African equipment locations
- **Main Functionality**:
  - Interactive neon-styled map of Africa and Indian Ocean islands
  - Display major cities: Antananarivo, Mahajanga, Toamasina, etc.
  - Show communication links between facilities
  - Hover and click interactions
  
- **Key Components Used**:
  - `AfricaMapExact` - React Simple Maps wrapper
  
- **API Calls**:
  - GET `/carte` - Fetch route failure data
  
- **Technical Stack**:
  - Library: react-simple-maps
  - GeoJSON data: world-atlas@2

---

### 1.4 AssistantPage.js
**Purpose**: AI-powered chatbot for equipment and maintenance assistance
- **Main Functionality**:
  - Multi-turn conversational AI in French
  - Quick prompt suggestions
  - Chat history persistence (localStorage)
  - Period and category context for queries
  
- **Key Components Used**:
  - Custom chat UI (no external chat library)
  - HTML rendering for formatted responses
  
- **State Management & Hooks**:
  - `useState` - Messages, loading, feedback
  - `useRef` - Message container scrolling
  - `useMemo` - Memoized system prompts
  - `useEffect` - Auto-scroll on new messages
  - localStorage with STORAGE_KEY: 'assistant-ia-history'
  
- **API Calls**:
  - GET `/assistant` - Get assistant status
  - POST `/assistant/chat` - Send message and get response
  
- **Advanced Features**:
  - Context-aware responses using database insights
  - Message formatting (paragraphs, lists, bold text)
  - Timestamp formatting
  - Quick prompts: "Resumer les pannes du mois...", etc.

---

### 1.5 ParametrePage.js
**Purpose**: Application settings and configuration management
- **Main Functionality**:
  - Configure risk thresholds (critique: 80, eleve: 65, moyen: 45)
  - Setup notifications (SMS, Email, Webhook)
  - Configure assistant behavior
  - Configure import settings
  - Dashboard customization
  
- **Key Components Used**:
  - Custom form elements (no external form library)
  
- **State Management & Hooks**:
  - `useState` - Form state, loading, saving status
  - `useEffect` - Load parameters on mount
  - Async load/save operations
  
- **API Calls**:
  - GET `/parametre` - Load current settings
  - PUT `/parametre` - Save updated settings
  
- **Configuration Sections**:
  - Seuils (Risk Thresholds)
  - Notifications (SMS, Email, Webhook, Daily Summary)
  - Assistant Settings (Period mode, Category, Timeout, Context)
  - Import Settings (Skip operational, Date validation, Normalization, Duplicate policy)
  - Dashboard Settings (Default category, Auto-period selection, Y-axis max, Context display)

---

### 1.6 SupportPage.js
**Purpose**: Support and documentation hub
- **Main Functionality**:
  - Static information display
  - Support tickets interface (placeholder)
  - Links to knowledge base and diagnostics
  
- **Components**: Basic card layout
- **API Calls**: GET `/support` (minimal)

---

## 2. FRONTEND COMPONENTS ANALYSIS

### 2.1 MaintenanceDashboard.tsx
**Purpose**: Display grid of equipment risk cards with predictions
- **Functionality**:
  - Grid layout of 4 demo equipment items
  - 40% alert threshold indicator
  - Responsive design (2 cols on tablet, 4 cols on desktop)
  
- **Demo Equipment**:
  ```
  - Lien ATS/DS SADC (COM)
  - Routeur reseau principal (RESEAU)
  - Station surveillance radar (SURV)
  - Capteur meteorologique (MET)
  ```
  
- **Technology**: Tailwind CSS

---

### 2.2 EquipmentRiskCard.tsx
**Purpose**: Individual equipment risk prediction card
- **Input Props**:
  - `equipmentId` (number)
  - `categorie` (string: COM, SURV, MET, RESEAU)
  - `equipmentName` (optional)
  
- **Functionality**:
  - Fetch risk prediction from backend
  - Display prediction confidence score
  - Show risk probability with color coding:
    - Red (≥50% probability)
    - Orange (30-50% probability)
    - Green (<30% probability)
  - Display equipment status (Sain/Risque)
  
- **State Management**:
  - `useState` - prediction data, loading, error states
  - `useEffect` - Fetch prediction on mount
  - `useMemo` - Memoized mock payload generation
  
- **API Call**:
  - POST `/maintenance/predict` with:
    ```json
    {
      "heure_du_jour": 0-23,
      "jour_semaine": 0-6,
      "est_weekend": 0/1,
      "heures_depuis_derniere_panne": number,
      "pannes_dernieres_24h": number,
      "pannes_dernieres_48h": number,
      "pannes_7_derniers_jours": number,
      "pannes_14_derniers_jours": number,
      "pannes_30_derniers_jours": number,
      "pannes_90_derniers_jours": number,
      "categorie": string
    }
    ```

---

### 2.3 AfricaMapExact.jsx
**Purpose**: Interactive geospatial visualization of African facilities
- **Features**:
  - Neon-styled interactive map
  - Zoom capability (BASE_SCALE: 2200)
  - Country/island highlighting
  - City markers with tooltips
  
- **Data Structure**:
  - **Islands**: Madagascar (450), Comores (174), Mayotte (175), Maurice (480), La Réunion (638), Seychelles (690)
  - **Cities**: 11 major cities with coordinates
  - **Routes**: 6 communication links between facilities
  
- **State Management**:
  - `useState` - hovered, selected, tooltip visibility, zoom level
  - `useRef` - Container reference
  - `useMemo` - Memoized route data
  - `useEffect` - Fetch route failures data
  
- **API Call**:
  - GET `/carte` - Fetch failure data for routes

---

### 2.4 ImportToolbar.js
**Purpose**: File upload interface for historical data import
- **Features**:
  - Category dropdown selection (COM, SURV, MET, RESEAU)
  - Year selection
  - File picker
  - Progress tracking
  - Toast notifications
  
- **State Management**:
  - `useState` - File, category, year, progress, uploading status
  - `useRef` - File input reference
  - `useEffect` - Auto-dismiss toast notifications (4s timeout)
  
- **API Call**:
  - POST `/import/upload` with FormData (file, category, year)
  - Progress tracking via onUploadProgress

---

### 2.5 Sidebar.js
**Purpose**: Main navigation component
- **Navigation Structure**:
  ```
  Menu:
    - Historique (/historique)
    - Prediction (/prediction)
    - Carte (/carte)
    - Assistant IA (/assistant-ia)
  
  General:
    - Parametre (/parametre)
    - Support (/support)
  ```
  
- **Features**:
  - Responsive (collapses on screens < 860px)
  - Active route highlighting
  - Icon display
  - Desktop/mobile detection
  
- **State Management**:
  - `useState` - Open/closed state, desktop detection
  - `useEffect` - Window resize listener

---

## 3. BACKEND MODULES ANALYSIS

### 3.1 HEALTH Module
**Controller**: GET `/health`
- **Purpose**: System health check endpoint
- **Response**: 
  ```json
  {
    "status": "ok",
    "service": "prediction-api",
    "timestamp": "2024-XX-XXTXX:XX:XXZ"
  }
  ```

---

### 3.2 ASSISTANT Module
**Endpoints**:
- GET `/assistant` - Get assistant status
- POST `/assistant/chat` - Send message to AI

**Purpose**: AI-powered conversational assistance using OpenRouter API

**Key Features**:
- Integrates with OpenRouter for LLM inference
- Builds contextual summaries from database
- Extracts period and category from user messages
- Supports French language responses
- French month parsing (janvier, février, mars...)

**Services**:
- `AssistantService` - Main chat logic and context building
- `AssistantContextService` - Database context aggregation

**Main Methods**:
```typescript
getAssistantSummary() // Returns API status
async chat(body: ChatDto) // Process user message with context
```

**DTO**:
```typescript
ChatDto {
  message: string;
  period?: string;
  category?: string;
}
```

**System Prompt** (French):
- Professional technical supervision tone
- Leverages database context
- Plain text output (no Markdown)
- Focuses on solutions and previous fixes

---

### 3.3 CARTE Module
**Endpoint**: GET `/carte`

**Purpose**: Equipment routes and their failure statistics

**Key Features**:
- Tracks 6 major communication links (routes)
- Aggregates failure counts from database
- Returns location and category for each route

**Routes Tracked**:
1. LIEN ATS/DS VERS FMNM (to FMNM)
2. LIEN ATS/DS VERS FMMT (to FMMT)
3. LIEN ATS/DS VERS FMEE (to FMEE)
4. LIEN ATS/DS VERS FIMP (to FIMP)
5. LIEN ATS/DS VERS FMCZ (to FMCZ)
6. LIEN ATS/DS VERS FMCH (to FMCH)

**Entities Used**:
- `Equipement` - Equipment data
- `Panne` - Failure records

**Response Structure**:
```json
{
  "source": "database",
  "routes": [
    {
      "label": "lien ATS/DS vers FMNM",
      "nomEquipement": "LIEN ATS/DS VERS FMNM",
      "totalPannes": 5,
      "categorie": "COM"
    }
  ]
}
```

---

### 3.4 HISTORIQUE Module
**Endpoints**:
- GET `/historique` - Default summary
- GET `/historique/summary?period=&category=` - Filtered summary
- GET `/historique/details?period=&category=` - Detailed records

**Purpose**: Historical failure data analysis and reporting

**Key Features**:
- Period-based filtering (monthly)
- Category-based filtering (COM, SURV, MET, RESEAU)
- Trend calculation (failures per day)
- Category breakdown statistics
- Equipment-wise failure counts
- Latest incident tracking

**Main Methods**:
```typescript
async getSummary(query: SummaryQueryDto)
async getDetails(query: SummaryQueryDto)
async getTrend(period, category)
async getCategoryBreakdown(period)
async getPannesParEquipement(period, category)
async getDernierIncident(period, category)
```

**Response Structure**:
```json
{
  "period": "2024-01-01",
  "trend": [
    { "label": "01", "value": 2 }
  ],
  "categoryBreakdown": [
    { "category": "COM", "count": 5 }
  ],
  "pannesParEquipement": [
    { "equipement": "NAME", "count": 3 }
  ],
  "dernierIncident": {
    "equipement": "NAME",
    "date": "2024-01-15",
    "heure": "14:30"
  }
}
```

**Entities Used**:
- `Panne` - Failure records

---

### 3.5 MAINTENANCE Module
**Endpoint**: POST `/maintenance/predict`

**Purpose**: Real-time equipment failure risk prediction using Python ML models

**Key Features**:
- Validates equipment data payload
- Spawns Python process for ML inference
- Calls ML models from ml-service directory
- Returns risk probability and status

**DTO Input**:
```typescript
MaintenanceDto {
  heure_du_jour: number;
  jour_semaine: number;
  est_weekend: number;
  heures_depuis_derniere_panne: number;
  pannes_dernieres_24h: number;
  pannes_dernieres_48h: number;
  pannes_7_derniers_jours: number;
  pannes_14_derniers_jours: number;
  pannes_30_derniers_jours: number;
  pannes_90_derniers_jours: number;
  categorie: string;
}
```

**Service**: `InferenceService`
- Validates payload structure and types
- Calls Python script: `ml-service/src/predict.py`
- Supports custom Python path via `ML_PYTHON_PATH` env var
- Uses virtual environment if available

**Response Structure**:
```json
{
  "classe_predite": 0,
  "statut_predit": "Sain | Risque",
  "confiance": 0.95,
  "probabilite_risque": 0.15,
  "triggerAlert": false
}
```

---

### 3.6 PREDICTION Module
**Endpoint**: GET `/prediction`

**Purpose**: General prediction data and models status

**Service**: `PredictionService`
- Returns available prediction models
- Returns prediction metrics

---

### 3.7 IMPORT Module
**Endpoint**: POST `/import/upload`

**Purpose**: Bulk import historical equipment failure data from Excel files

**Key Features**:
- Parses multi-sheet Excel files
- Automatic sheet date extraction (from sheet names)
- Column header detection
- Equipment name parsing from headers
- Failure data extraction per equipment
- Duplicate handling (skip or update policy)
- Date validation
- Category and year resolution

**File Format Expected**:
- Multiple sheets (one per month)
- Sheet names containing month indicators
- Header row with equipment names
- Data rows with:
  - Column 0: Day number (1-31)
  - Equipment columns: "Heure" (time) and "Panne" (failure count)

**DTO Input**:
```typescript
ImportOptionsDto {
  category?: string;
  year?: string;
}
```

**Processing Logic**:
1. Parse Excel workbook
2. Detect category from filename or parameter
3. Extract month from sheet names
4. Validate date ranges
5. Parse failure data per equipment
6. Update or insert into database

**Response**:
```json
{
  "inserted": 10,
  "skipped": 2,
  "updated": 1
}
```

**Service**: `ImportService`
- Uses xlsx library for parsing
- Repository: `EquipementRepository`, `PanneRepository`

---

### 3.8 PARAMETRE Module
**Endpoints**:
- GET `/parametre` - Get current settings
- PUT `/parametre` - Update settings

**Purpose**: Application configuration management

**Configuration Structure**:
```typescript
{
  source: "runtime-memory",
  seuils: {
    critique: 80,    // Critical threshold %
    eleve: 65,       // High threshold %
    moyen: 45        // Medium threshold %
  },
  notifications: {
    sms: "Equipe terrain",
    email: "Direction operations",
    webhook: "Portail maintenance",
    dailySummary: true
  },
  assistant: {
    defaultPeriodMode: "latest" | "manual",
    defaultCategory: "ALL" | "COM" | "SURV" | "MET" | "RESEAU",
    requestTimeoutSeconds: 60,
    includeDatabaseContext: true,
    maxHistoryMessages: 20
  },
  import: {
    skipOperationalValues: true,
    ignoreInvalidDates: true,
    normalizeLabels: true,
    duplicatePolicy: "skip" | "update"
  },
  dashboard: {
    defaultCategory: "ALL" | "COM" | "SURV" | "MET" | "RESEAU",
    autoSelectLatestPeriod: true,
    trendYAxisMax: 10,
    showAssistantContext: true
  }
}
```

**Storage**: Runtime memory (resets on restart)

---

### 3.9 SUPPORT Module
**Endpoint**: GET `/support`

**Purpose**: Support information and resources

**Response**:
```json
{
  "source": "db-placeholder",
  "contact": "support@exemple.com",
  "message": "Expose les ressources de support."
}
```

---

## 4. ENTITIES ANALYSIS

### 4.1 Equipement Entity
**Table**: `equipements`

**Fields**:
```typescript
@PrimaryGeneratedColumn()
id: number;

@Column('varchar', { length: 255 })
nomEquipement: string;

@Column('int', { default: 0 })
nombrePannes: number;

@Column('varchar', { length: 100, nullable: true })
categorie: string | null;

@OneToMany()
pannes: Panne[];
```

**Constraints**:
- Unique index on (nomEquipement, categorie)
- Cascade delete to Panne records

**Purpose**: Store equipment metadata and failure counts

**Categories**:
- COM (Communication)
- SURV (Surveillance)
- MET (Meteorology)
- RESEAU (Network)

---

### 4.2 Panne Entity
**Table**: `Pannes`

**Fields**:
```typescript
@PrimaryGeneratedColumn()
id: number;

@Column('time', { nullable: true })
heure: string | null;

@Column('date', { nullable: true })
dates: string | null;

@Column('text', { nullable: true })
commentaires: string | null;

@ManyToOne()
@JoinColumn({ name: 'equipement_id' })
equipement: Equipement;
```

**Purpose**: Store individual equipment failure records with timestamps

**Relationships**:
- ManyToOne with Equipement
- CASCADE delete on equipment deletion

---

## 5. OVERALL ARCHITECTURE

### 5.1 Technology Stack

**Frontend**:
- React 18
- React Router for navigation
- Tailwind CSS for styling
- Axios for HTTP requests
- react-simple-maps for geospatial visualization
- localStorage for state persistence

**Backend**:
- NestJS framework
- TypeORM for database ORM
- PostgreSQL database
- OpenRouter API for LLM integration
- Express.js (via NestJS)
- Multer for file uploads

**ML Service**:
- Python 3.x
- scikit-learn (Random Forest, MLP models)
- XGBoost
- pandas for data processing
- joblib for model serialization

---

### 5.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                           │
│  ┌────────────┐ ┌─────────┐ ┌────────┐ ┌──────────────────┐   │
│  │ Historique │ │Prediction│ │ Carte  │ │ AssistantPage    │   │
│  └─────┬──────┘ └────┬─────┘ └───┬────┘ └──────┬───────────┘   │
│        │             │            │             │                │
│  ┌─────┴─────────────┴────────────┴─────────────┴──────┐        │
│  │         Main Components & Hooks                      │        │
│  │  - MaintenanceDashboard - EquipmentRiskCard         │        │
│  │  - AfricaMapExact - ImportToolbar - Sidebar         │        │
│  └─────────────────┬──────────────────────────────────┘        │
└────────────────────┼─────────────────────────────────────────────┘
                     │ HTTP/REST (Axios)
                     │
┌────────────────────┼─────────────────────────────────────────────┐
│                    ▼              BACKEND (NestJS)              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  AppModule (Core Configuration & Module Imports)        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌──────────┐ ┌──────────────┐  │
│  │  Assistant │ │  Historique│ │Maintenance│ │  Carte       │  │
│  │  Module    │ │  Module    │ │ Module   │ │ Module       │  │
│  └────────────┘ └────────────┘ └──────────┘ └──────────────┘  │
│  ┌────────────┐ ┌────────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Prediction │ │  Parametre │ │  Import  │ │   Support    │  │
│  │  Module    │ │  Module    │ │  Module  │ │   Module     │  │
│  └────────────┘ └────────────┘ └──────────┘ └──────────────┘  │
│  ┌──────────────────────────────────────┐                      │
│  │      Health Module (Heartbeat)       │                      │
│  └──────────────────────────────────────┘                      │
│                    │                                             │
│  ┌────────────────┴─────────────────────┐                      │
│  │       TypeORM (Database Layer)       │                      │
│  │  - EquipementRepository              │                      │
│  │  - PanneRepository                   │                      │
│  └────────────────┬─────────────────────┘                      │
└────────────────────┼──────────────────────────────────────────┘
                     │ TCP/IP (Connection String)
                     │
┌────────────────────┼──────────────────────────────────────────┐
│                    ▼         POSTGRESQL DATABASE            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  equipements (id, nomEquipement, nombrePannes, etc)  │   │
│  │  Pannes (id, heure, dates, equipement_id, etc)       │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘

                          ┌─────────────────────────┐
                          │   ML-SERVICE (Python)   │
                          │  - Random Forest models │
                          │  - XGBoost models       │
                          │  - MLP classifiers      │
                          │  - predict.py script    │
                          └────────────────────────┘
                               │ (Child process)
                               │ Communication via JSON
                               │
                     POST /maintenance/predict
                     │
              InferenceService spawns Python
              for risk prediction
```

---

### 5.3 Data Flow Examples

#### Example 1: User Views Historical Failures
```
1. User navigates to /historique
2. HistoriquePage loads with default date range
3. Frontend calls: GET /historique/summary
4. Backend HistoriqueService:
   - Queries Panne table for date range
   - Aggregates failures by day (trend)
   - Counts by category
   - Counts by equipment
   - Finds latest incident
5. Frontend receives structured response
6. React renders charts and tables
```

#### Example 2: User Gets Risk Prediction for Equipment
```
1. MaintenanceDashboard displays demo equipment
2. EquipmentRiskCard builds mock maintenance payload
3. Sends: POST /maintenance/predict
   - heure_du_jour: 14
   - jour_semaine: 3
   - pannes_90_derniers_jours: 8
   - categorie: "COM"
   - [etc other temporal features]
4. Backend InferenceService:
   - Validates payload
   - Spawns Python process
   - Calls: ml-service/src/predict.py
   - Executes loaded RandomForest model
5. Python returns JSON:
   {
     "classe_predite": 1,
     "statut_predit": "Risque",
     "probabilite_risque": 0.62,
     "confiance": 0.91
   }
6. NestJS adds triggerAlert flag (>= 0.40)
7. Frontend displays red card if probabilite_risque >= 0.5
```

#### Example 3: User Imports Historical Excel File
```
1. User selects COM category and 2023 year
2. Picks monthly_failures.xlsx file
3. Frontend: POST /import/upload with FormData
4. Backend ImportService:
   - Parses Excel workbook (xlsx library)
   - Finds sheets with valid month names
   - Extracts equipment columns from headers
   - Iterates rows, builds date from day + year/month
   - For each failure count:
     - Finds or creates Equipement
     - Creates Panne record
5. Returns: { inserted: 45, skipped: 2 }
6. Frontend shows success toast
7. Historique module now has new data
```

#### Example 4: User Chats with AI Assistant
```
1. User types: "Quels equipements semblent critiques ?"
2. Frontend: POST /assistant/chat
   {
     "message": "Quels equipements semblent critiques ?",
     "period": "2024-01-01",
     "category": "ALL"
   }
3. Backend AssistantService:
   - Extracts context (period, category)
   - Calls AssistantContextService to build summary:
     * Queries recent failures
     * Counts by equipment
     * Gets failure trends
   - Constructs system prompt (French, professional)
   - Calls OpenRouter API with:
     * User message
     * Database context
     * System instructions
4. OpenRouter returns LLM response in French
5. Backend formats text (no Markdown)
6. Frontend displays response
7. Messages stored in localStorage
```

---

### 5.4 Database Schema

```
┌─────────────────────────────────────────┐
│           equipements                   │
├─────────────────────────────────────────┤
│ ID (PK)                                 │
│ nomEquipement (VARCHAR 255)             │
│ nombrePannes (INT, default 0)           │
│ categorie (VARCHAR 100, nullable)       │
│                                         │
│ Unique Index: (nomEquipement, categorie)│
└────────────────┬────────────────────────┘
                 │ 1 to Many
                 │
┌────────────────▼────────────────────────┐
│              Pannes                     │
├─────────────────────────────────────────┤
│ ID (PK)                                 │
│ heure (TIME, nullable)                  │
│ dates (DATE, nullable)                  │
│ commentaires (TEXT, nullable)           │
│ equipement_id (FK, CASCADE DELETE)      │
└─────────────────────────────────────────┘
```

---

### 5.5 API Routes Summary

| Method | Endpoint | Module | Purpose |
|--------|----------|--------|---------|
| GET | `/health` | Health | System heartbeat |
| GET | `/assistant` | Assistant | Get AI status |
| POST | `/assistant/chat` | Assistant | Send message to AI |
| GET | `/carte` | Carte | Get routes failure data |
| GET | `/historique` | Historique | Get default summary |
| GET | `/historique/summary?period=&category=` | Historique | Filtered failure summary |
| GET | `/historique/details?period=&category=` | Historique | Detailed failure records |
| POST | `/maintenance/predict` | Maintenance | Predict equipment risk |
| GET | `/prediction` | Prediction | Get predictions |
| GET | `/parametre` | Parametre | Get settings |
| PUT | `/parametre` | Parametre | Update settings |
| GET | `/support` | Support | Get support info |
| POST | `/import/upload` | Import | Import Excel data |

---

### 5.6 External Dependencies

**Frontend**:
- OpenRouter API (via backend)

**Backend**:
- PostgreSQL database
- OpenRouter API (for LLM)
- Python runtime (for ML inference)

**ML Service**:
- scikit-learn models
- XGBoost models
- Python packages (pandas, numpy, joblib)

---

### 5.7 Configuration

**Frontend** (.env):
- `REACT_APP_API_URL` - Backend API base URL (default: http://localhost:3001)

**Backend** (.env):
- `DB_HOST` - PostgreSQL host
- `DB_PORT` - PostgreSQL port (default 5432)
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password
- `DB_NAME` - Database name
- `DB_SSL` - Enable SSL (true/false)
- `OPENROUTER_API_KEY` - OpenRouter API key
- `ML_PYTHON_PATH` - Custom Python executable path

---

## 6. KEY WORKFLOWS

### Workflow 1: Maintenance Prediction Pipeline
```
Equipment Sensor Data
         ↓
Temporal Features (hour, day, weekday)
         ↓
Historical Failure Counts (24h, 48h, 7d, 30d, 90d)
         ↓
Equipment Category
         ↓
Random Forest Model Inference
         ↓
Risk Probability (0-1)
         ↓
Status Classification (Sain/Risque)
         ↓
Frontend Risk Card Display
```

### Workflow 2: Data Import Pipeline
```
Excel File Upload
         ↓
Parse Workbook (multi-sheet)
         ↓
Extract Month from Sheet Names
         ↓
Parse Equipment Columns from Headers
         ↓
Build Dates from Day + Year/Month
         ↓
Validate Calendar Dates
         ↓
Create/Update Equipment Records
         ↓
Create Panne Records
         ↓
Aggregate Failure Counts
```

### Workflow 3: Assistant Conversation
```
User Message
         ↓
Extract Period & Category Context
         ↓
Query Database for Relevant Data
         ↓
Build Context Summary
         ↓
Call OpenRouter LLM
         ↓
Format Response (Plain Text, French)
         ↓
Return to Frontend
         ↓
Store in localStorage
```

---

## 7. FEATURE COMPLETENESS ASSESSMENT

| Feature | Status | Components | Module |
|---------|--------|-----------|--------|
| Historical Analysis | ✅ Complete | HistoriquePage, ImportToolbar | Historique, Import |
| Risk Prediction | ✅ Complete | PredictionPage, EquipmentRiskCard | Maintenance, Prediction |
| Geospatial Visualization | ✅ Complete | CartePage, AfricaMapExact | Carte |
| AI Assistant | ✅ Complete | AssistantPage | Assistant |
| Settings Management | ✅ Complete | ParametrePage | Parametre |
| Data Import | ✅ Complete | ImportToolbar | Import |
| System Health | ✅ Complete | - | Health |
| Support Hub | ⚠️ Partial | SupportPage | Support |

---

## 8. SECURITY CONSIDERATIONS

- **API Key Management**: OpenRouter API key stored in backend .env
- **Database Credentials**: Configured via environment variables
- **CORS**: Not explicitly configured (may need frontend domain whitelist)
- **Input Validation**: Implemented in maintenance prediction and import modules
- **File Upload**: No file type validation visible in ImportController
- **Rate Limiting**: Not implemented

---

## 9. PERFORMANCE OPTIMIZATIONS

**Frontend**:
- useMemo for expensive calculations
- useRef for DOM avoiding unnecessary re-renders
- localStorage for chat history persistence
- Component lazy loading via React Router

**Backend**:
- Database indexes on (nomEquipement, categorie)
- Parallel queries in HistoriqueService
- Connection pooling via TypeORM

**ML Service**:
- Pre-loaded joblib models (not retraining)
- Child process spawning for predictions

---

## 10. MISSING/TODO ITEMS

1. **File Type Validation** - Import module should validate .xlsx format
2. **Rate Limiting** - Prevent abuse of API endpoints
3. **Authentication/Authorization** - No user management visible
4. **Error Handling** - Some edge cases may not be covered
5. **Caching** - No Redis or caching layer
6. **Logging** - Centralized logging not visible
7. **Testing** - Limited test coverage visible
8. **Documentation** - API documentation (Swagger) not implemented
9. **CORS Configuration** - Needs frontend domain whitelist

---

## Summary

**ProjetPrediction** is a well-structured full-stack application for predictive equipment maintenance using:
- **6 frontend pages** providing different views (historical, predictive, geospatial, conversational)
- **9 backend modules** offering APIs for data access and ML inference
- **2 database entities** (Equipement, Panne) tracking equipment and failures
- **Python ML integration** for real-time risk predictions
- **OpenRouter LLM** for French-language technical assistance

The architecture cleanly separates concerns with frontend handling UI/UX, backend managing business logic and data, and ML service handling model inference.
