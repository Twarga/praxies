import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "./components/Sidebar.jsx";
import {
  getElementScrollTop,
  getRouteScrollPosition,
  restoreElementScroll,
  setRouteScrollPosition,
} from "./lib/scrollState.js";
import { Gallery } from "./pages/Gallery.jsx";
import { Record } from "./pages/Record.jsx";
import { SessionDetail } from "./pages/SessionDetail.jsx";
import { Settings } from "./pages/Settings.jsx";
import { Today } from "./pages/Today.jsx";

function getPageRouteKey(page, params) {
  if (page === "session") {
    return params?.sessionId ? `session/${params.sessionId}` : "session";
  }

  return page || "today";
}

export default function App() {
  const [currentPage, setCurrentPage] = useState("today");
  const [params, setParams] = useState({});
  const scrollContainerRef = useRef(null);
  const scrollPositionsRef = useRef(new Map());

  const routeKey = useMemo(
    () => getPageRouteKey(currentPage, params),
    [currentPage, params],
  );

  function saveCurrentScrollPosition() {
    if (currentPage === "record") return;

    setRouteScrollPosition(
      scrollPositionsRef.current,
      routeKey,
      getElementScrollTop(scrollContainerRef.current),
    );
  }

  useLayoutEffect(() => {
    if (currentPage === "record") return;

    const savedPosition = getRouteScrollPosition(scrollPositionsRef.current, routeKey);
    restoreElementScroll(scrollContainerRef.current, savedPosition);
  }, [currentPage, routeKey]);

  function handleNavigate(page, nextParams) {
    saveCurrentScrollPosition();
    setCurrentPage(page);
    setParams(nextParams || {});
  }

  return (
    <div className="flex bg-[#0F1012] text-[#E0E0E0] h-screen overflow-hidden font-sans">
      {currentPage !== "record" ? (
        <Sidebar currentPage={currentPage} onNavigate={handleNavigate} />
      ) : null}

      <main className="flex-1 flex flex-col overflow-hidden bg-[#0F1012] min-w-0">
        {currentPage === "today" ? <Today onNavigate={handleNavigate} scrollRef={scrollContainerRef} /> : null}
        {currentPage === "record" ? <Record onNavigate={handleNavigate} /> : null}
        {currentPage === "gallery" ? <Gallery onNavigate={handleNavigate} scrollRef={scrollContainerRef} /> : null}
        {currentPage === "settings" ? <Settings scrollRef={scrollContainerRef} /> : null}
        {currentPage === "session" && params?.sessionId ? (
          <SessionDetail
            sessionId={params.sessionId}
            onNavigate={handleNavigate}
            scrollRef={scrollContainerRef}
          />
        ) : null}
      </main>
    </div>
  );
}
