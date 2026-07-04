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

function parseIngredientLine(value) {
  const original = textFrom(value).replace(/^[\s・*●○-]+/, "").trim();
  if (!original) return null;
  const text = original.replace(/\s+/g, " ");
  const number = "[0-9０-９]+(?:[./／][0-9０-９]+)?(?:\\s*[〜~\\-]\\s*[0-9０-９]+(?:[./／][0-9０-９]+)?)?";
  const countUnits = "g|kg|グラム|ml|mL|cc|L|個|本|枚|袋|束|玉|丁|株|切れ|尾|杯|缶|パック|かけ|片|膳|合";
  const spoonUnits = "大さじ|小さじ|カップ";
  const vagueUnits = "適量|少々|ひとつまみ|お好み";

  const spoon = text.match(new RegExp(`^(.+?)\\s*(${spoonUnits})\\s*(${number})(.*)$`));
  if (spoon) return { name: spoon[1].trim(), quantity: spoon[3].trim(), unit: spoon[2].trim(), note: spoon[4].trim() };

  const trailing = text.match(new RegExp(`^(.+?)\\s*(${number})\\s*(${countUnits})(.*)$`));
  if (trailing) return { name: trailing[1].trim(), quantity: trailing[2].trim(), unit: trailing[3].trim(), note: trailing[4].trim() };

  const vague = text.match(new RegExp(`^(.+?)\\s*(${vagueUnits})(.*)$`));
  if (vague) return { name: vague[1].trim(), quantity: "", unit: vague[2].trim(), note: vague[3].trim() };

  const parenthetical = text.match(/^(.+?)\s*[（(]([^）)]+)[）)]$/);
  if (parenthetical) return { name: parenthetical[1].trim(), quantity: "", unit: "", note: parenthetical[2].trim() };

  return { name: text, quantity: "", unit: "", note: "" };
}

function ingredientsFrom(value) {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  return items.map(parseIngredientLine).filter(i => i?.name);
}

function collectImageUrls(value, urls = []) {
  if (!value) return urls;
  if (typeof value === "string") {
    urls.push(value);
    return urls;
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectImageUrls(item, urls));
    return urls;
  }
  if (typeof value === "object") {
    if (value.url) urls.push(value.url);
    if (value.contentUrl) urls.push(value.contentUrl);
    if (value.thumbnailUrl) collectImageUrls(value.thumbnailUrl, urls);
  }
  return urls;
}

function absoluteUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return "";
  }
}

function imageUrlsFrom(value, baseUrl) {
  return [...new Set(
    collectImageUrls(value)
      .map(url => absoluteUrl(String(url || "").trim(), baseUrl))
      .filter(Boolean)
  )].slice(0, 3);
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
    const titleImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i);
    const fallbackImages = titleImageMatch?.[1] ? [absoluteUrl(titleImageMatch[1], parsed.toString())].filter(Boolean) : [];
    if (!recipeNode) {
      res.json({
        partial: true,
        recipe: {
          title: titleFromHtml(html) || parsed.hostname,
          sourceUrl: parsed.toString(),
          sourceName: parsed.hostname,
          imageUrl: fallbackImages[0] || "",
          imageUrls: fallbackImages,
          ingredients: [],
          steps: [],
          notes: "",
        },
      });
      return;
    }

    const imageUrls = imageUrlsFrom(recipeNode.image, parsed.toString());
    const mergedImageUrls = [...new Set([...imageUrls, ...fallbackImages])].slice(0, 3);
    res.json({
      partial: false,
      recipe: {
        title: textFrom(recipeNode.name) || titleFromHtml(html) || parsed.hostname,
        sourceUrl: parsed.toString(),
        sourceName: parsed.hostname,
        imageUrl: mergedImageUrls[0] || "",
        imageUrls: mergedImageUrls,
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
