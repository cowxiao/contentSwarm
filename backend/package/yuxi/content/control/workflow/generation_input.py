"""正文与审核模型视图：完整审计快照留在服务端。"""

from copy import deepcopy

from yuxi.content.model.contracts.content_nodes import (
    GenerateContentPromptV1,
    PlanVisualsInputV1,
    SemanticReviewPromptV1,
)
from yuxi.content.v3.modular_rules import (
    BASE_GENERATION_SKILLS,
    COVER_SKILL,
    GENERATION_SKILLS,
    REVIEW_SKILL,
    has_price_context,
    required_review_codes,
    select_modular_generation_skills,
)


def _project_frozen_writing_context(projected: dict) -> None:
    """仅去除已校验输入中的审计副本，保留每条可写事实和参考蓝图。"""

    strategy = projected["strategy_snapshot"]
    strategy.pop("decision", None)
    strategy.pop("snapshot_hash", None)
    # 参考蓝图与选择依据已经冻结在 style_reference Evidence 中。
    strategy.pop("reference_snapshot", None)
    body_formula = strategy["body_formula"]
    # 锁定快照为了审计在三个位置保存同一方向蓝图；模型只需顶层一份。
    if strategy.get("direction_blueprint") is not None:
        if body_formula.get("composition_blueprint") == strategy["direction_blueprint"]:
            body_formula.pop("composition_blueprint", None)
        if (
            body_formula.get("body_calling")
            and body_formula["body_calling"].get("composition_blueprint") == strategy["direction_blueprint"]
        ):
            body_formula["body_calling"].pop("composition_blueprint", None)
    body_formula.pop("body_calling_source", None)
    brief = projected["content_brief"]
    brief.pop("visual_material", None)
    for key in list(brief):
        if key.endswith("_version_id"):
            del brief[key]
    for section in ("business_variables", "form_values"):
        values = brief.get(section) or {}
        for key in list(values):
            if key == "user_request":
                continue
            if key.endswith("_version_id") or key in {"attachments", "visual_material"}:
                del values[key]
            elif any(
                item.get("source_type") == "manual_input"
                and item.get("source_id", "").startswith("field_")
                and item.get("verified_status") == "user_confirmed"
                and key in item.get("variable_codes", [])
                and type(item.get("value")) is type(values[key])
                and item.get("value") == values[key]
                for item in projected["evidence_bundle"].get("items", [])
            ):
                del values[key]
    for item in projected["evidence_bundle"].get("items", []):
        for field in ("source_hash", "source_version", "created_at"):
            item.pop(field, None)
        metadata = item.get("metadata") or {}
        if metadata.get("material_type") == "viral_example" and metadata.get("selected_reference"):
            basis = metadata.get("selection_basis") or {}
            if basis:
                metadata["selection_basis"] = {
                    key: basis[key]
                    for key in ("input_variable_paths", "matched_dimensions", "structure_fillability")
                    if key in basis
                }


def _project_rule_bundle(bundle: dict, active_skills: tuple[str, ...]) -> dict:
    active = set(active_skills)
    return {
        "schema_version": bundle.get("schema_version"),
        "bundle_version": bundle.get("bundle_version"),
        "bundle_hash": bundle.get("bundle_hash"),
        "active_modules": list(active_skills),
        "active_rule_ids": [
            rule_id for rule_id in bundle.get("active_rule_ids") or [] if str(rule_id).split(".v", 1)[0] in active
        ],
        "runtime_rules": {slug: value for slug, value in (bundle.get("runtime_rules") or {}).items() if slug in active},
        **({"topic_candidates": bundle.get("topic_candidates") or []} if "viral-topic-author" in active else {}),
    }


def project_generation_input(payload: dict, *, active_skills: tuple[str, ...] | None = None) -> dict:
    # 调用方必须先完成 GenerateContentInputV1 校验（包括冻结策略 hash）。
    if payload["runtime_config_snapshot"].get("creation_mode") != "viral_rewrite":
        raise ValueError("内容生成只支持爆款仿写")
    projected = deepcopy(payload)
    _project_frozen_writing_context(projected)
    runtime = projected["runtime_config_snapshot"]
    rule_bundle = runtime.get("content_rule_bundle") or {}
    if rule_bundle:
        active_skills = active_skills or select_modular_generation_skills(GENERATION_SKILLS, projected)
    projected["runtime_config_snapshot"] = {
        "creation_mode": "viral_rewrite",
        **({"content_rule_bundle": _project_rule_bundle(rule_bundle, active_skills)} if rule_bundle else {}),
    }
    return GenerateContentPromptV1.model_validate(projected).model_dump(mode="json")


def project_review_input(payload: dict) -> dict:
    """语义审核仍读取全文、全部事实和选中参考，只去除重复审计字段。"""

    projected = deepcopy(payload)
    _project_frozen_writing_context(projected)
    runtime = projected.get("runtime_config_snapshot") or {}
    rule_bundle = runtime.get("content_rule_bundle") or {}
    if rule_bundle:
        active_skills = list(BASE_GENERATION_SKILLS)
        if has_price_context(projected):
            active_skills.insert(-1, "viral-price-author")
        active_skills.append(REVIEW_SKILL)
        projected["runtime_config_snapshot"] = {
            "content_rule_bundle": _project_rule_bundle(rule_bundle, tuple(active_skills)),
            "required_review_codes": list(required_review_codes(projected)),
        }
    return SemanticReviewPromptV1.model_validate(projected).model_dump(mode="json", exclude_none=True)


def project_visual_input(
    payload: dict,
    *,
    required_visual_intent: str | None = None,
    required_source_asset_ids: tuple[str, ...] = (),
    allowed_visual_evidence_ids: frozenset[str] = frozenset(),
) -> dict:
    projected = deepcopy(payload)
    runtime = projected.get("runtime_config_snapshot") or {}
    rule_bundle = runtime.get("content_rule_bundle") or {}
    if rule_bundle:
        runtime["content_rule_bundle"] = _project_rule_bundle(rule_bundle, (COVER_SKILL,))
    projected["runtime_config_snapshot"] = runtime
    projected["required_visual_intent"] = required_visual_intent or "general"
    projected["required_source_asset_ids"] = list(required_source_asset_ids)
    projected["allowed_visual_evidence_ids"] = sorted(allowed_visual_evidence_ids)
    return PlanVisualsInputV1.model_validate(projected).model_dump(mode="json")


__all__ = ["project_generation_input", "project_review_input", "project_visual_input"]
