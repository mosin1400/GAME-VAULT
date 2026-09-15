import BuildForm from "@/components/BuildForm";
import RequestList from "@/components/RequestList";
import StatusBar from "@/components/StatusBar";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-extrabold md:text-3xl">Agent سازندهٔ اتوماسیون</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
          درخواست‌های طبیعی شما را دریافت می‌کند، با <b className="text-slate-200">Codex</b> به یک Workflow دقیق n8n تبدیل می‌کند،
          آن را اعتبارسنجی و از طریق <b className="text-slate-200">API / MCP</b> در n8n می‌سازد، فعال می‌کند و در صورت خطا خودش را ترمیم می‌کند.
          هر موفقیت به حافظه اضافه می‌شود؛ بنابراین با هر بار استفاده هوشمندتر می‌شود.
        </p>
      </section>

      <StatusBar />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <BuildForm />
        </div>
        <div className="lg:col-span-2">
          <RequestList />
        </div>
      </div>
    </div>
  );
}
