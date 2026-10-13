import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import errorHandler from './middlewares/errorHandler';
import { checkDatabaseConnection } from './infrastructure/database/checkDatabase';
import { domainErrorHandler } from './shared/http/domainErrorHandler';
import { unauthenticatedActorResolver, type ActorResolver } from './shared/http/actorResolver';
import { createOrganizationRouter } from './modules/organization/infrastructure/http/organizationRoutes';
import {
  createPrismaCreateStore,
  type CreateStore,
} from './modules/organization/infrastructure/organizationModule';
import { createCategoryRouter } from './modules/catalog/infrastructure/http/categoryRoutes';
import {
  createPrismaAdditionUseCases,
  createPrismaStoreCatalogUseCases,
  createPrismaCategoryUseCases,
  createPrismaProductUseCases,
  type AdditionUseCases,
  type StoreCatalogUseCases,
  type CategoryUseCases,
  type ProductUseCases,
} from './modules/catalog/infrastructure/catalogModule';
import { createProductRouter } from './modules/catalog/infrastructure/http/productRoutes';
import { createAdditionRouter } from './modules/catalog/infrastructure/http/additionRoutes';
import { createStoreCatalogRouter } from './modules/catalog/infrastructure/http/storeCatalogRoutes';

export type AppDependencies = {
  checkDatabase: () => Promise<boolean>;
  resolveActor: ActorResolver;
  createStore: CreateStore;
  categoryUseCases: CategoryUseCases;
  productUseCases: ProductUseCases;
  additionUseCases: AdditionUseCases;
  storeCatalogUseCases: StoreCatalogUseCases;
};

function defaultDependencies(): AppDependencies {
  return {
    checkDatabase: checkDatabaseConnection,
    resolveActor: unauthenticatedActorResolver,
    createStore: createPrismaCreateStore(),
    categoryUseCases: createPrismaCategoryUseCases(),
    productUseCases: createPrismaProductUseCases(),
    additionUseCases: createPrismaAdditionUseCases(),
    storeCatalogUseCases: createPrismaStoreCatalogUseCases(),
  };
}

export function createApp(overrides: Partial<AppDependencies> = {}) {
  const dependencies: AppDependencies = { ...defaultDependencies(), ...overrides };

  const app = express();

  const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

  app.use(morgan('dev'));

  app.use(
    cors({
      origin: CORS_ORIGIN,
    }),
  );

  app.use(express.json());

  app.get('/health', async (_req, res) => {
    const databaseOk = await dependencies.checkDatabase();

    res.status(200).json({
      status: 'ok',
      service: 'take-and-go-api',
      database: databaseOk ? 'ok' : 'error',
      timestamp: new Date(),
    });
  });

  app.use(
    '/api/v1',
    createOrganizationRouter({
      createStore: dependencies.createStore,
      resolveActor: dependencies.resolveActor,
    }),
  );

  app.use(
    '/api/v1',
    createCategoryRouter({
      useCases: dependencies.categoryUseCases,
      resolveActor: dependencies.resolveActor,
    }),
  );

  app.use(
    '/api/v1',
    createProductRouter({
      useCases: dependencies.productUseCases,
      resolveActor: dependencies.resolveActor,
    }),
  );

  app.use(
    '/api/v1',
    createAdditionRouter({
      useCases: dependencies.additionUseCases,
      resolveActor: dependencies.resolveActor,
    }),
  );

  app.use(
    '/api/v1',
    createStoreCatalogRouter({
      useCases: dependencies.storeCatalogUseCases,
      resolveActor: dependencies.resolveActor,
    }),
  );

  app.use((_req, res) => {
    res.status(404).json({
      error: 'Ruta no encontrada',
    });
  });

  app.use(domainErrorHandler);
  app.use(errorHandler);

  return app;
}

const app = createApp();

export default app;