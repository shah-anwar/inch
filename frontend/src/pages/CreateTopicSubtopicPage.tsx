import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateSubtopic, useCreateTopicWithSubtopics, useTopics } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { useUserData } from "@/hooks/useUserData";

/** Admin page to create topics (with required first subtopic) or add subtopics to existing topics. */
export default function CreateTopicSubtopicPage() {
  const user = useUserData();
  const { token } = useAuth();
  const { data: topics = [], isLoading: topicsLoading } = useTopics();
  const createTopicWithSubtopics = useCreateTopicWithSubtopics();
  const createSubtopic = useCreateSubtopic();

  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicDescription, setNewTopicDescription] = useState("");
  const [subtopicTitles, setSubtopicTitles] = useState<string[]>([""]);

  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [existingSubtopicTitle, setExistingSubtopicTitle] = useState("");

  const [formError, setFormError] = useState<string | null>(null);
  const [subtopicFormError, setSubtopicFormError] = useState<string | null>(null);
  const [newTopicNotice, setNewTopicNotice] = useState<string | null>(null);
  const [subtopicNotice, setSubtopicNotice] = useState<string | null>(null);

  if (!token) return null;
  if (user && user.username && (user as { isAdmin?: boolean }).isAdmin !== true) {
    return <Navigate to="/" replace />;
  }

  const sortedTopics = useMemo(() => [...topics].sort((a, b) => a.id - b.id), [topics]);

  const newTopicSubtopicsNonEmpty = useMemo(
    () => subtopicTitles.map((t) => t.trim()).filter((t) => t.length > 0),
    [subtopicTitles],
  );

  const canSubmitNewTopic = newTopicTitle.trim().length > 0 && newTopicSubtopicsNonEmpty.length > 0;

  const onSubmitNewTopic = () => {
    setFormError(null);
    setNewTopicNotice(null);
    if (!canSubmitNewTopic) {
      setFormError("Enter a topic title and at least one subtopic title.");
      return;
    }
    createTopicWithSubtopics.mutate(
      {
        topic: {
          title: newTopicTitle.trim(),
          description: newTopicDescription.trim() || undefined,
        },
        subtopicTitles,
      },
      {
        onSuccess: () => {
          setNewTopicTitle("");
          setNewTopicDescription("");
          setSubtopicTitles([""]);
          setNewTopicNotice("Topic and subtopic(s) created.");
        },
        onError: () => {
          setFormError("Could not create topic. Check your input and try again.");
        },
      },
    );
  };

  const onSubmitSubtopic = () => {
    setSubtopicFormError(null);
    setSubtopicNotice(null);
    if (selectedTopicId == null) {
      setSubtopicFormError("Select a topic in the table.");
      return;
    }
    const title = existingSubtopicTitle.trim();
    if (title.length === 0) {
      setSubtopicFormError("Enter a subtopic title.");
      return;
    }
    createSubtopic.mutate(
      { topicId: selectedTopicId, title },
      {
        onSuccess: () => {
          setExistingSubtopicTitle("");
          setSubtopicNotice("Subtopic added.");
        },
        onError: () => {
          setSubtopicFormError("Could not create subtopic. Try again.");
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <AdminSidebar />
        <section className="min-w-0 flex-1 space-y-8">
          <div>
            <h1 className="text-2xl font-semibold">Create Topic / Subtopic</h1>
            <p className="text-sm text-muted-foreground">
              Add topics and subtopics for debates. There is no delete option in the app — choose
              titles carefully.
            </p>
          </div>

          <div
            className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
            role="alert"
          >
            <p className="font-medium text-amber-100">Attention</p>
            <p className="mt-1">
              Topics and subtopics cannot be deleted from the interface once created. They remain
              part of the catalogue and any arguments attached to them.
            </p>
          </div>

          <div className="rounded-lg border border-border p-4">
            <h2 className="text-lg font-medium">Create a new topic</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              A new topic must include at least one subtopic created in the same step.
            </p>
            <div className="grid max-w-xl gap-3">
              <Input
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                placeholder="Topic title"
              />
              <Textarea
                value={newTopicDescription}
                onChange={(e) => setNewTopicDescription(e.target.value)}
                placeholder="Topic description (optional)"
                rows={3}
                className="min-h-[4rem]"
              />
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Initial subtopic(s)</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSubtopicTitles((prev) => [...prev, ""])}
                >
                  Add another subtopic
                </Button>
              </div>
              {subtopicTitles.map((value, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={value}
                    onChange={(e) =>
                      setSubtopicTitles((prev) =>
                        prev.map((v, i) => (i === index ? e.target.value : v)),
                      )
                    }
                    placeholder={`Subtopic title ${index + 1}`}
                  />
                  {subtopicTitles.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        setSubtopicTitles((prev) => prev.filter((_, i) => i !== index))
                      }
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {formError && <p className="mt-2 text-sm text-destructive">{formError}</p>}
            {newTopicNotice && <p className="mt-2 text-sm text-emerald-400">{newTopicNotice}</p>}
            <Button
              type="button"
              className="mt-4"
              disabled={!canSubmitNewTopic || createTopicWithSubtopics.isPending}
              onClick={onSubmitNewTopic}
            >
              {createTopicWithSubtopics.isPending ? "Creating…" : "Create topic"}
            </Button>
          </div>

          <div className="rounded-lg border border-border p-4">
            <h2 className="text-lg font-medium">Add a subtopic to an existing topic</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Select a topic below, then enter the new subtopic title.
            </p>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr className="border-b border-border">
                    <th className="w-10 px-2 py-2" />
                    <th className="px-3 py-2 font-medium">ID</th>
                    <th className="px-3 py-2 font-medium">Title</th>
                    <th className="px-3 py-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {topicsLoading ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-muted-foreground">
                        Loading topics…
                      </td>
                    </tr>
                  ) : sortedTopics.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-muted-foreground">
                        No topics yet. Create one above.
                      </td>
                    </tr>
                  ) : (
                    sortedTopics.map((topic) => (
                      <tr
                        key={topic.id}
                        className="border-b border-border last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-2 py-2">
                          <input
                            type="radio"
                            name="topic-pick"
                            checked={selectedTopicId === topic.id}
                            onChange={() => setSelectedTopicId(topic.id)}
                            aria-label={`Select topic ${topic.title}`}
                          />
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                          {topic.id}
                        </td>
                        <td className="px-3 py-2 font-medium">{topic.title}</td>
                        <td className="max-w-md truncate px-3 py-2 text-muted-foreground">
                          {topic.description ?? "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex max-w-xl flex-col gap-2 sm:flex-row sm:items-end">
              <Input
                value={existingSubtopicTitle}
                onChange={(e) => setExistingSubtopicTitle(e.target.value)}
                placeholder="New subtopic title"
                className="flex-1"
              />
              <Button
                type="button"
                disabled={
                  selectedTopicId == null ||
                  existingSubtopicTitle.trim().length === 0 ||
                  createSubtopic.isPending
                }
                onClick={onSubmitSubtopic}
              >
                {createSubtopic.isPending ? "Adding…" : "Add subtopic"}
              </Button>
            </div>
            {subtopicFormError && (
              <p className="mt-2 text-sm text-destructive">{subtopicFormError}</p>
            )}
            {subtopicNotice && <p className="mt-2 text-sm text-emerald-400">{subtopicNotice}</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
