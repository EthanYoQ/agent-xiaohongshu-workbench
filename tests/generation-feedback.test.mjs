import assert from "node:assert/strict";
import test from "node:test";
import { generationFailureFeedback, providerHealthState } from "../src/generation-feedback.mjs";

test("generation failures become persistent human-readable recovery states", () => {
  assert.equal(generationFailureFeedback(new Error("Ark function arguments are not valid JSON")).code, "MODEL_FORMAT_REJECTED");
  const imageJson = generationFailureFeedback(Object.assign(new Error("provider request failed: Ark function arguments are not valid JSON"), { providerStage: "image" }));
  assert.equal(imageJson.title, "分镜结构没有通过校验");
  assert.match(imageJson.detail, /¥0\.00/);
  assert.match(imageJson.detail, /图片模型尚未调用/);
  assert.equal(generationFailureFeedback(new Error("TEXT_QUALITY_GATE_FAILED:pages[1].body:too_short")).code, "COPY_TOO_SHORT");
  const lengthFailure = generationFailureFeedback(Object.assign(new Error("provider request failed: TEXT_QUALITY_GATE_FAILED:body:length"), { providerCode: "TEXT_QUALITY_GATE_FAILED:body:length", providerStage: "text" }));
  assert.equal(lengthFailure.code, "COPY_LENGTH_REJECTED");
  assert.equal(lengthFailure.technical_code, "TEXT_QUALITY_GATE_FAILED:body:length");
  assert.equal(lengthFailure.stage, "text");
  const networkFailure = generationFailureFeedback(Object.assign(new Error("provider request failed: PAGE_PLAN_MODEL_CALL_FAILED:NETWORK_FETCH_FAILED:UND_ERR_CONNECT_TIMEOUT"), { providerCode: "PAGE_PLAN_MODEL_CALL_FAILED:NETWORK_FETCH_FAILED:UND_ERR_CONNECT_TIMEOUT", providerStage: "image" }));
  assert.equal(networkFailure.code, "ARK_NETWORK_UNAVAILABLE");
  assert.equal(networkFailure.stage, "image");
  assert.match(networkFailure.detail, /本机工作台正常/);
  const pagePlan = generationFailureFeedback(new Error("TEXT_QUALITY_GATE_FAILED:pages[0].image_prompt:action_not_visually_demonstrated"));
  assert.equal(pagePlan.code, "IMAGE_PLAN_REJECTED");
  assert.match(pagePlan.detail, /发布文案仍然有效/);
  assert.equal(generationFailureFeedback(new DOMException("aborted", "AbortError")).code, "GENERATION_TIMEOUT");
});

test("quality gate failures report the actual content problem instead of blaming Ark connectivity", () => {
  const hook = generationFailureFeedback(Object.assign(new Error("provider request failed: TEXT_QUALITY_GATE_FAILED:titles:cheap_or_unverifiable_hook:不用复杂工具"), { providerCode: "TEXT_QUALITY_GATE_FAILED:titles:cheap_or_unverifiable_hook:不用复杂工具", providerStage: "text" }));
  assert.equal(hook.code, "CHEAP_HOOK_REJECTED");
  assert.match(hook.title, /标题/);
  assert.doesNotMatch(hook.title, /火山/);
  const procedure = generationFailureFeedback(new Error("TEXT_QUALITY_GATE_FAILED:wellness:missing_procedure"));
  assert.equal(procedure.code, "WELLNESS_PROCEDURE_MISSING");
  assert.match(procedure.detail, /三步|顺序动作/);
});

test("provider health distinguishes content rejection from connectivity failure", () => {
  assert.equal(providerHealthState({ configured: true, status: "FAIL_CLOSED", last_error: "TEXT_QUALITY_GATE_FAILED:wellness:missing_procedure" }), "UNVERIFIED");
  assert.equal(providerHealthState({ configured: true, status: "FAIL_CLOSED", last_error: "TEXT_QUALITY_GATE_FAILED:wellness:missing_procedure", last_success_at: "2026-08-23T00:00:00Z" }), "ONLINE");
  assert.equal(providerHealthState({ configured: true, status: "FAIL_CLOSED", last_error: "PAGE_PLAN_MODEL_CALL_FAILED:NETWORK_FETCH_FAILED:UND_ERR_CONNECT_TIMEOUT" }), "DEGRADED");
  assert.equal(providerHealthState({ configured: true, status: "TEXT_READY", last_error: null }), "UNVERIFIED");
  assert.equal(providerHealthState({ configured: true, status: "TEXT_READY", last_error: null, last_success_at: "2026-08-23T00:00:00Z" }), "ONLINE");
  assert.equal(providerHealthState({ configured: true, status: "CONFIGURED_UNVERIFIED", last_success_at: null }), "UNVERIFIED");
  assert.equal(providerHealthState({ configured: false, status: "NOT_CONFIGURED" }), "OFFLINE");
});

test("partial image failures tell the user exactly what is preserved and what resume will do", () => {
  const error = new Error("IMAGE_3_QA_REJECTED:HAND_INVALID");
  error.providerDetails = { resume_run_id: "images-2026-08-15T00-00-00-000Z-1234abcd", completed_pages: 2, total_pages: 4, failed_page: 3, actual_image_calls: 3, estimated_image_cost_cny: 0.66 };
  const feedback = generationFailureFeedback(error);
  assert.equal(feedback.code, "IMAGE_PARTIAL_RESULT_PRESERVED");
  assert.equal(feedback.title, "已保留 2/4 张图片");
  assert.match(feedback.detail, /第 3 张/);
  assert.match(feedback.detail, /¥0\.66/);
  assert.match(feedback.detail, /不会重新生成前 2 张/);
});

test("partial mother-sheet failures report paid calls instead of pretending they are final pages", () => {
  const error = new Error("MOTHER_SHEET_2_CALL_FAILED");
  error.providerDetails = { resume_run_id: "images-2026-08-23T00-00-00-000Z-abcd1234", completed_pages: 4, total_pages: 6, completed_mother_sheets: 1, total_mother_sheets: 2, failed_mother_sheet: 2, actual_image_calls: 1, estimated_image_cost_cny: 0.22 };
  const feedback = generationFailureFeedback(error);
  assert.equal(feedback.title, "已保留 1/2 张母图");
  assert.match(feedback.detail, /第 2 张母图/);
  assert.match(feedback.detail, /¥0\.22/);
});
