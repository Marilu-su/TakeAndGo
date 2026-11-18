import type { ReactNode } from 'react';
import { SessionShell } from '@/components/session-shell';

export default function StaffLayout({ children }: { children: ReactNode }) {
  return <SessionShell staff>{children}</SessionShell>;
}
