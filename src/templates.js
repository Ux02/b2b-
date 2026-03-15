export const sequence = [
  {
    step: 1,
    delayHours: 0,
    subject: '关于「{{company}}」线索跟进自动化的一个建议',
    body: `你好 {{name}}，

我是{{sender}}。我看了下 {{company}} 的 ToB 获客流程，
我们可以在不改你现有 CRM 的情况下，7 天内跑通一个轻量自动化：
- 线索自动分层
- 邮件自动触达
- 沉默客户提醒
- 周报复盘（回复率 / 预约率）

如果你愿意，我可以给你一份 1 页诊断建议。

{{sender}}
{{senderTitle}}`
  },
  {
    step: 2,
    delayHours: 48,
    subject: '补充一个更具体的落地方式（{{company}}）',
    body: `你好 {{name}}，

补充一下具体交付方式：
1) 接你现有线索来源（表单/企微/CRM）
2) 配 3~5 封自动跟进邮件
3) 输出每周数据看板

目标是减少漏跟进和重复劳动。
如果你愿意，我可以直接给你一个试点方案（7 天可上线）。`
  },
  {
    step: 3,
    delayHours: 96,
    subject: '最后一次跟进：是否要我发试点报价？',
    body: `你好 {{name}}，

这是最后一次跟进，避免打扰。
如果你对自动化跟进有兴趣，我可以发你：
- 试点范围
- 验收指标
- 固定报价

回复“要”即可，我就整理给你。`
  }
];

export function render(text, vars) {
  return text.replace(/{{(\w+)}}/g, (_, key) => vars[key] ?? '');
}
