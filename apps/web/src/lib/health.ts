
import { apiRequest } from "@/lib/api";

export type HealthResponse = {
  status: string;
  database?: string;
};

export function getHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>("/health");
}
