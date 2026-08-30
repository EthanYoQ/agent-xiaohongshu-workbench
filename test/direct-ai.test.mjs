import test from "node:test";
import assert from "node:assert/strict";
import { normalizeQuickPlan } from "../server/direct-ai.mjs";

function plan(count = 2) {
  return {
    title: "真正会休息的人，工作反而更快",
    body: "这是一段用于验证结构的完整发布正文。先说明为什么持续工作会让注意力下降，再给出一个可执行的离屏休息方法，最后提醒读者根据自己的状态调整。这里保留足够长度，避免把空洞短文误当成可发布内容。",
    tags: ["工作效率", "休息", "注意力", "职场", "方法"],
    cards: Array.from({ length: count }, (_, index) => ({
      kicker: index === 0 ? "小师妹" : "方法",
      headline: index === 0 ? "越会休息，越能做快" : `第 ${index + 1} 个动作`,
      body: "每一页只承担一个核心信息，让读者看完知道下一步做什么。",
      imagePrompt: "东方生活方式摄影，自然光，人物与环境形成清晰层次，保留上方负空间",
    })),
  };
}

test("direct quick plan requires the exact requested page count", () => {
  const checked = normalizeQuickPlan(plan(3), 3);
  assert.equal(checked.cards.length, 3);
  assert.equal(checked.tags.length, 5);
});

test("direct quick plan rejects incomplete page output", () => {
  assert.throws(() => normalizeQuickPlan(plan(2), 3), /QUICK_PLAN_INCOMPLETE/);
});

test("direct quick plan rejects missing image prompts", () => {
  const value = plan(2);
  value.cards[1].imagePrompt = "";
  assert.throws(() => normalizeQuickPlan(value, 2), /QUICK_PLAN_CARD_INCOMPLETE/);
});
