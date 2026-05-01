import { useState } from "react";
import { Sidebar } from "./components/Sidebar.jsx";
import { Gallery } from "./pages/Gallery.jsx";
import { Record } from "./pages/Record.jsx";
import { SessionDetail } from "./pages/SessionDetail.jsx";
import { Settings } from "./pages/Settings.jsx";
import { Today } from "./pages/Today.jsx";

export default function App() {
  const [currentPage, setCurrentPage] = useState("today");
  const [params, setParams] = useState({});

  function handleNavigate(page, nextParams) {
    setCurrentPage(page);
    setParams(nextParams || {});
  }

  return (
    <div className="flex bg-[#0F1012] text-[#E0E0E0] h-screen overflow-hidden font-sans">
      {currentPage !== "record" ? (
        <Sidebar currentPage={currentPage} onNavigate={handleNavigate} />
      ) : null}

      <main className="flex-1 flex flex-col overflow-hidden bg-[#0F1012] min-w-0">
        {currentPage === "today" ? <Today onNavigate={handleNavigate} /> : null}
        {currentPage === "record" ? <Record onNavigate={handleNavigate} /> : null}
        {currentPage === "gallery" ? <Gallery onNavigate={handleNavigate} /> : null}
        {currentPage === "settings" ? <Settings /> : null}
        {currentPage === "session" && params?.sessionId ? (
          <SessionDetail sessionId={params.sessionId} onNavigate={handleNavigate} />
        ) : null}
      </main>
    </div>
  );
}
