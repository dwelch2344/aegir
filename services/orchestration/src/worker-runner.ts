import { pollTask, updateTask } from './conductor.js'
import { handleAgentDeliverResponse } from './workers/agent-deliver-response.js'
import { handleAgentGatherContext } from './workers/agent-gather-context.js'
import { handleAgentInvokeClaude } from './workers/agent-invoke-claude.js'
import { handleProvisionAccount } from './workers/provision-account.js'
import { handleSendWelcomeEmail } from './workers/send-welcome-email.js'
import { handleShAgentSignsDocusign } from './workers/sh-agent-signs-docusign.js'
import { handleShCarrierProcessing } from './workers/sh-carrier-processing.js'
import { handleShCreateSirconAffiliation } from './workers/sh-create-sircon-affiliation.js'
import { handleShFinalizeContract } from './workers/sh-finalize-contract.js'
import { handleShHfCountersignAndTraining } from './workers/sh-hf-countersign-and-training.js'
import { handleShRequestContract } from './workers/sh-request-contract.js'
import { handleShValidateAgentInfo } from './workers/sh-validate-agent-info.js'
import { handleProjectApplyPattern } from './workers/project-apply-pattern.js'
import { handleProjectCheckStatus } from './workers/project-check-status.js'
import { handleProjectClone } from './workers/project-clone.js'
import { handleProjectCommitPush } from './workers/project-commit-push.js'
import { handleProjectRunDiagnostics } from './workers/project-run-diagnostics.js'
import { handleProjectParseManifest } from './workers/project-parse-manifest.js'
import { handleProjectStoreMetadata } from './workers/project-store-metadata.js'
import { handleValidateIdentity } from './workers/validate-identity.js'

type TaskHandler = (task: any) => TaskResult | Promise<TaskResult>

import type { TaskResult } from './conductor.js'

const handlers: Record<string, TaskHandler> = {
  validate_identity: handleValidateIdentity,
  provision_account: handleProvisionAccount,
  send_welcome_email: handleSendWelcomeEmail,
  sh_validate_agent_info: handleShValidateAgentInfo,
  sh_create_sircon_affiliation: handleShCreateSirconAffiliation,
  sh_request_contract: handleShRequestContract,
  sh_agent_signs_docusign: handleShAgentSignsDocusign,
  sh_hf_countersign_and_training: handleShHfCountersignAndTraining,
  sh_carrier_processing: handleShCarrierProcessing,
  sh_finalize_contract: handleShFinalizeContract,
  agent_gather_context: handleAgentGatherContext,
  agent_invoke_claude: handleAgentInvokeClaude,
  agent_deliver_response: handleAgentDeliverResponse,
  project_clone: handleProjectClone,
  project_parse_manifest: handleProjectParseManifest,
  project_store_metadata: handleProjectStoreMetadata,
  project_check_status: handleProjectCheckStatus,
  project_apply_pattern: handleProjectApplyPattern,
  project_commit_push: handleProjectCommitPush,
  project_run_diagnostics: handleProjectRunDiagnostics,
}

const WORKER_ID = `orchestration-${process.pid}`
const POLL_INTERVAL_MS = 1000

export function startWorkers(signal: AbortSignal) {
  for (const taskType of Object.keys(handlers)) {
    runWorkerLoop(taskType, signal)
  }
}

async function runWorkerLoop(taskType: string, signal: AbortSignal) {
  console.log(`[worker] polling for "${taskType}"`)

  while (!signal.aborted) {
    try {
      const task = await pollTask(taskType, WORKER_ID)
      if (task) {
        console.log(`[worker] executing "${taskType}" (task=${task.taskId})`)
        const result = await handlers[taskType](task)
        await updateTask(result)
        console.log(`[worker] completed "${taskType}" (task=${task.taskId}) -> ${result.status}`)
      }
    } catch (err: any) {
      if (!signal.aborted) {
        console.error(`[worker] error polling "${taskType}": ${err.message}`)
      }
    }
    if (!signal.aborted) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    }
  }
}
