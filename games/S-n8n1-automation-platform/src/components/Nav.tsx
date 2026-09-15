import Link from "next/link";

const links = [
  { href: "/", label: "داشبورد" },
  { href: "/workflows", label: "Workflowها" },
  { href: "/executions", label: "اجراها" },
  { href: "/credentials", label: "Credentialها" },
  { href: "/variables", label: "متغیرها" },
  { href: "/nodes", label: "کاتالوگ نودها" },
];

export default function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-white">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-base">⚡</span>
          FlowForge
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
