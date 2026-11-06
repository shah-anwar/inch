import type {
  AncestorChain,
  ArgumentContext,
  ArgumentWithChildrenByStatus,
  ChildrenSort,
  CreateCounterArgument,
  CreateInitialArgument,
  HomeArgumentLists,
  PaginatedChildren,
  SearchResponse,
  Subtopic,
  Topic,
  GenerateArgumentTextRequest,
  GenerateArgumentTextResponse,
  ReleaseArgumentTextPreviewRequest,
  AdminScheme,
  AdminCriticalQuestion,
  Scheme,
  CriticalQuestion,
  ActiveSchemesResponse,
  SetActiveSchemes,
  PromoteUserToAdmin,
  PromoteUserToAdminResponse,
  CreateScheme,
  CreateTopic,
} from "@inch/types";
import { ModerationFailedResponseSchema } from "@inch/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { apiClient } from "@/lib/api";

/** Thrown when POST /arguments/text-options returns 422 moderation_failed. */
export class ModerationFailedClientError extends Error {
  readonly violations: Array<{ variableId: string; reason: string }>;

  constructor(violations: Array<{ variableId: string; reason: string }>) {
    super("moderation_failed");
    this.name = "ModerationFailedClientError";
    this.violations = violations;
  }
}

export interface MyArgumentSummary {
  id: string;
  argumentText: string;
  schemeId: string;
  status: "IN" | "OUT" | "UNDECIDED";
  isInitial: boolean;
  createdAt: string;
  subtopicId: number;
  subtopicTitle: string;
  topicId: number;
  topicTitle: string;
}

/** Public home page: top initial arguments by descendants and most recent arguments. */
export function useHomeArgumentLists() {
  return useQuery({
    queryKey: ["home-argument-lists"],
    queryFn: async (): Promise<HomeArgumentLists> => {
      const { data } = await apiClient.get<HomeArgumentLists>("/arguments/home-lists");
      return data;
    },
  });
}

/** Authenticated profile list of current user's submitted arguments. */
export function useMyArguments(enabled: boolean = true) {
  return useQuery({
    queryKey: ["me", "arguments"],
    queryFn: async (): Promise<MyArgumentSummary[]> => {
      const { data } = await apiClient.get<MyArgumentSummary[]>("/me/arguments");
      return data;
    },
    enabled,
  });
}

/** Fetches the global topic catalogue for the topic landing page. */
export function useTopics() {
  return useQuery({
    queryKey: ["topics"],
    queryFn: async (): Promise<Topic[]> => {
      const { data } = await apiClient.get<Topic[]>("/topics");
      return data;
    },
  });
}

export function useTopic(topicId: number | null) {
  return useQuery({
    queryKey: ["topic", topicId],
    queryFn: async (): Promise<Topic> => {
      const { data } = await apiClient.get<Topic>(`/topics/${topicId}`);
      return data;
    },
    enabled: topicId !== null,
  });
}

export function useSubtopics(topicId: number | null) {
  return useQuery({
    queryKey: ["subtopics", topicId],
    queryFn: async (): Promise<Subtopic[]> => {
      const { data } = await apiClient.get<Subtopic[]>(`/topics/${topicId}/subtopics`);
      return data;
    },
    enabled: topicId !== null,
  });
}

export function useSubtopic(topicId: number | null, subtopicId: number | null) {
  return useQuery({
    queryKey: ["subtopic", topicId, subtopicId],
    queryFn: async (): Promise<Subtopic> => {
      const { data } = await apiClient.get<Subtopic>(`/topics/${topicId}/subtopics/${subtopicId}`);
      return data;
    },
    enabled: topicId !== null && subtopicId !== null,
  });
}

export function useArgumentContext(argumentId: string | null) {
  return useQuery({
    queryKey: ["argument-context", argumentId],
    queryFn: async (): Promise<ArgumentContext> => {
      const { data } = await apiClient.get<ArgumentContext>(`/arguments/${argumentId}/context`);
      return data;
    },
    enabled: argumentId !== null,
  });
}

export function useArgument(argumentId: string | null) {
  return useQuery({
    queryKey: ["argument", argumentId],
    queryFn: async (): Promise<ArgumentWithChildrenByStatus> => {
      const { data } = await apiClient.get<ArgumentWithChildrenByStatus>(
        `/arguments/${argumentId}`,
      );
      return data;
    },
    enabled: argumentId !== null,
  });
}

export function useAncestors(argumentId: string | null) {
  return useQuery({
    queryKey: ["ancestors", argumentId],
    queryFn: async (): Promise<AncestorChain> => {
      const { data } = await apiClient.get<AncestorChain>(`/arguments/${argumentId}/ancestors`);
      return data;
    },
    enabled: argumentId !== null,
  });
}

