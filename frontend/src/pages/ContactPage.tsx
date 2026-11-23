import { Navbar } from "@/components/Navbar";

/** Placeholder contact page. */
export default function ContactPage() {
  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold tracking-tight mb-6">Contact</h1>
          <p className="text-muted-foreground">This is the contact page.</p>
        </div>
      </main>
    </div>
  );
}
