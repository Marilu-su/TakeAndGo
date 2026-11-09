
import { ConfirmPickupUseCase } from '../application/confirmPickupUseCase';
import { IssuePickupTokenUseCase } from '../application/issuePickupTokenUseCase';
import { ManualPickupUseCase } from '../application/manualPickupUseCase';

import { PrismaConfirmPickupAdapter } from './prismaConfirmPickupAdapter';
import { PrismaIssuePickupTokenAdapter } from './prismaIssuePickupTokenAdapter';
import { PrismaManualPickupAdapter } from './prismaManualPickupAdapter';

export interface PickupModule {
  confirmPickupUseCase: ConfirmPickupUseCase;
  issuePickupTokenUseCase: IssuePickupTokenUseCase;
  manualPickupUseCase: ManualPickupUseCase;
}

export function createPickupModule(): PickupModule {
  const confirmPickupPort = new PrismaConfirmPickupAdapter();
  const issuePickupTokenPort = new PrismaIssuePickupTokenAdapter();
  const manualPickupPort = new PrismaManualPickupAdapter();

  return {
    confirmPickupUseCase: new ConfirmPickupUseCase(
      confirmPickupPort
    ),
    issuePickupTokenUseCase: new IssuePickupTokenUseCase(
      issuePickupTokenPort
    ),
    manualPickupUseCase: new ManualPickupUseCase(
      manualPickupPort
    ),
  };
}
