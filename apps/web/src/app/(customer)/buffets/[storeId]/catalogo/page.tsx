import { StoreCatalog } from '@/components/catalog';
export default async function Page({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  return <StoreCatalog storeId={storeId} />;
}
