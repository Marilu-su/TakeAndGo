
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import errorHandler from './middlewares/errorHandler';
import { checkDatabaseConnection } from './infrastructure/database/checkDatabase';
import { getPrisma } from './infrastructure/database/prisma';
import { domainErrorHandler } from './shared/http/domainErrorHandler';
import type { ActorResolver } from './shared/http/actorResolver';
import type { IdentityResolver } from './shared/http/identityResolver';
import { createDefaultAuthResolvers } from './infrastructure/auth/authModule';

import { createOrganizationRouter } from './modules/organization/infrastructure/http/organizationRoutes';
import {
  createPrismaCreateStore,
  type CreateStore,
} from './modules/organization/infrastructure/organizationModule';

import {
  createPickupModule,
  type PickupModule,
} from './modules/pickup/infrastructure/pickupModule';

import { createPickupRouter } from './modules/pickup/infrastructure/http/pickupRoutes';

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
import { makeRequireStoreCatalogAccess } from './modules/catalog/application/viewStoreCatalog';
import { CustomerModuleMemberships } from './modules/catalog/infrastructure/customerModuleMemberships';
import { PrismaStoreRepository } from './modules/organization/infrastructure/prismaStoreRepository';

import { createMeRouter } from './infrastructure/auth/http/meRoutes';
import { createCustomerRouter } from './modules/customer/infrastructure/http/customerRoutes';
import { createCustomerStoreRouter } from './modules/customer/infrastructure/http/customerStoreRoutes';
import { createStoreManagementRouter } from './modules/organization/infrastructure/http/storeManagementRoutes';
import { createPrismaStoreManagement } from './modules/organization/infrastructure/organizationModule';
import { createPrismaListCustomerStores, createPrismaAssociateCustomerToStore, createPrismaCustomerPreferences } from './modules/customer/infrastructure/customerModule';
import { createCustomerPreferencesRouter } from './modules/customer/infrastructure/http/customerPreferencesRoutes';
import {
  createPrismaRegisterCustomer,
  type RegisterCustomer,
} from './modules/customer/infrastructure/customerModule';

// Módulos Stock y Order
import {
  createStockModule,
  type StockModule,
} from './modules/stock/infrastructure/stockModule';

import {
  createOrderModule,
  type OrderModule,
} from './modules/order/infrastructure/orderModule';

import { createOrderRouter } from './modules/order/infrastructure/http/orderRoutes';
import { ListPickupWindowsUseCase } from './modules/order/application/listPickupWindowsUseCase';
import { createResolvedDemoStoreSchedule } from './modules/order/infrastructure/demoStoreSchedule';
import {
  createPickupWindowRouter,
  type PickupWindowHttpDependencies,
} from './modules/order/infrastructure/http/pickupWindowRoutes';
import { PrismaOrderRepository } from './modules/order/infrastructure/prismaOrderRepository';
import { createStockRouter } from './modules/stock/infrastructure/http/stockRoutes';

// Módulo Cocina (C2-18)
import {
  createKitchenModule,
  type KitchenModule,
} from './modules/kitchen/infrastructure/kitchenModule';

import { createKitchenRouter } from './modules/kitchen/infrastructure/http/kitchenRoutes';
import { createMeniaModule } from './modules/menia/infrastructure/meniaModule';
import { createMeniaRouter, meniaJsonErrorHandler } from './modules/menia/infrastructure/http/meniaRoutes';
import type { MeniaUseCases } from './modules/menia/application/meniaUseCases';

// Módulo Pagos (MVP-06)
import {
  createPaymentModule,
  type PaymentModule,
} from './modules/payment/infrastructure/paymentModule';

import { createPaymentRouter } from './modules/payment/infrastructure/http/paymentRoutes';

export type AppDependencies = {
  checkDatabase: () => Promise<boolean>;
  resolveActor: ActorResolver;
  resolveIdentity: IdentityResolver;
  registerCustomer: RegisterCustomer;
  customerPreferences: ReturnType<typeof createPrismaCustomerPreferences>;
  createStore: CreateStore;
  categoryUseCases: CategoryUseCases;
  productUseCases: ProductUseCases;
  additionUseCases: AdditionUseCases;
  storeCatalogUseCases: StoreCatalogUseCases;
  stockModule: StockModule;
  orderModule: OrderModule;
  pickupWindows: Omit<PickupWindowHttpDependencies, 'resolveActor'>;
  kitchenModule: KitchenModule;
  pickupModule: PickupModule;
  meniaUseCases: MeniaUseCases;

  paymentModule: PaymentModule;
};

