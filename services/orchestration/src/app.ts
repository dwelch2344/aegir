import Fastify from "fastify";
import { getEnv } from "@aegir/common";
import {
  registerTaskDefs,
  registerWorkflow,
  startWorkflow,
  getWorkflow,
  signalWaitTask,
} from "./conductor.js";
import {
  taskDefs,
  onboardingWorkflow,
  selectHealthTaskDefs,
  selectHealthAcaWorkflow,
  agentChatTaskDefs,
  agentChatWorkflow,
} from "./definitions.js";
import { startWorkers } from "./worker-runner.js";

export async function buildApp() {
  const fastify = Fastify({ logger: true });
  const ac = new AbortController();

  fastify.get("/health", async () => ({
    status: "ok",
    service: "orchestration",
  }));

  // Trigger an onboarding workflow run via REST
  fastify.post<{ Body: { email: string; name: string } }>(
    "/onboard",
    async (req) => {
      const { email, name } = req.body;
      const workflowId = await startWorkflow("user_onboarding", {
        email,
        name,
      });
      return { workflowId };
    },
  );

  // Select Health ACA contracting
  fastify.post<{ Body: Record<string, unknown> }>(
    "/contracting/select-health",
    async (req) => {
      const workflowId = await startWorkflow(
        "select_health_aca_new_contract",
        req.body,
        2,
      );
      return { workflowId };
    },
  );

  fastify.get<{ Params: { workflowId: string } }>(
    "/contracting/status/:workflowId",
    async (req) => {
      const workflow = await getWorkflow(req.params.workflowId);
      if (!workflow) return { error: "Workflow not found" };
      return {
        workflowId: workflow.workflowId,
        status: workflow.status,
        input: workflow.input,
        output: workflow.output,
        tasks: (workflow.tasks ?? []).map((t: any) => ({
          name:
            t.taskDefName ??
            (t.referenceTaskName?.replace(/_ref$/, "") || t.referenceTaskName),
          taskRefName: t.referenceTaskName,
          type: t.taskType,
          status: t.status,
          startTime: t.startTime,
          endTime: t.endTime,
          outputData: t.outputData ? JSON.stringify(t.outputData) : null,
          logs: (t.logs ?? []).map((l: any) => ({
            log: l.log,
            createdTime: l.createdTime,
          })),
        })),
      };
    },
  );

  // Approve / signal a WAIT task (human interaction)
  fastify.post<{ Body: { workflowId: string; taskRefName: string } }>(
    "/contracting/approve-step",
    async (req) => {
      const { workflowId, taskRefName } = req.body;
      await signalWaitTask(workflowId, taskRefName, {
        approved: true,
        approvedAt: new Date().toISOString(),
      });
      return { ok: true };
    },
  );

  // Agent chat — start a persistent conversation workflow
  fastify.post<{ Body: { conversationId: string } }>(
    "/agents/chat/start",
    async (req) => {
      const { conversationId } = req.body;
      const workflowId = await startWorkflow("agent_chat_conversation", {
        conversationId,
      });
      return { workflowId };
    },
  );

  // Send a message into an existing conversation workflow (signals the WAIT task)
  fastify.post<{ Body: { workflowId: string; text: string } }>(
    "/agents/chat/message",
    async (req) => {
      const { workflowId, text } = req.body;
      await signalWaitTask(workflowId, "agent_wait_for_message_ref", {
        text,
        action: "continue",
      });
      return { ok: true };
    },
  );

  // Close a conversation workflow
  fastify.post<{ Body: { workflowId: string } }>(
    "/agents/chat/close",
    async (req) => {
      const { workflowId } = req.body;
      await signalWaitTask(workflowId, "agent_wait_for_message_ref", {
        action: "close",
      });
      return { ok: true };
    },
  );

  fastify.addHook("onClose", () => ac.abort());

  return {
    async start() {
      const port = Number(getEnv("ORCHESTRATION_PORT", "4010"));
      const host = getEnv("ORCHESTRATION_HOST", "0.0.0.0");

      // Register definitions with Conductor (retry until Conductor is ready)
      await registerWithRetry();

      // Start task workers
      startWorkers(ac.signal);

      await fastify.listen({ port, host });
    },
    fastify,
  };
}

async function registerWithRetry(maxAttempts = 20, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const allTaskDefs = [
        ...taskDefs,
        ...selectHealthTaskDefs,
        ...agentChatTaskDefs,
      ];
      await registerTaskDefs(allTaskDefs);
      console.log(
        `[orchestration] registered ${allTaskDefs.length} task definitions`,
      );

      await registerWorkflow(onboardingWorkflow);
      console.log(
        `[orchestration] registered workflow "${onboardingWorkflow.name}"`,
      );

      await registerWorkflow(selectHealthAcaWorkflow);
      console.log(
        `[orchestration] registered workflow "${selectHealthAcaWorkflow.name}"`,
      );

      await registerWorkflow(agentChatWorkflow);
      console.log(
        `[orchestration] registered workflow "${agentChatWorkflow.name}"`,
      );
      return;
    } catch (err: any) {
      console.warn(
        `[orchestration] attempt ${attempt}/${maxAttempts} - conductor not ready: ${err.message}`,
      );
      if (attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
