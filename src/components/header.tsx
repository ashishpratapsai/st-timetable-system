"use client";

import { useSession } from "next-auth/react";

export function Header({ title }: { title?: string }) {
  const { data: session } = useSession();

  return (
    <header className="h-16 bg-white/80 backdrop-blur-xl sticky top-0 z-30 flex items-center justify-between px-6 border-b border-slate-200/60 shadow-[0_1px_3px_0_rgba(0,0,0,0.06)]">
      <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
        {title || "Dashboard"}
      </h2>
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-500">
          Welcome, <span className="font-medium text-slate-700">{session?.user?.name}</span>
        </span>
      </div>
    </header>
  );
}
