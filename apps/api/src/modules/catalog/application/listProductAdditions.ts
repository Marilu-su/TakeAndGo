import type { Actor } from '../../../shared/auth/actor';
import { DomainError } from '../../../shared/domain/DomainError';
import type { Addition } from '../domain/addition';
import { assertCanManageStoreCatalog } from '../domain/catalogAuthorization';
import type {
    AdditionRepositoryPort,
    ProductAdditionRepositoryPort,
    ProductRepositoryPort,
} from './ports';

export type ListProductAdditionsCommand = {
    storeId: string;
    productId: string;
};

type Dependencies = {
    products: ProductRepositoryPort;
    additions: AdditionRepositoryPort;
    productAdditions: ProductAdditionRepositoryPort;
};

export function makeListProductAdditions({ products, additions, productAdditions }: Dependencies) {
    return async function listProductAdditions(
        actor: Actor,
        command: ListProductAdditionsCommand,
    ): Promise<Addition[]> {
        assertCanManageStoreCatalog(actor, command.storeId);

        const product = await products.findById(command.productId);

        if (!product || product.storeId !== command.storeId) {
        throw new DomainError('PRODUCT_NOT_FOUND', 'El producto no existe en este buffet');
        }

        const additionIds = await productAdditions.listAdditionIds(product.id);

        return additions.findManyByIds(additionIds);
    };
}