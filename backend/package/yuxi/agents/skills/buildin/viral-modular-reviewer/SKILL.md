---
name: viral-modular-reviewer
description: 按照创作时冻结的同一模块规则快照审核爆款仿写的事实、结构、表达、报价和话题。
---

# 模块化爆款审核

只审核，不改稿。以 runtime_config_snapshot.content_rule_bundle 的版本、哈希和规则为准，不自行增加写作偏好。确定性校验已阻断的问题保持 blocked，并补充具体位置和定点建议。

提交结果前，读取 `runtime_config_snapshot.required_review_codes`。`checks` 必须把其中每个 code 恰好输出一次，逐项给出 `passed` 或 `blocked`，不得遗漏、改名或使用 `warning`。

逐项检查：

- `TITLE_ALIGNMENT`：标题公式、单一卖点、标题与正文主题一致；事实与数字有 Evidence。
- `CREATION_TYPE_ALIGNMENT`、`COMPOSITION_ALIGNMENT`：唯一爆款蓝图的创作类型和组成层次得到执行，但没有复制参考事实或原句。
- `BODY_VALUE`：正文至少有一种明确阅读价值，且核心卖点得到兑现。
- `NATURAL_EXPRESSION`：表达自然，不出现报告腔、报幕句、机械重复和硬塞热词。
- `LAYOUT_READABILITY`：短段、清单、留白和 Emoji 位置便于扫读，无 Markdown 结构。
- `PERSONA_OPENING`：正文前两个自然段已自然完成身份、价值、证据三层。身份回答“我是谁、做什么”；价值用做事特点回应当前痛点；证据用已有师傅资源、经验、报价方式、施工动作、服务方式或案例说明“为什么相信我”。三层可与爆款钩子合并，但不能写成标签清单。
- `PERSONA_GROUNDING`：全文只使用与当前场景和核心痛点匹配的 2～3 项有据优势，每项都能说明解决什么顾虑；少于 2 项、超过 3 项、机械罗列、不相关或无 Evidence 时阻断，不要求为凑数虚构。
- `PERSONA_CLOSING`：末段保持同一说话人，用已有服务边界或检查建议自然收尾，不新增优势、承诺或强引导。
- EMOJI_COVERAGE、EMOJI_APPROPRIATENESS、EMOJI_RESTRICTIONS：Emoji 覆盖至少三类真实语义、位置准确、不过量且不替代数字单位。
- `PRICE_SCOPE_ALIGNMENT`：有报价场景时，城市、工种、单位、价格类型、范围和合计一致；标准单价未被写成成交价。
- `PLATFORM_CTA`：问题词替换自然，无绝对化宣传；结尾没有要求评论、私信或发送户型项目。
- `TOPIC_ALIGNMENT`：话题恰好 10 个、互不重复、来自冻结池且与内容相关。

存在 `payload.expression_guidance` 时，`NATURAL_EXPRESSION` 和 `LAYOUT_READABILITY` 还要核对成稿是否吸收对应语气与具象表达原则，同时确认没有复制参考库中的人物、城市、数字、报价、案例、反馈或承诺。`我的优势`只能通过 Evidence 支撑开头三层人设和正文优势，不能从表达参考中补事实。

每个阻断项使用明确 code、原文 location、message、suggestion 和相关 Evidence ID。没有证据的问题不要臆测。
