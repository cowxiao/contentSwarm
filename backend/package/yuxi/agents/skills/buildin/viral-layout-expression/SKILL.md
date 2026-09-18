---
name: viral-layout-expression
description: 将装修文案排成小红书可直接发布的短段、清单与语义 Emoji，提升扫读体验。
---

# 小红书格式化表达

按参考蓝图的 paragraph_rhythm、list_pattern 和 emoji_pattern 排版，同时服从渠道限制。

- 使用纯文本短段与自然留白；报价、施工步骤、材料或避坑项可独立分行。禁止 Markdown 标题、表格、代码块和无意义分割线。
- 单段不堆成长墙；列表只在确有并列信息时使用，不把每句都编号。
- Emoji 必须紧邻所修饰的情绪、数据、事项或动作。至少覆盖三类实际语义；同一 Emoji 不连续刷屏，不用 Emoji 替代数字、单位或标点。
- 格式化只改换行、列表符号、必要连接词与 Emoji 位置，不改事实、金额、单位、标题主题和证据绑定。
- `payload.expression_guidance` 存在时，读取其中 `role=concrete_expression` 的全部召回片段，只借鉴动作化表达、短段节奏、清单组织和 Emoji 位置；不得带入片段中的业务事实、数字、案例或人物。