/** Turns a 422 moderation_failed reply into ModerationFailedClientError so forms can flag each variable. */
export function useGenerateArgumentText() {
  return useMutation({
    mutationFn: async (
      data: GenerateArgumentTextRequest,
    ): Promise<GenerateArgumentTextResponse> => {
      try {
        const { data: response } = await apiClient.post<GenerateArgumentTextResponse>(
          "/arguments/text-options",
          data,
        );
        return response;
      } catch (e: unknown) {
        if (axios.isAxiosError(e) && e.response?.status === 422) {
          const parsed = ModerationFailedResponseSchema.safeParse(e.response.data);
          if (parsed.success) {
            throw new ModerationFailedClientError(parsed.data.violations);
          }
        }
        throw e;
      }
    },
  });
}

/** Frees the server-side preview when the user backs out, instead of waiting for it to expire. */
export function useReleaseArgumentTextPreview() {
  return useMutation({
    mutationFn: async (data: ReleaseArgumentTextPreviewRequest): Promise<void> => {
      await apiClient.post("/arguments/text-options/release", data);
    },
  });
}

export function useArgumentChildren(
  argumentId: string | null,
  options: { limit: number; sort: ChildrenSort; after?: string },
) {
  return useQuery({
    queryKey: ["argument-children", argumentId, options],
    queryFn: async (): Promise<PaginatedChildren> => {
      const params = new URLSearchParams();
      params.set("limit", String(options.limit));
      params.set("sort", options.sort);
      if (options.after != null) params.set("after", options.after);
      const { data } = await apiClient.get<PaginatedChildren>(
        `/arguments/${argumentId}/children?${params.toString()}`,
      );
      return data;
    },
    enabled: argumentId !== null,
  });
}

export function useSubtopicArguments(subtopicId: number | null) {
  return useQuery({
    queryKey: ["subtopic-arguments", subtopicId],
    queryFn: async (): Promise<ArgumentWithChildrenByStatus[]> => {
      const { data } = await apiClient.get<ArgumentWithChildrenByStatus[]>(
        `/subtopics/${subtopicId}/arguments`,
      );
      return data;
    },
    enabled: subtopicId !== null,
  });
}

export function useSearch(
  query: string,
  page: number = 1,
  enabled: boolean = true,
  limit: number = 10,
) {
  return useQuery<SearchResponse>({
    queryKey: ["search", query, page, limit],
    queryFn: () =>
      apiClient.get("/search", { params: { q: query, page, limit } }).then((r) => r.data),
    enabled: enabled && query.trim().length > 0,
    staleTime: 1000 * 10, // 10 seconds for search results
  });
}

/** Fetches all admin-visible schemes with nested critical questions. */
export function useAdminSchemes() {
  return useQuery({
    queryKey: ["admin", "schemes"],
    queryFn: async (): Promise<AdminScheme[]> => {
      const { data } = await apiClient.get<AdminScheme[]>("/admin/schemes");
      return data;
    },
  });
}

export function useAdminScheme(schemeId: string | null) {
  return useQuery({
    queryKey: ["admin", "scheme", schemeId],
    queryFn: async (): Promise<AdminScheme> => {
      const { data } = await apiClient.get<AdminScheme>(`/admin/schemes/${schemeId}`);
      return data;
    },
    enabled: schemeId !== null,
  });
}

/** Fetches active scheme ids for admin toggles. */
export function useAdminActiveSchemes() {
  return useQuery({
    queryKey: ["admin", "active-schemes"],
    queryFn: async (): Promise<ActiveSchemesResponse> => {
      const { data } = await apiClient.get<ActiveSchemesResponse>("/admin/active-schemes");
      return data;
    },
  });
}

/** Replaces all active schemes in one request. */
export function useSetAdminActiveSchemes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SetActiveSchemes): Promise<ActiveSchemesResponse> => {
      const { data } = await apiClient.put<ActiveSchemesResponse>("/admin/active-schemes", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "active-schemes"] });
      queryClient.invalidateQueries({ queryKey: ["initial-argument", "schemes"] });
    },
  });
}

/** Promotes a user to admin by username (admin-only endpoint). */
export function usePromoteUserToAdmin() {
  return useMutation({
    mutationFn: async (payload: PromoteUserToAdmin): Promise<PromoteUserToAdminResponse> => {
      const { data } = await apiClient.post<PromoteUserToAdminResponse>(
        "/admin/promote-user",
        payload,
      );
      return data;
    },
  });
}

