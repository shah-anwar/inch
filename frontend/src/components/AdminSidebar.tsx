import { Link, useLocation } from "react-router-dom";

/** Left navigation for admin section pages. */
export function AdminSidebar() {
  const location = useLocation();

  const links = [
    { to: "/admin/schemes", label: "Active Schemes" },
    { to: "/admin/create-scheme", label: "Create Scheme" },
    { to: "/admin/create-topic-subtopic", label: "Create Topic / Subtopic" },
    { to: "/admin/privileges", label: "Admin Privileges" },
  ];

  return (
    <aside className="w-64 shrink-0 rounded-lg border border-border p-2">
      {links.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          className={[
            "mb-1 block rounded-md px-3 py-2 text-sm transition-colors",
            location.pathname === link.to
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          ].join(" ")}
        >
          {link.label}
        </Link>
      ))}
    </aside>
  );
}
