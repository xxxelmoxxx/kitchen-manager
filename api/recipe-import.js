function extractJsonLd(html) {
  const blocks = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const text = match[1].trim();
    if (!text) continue;
    try {
      blocks.push(JSON.parse(text));
    } catch {
      // Some pages include invalid JSON-LD. Ignore and keep looking.
    }
  }
  return blocks;
}

function findRecipeNode(node) {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }
  const type = node["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.some(t => String(t).toLowerCase() === "recipe")) return node;
  if (node["@graph"]) return findRecipeNode(node["@graph"]);
  if (node.mainEntity) return findRecipeNode(node.mainEntity);
  return null;
}

function textFrom(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(textFrom).filter(Boolean).join("\n");
  if (typeof value === "object") {
    return value.text || value.name || "";
  }
  return String(value);
}

function stepsFrom(value) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : [value];
  return items.flatMap(item => {
    if (typeof item === "string") return [item.trim()];
    if (item.itemListElement) return stepsFrom(item.itemListElement);
    const text = textFrom(item);
    return text ? [text] : [];
  }).filter(Boolean);
}

function ingredientsFrom(value) {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  return items.map(item => ({ name: textFrom(item), quantity: "", unit: "", note: "" })).filter(i => i.name);
}

function imageFrom(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return imageFrom(value[0]);
  if (typeof value === "object") return value.url || value.contentUrl || "";
  return "";
}

function titleFromHtml(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/\s+/g, " ").trim() : "";
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { url } = req.body || {};
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "url is required" });
    return;
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    res.status(400).json({ error: "URLが正しくありません" });
    return;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    res.status(400).json({ error: "http/https のURLだけ対応しています" });
    return;
  }

  try {
    const response = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OuchiKitchenRecipeImporter/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) {
      res.status(502).json({ error: `ページ取得に失敗しました (${response.status})` });
      return;
    }
    const html = await response.text();
    const recipeNode = findRecipeNode(extractJsonLd(html));
    if (!recipeNode) {
      res.json({
        partial: true,
        recipe: {
          title: titleFromHtml(html) || parsed.hostname,
          sourceUrl: parsed.toString(),
          sourceName: parsed.hostname,
          ingredients: [],
          steps: [],
          notes: "",
        },
      });
      return;
    }

    res.json({
      partial: false,
      recipe: {
        title: textFrom(recipeNode.name) || titleFromHtml(html) || parsed.hostname,
        sourceUrl: parsed.toString(),
        sourceName: parsed.hostname,
        imageUrl: imageFrom(recipeNode.image),
        servings: Number.parseFloat(textFrom(recipeNode.recipeYield)) || 2,
        ingredients: ingredientsFrom(recipeNode.recipeIngredient),
        steps: stepsFrom(recipeNode.recipeInstructions),
        notes: textFrom(recipeNode.description),
        tags: [textFrom(recipeNode.recipeCategory), textFrom(recipeNode.recipeCuisine)].filter(Boolean),
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "レシピ取得に失敗しました" });
  }
}
