import { disabledResponse, isBridgeRequest, responseFor, type BridgeRequest } from "./protocol.js";

const localControlResponses: Readonly<Record<string, unknown>> = {
  CHECK_ACTIVE_EXTENSION: { active: true, externalExecutionEnabled: false },
  GET_VERSION: { version: "0.1.0", externalExecutionEnabled: false }
};

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isBridgeRequest(message)) {
    sendResponse({
      type: "R_INVALID",
      requestId: "invalid",
      success: false,
      error: "Invalid GroupPilot bridge request"
    });
    return false;
  }

  const request = message as BridgeRequest;
  const localData = localControlResponses[request.type];
  if (localData !== undefined) {
    sendResponse(responseFor(request, { success: true, data: localData }));
    return false;
  }

  // Deliberately no fetch(), tabs API, cookies API, or Facebook operation.
  sendResponse(disabledResponse(request));
  return false;
});
