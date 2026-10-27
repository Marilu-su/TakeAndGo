import type { StockRepository } from '../domain/stockRepository';
import { PrismaStockRepository } from './prismaStockRepository';

export interface StockModule {
  stockRepository: StockRepository;
}

export function createStockModule(): StockModule {
  return {
    stockRepository: new PrismaStockRepository(),
  };
}
