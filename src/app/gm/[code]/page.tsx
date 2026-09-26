import { GmDashboard } from "@/components/GmDashboard";

export default async function GmPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <GmDashboard code={code.toUpperCase()} />;
}
