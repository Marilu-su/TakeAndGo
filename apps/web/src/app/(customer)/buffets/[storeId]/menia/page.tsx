import { MeniaChat } from '@/components/menia-chat';

export default async function Page({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  return <MeniaChat key={storeId} storeId={storeId} />;
}
