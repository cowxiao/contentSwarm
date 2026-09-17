import { createBlankDesign, createNode, type DesignFile, type Node, type TextNode } from "@hc/schema";
import { fromHex } from "@hc/color";
import { fontFamilyStack } from "@hc/engine";
import { buildCoverElement, type CoverElement } from "@/lib/coverElements";

export const XHS_EDITORIAL_ID = "xhs_left_editorial_v1";
export const xhsEditorialDefault = {
  title: "旧房改造\n这些细节要注意",
  subtitle: "拆清项目，看懂每一笔人工费用",
  tags: { primary: "长沙装修", secondary: "三室两厅" },
  number: { value: "33341", unit: "元" },
  footnote: "费用口径与施工范围，以实际方案为准",
};
export type XhsEditorialContent = typeof xhsEditorialDefault;
export type XhsLayoutError = { slotId: string; code: "REQUIRED" | "TEXT_OVERFLOW" | "FLOW_OVERFLOW"; message: string };
export type XhsLayoutResult = { success: true; file: DesignFile } | { success: false; errors: XhsLayoutError[] };

type Measure = (text: string, fontSize: number, weight: number) => number;
const colors = { title: "#16232D", subtitle: "#556577", blue: "#2D52B0", blueLight: "#EAF0FF", number: "#E94830", line: "#9AAFC5", footnote: "#718298" };

export function browserEditorialMeasure(): Measure {
  const context = document.createElement("canvas").getContext("2d")!;
  return (text, size, weight) => {
    context.font = `${weight} ${size}px ${fontFamilyStack("system")}`;
    return context.measureText(text).width;
  };
}

// Each authored line is measured as grapheme clusters. Explicit newlines stay
// intact; automatic wrapping never separates a combined character or emoji.
function fit(text: string, slotId: string, maxWidth: number, maxLines: number, initialSize: number, minimumSize: number, weight: number, measure: Measure):
  { lines: string[]; size: number } | XhsLayoutError {
  const explicit = text.trim().split("\n");
  if (explicit.length > maxLines) return { slotId, code: "TEXT_OVERFLOW", message: `${slotId} 最多 ${maxLines} 行，请减少换行` };
  const segmenter = new Intl.Segmenter("zh", { granularity: "grapheme" });
  for (let size = initialSize; size >= minimumSize; size -= 2) {
    const lines: string[] = [];
    for (const source of explicit) {
      let current = "";
      for (const { segment } of segmenter.segment(source)) {
        if (current && measure(current + segment, size, weight) > maxWidth) {
          lines.push(current);
          current = segment;
        } else current += segment;
      }
      lines.push(current);
    }
    if (lines.length <= maxLines && lines.every((line) => measure(line, size, weight) <= maxWidth)) return { lines, size };
  }
  return { slotId, code: "TEXT_OVERFLOW", message: `${slotId} 内容过长，请缩短文字` };
}

function textNode(slotId: string, elementType: "title" | "subtitle" | "tag" | "number", binding: string,
  lines: string[], x: number, y: number, width: number, height: number, size: number, weight: number, color: string, lineHeight: number): TextNode {
  const names: Record<string, string> = { title: "主标题", subtitle: "副标题", footnote: "底部说明", tagPrimaryText: "顶部标签文字", tagSecondaryText: "次级标签文字", numberValue: "数字", numberUnit: "单位" };
  const preset: CoverElement = { id: slotId, category: elementType === "title" ? "标题" : elementType === "tag" ? "标签" : elementType === "number" ? "数字" : "副标题",
    name: names[slotId] ?? slotId, lines, width, fontSize: size, weight, color };
  const node = buildCoverElement(preset, { width: 1080, height: 1440 }) as TextNode;
  node.transform = { ...node.transform, x, y };
  node.size = { width, height };
  node.box = { mode: "fixed", width, height, padding: { t: 0, r: 0, b: 0, l: 0 }, verticalAlign: "middle" };
  node.content.forEach((paragraph) => paragraph.runs.forEach((run) => { run.style.lineHeight = { mode: "absolute", value: lineHeight }; }));
  node.data = { ...node.data, layoutInstanceId: XHS_EDITORIAL_ID, layoutTemplateId: XHS_EDITORIAL_ID, slotId, elementType, binding, layoutMode: "auto" };
  return node;
}

function tagNode(slotId: "tagPrimary" | "tagSecondary", binding: string, value: string, x: number, y: number,
  width: number, height: number, size: number, foreground: string, background: string): Node {
  const name = slotId === "tagPrimary" ? "顶部标签" : "次级标签";
  const backdrop = createNode("shape", { name: `${name}底色`, shape: "rect", size: { width, height },
    cornerRadius: { topLeft: 28, topRight: 28, bottomRight: 28, bottomLeft: 28 },
    fills: [{ type: "solid", color: fromHex(background)! }],
    data: { layoutInstanceId: XHS_EDITORIAL_ID, layoutTemplateId: XHS_EDITORIAL_ID, slotId: `${slotId}Background`, elementType: "decoration", binding: "", layoutMode: "auto" } });
  const label = textNode(`${slotId}Text`, "tag", binding, [value], 24, 0, width - 48, height, size, 700, foreground, height);
  return createNode("group", { name, size: { width, height }, transform: { x, y, scaleX: 1, scaleY: 1, rotation: 0 }, children: [backdrop, label],
    data: { layoutInstanceId: XHS_EDITORIAL_ID, layoutTemplateId: XHS_EDITORIAL_ID, slotId, elementType: "tag", binding, layoutMode: "auto" } });
}

