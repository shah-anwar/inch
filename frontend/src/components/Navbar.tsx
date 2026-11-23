import { Search, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useShallow } from "zustand/shallow";
import { SearchResultRow } from "./SearchResultRow";
import { UserMenu } from "./UserMenu";
import { ModeToggle } from "./mode-toggle";
import { useSearch } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { useUserData } from "@/hooks/useUserData";
import { NAVBAR_EXPAND_SEARCH_EVENT } from "@/lib/requestNavbarSearch";
import { useDebateStore } from "@/stores";

/**
 * Top navigation bar with logo, toggleable search (icon + expandable field), breadcrumb,
 * theme toggle, admin link, and session-aware user actions.
 *
 * @returns Persistent app navigation component.
 */
export function Navbar() {
  const user = useUserData();
  const { logout } = useAuth();
  const { selectedTopic, selectedSubtopic } = useDebateStore(
    useShallow((s) => ({
      selectedTopic: s.selectedTopic,
      selectedSubtopic: s.selectedSubtopic,
    })),
  );
  const location = useLocation();
  const navigate = useNavigate();

  /** Panel open; query text persists when collapsed until refresh or clear. */
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const searchShellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (searchExpanded) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [searchExpanded]);

  useEffect(() => {
    const onExpandFromElsewhere = () => {
      setSearchExpanded(true);
      requestAnimationFrame(() => {
        inputRef.current?.focus({ preventScroll: true });
      });
    };
    window.addEventListener(NAVBAR_EXPAND_SEARCH_EVENT, onExpandFromElsewhere);
    return () => window.removeEventListener(NAVBAR_EXPAND_SEARCH_EVENT, onExpandFromElsewhere);
  }, []);

  /** Collapse expanded search when clicking outside the search strip (breadcrumbs return). */
  useEffect(() => {
    if (!searchExpanded) return;
    const onPointerDown = (e: PointerEvent) => {
      const shell = searchShellRef.current;
      if (!shell) return;
      const target = e.target;
      if (target instanceof Node && !shell.contains(target)) {
        setSearchExpanded(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [searchExpanded]);

  const { data: searchData } = useSearch(
    debouncedQuery,
    1,
    searchExpanded && debouncedQuery.length > 1,
    5,
  );

  const isArgRoute = location.pathname.startsWith("/arg/");
  const isAdminRoute = location.pathname.startsWith("/admin");
  const isProfileRoute = location.pathname.startsWith("/profile");
  const isHome = location.pathname === "/" || location.pathname === "";
  const isLearn = location.pathname === "/learn";
  const isTopicsIndex = location.pathname === "/topics" || location.pathname === "/topics/";

  let breadcrumb: React.ReactNode = null;
  if (isAdminRoute) {
    breadcrumb = (
      <span className="text-foreground" aria-current="page">
        ADMIN PAGE
      </span>
    );
  } else if (isProfileRoute) {
    breadcrumb = (
      <span className="text-foreground" aria-current="page">
        PROFILE PAGE
      </span>
    );
  } else if (isHome) {
    breadcrumb = (
      <span className="text-foreground" aria-current="page">
        Home
      </span>
    );
  } else if (isLearn) {
    breadcrumb = (
      <span className="text-foreground" aria-current="page">
        Learn INCH
      </span>
    );
  } else if (isTopicsIndex) {
    breadcrumb = <span className="text-foreground">Topics</span>;
  } else if (selectedTopic) {
    if (!selectedSubtopic) {
      breadcrumb = (
        <Link to={`/topics/${selectedTopic.id}`} className="text-foreground hover:underline">
          {selectedTopic.title}
        </Link>
      );
    } else if (isArgRoute) {
      breadcrumb = (
        <>
          <Link to={`/topics/${selectedTopic.id}`} className="text-foreground hover:underline">
            {selectedTopic.title}
          </Link>
          <span className="text-muted-foreground mx-1">&gt;</span>
          <Link
            to={`/topics/${selectedTopic.id}/${selectedSubtopic.id}`}
            className="text-foreground hover:underline"
          >
            {selectedSubtopic.title}
          </Link>
          <span className="text-muted-foreground mx-1">&gt;</span>
          <span className="text-foreground">Current</span>
        </>
      );
    } else {
      breadcrumb = (
        <>
          <Link to={`/topics/${selectedTopic.id}`} className="text-foreground hover:underline">
            {selectedTopic.title}
          </Link>
          <span className="text-muted-foreground mx-1">&gt;</span>
          <Link
            to={`/topics/${selectedTopic.id}/${selectedSubtopic.id}`}
            className="text-foreground hover:underline"
          >
            {selectedSubtopic.title}
          </Link>
        </>
      );
    }
  }

  const collapseSearch = () => {
    setSearchExpanded(false);
  };

  const clearSearchText = () => {
    setSearchQuery("");
    inputRef.current?.focus();
  };

  return (
    <nav className="border-b font-mono">
      <div className="flex h-10 w-full min-w-0 items-stretch px-4">
        {/* Left - Home */}
        <div className="flex shrink-0 items-center pr-3">
          <Link to="/" className="text-lg font-medium hover:opacity-70 transition-opacity">
            INCH
          </Link>
        </div>

        <div className="h-full w-px shrink-0 bg-border self-stretch" aria-hidden />

        {/*
          Middle: search icon in a fixed centered column, then either breadcrumb (collapsed)
          or full-width field (expanded) up to the divider before the theme toggle.
        */}
        <div ref={searchShellRef} className="flex min-h-0 min-w-0 flex-1 items-center gap-2 px-3">
          <div className="flex h-full w-10 shrink-0 items-center justify-center">
            <button
              type="button"
              onClick={() => setSearchExpanded((v) => !v)}
              className={[
                "flex size-8 shrink-0 items-center justify-center rounded-md",
                "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              ].join(" ")}
              aria-expanded={searchExpanded}
              aria-controls="navbar-search-input"
              aria-label={searchExpanded ? "Collapse search" : "Expand search"}
            >
              <Search className="size-4" aria-hidden />
            </button>
          </div>

          {searchExpanded ? (
            <div className="relative min-h-0 min-w-0 flex-1">
              <input
                id="navbar-search-input"
                ref={inputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    collapseSearch();
                  }
                }}
                placeholder="Search topics, subtopics, arguments..."
                className="h-8 w-full rounded-md border border-input bg-background pl-2 pr-8 text-foreground text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {searchQuery.length > 0 && (
                <button
                  type="button"
                  onClick={clearSearchText}
                  className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Clear search text"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              )}

              {debouncedQuery.length > 1 &&
                searchData?.results &&
                searchData.results.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
                    {searchData.results.slice(0, 5).map((result, index) => (
                      <SearchResultRow
                        key={`${result.type}-${result.id}`}
                        result={result}
                        rowIndex={index}
                        onSelect={() => {
                          collapseSearch();
                          setSearchQuery("");
                          if (result.type === "topic") {
                            navigate(`/topics/${result.id}`);
                          } else if (result.type === "subtopic") {
                            navigate(`/topics/${result.topicId}/${result.id}`);
                          } else {
                            navigate(`/arg/${result.id}`);
                          }
                        }}
                      />
                    ))}
                    {searchData.total > 5 && (
                      <button
                        type="button"
                        onClick={() => {
                          navigate(`/search?q=${encodeURIComponent(debouncedQuery)}`);
                          collapseSearch();
                          setSearchQuery("");
                        }}
                        className="w-full border-t bg-muted/50 px-3 py-2 text-center text-sm font-medium hover:bg-muted"
                      >
                        See all {searchData.total} results →
                      </button>
                    )}
                  </div>
                )}
            </div>
          ) : (
            <div className="min-w-0 flex-1 truncate text-left text-sm">{breadcrumb}</div>
          )}
        </div>

        <div className="h-full w-px shrink-0 bg-border self-stretch" aria-hidden />

        {/* Theme toggle section */}
        <div className="flex shrink-0 items-center gap-3 px-4">
          <ModeToggle />
        </div>

        <div className="h-full w-px bg-border"></div>

        {/* User controls */}
        <div className="flex items-center gap-3 pl-4">
          {user && user.username ? (
            <UserMenu
              username={user.username}
              isAdmin={(user as { isAdmin?: boolean }).isAdmin === true}
              onLogout={logout}
            />
          ) : (
            <Link
              to="/login"
              state={{ from: location }}
              className="text-lg hover:opacity-70 transition-opacity"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
