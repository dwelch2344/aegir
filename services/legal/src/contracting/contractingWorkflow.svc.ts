import { getEnv } from "@aegir/common";

const orchestrationUrl = () =>
  getEnv("ORCHESTRATION_URL", "http://localhost:4010");

export default class ContractingWorkflowService {
  constructor() {}

  async startSelectHealth(input: {
    agentFirstName: string;
    agentLastName: string;
    agentEmail: string;
    agentPhone: string;
    agentNpn: string;
    residentState: string;
    requestedStates: string[];
    hasC4CoCertification: boolean;
    hasCoLicense: boolean;
  }) {
    const res = await fetch(`${orchestrationUrl()}/contracting/select-health`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Failed to start workflow: ${res.status} ${body}`);
    }
    const { workflowId } = (await res.json()) as { workflowId: string };
    return { workflowId };
  }

  async getWorkflowStatus(workflowId: string) {
    const res = await fetch(
      `${orchestrationUrl()}/contracting/status/${encodeURIComponent(workflowId)}`,
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Failed to get workflow status: ${res.status} ${body}`);
    }
    return res.json();
  }

  async approveStep(workflowId: string, taskRefName: string) {
    const res = await fetch(`${orchestrationUrl()}/contracting/approve-step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowId, taskRefName }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Failed to approve step: ${res.status} ${body}`);
    }
    return true;
  }
}