export function buildXhsEditorialCover(content: XhsEditorialContent, measure: Measure): XhsLayoutResult {
  const errors: XhsLayoutError[] = [];
  const title = content.title.trim();
  if (!title) return { success: false, errors: [{ slotId: "title", code: "REQUIRED", message: "请填写主标题" }] };
  const fittedTitle = fit(title, "title", 888, 2, 120, 88, 900, measure);
  if ("code" in fittedTitle) errors.push(fittedTitle);
  const subtitle = content.subtitle.trim();
  const fittedSubtitle = subtitle ? fit(subtitle, "subtitle", 888, 2, 44, 36, 500, measure) : null;
  if (fittedSubtitle && "code" in fittedSubtitle) errors.push(fittedSubtitle);
  const footnote = content.footnote.trim();
  const fittedFootnote = footnote ? fit(footnote, "footnote", 888, 2, 28, 22, 400, measure) : null;
  if (fittedFootnote && "code" in fittedFootnote) errors.push(fittedFootnote);
  const primary = content.tags.primary.trim();
  const fittedPrimary = primary ? fit(primary, "tagPrimary", 372, 1, 40, 28, 700, measure) : null;
  if (fittedPrimary && "code" in fittedPrimary) errors.push(fittedPrimary);
  const secondary = content.tags.secondary.trim();
  const fittedSecondary = secondary ? fit(secondary, "tagSecondary", 232, 1, 32, 24, 700, measure) : null;
  if (fittedSecondary && "code" in fittedSecondary) errors.push(fittedSecondary);
  if (errors.length) return { success: false, errors };
  const main = fittedTitle as { lines: string[]; size: number };
  const sub = fittedSubtitle as { lines: string[]; size: number } | null;
  const foot = fittedFootnote as { lines: string[]; size: number } | null;
  const tag1 = fittedPrimary as { lines: string[]; size: number } | null;
  const tag2 = fittedSecondary as { lines: string[]; size: number } | null;
  const file = createBlankDesign({ width: 1080, height: 1440 });
  file.title = "左对齐大标题 · 数字信息行";
  const page = file.pages[0];
  page.name = file.title;
  page.background = { type: "solid", color: fromHex("#FFF9F0")! };
  const nodes: Node[] = [];
  if (tag1) {
    const width = Math.min(420, Math.ceil(measure(primary, tag1.size, 700) + 48));
    nodes.push(tagNode("tagPrimary", "tags.primary", primary, 96, 112, width, 64, tag1.size, "#FFFFFF", colors.blue));
  }
  const titleHeight = main.lines.length * main.size * 1.2;
  nodes.push(textNode("title", "title", "title", main.lines, 96, 272, 888, titleHeight, main.size, 900, colors.title, main.size * 1.2));
  let nextY = 272 + titleHeight;
  if (sub) {
    nextY += 48;
    const height = sub.lines.length * sub.size * (56 / 44);
    nodes.push(textNode("subtitle", "subtitle", "subtitle", sub.lines, 96, nextY, 888, height, sub.size, 500, colors.subtitle, sub.size * (56 / 44)));
    nextY += height;
  }
  const value = content.number.value.trim();
  if (value || tag2) {
    nextY += 56;
    let numberSize = 88;
    let numberWidth = value ? measure(value, numberSize, 900) + (content.number.unit.trim() ? 8 + measure(content.number.unit.trim(), 30, 600) : 0) : 0;
    while (value && numberWidth > 888 && numberSize > 64) {
      numberSize -= 2;
      numberWidth = measure(value, numberSize, 900) + (content.number.unit.trim() ? 8 + measure(content.number.unit.trim(), 30, 600) : 0);
    }
    if (numberWidth > 888) errors.push({ slotId: "numberMain", code: "TEXT_OVERFLOW", message: "数字过长，请缩短" });
    const tagWidth = tag2 ? Math.min(280, Math.ceil(measure(secondary, tag2.size, 700) + 48)) : 0;
    const stacked = Boolean(value && tag2 && numberWidth + 48 + 3 + 40 + tagWidth > 888);
    if (value) {
      const valueWidth = measure(value, numberSize, 900);
      const numberChildren: Node[] = [textNode("numberValue", "number", "number.value", [value], 0, 0, valueWidth, 112, numberSize, 900, colors.number, 112)];
      if (content.number.unit.trim()) numberChildren.push(textNode("numberUnit", "number", "number.unit", [content.number.unit.trim()], valueWidth + 8, 0, numberWidth - valueWidth - 8, 112, 30, 600, colors.number, 112));
      nodes.push(createNode("group", { name: "数字与单位", size: { width: numberWidth, height: 112 }, transform: { x: 96, y: nextY, scaleX: 1, scaleY: 1, rotation: 0 }, children: numberChildren,
        data: { layoutInstanceId: XHS_EDITORIAL_ID, layoutTemplateId: XHS_EDITORIAL_ID, slotId: "numberMain", elementType: "number", binding: "number.value / number.unit", layoutMode: "auto" } }));
    }
    if (tag2) {
      const tagX = value && !stacked ? 96 + numberWidth + 48 + 3 + 40 : 96;
      const tagY = stacked ? nextY + 112 + 24 : nextY + 28;
      nodes.push(tagNode("tagSecondary", "tags.secondary", secondary, tagX, tagY, tagWidth, 56, tag2.size, colors.blue, colors.blueLight));
      if (value && !stacked) {
        const line = createNode("shape", { name: "数字与标签分隔线", shape: "rect", size: { width: 3, height: 80 }, transform: { x: 96 + numberWidth + 48, y: nextY + 16, scaleX: 1, scaleY: 1, rotation: 0 }, fills: [{ type: "solid", color: fromHex(colors.line)! }], data: { layoutInstanceId: XHS_EDITORIAL_ID, layoutTemplateId: XHS_EDITORIAL_ID, slotId: "separator", elementType: "decoration", binding: "" } });
        nodes.push(line);
      }
    }
    nextY += stacked ? 192 : 112;
  }
  if (nextY > 1184) errors.push({ slotId: "numberMain", code: "FLOW_OVERFLOW", message: "正文超过底部安全范围，请缩短标题或说明" });
  if (foot) nodes.push(textNode("footnote", "subtitle", "footnote", foot.lines, 96, 1344 - foot.lines.length * foot.size * (40 / 28), 888, foot.lines.length * foot.size * (40 / 28), foot.size, 400, colors.footnote, foot.size * (40 / 28)));
  if (errors.length) return { success: false, errors };
  page.children = nodes;
  return { success: true, file };
}

