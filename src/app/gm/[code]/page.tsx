import { SetupDashboard } from "@/components/SetupDashboard";

export default async function GmPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <SetupDashboard code={code.toUpperCase()} />;
}
