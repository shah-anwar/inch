import React from "react";
import { useNavigate } from "react-router-dom";

interface UserMenuProps {
  username: string;
  isAdmin?: boolean;
  onLogout: () => void | Promise<void>;
}

/**
 * User dropdown menu with profile navigation and logout action.
 *
 * @param props Username label and logout callback.
 * @returns Popover-style user menu trigger and content.
 */
export function UserMenu({ username, isAdmin = false, onLogout }: UserMenuProps) {
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close menu on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="text-lg font-semibold hover:opacity-70 transition-opacity"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {username}
      </button>
      {open && (
        <div
          className="absolute right-0 z-50"
          style={{ marginTop: "16px", maxWidth: "calc(100vw - 16px)", boxSizing: "border-box" }}
        >
          {/* Pointer */}
          <div
            className="absolute top-[-10px] right-4"
            style={{
              width: 0,
              height: 0,
              borderLeft: "8px solid transparent",
              borderRight: "8px solid transparent",
              borderBottom: "10px solid",
              borderBottomColor: "white",
              zIndex: 51,
            }}
          />
          {/* Dark mode pointer overlay */}
          <div
            className="absolute top-[-10px] right-4 dark:block hidden"
            style={{
              width: 0,
              height: 0,
              borderLeft: "8px solid transparent",
              borderRight: "8px solid transparent",
              borderBottom: "10px solid #18181b",
              zIndex: 52,
            }}
          />
          <div className="min-w-[140px] max-w-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded shadow-lg animate-fade-in flex flex-col">
            <button
              className="text-left px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border-b border-zinc-200 dark:border-zinc-700"
              onClick={() => {
                setOpen(false);
                navigate("/profile");
              }}
            >
              Profile
            </button>
            {isAdmin && (
              <button
                className="text-left px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border-b border-zinc-200 dark:border-zinc-700"
                onClick={() => {
                  setOpen(false);
                  navigate("/admin/schemes");
                }}
              >
                Admin
              </button>
            )}
            <button
              className="text-left px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              onClick={() => {
                setOpen(false);
                void onLogout();
              }}
            >
              Logout
            </button>
            {/* Future extensibility: add more menu items here */}
          </div>
        </div>
      )}
    </div>
  );
}
