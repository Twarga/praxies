import { LayoutDashboard, Mic, Settings as SettingsIcon, Video } from "lucide-react";
import { useIndex } from "../hooks/useIndex.js";

const NAV_ITEMS = [
  { id: "today", icon: LayoutDashboard, label: "Today" },
  { id: "record", icon: Mic, label: "Record" },
  { id: "gallery", icon: Video, label: "Gallery" },
];

export function Sidebar({ currentPage, onNavigate }) {
  const { index } = useIndex();
  const totalSessions = index?.totals?.sessions ?? 0;

  return (
    <nav className="w-[72px] sm:w-[240px] h-full bg-[#151619] border-r border-[#2A2C31] flex flex-col py-6 items-center sm:items-stretch sm:px-4 shrink-0">
      <div className="flex items-center justify-center sm:justify-start sm:px-2 mb-8">
        <div className="w-8 h-8 bg-white rounded flex items-center justify-center sm:mr-3">
          <div className="w-4 h-4 border-[3px] border-[#151619] border-t-transparent rounded-full" />
        </div>
        <h1 className="hidden sm:block text-white tracking-widest uppercase text-xs font-semibold">
          Praxis
        </h1>
      </div>

      <div className="flex-1 flex flex-col gap-2 sm:gap-1 w-full items-center sm:items-stretch">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id || (item.id === "gallery" && currentPage === "session");
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center justify-center sm:justify-start gap-3 p-2 sm:px-3 sm:py-2 rounded-lg text-sm transition-colors w-10 sm:w-full ${
                isActive
                  ? "bg-[#2A2C31] text-white font-medium"
                  : "text-[#E0E0E0] opacity-40 hover:opacity-100 hover:bg-[#2A2C31]/50"
              }`}
              title={item.label}
            >
              <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
              <span className="hidden sm:block text-xs uppercase tracking-widest font-semibold">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto flex flex-col items-center sm:items-stretch w-full gap-2">
        <button
          type="button"
          onClick={() => onNavigate("settings")}
          aria-current={currentPage === "settings" ? "page" : undefined}
          className={`flex items-center justify-center sm:justify-start gap-3 p-2 sm:px-3 sm:py-2 rounded-lg text-sm transition-colors w-10 sm:w-full ${
            currentPage === "settings"
              ? "bg-[#2A2C31] text-white font-medium"
              : "text-[#E0E0E0] opacity-40 hover:opacity-100 hover:bg-[#2A2C31]/50"
          }`}
          title="Settings"
        >
          <SettingsIcon size={20} strokeWidth={currentPage === "settings" ? 2 : 1.5} />
          <span className="hidden sm:block text-xs uppercase tracking-widest font-semibold">
            Settings
          </span>
        </button>
        <div className="hidden sm:block mt-2 text-[10px] sm:px-3 font-mono opacity-30 text-center sm:text-left">
          {totalSessions} sessions
        </div>
      </div>
    </nav>
  );
}
