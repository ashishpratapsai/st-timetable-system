"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

const adminNavItems = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/centers", label: "Centers", icon: "🏢" },
  { href: "/subjects", label: "Subjects", icon: "📚" },
  { href: "/teachers", label: "Teachers", icon: "👨‍🏫" },
  { href: "/classrooms", label: "Classrooms", icon: "🏫" },
  { href: "/batches", label: "Batches", icon: "👥" },
  { href: "/teaching-assignments", label: "Assignments", icon: "📋" },
  { href: "/syllabus", label: "Syllabus", icon: "📖" },
  { href: "/time-slots", label: "Time Slots", icon: "🕐" },
  { href: "/timetable", label: "Timetable", icon: "📅" },
  { href: "/leaves", label: "Leaves", icon: "📝" },
  { href: "/reports", label: "Reports", icon: "📈" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

const teacherNavItems = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/timetable", label: "My Timetable", icon: "📅" },
  { href: "/leaves", label: "My Leaves", icon: "📝" },
  { href: "/syllabus/my-progress", label: "My Syllabus", icon: "📖" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const navItems = isAdmin ? adminNavItems : teacherNavItems;

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-blue-600">School Toppers</h1>
        <p className="text-xs text-gray-500 mt-1">Timetable System</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
            {session?.user?.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {session?.user?.name}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {session?.user?.role}
            </p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
