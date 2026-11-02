import { isBridgeRequest, type BridgeRequest, type BridgeResponse } from "./protocol.js";

function deliver(response: BridgeResponse): void {
  window.postMessage(response, window.location.origin);
}

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.source !== window || !isBridgeRequest(event.data)) return;
  const request = event.data as BridgeRequest;
  chrome.runtime.sendMessage(request, (response: unknown) => {
    const runtimeError = chrome.runtime.lastError?.message;
    if (runtimeError) {
      deliver({
        type: `R_${request.type}`,
        requestId: request.requestId,
        success: false,
        error: runtimeError
      });
      return;
    }
    if (!response || typeof response !== "object") {
      deliver({
        type: `R_${request.type}`,
        requestId: request.requestId,
        success: false,
        error: "Empty extension response"
      });
      return;
    }
    deliver(response as BridgeResponse);
  });
});
