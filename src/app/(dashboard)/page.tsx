"use client";

import { useSession } from "next-auth/react";
import { Header } from "@/components/header";
import { useEffect, useState } from "react";

interface DashboardStats {
  totalTeachers: number;
  totalBatches: number;
  totalClassrooms: number;
  totalCenters: number;
  pendingLeaves: number;
  todayClasses: number;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <div>
      <Header title="Dashboard" />
      <div className="p-6 animate-fadeIn">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Welcome back, {session?.user?.name}!
          </h1>
          <p className="text-slate-500 mt-1">
            {isAdmin
              ? "Here's an overview of your coaching institute."
              : "Here's your schedule overview."}
          </p>
        </div>

        {isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <StatCard
              title="Centers"
              value={stats?.totalCenters ?? "-"}
              color="blue"
              icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5M3.75 3v18m16.5-18v18M5.25 3h13.5M5.25 21V10.5m13.5 10.5V10.5M8.25 6.75h.008v.008H8.25V6.75Zm0 3h.008v.008H8.25V9.75Zm3-3h.008v.008h-.008V6.75Zm0 3h.008v.008h-.008V9.75Zm3-3h.008v.008h-.008V6.75Zm0 3h.008v.008h-.008V9.75Z" /></svg>}
            />
            <StatCard
              title="Teachers"
              value={stats?.totalTeachers ?? "-"}
              color="emerald"
              icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>}
            />
            <StatCard
              title="Active Batches"
              value={stats?.totalBatches ?? "-"}
              color="violet"
              icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></svg>}
            />
            <StatCard
              title="Classrooms"
              value={stats?.totalClassrooms ?? "-"}
              color="amber"
              icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205 3 1m1.5.5-1.5-.5M6.75 7.364V3h-3v18m3-13.636 10.5-3.819" /></svg>}
            />
            <StatCard
              title="Pending Leaves"
              value={stats?.pendingLeaves ?? "-"}
              color="rose"
              icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>}
            />
            <StatCard
              title="Classes Today"
              value={stats?.todayClasses ?? "-"}
              color="cyan"
              icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>}
            />
          </div>
        )}

        {!isAdmin && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
            <p className="text-slate-400">
              Your timetable and schedule information will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}) {
  const styles: Record<string, { bg: string; iconBg: string; iconText: string }> = {
    blue: { bg: "from-blue-50 to-white", iconBg: "bg-blue-100", iconText: "text-blue-600" },
    emerald: { bg: "from-emerald-50 to-white", iconBg: "bg-emerald-100", iconText: "text-emerald-600" },
    violet: { bg: "from-violet-50 to-white", iconBg: "bg-violet-100", iconText: "text-violet-600" },
    amber: { bg: "from-amber-50 to-white", iconBg: "bg-amber-100", iconText: "text-amber-600" },
    rose: { bg: "from-rose-50 to-white", iconBg: "bg-rose-100", iconText: "text-rose-600" },
    cyan: { bg: "from-cyan-50 to-white", iconBg: "bg-cyan-100", iconText: "text-cyan-600" },
  };

  const s = styles[color] || styles.blue;

  return (
    <div className={`bg-gradient-to-br ${s.bg} rounded-2xl border border-slate-200/80 p-6 card-hover shadow-sm`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl ${s.iconBg} ${s.iconText} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
      <p className="text-sm text-slate-500 mt-1">{title}</p>
    </div>
  );
}
