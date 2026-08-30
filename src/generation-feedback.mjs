export function providerHealthState(health) {
  if (!health || health.configured !== true) return "OFFLINE";
  const status = String(health.status || "");
  const lastError = String(health.last_error || "");
  const hasVerifiedSuccess = Boolean(health.last_success_at);
  if (status === "CONFIGURED_UNVERIFIED" || status === "READY_FOR_PROBE") return "UNVERIFIED";
  if (status !== "FAIL_CLOSED") return hasVerifiedSuccess || status === "LIVE_VERIFIED" ? "ONLINE" : "UNVERIFIED";
  if (/NETWORK_FETCH_FAILED|UND_ERR|SSL.*timeout|fetch failed|ARK_HTTP_(401|403|408|429|5\d\d)|ModelNotOpen|quota|billing/i.test(lastError)) return "DEGRADED";
  return hasVerifiedSuccess ? "ONLINE" : "UNVERIFIED";
}

export function generationFailureFeedback(error) {
  const message = String(error?.message || error || "");
  const technicalCode = String(error?.providerCode || message.replace(/^provider request failed:\s*/i, "") || "GENERATION_FAILED").slice(0, 220);
  const inferredStage = error?.providerStage || (/IMAGE_|PAGE_PLAN|image/i.test(technicalCode) ? "image" : "text");
  const meta = { technical_code: technicalCode, stage: inferredStage, failure_id: error?.failureId || null, failed_at: new Date().toISOString() };
  const resume = error?.providerDetails;
  if (resume?.resume_run_id && Number.isInteger(resume.completed_mother_sheets) && Number.isInteger(resume.total_mother_sheets)) {
    return { ...meta, stage: "image", code: "IMAGE_PARTIAL_RESULT_PRESERVED", title: `已保留 ${resume.completed_mother_sheets}/${resume.total_mother_sheets} 张母图`, detail: `停在第 ${resume.failed_mother_sheet || resume.completed_mother_sheets + 1} 张母图；已发生约 ¥${Number(resume.estimated_image_cost_cny || 0).toFixed(2)}。继续时会从母图断点恢复，已切好的插画单元不会重做。` };
  }
  if (resume?.resume_run_id && Number.isInteger(resume.completed_pages) && Number.isInteger(resume.total_pages)) {
    return { ...meta, stage: "image", code: "IMAGE_PARTIAL_RESULT_PRESERVED", title: `已保留 ${resume.completed_pages}/${resume.total_pages} 张图片`, detail: `停在第 ${resume.failed_page || resume.completed_pages + 1} 张；已发生约 ¥${Number(resume.estimated_image_cost_cny || 0).toFixed(2)}。点击“继续生成剩余图片”会从断点继续，不会重新生成前 ${resume.completed_pages} 张。` };
  }
  if (/ModelNotOpen/.test(message)) return { ...meta, code: "MODEL_NOT_OPEN", title: "当前模型尚未开通", detail: "请先在火山方舟开通当前模型；画布和旧稿没有改变。" };
  if (/PAGE_PLAN_MODEL_CALL_FAILED:NETWORK_FETCH_FAILED|fetch failed/i.test(message) && inferredStage === "image") return { ...meta, stage: "image", code: "ARK_NETWORK_UNAVAILABLE", title: "当前网络连不上火山方舟", detail: "本机工作台正常，但配图分镜请求没有到达方舟。本轮没有取得图片调用结果；请检查网络、代理或 VPN，稍后从这里重试。" };
  if (/IMAGE_ASSET_DOWNLOAD_NETWORK_FAILED/i.test(message)) return { ...meta, stage: "image", code: "IMAGE_DOWNLOAD_INTERRUPTED", title: "生成图下载中断", detail: "方舟可能已经返回图片，但本机未能下载完成。不要重新开始整批生成，请从当前断点继续。" };
  if (/NETWORK_FETCH_FAILED|UND_ERR|SSL.*timeout|fetch failed/i.test(message)) return { ...meta, code: "ARK_NETWORK_UNAVAILABLE", title: "火山方舟连接异常", detail: "本机工作台仍正常，旧稿和当前画布均已保留。请检查网络、代理或 VPN 后重试当前节点。" };
  if (/Ark function arguments are not valid JSON|INVALID_JSON|function arguments/i.test(message)) {
    if (inferredStage === "image") return { ...meta, stage: "image", code: "MODEL_FORMAT_REJECTED", title: "分镜结构没有通过校验", detail: "模型返回的分镜 JSON 不完整。发布文字和旧画布都已保留，图片模型尚未调用，本轮图片费用为 ¥0.00；可从当前配图节点重试。" };
    return { ...meta, stage: "text", code: "MODEL_FORMAT_REJECTED", title: "文字格式没有通过校验", detail: "模型返回的文字结构不完整。旧稿已保留，可在这里重试文字。" };
  }
  if (/TEXT_QUALITY_GATE_FAILED:titles:cheap_or_unverifiable_hook/i.test(message)) return { ...meta, stage: "text", code: "CHEAP_HOOK_REJECTED", title: "标题钩子太虚，已拦截", detail: "系统已尝试把标题改成更具体、可验证的表达，但本轮仍未过线。旧稿没有丢；重试会继续围绕主题本身改写，不会调用图片。" };
  if (/TEXT_QUALITY_GATE_FAILED:publish_copy:cheap_or_unverifiable_hook/i.test(message)) return { ...meta, stage: "text", code: "CHEAP_COPY_REJECTED", title: "正文有夸张或不可核验表达", detail: "系统已经做过有界修稿，但仍有低门槛、强效果或主观自证式表达。旧稿已保留；重试文字不会产生图片费用。" };
  if (/TEXT_QUALITY_GATE_FAILED:wellness:missing_procedure/i.test(message)) return { ...meta, stage: "text", code: "WELLNESS_PROCEDURE_MISSING", title: "养生稿缺少清楚步骤", detail: "正文讲了原因或感受，但没有形成至少三步可照做的顺序动作。系统会在重试时优先补齐步骤和停止条件。" };
  if (/TEXT_QUALITY_GATE_FAILED:wellness:missing_safety_boundary/i.test(message)) return { ...meta, stage: "text", code: "WELLNESS_SAFETY_MISSING", title: "养生稿缺少安全边界", detail: "需要明确哪些情况应停止、就医或咨询专业人士。系统会在重试时补齐，而不是放松安全标准。" };
  if (/TEXT_QUALITY_GATE_FAILED.*too_short|body:too_short/i.test(message)) return { ...meta, stage: "text", code: "COPY_TOO_SHORT", title: "正文太短，已拦截", detail: "模型没有写到可发布长度。旧稿已保留；修改原文或补充要求后重试文字。" };
  if (/TEXT_QUALITY_GATE_FAILED.*body:length|body:length/i.test(message)) return { ...meta, stage: "text", code: "COPY_LENGTH_REJECTED", title: "正文长度没有通过校验", detail: "模型连续尝试后仍没有落在可发布长度。旧稿已保留；修改原文或补充要求后重试文字。" };
  if (/PAGE_PLAN|pages\[[0-9]+\].*action|action_not_visually_demonstrated|eye_care_action_not_visible|VISUAL_SUBJECT_MISSING/i.test(message)) return { ...meta, stage: "image", code: "IMAGE_PLAN_REJECTED", title: "分镜描述不够明确", detail: "发布文案仍然有效，图片模型尚未调用。补充动作参考或画面设置后重试图片。" };
  if (/return_xiaoshimei_image_qa|IMAGE_[0-9]+_QA_CALL_FAILED/i.test(message)) return { ...meta, stage: "image", code: "IMAGE_QA_UNAVAILABLE", title: "图片质检暂时不可用", detail: "已生成图片应继续保留供人工确认，不会自动覆盖或重复计费。" };
  if (/production layout budget|TEXT_QUALITY_GATE_FAILED/i.test(message)) return { ...meta, code: "QUALITY_GATE_REJECTED", title: "内容没有通过质量校验", detail: "文字密度、主题相关性或表达边界仍有明确问题。旧稿已保留，重试只修当前文字节点。" };
  if (/AbortError|aborted|timeout/i.test(message)) return { ...meta, code: "GENERATION_TIMEOUT", title: "生成等待超时", detail: "旧稿没有改变。服务恢复后可从当前节点重试。" };
  return { ...meta, code: "GENERATION_FAILED", title: "生成请求没有完成", detail: "旧稿和当前画布均已保留。下方保留了技术码，可从当前节点重试。" };
}
