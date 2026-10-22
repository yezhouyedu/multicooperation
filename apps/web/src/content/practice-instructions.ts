// Researcher-approved 2026-10-22 copy. Formatting only; do not interpolate or rewrite.
// Source: 第十一次开会/测试轮指导语.txt. Verified by scripts/verify-practice-instructions.cjs.
export const PRACTICE_INSTRUCTIONS_TEXT = `欢迎进入测试轮

测试轮用于熟悉实验页面和操作，不计入绩效。

任务1与工作台

- 每次任务1需要阅读一家公司的材料并填写任务表。测试轮只处理1家公司，正式工作段中需依次处理多家公司。
- 左侧为材料区，用于查看公司材料；右侧为任务表区，用于填写任务结果。

任务1的时间安排

- 角色A：每家公司处理时间为5分钟，到时自动提交，不支持提前提交。
- 角色B：测试轮处理时间在屏幕右上角显示，到时自动提交；正式工作段中每家公司不单独限时，但开始5分钟后才能选择提交。
- 信息开放：正式工作段中，开始处理一家公司5分钟后，角色A的任务结果及原始材料向角色B开放。角色B可自行决定是否查看和使用，不影响其提交资格。角色B可以就信息开放内容选择反馈，如果反馈，将向角色A实时显示。
- 测试轮不开放另一角色的信息。

任务2

- 正式工作段中，任务2会按系统安排出现。你可以自主决定如何在任务1和任务2之间安排时间。
- 任务2的题目进度在新的工作段开始后重置，已获得的绩效分不会清零。
- 测试轮中的任务2仅用于操作演示，不会实际推送题目。

**按钮：我了解了**`;

const paragraphs = PRACTICE_INSTRUCTIONS_TEXT.split('\n\n');
const sectionParagraphs = paragraphs.slice(2, -1);

export const PRACTICE_OVERVIEW = {
  title: paragraphs[0],
  introduction: paragraphs[1],
  sections: Array.from({ length: sectionParagraphs.length / 2 }, (_, index) => ({
    heading: sectionParagraphs[index * 2],
    items: sectionParagraphs[index * 2 + 1].split('\n').map((line) => line.slice(2)),
  })),
  buttonLabel: paragraphs.at(-1)!.replace(/^\*\*按钮：(.*)\*\*$/, '$1'),
};