function defaultDependencies(): AppDependencies {
  const auth = createDefaultAuthResolvers();

  const stockModule = createStockModule();
  const pickupSchedules = createResolvedDemoStoreSchedule({
    findByCode: code => new PrismaStoreRepository(getPrisma()).findByCode(code),
  });
  const orderModule = createOrderModule(stockModule.stockRepository, pickupSchedules);
  const pickupWindows = new ListPickupWindowsUseCase(pickupSchedules);

  // Cocina reutiliza el repositorio existente de pedidos
  const kitchenModule = createKitchenModule(orderModule.orderRepository);

  const pickupModule = createPickupModule();


  return {
    checkDatabase: checkDatabaseConnection,
    resolveActor: auth.resolveActor,
    resolveIdentity: auth.resolveIdentity,
    registerCustomer: createPrismaRegisterCustomer(),
    customerPreferences: createPrismaCustomerPreferences(),
    createStore: createPrismaCreateStore(),
    categoryUseCases: createPrismaCategoryUseCases(),
    productUseCases: createPrismaProductUseCases(),
    additionUseCases: createPrismaAdditionUseCases(),
    storeCatalogUseCases: createPrismaStoreCatalogUseCases(),
    stockModule,
    orderModule,
    pickupWindows: {
      requireCatalogAccess: makeRequireStoreCatalogAccess(
        new CustomerModuleMemberships(createPrismaListCustomerStores()),
      ),
      getAvailability: storeId => pickupWindows.getAvailability(storeId),
    },
    kitchenModule,
    pickupModule,
    meniaUseCases: createMeniaModule(),

    paymentModule: createPaymentModule({
      orderRepository: orderModule.orderRepository,
      releaseExpiredReservations: orderModule.releaseExpiredReservationsUseCase,
    }),
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
  app.use('/api/v1/stores/:storeId/menia', meniaJsonErrorHandler);

  app.use('/api/v1', createMeniaRouter({
    resolveActor: dependencies.resolveActor,
    useCases: dependencies.meniaUseCases,
  }));

  app.get('/health', async (_req, res) => {
    const databaseOk = await dependencies.checkDatabase();

    res.status(200).json({
      status: 'ok',
      service: 'take-and-go-api',
      database: databaseOk ? 'ok' : 'error',
      timestamp: new Date(),
    });
  });

  app.use('/api/v1', createMeRouter({ resolveActor: dependencies.resolveActor }));
  app.use('/api/v1', createStockRouter({
    resolveActor: dependencies.resolveActor,
    products: dependencies.productUseCases.listProducts,
    additions: dependencies.additionUseCases.listAdditions,
    stock: dependencies.stockModule.stockRepository,
  }));
  app.use('/api/v1', createStoreManagementRouter(dependencies.resolveActor, createPrismaStoreManagement()));
  app.use('/api/v1', createCustomerStoreRouter({
    resolveActor: dependencies.resolveActor,
    listStores: createPrismaListCustomerStores(),
    associateStore: createPrismaAssociateCustomerToStore(),
  }));
  app.use('/api/v1', createCustomerPreferencesRouter(dependencies.resolveActor, dependencies.customerPreferences));

  app.use(
    '/api/v1',
    createCustomerRouter({
      registerCustomer: dependencies.registerCustomer,
      resolveIdentity: dependencies.resolveIdentity,
    }),
  );

  app.use(
    '/api/v1',
    createOrganizationRouter({
      createStore: dependencies.createStore,
      resolveActor: dependencies.resolveActor,
      resolveIdentity: dependencies.resolveIdentity,
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
      getCustomerPreferences: userId => dependencies.customerPreferences.get(userId),
    }),
  );

  app.use('/api/v1', createPickupWindowRouter({
    ...dependencies.pickupWindows,
    resolveActor: dependencies.resolveActor,
  }));

  // Rutas de Pedidos (C2-12)
  app.use(
    '/api/v1',
    createOrderRouter(dependencies.orderModule, {
      resolveActor: dependencies.resolveActor,
      viewCatalog: dependencies.storeCatalogUseCases.viewStoreCatalog,
      listOrders: customerId => new PrismaOrderRepository().findByCustomer(customerId),
      getCustomerPreferences: userId => dependencies.customerPreferences.get(userId),
    }),
  );

  // Rutas de Cocina (C2-18)
  app.use(
    '/api/v1',
    createKitchenRouter({
      kitchenModule: dependencies.kitchenModule,
      resolveActor: dependencies.resolveActor,
    }),
  );

// Rutas de Retiro (C2-19)
app.use(
  '/api/v1',
  createPickupRouter({
    pickupModule: dependencies.pickupModule,
    resolveActor: dependencies.resolveActor,
  }),
);

// Rutas de Pagos (MVP-06)
app.use(
  '/api/v1',
  createPaymentRouter({
    resolveActor: dependencies.resolveActor,
    findOrder: orderId => dependencies.orderModule.orderRepository.findById(orderId),
    paymentModule: dependencies.paymentModule,
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
