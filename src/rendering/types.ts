import type { Status } from "../host";
export interface RenderSession {
  dispose(): void;
  getStatus(): Status;
}