/** Creates a topic, then one or more subtopics under it. */
export function useCreateTopicWithSubtopics() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      topic: CreateTopic;
      subtopicTitles: string[];
    }): Promise<Topic> => {
      const { data: topic } = await apiClient.post<Topic>("/topics", payload.topic);
      const titles = payload.subtopicTitles.map((t) => t.trim()).filter((t) => t.length > 0);
      for (const title of titles) {
        await apiClient.post<Subtopic>(`/topics/${topic.id}/subtopics`, { title });
      }
      return topic;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topics"] });
    },
  });
}

/** Creates a subtopic under an existing topic. */
export function useCreateSubtopic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { topicId: number; title: string }): Promise<Subtopic> => {
      const { data } = await apiClient.post<Subtopic>(`/topics/${vars.topicId}/subtopics`, {
        title: vars.title.trim(),
      });
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["topics"] });
      queryClient.invalidateQueries({ queryKey: ["subtopics", variables.topicId] });
    },
  });
}

/** Creates a new scheme via admin endpoint. */
export function useCreateAdminScheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateScheme): Promise<AdminScheme> => {
      const { data } = await apiClient.post<AdminScheme>("/admin/schemes", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "schemes"] });
    },
  });
}

/** Fetches active schemes available for initial argument creation. */
export function useInitialArgumentSchemes() {
  return useQuery({
    queryKey: ["initial-argument", "schemes"],
    queryFn: async (): Promise<Scheme[]> => {
      const { data } = await apiClient.get<Scheme[]>("/schemes");
      return data;
    },
  });
}

/** Fetches visible critical questions for a target argument. */
export function useVisibleCriticalQuestions(argumentId: string | null) {
  return useQuery({
    queryKey: ["argument", argumentId, "critical-questions"],
    queryFn: async (): Promise<CriticalQuestion[]> => {
      const { data } = await apiClient.get<CriticalQuestion[]>(
        `/arguments/${argumentId}/critical-questions`,
      );
      return data;
    },
    enabled: argumentId !== null,
  });
}

/** Fetches active response schemes for a specific argument critical question. */
export function useVisibleResponseSchemes(argumentId: string | null, cqId: string | null) {
  return useQuery({
    queryKey: ["argument", argumentId, "critical-questions", cqId, "response-schemes"],
    queryFn: async (): Promise<Scheme[]> => {
      const { data } = await apiClient.get<Scheme[]>(
        `/arguments/${argumentId}/critical-questions/${cqId}/response-schemes`,
      );
      return data;
    },
    enabled: argumentId !== null && cqId !== null,
  });
}

export function useCreateScheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AdminScheme) =>
      apiClient.post<AdminScheme>("/admin/schemes", data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "schemes"] });
    },
  });
}

export function useUpdateScheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { id: string; data: Partial<AdminScheme> }) =>
      apiClient
        .patch<AdminScheme>(`/admin/schemes/${variables.id}`, variables.data)
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "schemes"] });
    },
  });
}

export function useCreateCriticalQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { schemeId: string; data: Omit<AdminCriticalQuestion, "schemeId"> }) =>
      apiClient
        .post<AdminCriticalQuestion>(
          `/admin/schemes/${variables.schemeId}/critical-questions`,
          variables.data,
        )
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "schemes"] });
    },
  });
}

export function useUpdateCriticalQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { id: string; data: { validResponseSchemeIds: string[] } }) =>
      apiClient
        .patch<AdminCriticalQuestion>(`/admin/critical-questions/${variables.id}`, variables.data)
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "schemes"] });
    },
  });
}

export function useCreateInitialArgument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInitialArgument) =>
      apiClient
        .post<{ id: string; subtopicId: number }>("/arguments/initial", data)
        .then((r) => r.data),
    onSuccess: (newArgument) => {
      queryClient.invalidateQueries({
        queryKey: ["subtopic-arguments", newArgument.subtopicId],
      });
    },
  });
}

/** Invalidates the subtopic, parent and parent-children queries so the new reply shows at once. */
export function useCreateCounterArgument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCounterArgument) =>
      apiClient.post<ArgumentWithChildrenByStatus>("/arguments/counter", data).then((r) => r.data),
    onSuccess: (newArgument) => {
      queryClient.invalidateQueries({
        queryKey: ["subtopic-arguments", newArgument.subtopicId],
      });
      queryClient.invalidateQueries({
        queryKey: ["argument", newArgument.parentId],
      });
      queryClient.invalidateQueries({
        queryKey: ["argument-children", newArgument.parentId],
      });
    },
  });
}
