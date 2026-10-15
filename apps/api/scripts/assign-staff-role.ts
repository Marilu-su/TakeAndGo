import 'dotenv/config';

import { getPrisma } from '../src/infrastructure/database/prisma';
import { isStaffRole } from '../src/modules/organization/domain/staffScope';
import { createStoreCode } from '../src/modules/organization/domain/storeCode';
import {
    createPrismaAssignStaffRole,
    type AssignStaffRole,
} from '../src/modules/organization/infrastructure/organizationModule';

const USAGE = `Uso (desde apps/api):
    npx tsx scripts/assign-staff-role.ts <email> STORE_ADMIN <código-de-buffet>
    npx tsx scripts/assign-staff-role.ts <email> STORE_EMPLOYEE <código-de-buffet>
    npx tsx scripts/assign-staff-role.ts <email> ORGANIZATION_ADMIN <id-de-organización>`;

async function main() {
    const [email, role, target] = process.argv.slice(2);

    if (!email || !role || !target || !isStaffRole(role)) {
        console.error(USAGE);
        process.exitCode = 1;
        return;
    }

    const prisma = getPrisma();

    const users = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM neon_auth."user" WHERE lower(email) = lower(${email})
    `;

    if (users.length === 0) {
        console.error(`No existe un usuario registrado en Neon Auth con el email ${email}.`);
        process.exitCode = 1;
        return;
    }

    const authUserId = String(users[0].id);
    let command: Parameters<AssignStaffRole>[0];

    if (role === 'ORGANIZATION_ADMIN') {
        command = { authUserId, role, organizationId: target };
    } else {
        const store = await prisma.store.findUnique({ where: { code: createStoreCode(target) } });

        if (!store) {
        console.error(`No existe un buffet con el código ${target}.`);
        process.exitCode = 1;
        return;
        }

        command = { authUserId, role, storeId: store.id };
    }

    const scope = await createPrismaAssignStaffRole()(command);

    console.log(`Rol ${scope.role} asignado a ${email}${role === 'ORGANIZATION_ADMIN' ? '' : ` en el buffet ${target.toUpperCase()}`}.`);
}

main()
    .catch((error: unknown) => {
        console.error('Error al asignar el rol:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await getPrisma().$disconnect();
    });