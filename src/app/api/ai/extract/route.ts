import { handleAiRequest } from "@/server/ai/handler";
import { extractTask } from "@/server/ai/tasks";

export function POST(request: Request): Promise<Response> {
  return handleAiRequest(extractTask, request);
}
