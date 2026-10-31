import { handleAiRequest } from "@/server/ai/handler";
import { draftTask } from "@/server/ai/tasks";

export function POST(request: Request): Promise<Response> {
  return handleAiRequest(draftTask, request);
}
