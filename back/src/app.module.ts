import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import { ApiKeyGuard } from './common/security/api-key.guard';
import { AppController } from './app.controller';
import { HealthModule } from './modules/health/health.module';
import { HistoriqueModule } from './modules/historique/historique.module';
import { PredictionModule } from './modules/prediction/prediction.module';
import { CarteModule } from './modules/carte/carte.module';
import { AssistantModule } from './modules/assistant/assistant.module';
import { ParametreModule } from './modules/parametre/parametre.module';
import { SupportModule } from './modules/support/support.module';
import { ImportModule } from './modules/import/import.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const db = configService.get('database');
        return {
          type: 'postgres',
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.name,
          ssl: db.ssl ? { rejectUnauthorized: db.rejectUnauthorized } : false,
          autoLoadEntities: true,
          synchronize: false,
        };
      },
    }),
    HealthModule,
    HistoriqueModule,
    PredictionModule,
    CarteModule,
    AssistantModule,
    ParametreModule,
    SupportModule,
    ImportModule,
    MaintenanceModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
})
export class AppModule {}
