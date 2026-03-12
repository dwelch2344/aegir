import type { FastifyReply } from 'fastify'
import type ContractingWorkflowService from './contracting/contracting-workflow.svc.js'
import type WorkflowNotesService from './contracting/workflowNotes.svc.js'

function resolveService<T>(ctx: { reply: FastifyReply }, name: string): T {
  return ctx.reply.request.scope.resolve<T>(name)
}

export const resolvers = {
  Query: {
    contracts: async (_: unknown, args: { organizationId: number }, ctx: { reply: FastifyReply }) => {
      const contractsService = resolveService<{ findAll(organizationId: number): Promise<unknown[]> }>(ctx, 'contractsService')
      return contractsService.findAll(args.organizationId)
    },
    contract: async (_: unknown, args: { id: string }, ctx: { reply: FastifyReply }) => {
      const contractsService = resolveService<{ findById(id: string): Promise<unknown> }>(ctx, 'contractsService')
      return contractsService.findById(args.id)
    },
    legal: () => ({}),
  },
  Legal: {
    contracting: () => ({}),
  },
  LegalContracting: {
    workflowStatus: async (_: unknown, args: { workflowId: string }, ctx: { reply: FastifyReply }) => {
      const workflowSvc = resolveService<ContractingWorkflowService>(ctx, 'contractingWorkflowService')
      const notesSvc = resolveService<WorkflowNotesService>(ctx, 'workflowNotesService')

      const status = await workflowSvc.getWorkflowStatus(args.workflowId) as any
      const allNotes = await notesSvc.findByWorkflow(args.workflowId)

      // Group notes by task name
      const notesByTask = new Map<string, typeof allNotes>()
      for (const note of allNotes) {
        const list = notesByTask.get(note.taskName) || []
        list.push(note)
        notesByTask.set(note.taskName, list)
      }

      // Attach notes to each task
      if (status?.tasks) {
        for (const task of status.tasks) {
          task.notes = notesByTask.get(task.name) || []
        }
      }

      return status
    },
  },
  Mutation: {
    legal: () => ({}),
  },
  LegalOps: {
    contracting: () => ({}),
  },
  LegalContractingOps: {
    startSelectHealth: async (_: unknown, args: { input: any }, ctx: { reply: FastifyReply }) => {
      const svc = resolveService<ContractingWorkflowService>(ctx, 'contractingWorkflowService')
      return svc.startSelectHealth(args.input)
    },
    approveStep: async (_: unknown, args: { workflowId: string; taskRefName: string }, ctx: { reply: FastifyReply }) => {
      const svc = resolveService<ContractingWorkflowService>(ctx, 'contractingWorkflowService')
      return svc.approveStep(args.workflowId, args.taskRefName)
    },
    addWorkflowTaskNote: async (_: unknown, args: { workflowId: string; taskName: string; content: string }, ctx: { reply: FastifyReply }) => {
      const notesSvc = resolveService<WorkflowNotesService>(ctx, 'workflowNotesService')
      // TODO: resolve actual identity from auth context; hardcode 1 for now
      const authorIdentityId = 1
      return notesSvc.addNote(args.workflowId, args.taskName, authorIdentityId, args.content)
    },
  },
  Contract: {
    __resolveReference: (contract: { id: string }) => {
      return {
        id: contract.id,
        status: 'DRAFT',
        carrierId: '',
        carrierName: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    },
  },
}
