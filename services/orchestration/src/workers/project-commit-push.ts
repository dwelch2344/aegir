import { execSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import type { TaskResult } from '../conductor.js'

export async function handleProjectCommitPush(task: any): Promise<TaskResult> {
  const { projectId, localPath, patternId, commitMessage } = task.inputData ?? {}

  try {
    const message = commitMessage || `shipyard: apply ${patternId}`
    const opts = { cwd: localPath, encoding: 'utf-8' as const, timeout: 30_000 }

    // Stage all changes
    execSync('git add -A', opts)

    // Check if there are changes to commit
    const status = execSync('git status --porcelain', opts).trim()
    if (!status) {
      return {
        workflowInstanceId: task.workflowInstanceId,
        taskId: task.taskId,
        status: 'COMPLETED',
        outputData: { committed: false, pushed: false, prUrl: null, message: 'No changes to commit' },
        logs: [{ log: 'No changes detected after apply', createdTime: Date.now() }],
      }
    }

    // Create a feature branch: shipyard/<patternId>-<timestamp>
    const branchSuffix = patternId ? patternId.replace(/[^a-z0-9-]/g, '-') : 'update'
    const branchName = `shipyard/${branchSuffix}-${Date.now()}`
    execSync(`git checkout -b ${branchName}`, opts)

    // Commit
    execSync(`git commit -m "${message}"`, opts)

    // Push the branch
    execSync(`git push -u origin ${branchName}`, opts)

    // Open a PR via gh CLI — write body to temp file to avoid shell escaping issues
    let prUrl: string | null = null
    try {
      const prTitle = patternId ? `shipyard: apply ${patternId}` : 'shipyard: update project'
      const changeLines = status
        .split('\n')
        .map((l: string) => `- ${l.trim()}`)
        .join('\n')
      const prBody = [
        '## Shipyard Automated Change',
        '',
        patternId
          ? `Applied catalog pattern ${patternId} via the Shipyard platform.`
          : 'Automated update from Shipyard.',
        '',
        '### Changes',
        changeLines,
        '',
        '---',
        'This PR was created automatically by the Shipyard.',
      ].join('\n')

      const bodyFile = join(localPath, '.pr-body.md')
      writeFileSync(bodyFile, prBody)
      try {
        const result = execSync(
          `gh pr create --title "${prTitle}" --body-file "${bodyFile}" --head ${branchName}`,
          opts,
        ).trim()
        prUrl = result
      } finally {
        try {
          unlinkSync(bodyFile)
        } catch {}
      }
    } catch (prErr: any) {
      // gh CLI may not be available or auth may not be configured — not fatal
      console.warn(`[project-commit-push] PR creation failed (non-fatal): ${prErr.message}`)
    }

    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'COMPLETED',
      outputData: { committed: true, pushed: true, branchName, prUrl, message },
      logs: [
        {
          log: `Committed to ${branchName}, pushed${prUrl ? `, PR: ${prUrl}` : ' (no PR — gh CLI unavailable)'}`,
          createdTime: Date.now(),
        },
      ],
    }
  } catch (err: any) {
    return {
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.taskId,
      status: 'FAILED',
      outputData: { error: err.message },
      logs: [{ log: `Commit/push failed: ${err.message}`, createdTime: Date.now() }],
    }
  }
}
