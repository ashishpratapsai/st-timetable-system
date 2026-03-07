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
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {session?.user?.name}!
          </h1>
          <p className="text-gray-500 mt-1">
            {isAdmin
              ? "Here's an overview of your coaching institute."
              : "Here's your schedule overview."}
          </p>
        </div>

        {isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard
              title="Centers"
              value={stats?.totalCenters ?? "-"}
              icon="🏢"
              color="blue"
            />
            <StatCard
              title="Teachers"
              value={stats?.totalTeachers ?? "-"}
              icon="👨‍🏫"
              color="green"
            />
            <StatCard
              title="Active Batches"
              value={stats?.totalBatches ?? "-"}
              icon="👥"
              color="purple"
            />
            <StatCard
              title="Classrooms"
              value={stats?.totalClassrooms ?? "-"}
              icon="🏫"
              color="orange"
            />
            <StatCard
              title="Pending Leaves"
              value={stats?.pendingLeaves ?? "-"}
              icon="📝"
              color="red"
            />
            <StatCard
              title="Classes Today"
              value={stats?.todayClasses ?? "-"}
              icon="📅"
              color="teal"
            />
          </div>
        )}

        {!isAdmin && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500">
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
  icon: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    purple: "bg-purple-50 text-purple-700",
    orange: "bg-orange-50 text-orange-700",
    red: "bg-red-50 text-red-700",
    teal: "bg-teal-50 text-teal-700",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <span className={`text-2xl p-2 rounded-lg ${colorMap[color]}`}>
          {icon}
        </span>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{title}</p>
    </div>
  );
}
