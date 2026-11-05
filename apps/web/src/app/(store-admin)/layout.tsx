import { SessionShell } from '@/components/session-shell';
import type { ReactNode } from 'react';
export default function Layout({ children }: { children: ReactNode }) { return <SessionShell admin>{children}</SessionShell>; }
