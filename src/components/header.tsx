"use client";

import { useSession } from "next-auth/react";

export function Header({ title }: { title?: string }) {
  const { data: session } = useSession();

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <h2 className="text-lg font-semibold text-gray-900">
        {title || "Dashboard"}
      </h2>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">
          Welcome, {session?.user?.name}
        </span>
      </div>
    </header>
  );
}
