import { Navbar } from "@/components/Navbar";

/** Placeholder about page. */
export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold tracking-tight mb-6">About</h1>
          <p className="text-muted-foreground">This is the about page.</p>
        </div>
      </main>
    </div>
  );
}
