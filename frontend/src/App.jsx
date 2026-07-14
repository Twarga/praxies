import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LiveUpdateEffects } from "./components/LiveUpdateEffects.jsx";
import { Sidebar } from "./components/Sidebar.jsx";
import { AppChrome } from "./components/AppChrome.jsx";
import {
  getElementScrollTop,
  getRouteScrollPosition,
  restoreElementScroll,
  setRouteScrollPosition,
} from "./lib/scrollState.js";
import { Gallery } from "./pages/Gallery.jsx";
import { Onboarding } from "./pages/Onboarding.jsx";
import { Record } from "./pages/Record.jsx";
import { SessionDetail } from "./pages/SessionDetail.jsx";
import { Settings } from "./pages/Settings.jsx";
import { Today } from "./pages/Today.jsx";
import { Trends } from "./pages/Trends.jsx";
import { Practice } from "./pages/Practice.jsx";
import { useConfig } from "./hooks/useConfig.js";
import { getGlobalShortcutRoute, getPageLabel } from "./lib/nav.js";

export { getGlobalShortcutRoute };

function getPageRouteKey(page, params) {
  if (page === "session") {
    return params?.sessionId ? `session/${params.sessionId}` : "session";
  }

  return page || "today";
}

function getInitialNavigation() {
  const sessionId = new URLSearchParams(window.location.search).get("session");
  return sessionId ? { page: "session", params: { sessionId } } : { page: "today", params: {} };
}

export default function App() {
  const { config, isLoading } = useConfig();
  const initialNavigationRef = useRef(getInitialNavigation());
  const [currentPage, setCurrentPage] = useState(initialNavigationRef.current.page);
  const [params, setParams] = useState(initialNavigationRef.current.params);
  const scrollContainerRef = useRef(null);
  const mainRef = useRef(null);
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

  useEffect(() => {
    function handleGlobalShortcut(event) {
      const page = getGlobalShortcutRoute(event);
      if (!page) return;
      event.preventDefault();
      handleNavigate(page);
    }
    window.addEventListener("keydown", handleGlobalShortcut);
    return () => window.removeEventListener("keydown", handleGlobalShortcut);
  }, [currentPage, routeKey]);

  useEffect(() => {
    document.title = `${getPageLabel(currentPage)} · Praxis`;
    mainRef.current?.focus({ preventScroll: true });
  }, [routeKey, currentPage]);

  if (!isLoading && config && !config.setup_completed) {
    return (
      <div className="h-screen overflow-hidden bg-[var(--praxis-bg-app)] text-[var(--praxis-text-primary)]">
        <a href="#praxis-main" className="praxis-skip-link">Skip to content</a>
        <main id="praxis-main" className="h-full" tabIndex={-1}>
          <Onboarding onComplete={() => handleNavigate("today")} />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--praxis-bg-app)] font-sans text-[var(--praxis-text-primary)]">
      <a href="#praxis-main" className="praxis-skip-link">Skip to content</a>
      <LiveUpdateEffects />
      <AppChrome
        currentPage={currentPage}
        onNavigate={handleNavigate}
        isRecordingRoute={currentPage === "record"}
      />

      <div className="flex min-h-0 flex-1">
        {currentPage !== "record" ? (
          <Sidebar currentPage={currentPage} onNavigate={handleNavigate} />
        ) : null}

        <main
          id="praxis-main"
          ref={mainRef}
          tabIndex={-1}
          data-chrome={currentPage === "record" ? "minimal" : "full"}
          className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--praxis-bg-canvas)] focus:outline-none"
        >
          {currentPage === "today" ? <Today onNavigate={handleNavigate} scrollRef={scrollContainerRef} /> : null}
          {currentPage === "record" ? <Record onNavigate={handleNavigate} /> : null}
          {currentPage === "practice" ? <Practice onNavigate={handleNavigate} scrollRef={scrollContainerRef} /> : null}
          {currentPage === "gallery" ? <Gallery onNavigate={handleNavigate} scrollRef={scrollContainerRef} /> : null}
          {currentPage === "trends" ? <Trends onNavigate={handleNavigate} scrollRef={scrollContainerRef} /> : null}
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
    </div>
  );
}