export function readXhsEditorialContent(nodes: Node[]): XhsEditorialContent | null {
  if (!nodes.some((node) => node.data?.layoutTemplateId === XHS_EDITORIAL_ID)) return null;
  const content: XhsEditorialContent = { title: "", subtitle: "", tags: { primary: "", secondary: "" }, number: { value: "", unit: "" }, footnote: "" };
  const visit = (node: Node): void => {
    if (node.type === "text") {
      const value = (node as TextNode).content.map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n");
      switch (node.data?.slotId) {
        case "title": content.title = value; break;
        case "subtitle": content.subtitle = value; break;
        case "tagPrimaryText": content.tags.primary = value; break;
        case "tagSecondaryText": content.tags.secondary = value; break;
        case "numberValue": content.number.value = value; break;
        case "numberUnit": content.number.unit = value; break;
        case "footnote": content.footnote = value; break;
      }
    }
    if (node.type === "group") (node as Extract<Node, { type: "group" }>).children.forEach(visit);
  };
  nodes.forEach(visit);
  return content;
}

export function reflowXhsEditorialNodes(nodes: Node[], measure: Measure): { success: true; nodes: Node[] } | { success: false; errors: XhsLayoutError[] } {
  const content = readXhsEditorialContent(nodes);
  if (!content) return { success: false, errors: [{ slotId: "title", code: "REQUIRED", message: "当前页面没有自动排版实例" }] };
  const result = buildXhsEditorialCover(content, measure);
  if (!result.success) return result;
  const oldBySlot = new Map<string, Node>();
  const collect = (node: Node): void => {
    if (node.data?.layoutTemplateId === XHS_EDITORIAL_ID && typeof node.data.slotId === "string") oldBySlot.set(node.data.slotId, node);
    if (node.type === "group") (node as Extract<Node, { type: "group" }>).children.forEach(collect);
  };
  nodes.forEach(collect);
  const preserve = (node: Node): Node => {
    const old = oldBySlot.get(String(node.data?.slotId));
    if (old) {
      node.id = old.id;
      node.data = { ...node.data, layoutInstanceId: old.data?.layoutInstanceId };
      if (old.type === "text" && node.type === "text") {
        const oldText = old as TextNode;
        const newText = node as TextNode;
        const fill = oldText.content[0]?.runs[0]?.style.fill;
        if (fill) newText.content.forEach((paragraph) => paragraph.runs.forEach((run) => { run.style.fill = structuredClone(fill); }));
        if (oldText.textEffects?.length) newText.textEffects = structuredClone(oldText.textEffects);
      }
      if (old.type === "shape" && node.type === "shape") (node as Extract<Node, { type: "shape" }>).fills = structuredClone((old as Extract<Node, { type: "shape" }>).fills);
    }
    if (node.type === "group") (node as Extract<Node, { type: "group" }>).children.forEach(preserve);
    return node;
  };
  return { success: true, nodes: [...nodes.filter((node) => node.data?.layoutTemplateId !== XHS_EDITORIAL_ID), ...result.file.pages[0].children.map(preserve)] };
}
