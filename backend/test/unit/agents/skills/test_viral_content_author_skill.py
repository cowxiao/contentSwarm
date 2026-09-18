import json
from pathlib import Path

import pytest

from yuxi.agents.middlewares.skills import RequiredSkillResolutionError, select_viral_author_instructions
from yuxi.agents.skills.buildin import BUILTIN_SKILLS


@pytest.fixture
def author_source():
    spec = next(item for item in BUILTIN_SKILLS if item.slug == "viral-content-author")
    return (Path(spec.source_dir) / "SKILL.md").read_text(encoding="utf-8")


def test_first_generation_injects_only_relevant_sections(author_source):
    payload = {
        "strategy_snapshot": {"body_formula": {"code": "FRB07"}},
        "evidence_bundle": {"items": [{"metadata": {"price_basis": "standard_unit_price"}}]},
        "channel_profile": {"body_constraints": {"emoji_allowed": True}},
    }

    instructions = select_viral_author_instructions(author_source, payload)

    assert "## 首次生成" in instructions
    assert "## 阻断后的定点回修" not in instructions
    assert "标准单价参考" in instructions
    assert "## Emoji 的语义覆盖" in instructions
    assert "## Emoji 禁用" not in instructions
    assert "写作前沿用锁定策略" in instructions
    assert "必须组成能自然朗读的中文短句" in instructions
    assert "元素拥挤时主动删到二至四个" in instructions
    assert "标题与正文围绕同一核心主题" in instructions
    assert "VIRAL_AUTHOR_" not in instructions
    assert len(instructions) <= 14_000


def test_repair_with_emoji_ban_omits_first_and_emoji_coverage(author_source):
    payload = {
        "strategy_snapshot": {"body_formula": {"code": "C03"}},
        "evidence_bundle": {"items": []},
        "channel_profile": {"body_constraints": {"emoji_allowed": False}},
        "review_report": {"status": "blocked"},
    }

    instructions = select_viral_author_instructions(author_source, payload)

    assert "## 阻断后的定点回修" in instructions
    assert "## 首次生成" not in instructions
    assert "## Emoji 禁用" in instructions
    assert "## Emoji 的语义覆盖" not in instructions
    assert "## 报价口径（本次涉及价格时执行）" not in instructions
    assert "直接删除该短语" in instructions
    assert "不得为了句子更丰富新增服务名词" in instructions


def test_missing_versioned_section_fails_explicitly():
    with pytest.raises(RequiredSkillResolutionError, match="仿写 Skill 缺少段落"):
        select_viral_author_instructions("# incomplete", {})


def test_reviewer_requires_literal_forbidden_word_match():
    spec = next(item for item in BUILTIN_SKILLS if item.slug == "viral-content-reviewer")
    instructions = (Path(spec.source_dir) / "SKILL.md").read_text(encoding="utf-8")

    assert "Unicode 字符在原文中逐字连续出现" in instructions
    assert "不得因同音、近义、相关概念或原文不存在的字阻断" in instructions
    assert "多个名词直接串接造成关键词堆砌" in instructions


def test_modular_persona_rules_require_three_layer_opening_and_relevant_advantages():
    persona = next(item for item in BUILTIN_SKILLS if item.slug == "viral-persona-author")
    persona_root = Path(persona.source_dir)
    instructions = (persona_root / "SKILL.md").read_text(encoding="utf-8")
    rules = json.loads((persona_root / "references" / "rules.yaml").read_text(encoding="utf-8"))
    reviewer = next(item for item in BUILTIN_SKILLS if item.slug == "viral-modular-reviewer")
    review_instructions = (Path(reviewer.source_dir) / "SKILL.md").read_text(encoding="utf-8")

    assert "正文前两个自然段必须自然完成三层表达" in instructions
    assert all(term in instructions for term in ("身份人设", "价值人设", "证据人设"))
    assert "当前场景和核心痛点最相关的 2～3 项" in instructions
    assert persona.version == "1.1.0"
    assert rules["version"] == "1.1.0"
    assert rules["runtime_rules"]["opening_layers"] == ["identity", "value", "evidence"]
    assert rules["runtime_rules"]["relevant_advantage_count"] == {"min": 2, "max": 3}
    assert reviewer.version == "1.1.0"
    assert "少于 2 项、超过 3 项、机械罗列、不相关或无 Evidence 时阻断" in review_instructions
