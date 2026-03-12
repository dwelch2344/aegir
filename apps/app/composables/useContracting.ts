interface StartSelectHealthInput {
  agentFirstName: string;
  agentLastName: string;
  agentEmail: string;
  agentPhone: string;
  agentNpn: string;
  residentState: string;
  requestedStates: string[];
  hasC4CoCertification: boolean;
  hasCoLicense: boolean;
}

interface WorkflowTaskLog {
  log: string;
  createdTime: string;
}

interface WorkflowNote {
  id: string;
  authorIdentityId: number;
  content: string;
  visibility: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowTask {
  name: string;
  taskRefName: string | null;
  type: string | null;
  status: string;
  startTime: string | null;
  endTime: string | null;
  logs: WorkflowTaskLog[];
  outputData: string | null;
  notes: WorkflowNote[];
}

interface WorkflowStatus {
  workflowId: string;
  status: string;
  input: {
    agentFirstName: string;
    agentLastName: string;
    agentEmail: string;
    agentPhone: string;
    agentNpn: string;
    residentState: string;
    requestedStates: string[];
  } | null;
  output: {
    contractId: string;
    approvedStates: string[];
    status: string;
    completedAt: string;
    writingNumber: string;
  } | null;
  tasks: WorkflowTask[];
}

interface StoredWorkflow {
  workflowId: string;
  agentName: string;
  startedAt: string;
  organizationId: number;
}

const STORAGE_KEY = "aegir:contracting:workflows";

async function gql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const config = useRuntimeConfig();
  const url = config.public.gatewayUrl as string;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status}`);
  }
  const res = (await response.json()) as {
    data: T;
    errors?: { message: string }[];
  };
  if (res.errors?.length) {
    throw new Error(res.errors[0].message);
  }
  return res.data;
}

export function useContracting() {
  const { activeOrgId } = useOrg();

  async function startSelectHealth(input: StartSelectHealthInput) {
    const data = await gql<{
      legal: { contracting: { startSelectHealth: { workflowId: string } } };
    }>(
      `
      mutation StartSelectHealth($input: LegalStartSelectHealthInput!) {
        legal {
          contracting {
            startSelectHealth(input: $input) {
              workflowId
            }
          }
        }
      }
    `,
      { input },
    );

    const { workflowId } = data.legal.contracting.startSelectHealth;

    // Store in localStorage for the list view (scoped by org)
    const stored = getAllStoredWorkflows();
    stored.unshift({
      workflowId,
      agentName: `${input.agentFirstName} ${input.agentLastName}`,
      startedAt: new Date().toISOString(),
      organizationId: activeOrgId.value!,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    return { workflowId };
  }

  async function getWorkflowStatus(
    workflowId: string,
  ): Promise<WorkflowStatus> {
    const data = await gql<{
      legal: { contracting: { workflowStatus: WorkflowStatus } };
    }>(
      `
      query WorkflowStatus($workflowId: ID!) {
        legal {
          contracting {
            workflowStatus(workflowId: $workflowId) {
              workflowId
              status
              input {
                agentFirstName
                agentLastName
                agentEmail
                agentPhone
                agentNpn
                residentState
                requestedStates
              }
              output {
                contractId
                approvedStates
                status
                completedAt
                writingNumber
              }
              tasks {
                name
                taskRefName
                type
                status
                startTime
                endTime
                logs { log createdTime }
                outputData
                notes { id authorIdentityId content visibility createdAt updatedAt }
              }
            }
          }
        }
      }
    `,
      { workflowId },
    );

    return data.legal.contracting.workflowStatus;
  }

  /** Get all stored workflows (all orgs) from localStorage */
  function getAllStoredWorkflows(): StoredWorkflow[] {
    if (import.meta.server) return [];
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  /** Get stored workflows for the active org only */
  function getStoredWorkflows(): StoredWorkflow[] {
    const orgId = activeOrgId.value;
    if (!orgId) return [];
    return getAllStoredWorkflows().filter((w) => w.organizationId === orgId);
  }

  async function approveStep(workflowId: string, taskRefName: string) {
    await gql<{ legal: { contracting: { approveStep: boolean } } }>(
      `
      mutation ApproveStep($workflowId: ID!, $taskRefName: String!) {
        legal {
          contracting {
            approveStep(workflowId: $workflowId, taskRefName: $taskRefName)
          }
        }
      }
    `,
      { workflowId, taskRefName },
    );
  }

  async function addWorkflowTaskNote(
    workflowId: string,
    taskName: string,
    content: string,
  ): Promise<WorkflowNote> {
    const data = await gql<{
      legal: { contracting: { addWorkflowTaskNote: WorkflowNote } };
    }>(
      `
      mutation AddWorkflowTaskNote($workflowId: ID!, $taskName: String!, $content: String!) {
        legal {
          contracting {
            addWorkflowTaskNote(workflowId: $workflowId, taskName: $taskName, content: $content) {
              id authorIdentityId content visibility createdAt updatedAt
            }
          }
        }
      }
    `,
      { workflowId, taskName, content },
    );
    return data.legal.contracting.addWorkflowTaskNote;
  }

  return {
    startSelectHealth,
    getWorkflowStatus,
    getStoredWorkflows,
    approveStep,
    addWorkflowTaskNote,
  };
}
