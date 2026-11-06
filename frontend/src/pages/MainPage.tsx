import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArgumentDetail as ArgumentDetailPanel } from "@/components/ArgumentDetail";
import { Navbar } from "@/components/Navbar";
import { setPageTitle } from "@/lib/pageTitle";

/** Transitional main page that links users into topic and argument routes. */
export default function MainPage() {
  useEffect(() => {
    setPageTitle("Home");
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="flex w-full min-h-[calc(100vh-64px)]">
        <section className="w-1/3 h-[calc(100vh-64px)] overflow-y-auto flex-shrink-0 bg-background text-foreground p-6">
          <ArgumentDetailPanel />
        </section>
        <div className="w-px bg-border min-h-full" />
        <section className="flex-1 h-[calc(100vh-64px)] overflow-y-auto bg-background text-foreground flex items-center justify-center p-8">
          <p className="text-muted-foreground text-center">
            Browse{" "}
            <Link to="/topics" className="text-primary hover:underline">
              topics
            </Link>{" "}
            to explore debates, or open an argument at{" "}
            <code className="text-xs bg-muted px-1 rounded">/arg/:argumentId</code>.
          </p>
        </section>
      </div>
    </div>
  );
}
