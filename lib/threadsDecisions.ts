export type DecisionStage = 'material' | 'experiment' | 'draft' | 'publish' | 'performance';
export type DecisionAction = 'approve' | 'revise' | 'reject' | 'hold' | 'continue';
export type DecisionRisk = 'low' | 'medium' | 'high' | 'unknown';
export type DecisionStatus = 'pending' | 'resolved' | 'expired';

export type DecisionItem = {
  id: string;
  brandKey: string;
  stage: DecisionStage;
  sourceId: string;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  aiChecks: Array<{ key: string; status: 'pass' | 'warning' | 'fail'; reason: string }> | null;
  recommendation: string;
  riskLevel: DecisionRisk;
  suggestedSlot: string | null;
  status: DecisionStatus;
  createdAt: string;
  updatedAt: string;
};

export type PostDecisionRequest = { decisionId: string; action: DecisionAction; feedback?: string; scheduledAt?: string };

export type DecisionBatchStatus = 'pending' | 'in_progress' | 'resolved' | 'expired';
export type SlotAssignment = { sourceId: string; scheduledAt: string };
export type DecisionBatch = {
  batchId: string;
  brandKey: string;
  date: string;
  stage: DecisionStage;
  items: DecisionItem[];
  recommendedIds: string[];
  selectedIds: string[];
  status: DecisionBatchStatus;
  createdAt: string;
  updatedAt: string;
};

export type PostBatchActionRequest = { batchId: string; action: DecisionAction; itemDecisions: Array<{ sourceId: string; action: DecisionAction; feedback?: string }>; selectedIds?: string[]; slotAssignments?: SlotAssignment[] };
