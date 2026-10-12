import type { Actor } from '../../../shared/auth/actor';
import { DomainError } from '../../../shared/domain/DomainError';
import { assertAdditionsBelongToStore, type Addition } from '../domain/addition';
import { assertCanManageStoreCatalog } from '../domain/catalogAuthorization';
import type {
    AdditionRepositoryPort,
    ProductAdditionRepositoryPort,
    ProductRepositoryPort,
} from './ports';

export type ConfigureProductAdditionsCommand = {
    storeId: string;
    productId: string;
    additionIds: string[];
};

type Dependencies = {
    products: ProductRepositoryPort;
    additions: AdditionRepositoryPort;
    productAdditions: ProductAdditionRepositoryPort;
};

export function makeConfigureProductAdditions({ products, additions, productAdditions }: Dependencies) {
    return async function configureProductAdditions(
        actor: Actor,
        command: ConfigureProductAdditionsCommand,
    ): Promise<Addition[]> {
        assertCanManageStoreCatalog(actor, command.storeId);

        const product = await products.findById(command.productId);

        if (!product || product.storeId !== command.storeId) {
        throw new DomainError('PRODUCT_NOT_FOUND', 'El producto no existe en este buffet');
        }

        const uniqueIds = [...new Set(command.additionIds)];
        const found = await additions.findManyByIds(uniqueIds);

        if (found.length !== uniqueIds.length) {
        throw new DomainError('INVALID_ADDITION_SCOPE', 'Uno de los adicionales no pertenece a este buffet');
        }

        assertAdditionsBelongToStore(found, command.storeId);

        await productAdditions.replace(product.id, command.storeId, uniqueIds);

        return found;
    };
}