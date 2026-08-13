import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { MaintenanceDto } from './dto/maintenance.dto';

export interface RiskPrediction {
  equipement_id?: number | null;
  classe_predite: number;
  statut_predit: string;
  confiance: number;
  probabilite_risque: number;
  risk_threshold: number;
  triggerAlert: boolean;
  categorie: string;
  estimation_prochaine_panne: null | {
    intervalle_id: number;
    intervalle_libelle: string;
    confiance: number;
    heures_min: number;
    heures_max: number;
    heures_estimees: number;
    date_debut: string;
    date_fin: string;
    date_estimee: string;
  };
}

@Injectable()
export class InferenceService {
  private activeProcesses = 0;
  private readonly timeoutMs = Number(process.env.ML_INFERENCE_TIMEOUT_MS ?? 15_000);
  private readonly maxConcurrentProcesses = Number(process.env.ML_MAX_CONCURRENCY ?? 2);
  private readonly maxOutputBytes = Number(process.env.ML_MAX_OUTPUT_BYTES ?? 64_000);
  private readonly requiredNumericFields: Array<keyof MaintenanceDto> = [
    'jour_semaine',
    'est_weekend',
    'mois',
    'jours_depuis_derniere_panne',
    'pannes_dernieres_1j',
    'pannes_dernieres_2j',
    'pannes_7_derniers_jours',
    'pannes_14_derniers_jours',
    'pannes_30_derniers_jours',
    'pannes_90_derniers_jours',
    'intervalle_median_pannes_jours',
    'mtbf_jours',
    'taux_panne_mois',
    'tendance_pannes',
    'comment_hs_30j',
    'comment_liaison_30j',
    'comment_reset_30j',
    'comment_sans_intervention_30j',
    'comment_perturbation_30j',
  ];

  async predictEquipmentRisk(data: MaintenanceDto): Promise<RiskPrediction> {
    this.validatePayload(data);

    const mlServiceDir =
      process.env.ML_SERVICE_DIR || resolve(process.cwd(), '..', 'ml-service');
    const predictScript = join(mlServiceDir, 'src', 'predict.py');
    const venvPython = join(mlServiceDir, 'venv', 'Scripts', 'python.exe');
    const pythonCommand =
      process.env.ML_PYTHON_PATH || (existsSync(venvPython) ? venvPython : 'python');

    const stdout = await this.runPython(
      pythonCommand,
      predictScript,
      JSON.stringify(data),
      mlServiceDir,
    );

    try {
      const parsed = JSON.parse(stdout) as RiskPrediction;
      if (typeof parsed.probabilite_risque !== 'number') {
        throw new Error('Champ probabilite_risque absent.');
      }
      return parsed;
    } catch (error) {
      throw new InternalServerErrorException(
        `Reponse Python invalide: ${String(error)}`,
      );
    }
  }

  private validatePayload(data: MaintenanceDto): void {
    if (!data || typeof data !== 'object') {
      throw new BadRequestException('Payload maintenance invalide.');
    }

    for (const field of this.requiredNumericFields) {
      const value = data[field];
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new BadRequestException(`Le champ ${field} doit etre un nombre.`);
      }
    }

    if (!data.categorie || typeof data.categorie !== 'string') {
      throw new BadRequestException('Le champ categorie doit etre une chaine.');
    }

    if (!/^[A-Z0-9_-]{2,20}$/i.test(data.categorie.trim())) {
      throw new BadRequestException('Le champ categorie contient des caracteres non autorises.');
    }
  }

  private runPython(
    pythonCommand: string,
    scriptPath: string,
    jsonPayload: string,
    cwd: string,
  ): Promise<string> {
    return new Promise((resolvePromise, rejectPromise) => {
      if (this.activeProcesses >= this.maxConcurrentProcesses) {
        rejectPromise(
          new InternalServerErrorException(
            'Le service de prediction est momentanement sature. Reessayez plus tard.',
          ),
        );
        return;
      }

      this.activeProcesses += 1;
      const child = spawn(pythonCommand, [scriptPath, jsonPayload], {
        cwd,
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';
      let settled = false;
      const timeout = setTimeout(() => {
        settled = true;
        child.kill();
        this.activeProcesses -= 1;
        rejectPromise(
          new InternalServerErrorException("Delai d'inference depasse."),
        );
      }, this.timeoutMs);

      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.activeProcesses -= 1;
        callback();
      };

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
        if (Buffer.byteLength(stdout) > this.maxOutputBytes) {
          child.kill();
          finish(() =>
            rejectPromise(
              new InternalServerErrorException('Sortie Python trop volumineuse.'),
            ),
          );
        }
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
        if (Buffer.byteLength(stderr) > this.maxOutputBytes) {
          child.kill();
          finish(() =>
            rejectPromise(
              new InternalServerErrorException('Sortie erreur Python trop volumineuse.'),
            ),
          );
        }
      });

      child.on('error', (error) => {
        finish(() =>
          rejectPromise(
            new InternalServerErrorException(
              `Impossible de lancer Python: ${error.message}`,
            ),
          ),
        );
      });

      child.on('close', (code) => {
        if (code !== 0) {
          finish(() =>
            rejectPromise(
              new InternalServerErrorException(
                `Erreur inference Python (${code}). Consultez les logs serveur.`,
              ),
            ),
          );
          return;
        }

        finish(() => resolvePromise(stdout.trim()));
      });
    });
  }
}
