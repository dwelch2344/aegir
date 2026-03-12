import avro from "avsc";

export const WorkflowEventSchema = avro.Type.forSchema({
  type: "record",
  name: "WorkflowEvent",
  namespace: "com.aegir.conductor.cdc",
  fields: [
    {
      name: "event_type",
      type: {
        type: "enum",
        name: "EventType",
        symbols: ["CREATE", "UPDATE", "DELETE"],
      },
    },
    { name: "workflow_id", type: "string" },
    { name: "workflow_type", type: "string" },
    { name: "version", type: "int" },
    { name: "status", type: "string" },
    { name: "correlation_id", type: ["null", "string"], default: null },
    { name: "input", type: ["null", "string"], default: null },
    { name: "output", type: ["null", "string"], default: null },
    { name: "start_time", type: ["null", "long"], default: null },
    { name: "end_time", type: ["null", "long"], default: null },
    { name: "create_time", type: "long" },
    { name: "update_time", type: "long" },
    { name: "captured_at", type: "long" },
  ],
});

export const TaskEventSchema = avro.Type.forSchema({
  type: "record",
  name: "TaskEvent",
  namespace: "com.aegir.conductor.cdc",
  fields: [
    {
      name: "event_type",
      type: {
        type: "enum",
        name: "EventType",
        symbols: ["CREATE", "UPDATE", "DELETE"],
      },
    },
    { name: "task_id", type: "string" },
    { name: "workflow_id", type: "string" },
    { name: "task_type", type: "string" },
    { name: "reference_task_name", type: "string" },
    { name: "status", type: "string" },
    { name: "worker_id", type: ["null", "string"], default: null },
    { name: "input", type: ["null", "string"], default: null },
    { name: "output", type: ["null", "string"], default: null },
    { name: "start_time", type: ["null", "long"], default: null },
    { name: "end_time", type: ["null", "long"], default: null },
    { name: "poll_count", type: "int", default: 0 },
    { name: "retry_count", type: "int", default: 0 },
    { name: "captured_at", type: "long" },
  ],
});

export type WorkflowEvent = {
  event_type: "CREATE" | "UPDATE" | "DELETE";
  workflow_id: string;
  workflow_type: string;
  version: number;
  status: string;
  correlation_id: string | null;
  input: string | null;
  output: string | null;
  start_time: number | null;
  end_time: number | null;
  create_time: number;
  update_time: number;
  captured_at: number;
};

export type TaskEvent = {
  event_type: "CREATE" | "UPDATE" | "DELETE";
  task_id: string;
  workflow_id: string;
  task_type: string;
  reference_task_name: string;
  status: string;
  worker_id: string | null;
  input: string | null;
  output: string | null;
  start_time: number | null;
  end_time: number | null;
  poll_count: number;
  retry_count: number;
  captured_at: number;
};
