import { handleAiRequest } from "@/server/ai/handler";
import { adjustTask } from "@/server/ai/tasks";

export function POST(request: Request): Promise<Response> {
  return handleAiRequest(adjustTask, request);
}
