/** Enumerates directional argument roles used by legacy UI models. */
export const ArgumentType = {
  SUPPORTING: "supporting",
  ATTACKING: "attacking",
} as const;

/** Union type of supported argument direction labels. */
export type ArgumentType = (typeof ArgumentType)[keyof typeof ArgumentType];

/** Enumerates normalized argument evaluation statuses for presentation. */
export const ArgumentStatus = {
  IN: "in",
  OUT: "out",
  UNDEC: "undec",
} as const;

/** Union type of argument status values. */
export type ArgumentStatus = (typeof ArgumentStatus)[keyof typeof ArgumentStatus];

/** Maps each argument status to its foreground text color utility class. */
export const ArgumentStatusColor: Record<ArgumentStatus, string> = {
  [ArgumentStatus.IN]: "text-green-500",
  [ArgumentStatus.OUT]: "text-red-500",
  [ArgumentStatus.UNDEC]: "text-blue-500",
};

/** Maps each argument status to its border color utility class. */
export const ArgumentStatusBorderColor: Record<ArgumentStatus, string> = {
  [ArgumentStatus.IN]: "border-green-500",
  [ArgumentStatus.OUT]: "border-red-500",
  [ArgumentStatus.UNDEC]: "border-blue-500",
};

/** Variable name/value pair displayed in argument detail views. */
export interface ArgumentVariable {
  name: string;
  value: string;
}

/** Child argument ids grouped by evaluation status. */
export interface ArgumentChildren {
  in?: string[];
  out?: string[];
  undec?: string[];
}

/**
 * Legacy argument detail shape used by older frontend screens.
 */
export interface ArgumentDetail {
  id: string;
  text: string;
  type: ArgumentType;
  status: ArgumentStatus;
  childIds?: ArgumentChildren;
  descendants: number;
  scheme: string; // Will make a future scheme type that exports from JSON
  variables: ArgumentVariable[];
  criticalQuestion?: string; // Optional, since initial arguments aren't based on a CQ
}
