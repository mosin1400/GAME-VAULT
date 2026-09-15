import Link from "next/link";
import { notFound } from "next/navigation";
import RequestDetail from "@/components/RequestDetail";

export const dynamic = "force-dynamic";

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isFinite(id)) notFound();
  return (
    <div className="space-y-4">
      <Link href="/" className="text-sm text-slate-400 hover:text-white">
        → بازگشت به داشبورد
      </Link>
      <RequestDetail id={id} />
    </div>
  );
}
