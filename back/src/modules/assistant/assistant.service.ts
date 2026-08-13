import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssistantContextService } from './assistant-context.service';
import { ChatDto } from './dto/chat.dto';

type OpenRouterMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type OpenRouterResponse = {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

const FRENCH_MONTHS: Record<string, string> = {
  janvier: '01',
  fevrier: '02',
  mars: '03',
  avril: '04',
  mai: '05',
  juin: '06',
  juillet: '07',
  aout: '08',
  septembre: '09',
  octobre: '10',
  novembre: '11',
  decembre: '12',
};

const KNOWN_CATEGORIES = ['COM', 'SURV', 'MET', 'RESEAU'] as const;
const MAX_MESSAGE_LENGTH = 2000;
const PERIOD_PATTERN = /^20\d{2}-(0[1-9]|1[0-2])$/;

@Injectable()
export class AssistantService {
  private readonly systemPrompt =
    "Tu es l'assistant IA de supervision technique du projet Prediction. Reponds en francais, avec un ton clair, utile et professionnel. Appuie-toi en priorite sur le contexte metier fourni. Si une information manque, dis-le franchement. Donne des reponses concretes, structurees et faciles a comprendre. Exploite explicitement les sections sur les causes probables, les solutions deja appliquees et les commentaires recents quand elles existent. N'utilise pas le format Markdown : pas de #, pas de *, pas de **, pas de listes Markdown. Ecris en texte simple avec des phrases claires et des retours a la ligne sobres.";

  constructor(
    private readonly configService: ConfigService,
    private readonly assistantContextService: AssistantContextService,
  ) {}

  getAssistantSummary() {
    return {
      source: 'openrouter',
      status: 'ready',
      model: this.getModel(),
      message: "Assistant IA configure pour OpenRouter. Utilisez l'endpoint POST /assistant/chat.",
    };
  }

  async chat(body: ChatDto) {
    const normalizedMessage = body?.message?.trim();

    if (!normalizedMessage) {
      throw new BadRequestException('Le message est obligatoire.');
    }

    if (normalizedMessage.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(
        `Le message ne doit pas depasser ${MAX_MESSAGE_LENGTH} caracteres.`,
      );
    }

    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        "La cle API OpenRouter n'est pas configuree dans le back.",
      );
    }

    const requestContext = this.extractRequestContext(body, normalizedMessage);
    const includeDatabaseContext =
      this.configService.get<string>('ASSISTANT_INCLUDE_DB_CONTEXT') === 'true';
    const assistantContext = includeDatabaseContext
      ? await this.assistantContextService.buildContext({
          period: requestContext.period,
          category: requestContext.category,
        })
      : {
          summary:
            "Contexte base de donnees desactive par configuration securite. Reponds sans divulguer de donnees internes.",
          period: requestContext.period ?? null,
          category: requestContext.category ?? null,
        };

    const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': this.getReferer(),
        'X-Title': 'ProjetPrediction Assistant IA',
      },
      body: JSON.stringify({
        model: this.getModel(),
        messages: this.buildMessages(normalizedMessage, assistantContext.summary),
      }),
    });

    const payload = (await response.json().catch(() => null)) as OpenRouterResponse | null;

    if (!response.ok) {
      throw new InternalServerErrorException(
        "Erreur lors de l'appel au fournisseur IA.",
      );
    }

    const reply = this.normalizeAssistantReply(
      payload?.choices?.[0]?.message?.content?.trim() || '',
    );

    if (!reply) {
      throw new InternalServerErrorException("Aucune reponse n'a ete renvoyee par OpenRouter.");
    }

    return {
      reply,
      model: payload?.model || this.getModel(),
      provider: 'openrouter',
      context: {
        period: assistantContext.period,
        category: assistantContext.category,
        requestedPeriod: requestContext.period ?? null,
        requestedCategory: requestContext.category ?? null,
      },
      createdAt: new Date().toISOString(),
    };
  }

  private extractRequestContext(body: ChatDto, userMessage: string) {
    const directPeriod = this.validatePeriod(body.period?.trim() || undefined);
    const directCategory = this.validateCategory(body.category?.trim() || undefined);

    if (directPeriod || directCategory) {
      return {
        period: directPeriod,
        category: directCategory,
      };
    }

    return {
      period: this.validatePeriod(this.extractPeriodFromMessage(userMessage) ?? undefined),
      category: this.validateCategory(this.extractCategoryFromMessage(userMessage) ?? undefined),
    };
  }

  private extractPeriodFromMessage(userMessage: string) {
    const normalizedMessage = this.normalizeText(userMessage);

    for (const [monthLabel, monthNumber] of Object.entries(FRENCH_MONTHS)) {
      const monthPattern = new RegExp(
        `\\b(?:en|du|de|pour|sur|au|aux|des)?\\s*${monthLabel}\\s+(20\\d{2})\\b`,
        'i',
      );
      const match = normalizedMessage.match(monthPattern);

      if (match?.[1]) {
        return `${match[1]}-${monthNumber}`;
      }
    }

    const isoMatch = normalizedMessage.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}`;
    }

    const slashMatch = normalizedMessage.match(/\b(0?[1-9]|1[0-2])[\/\-](20\d{2})\b/);
    if (slashMatch) {
      return `${slashMatch[2]}-${String(slashMatch[1]).padStart(2, '0')}`;
    }

    const reversedSlashMatch = normalizedMessage.match(/\b(20\d{2})[\/\-](0[1-9]|1[0-2])\b/);
    if (reversedSlashMatch) {
      return `${reversedSlashMatch[1]}-${reversedSlashMatch[2]}`;
    }

    return null;
  }

  private extractCategoryFromMessage(userMessage: string) {
    const normalizedMessage = this.normalizeText(userMessage).toUpperCase();
    const detectedCategory = KNOWN_CATEGORIES.find((category) =>
      new RegExp(`\\b${category}\\b`, 'i').test(normalizedMessage),
    );

    return detectedCategory ?? null;
  }

  private validatePeriod(period?: string) {
    if (!period) return undefined;

    if (!PERIOD_PATTERN.test(period)) {
      throw new BadRequestException('La periode doit respecter le format YYYY-MM.');
    }

    return period;
  }

  private validateCategory(category?: string | null) {
    if (!category || category === 'ALL') return undefined;

    const normalizedCategory = category.trim().toUpperCase();
    if (!KNOWN_CATEGORIES.includes(normalizedCategory as (typeof KNOWN_CATEGORIES)[number])) {
      throw new BadRequestException('Categorie assistant invalide.');
    }

    return normalizedCategory;
  }

  private normalizeText(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private normalizeAssistantReply(value: string) {
    return value
      .replace(/^#{1,6}\s*/gm, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/^\s*[-•]\s+/gm, '- ')
      .replace(/^\s*\d+\.\s+/gm, (match) => match.trim())
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private buildMessages(userMessage: string, contextSummary: string): OpenRouterMessage[] {
    return [
      { role: 'system', content: this.systemPrompt },
      {
        role: 'user',
        content: `Contexte metier issu de la base de donnees:\n${contextSummary}\n\nQuestion utilisateur:\n${userMessage}`,
      },
    ];
  }

  private getBaseUrl() {
    return (
      this.configService.get<string>('OPENROUTER_BASE_URL') || 'https://openrouter.ai/api/v1'
    );
  }

  private getModel() {
    return this.configService.get<string>('OPENROUTER_MODEL') || 'openrouter/free';
  }

  private getReferer() {
    return this.configService.get<string>('OPENROUTER_REFERER') || 'http://localhost:3000';
  }
}
