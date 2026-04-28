import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

const LOCATIONS = {
  fridge:  { label: "冷蔵庫", icon: "🧊", color: "#4A90D9", bg: "#EBF8FF" },
  freezer: { label: "冷凍庫", icon: "❄️", color: "#7B68EE", bg: "#EDE9FE" },
};
const KINDS = {
  ingredient: { label: "食材",     icon: "🥩", color: "#2F855A", bg: "#F0FFF4", border: "#9AE6B4", desc: "下処理・調理が必要" },
  retort:     { label: "レトルト", icon: "📦", color: "#C05621", bg: "#FFFAF0", border: "#FBD38D", desc: "焼くだけ・温めるだけ" },
};
const DEFAULT_PRESETS = {
  fridge:  {
    ingredient: ["鶏モモ肉","豚バラ肉","牛こま肉","卵","豆腐","キャベツ","玉ねぎ","にんじん","もやし","ほうれん草","牛乳","納豆"],
    retort:     ["焼くだけ魚（塩サバ）","漬け魚（西京漬け）","味付け豚バラ","ミートボール缶","レトルトカレー","鍋つゆパック"],
  },
  freezer: {
    ingredient: ["冷凍えび","冷凍ほうれん草","冷凍コーン","鮭の切り身","牛こま切れ","豚バラ薄切り","冷凍うどん"],
    retort:     ["焼くだけ餃子","温めるだけ肉団子","冷凍唐揚げ","冷凍シュウマイ","冷凍春巻き","冷凍ピラフ","冷凍チャーハン"],
  },
};
const DEFAULT_SETTINGS = {
  familySize:      2,
  mealComposition: "full",
  cookingTime:     0,
  fontSize:        "sm",
};
const FONT_SCALE   = { sm:1, md:1.15, lg:1.3 };
const AMOUNT_OPTIONS = ["少量","半分","たっぷり"];
const FISH_KEYWORDS   = ["魚","サバ","鮭","サーモン","鯖","アジ","ブリ","タラ","ヒラメ","マグロ","ツナ","イワシ","サンマ","ししゃも","焼き魚","刺身","煮魚","塩サバ","西京","魚介"];
const RETORT_KEYWORDS = ["焼くだけ","温めるだけ","レトルト","缶詰","パウチ","インスタント","冷凍食品"];
const FROZEN_KEYWORDS = ["冷凍","アイス"];
const CATEGORY_MAP = [
  { icon:"🥩", color:"#FC8181", bg:"#FFF5F5", keys:["鶏","豚","牛","ひき肉","ベーコン","ソーセージ","ハム","ラム","合い挽き","唐揚げ","焼き鳥","肉団子","ミートボール","餃子","シュウマイ","春巻き"] },
  { icon:"🐟", color:"#4299E1", bg:"#EBF8FF", keys:["魚","サバ","鮭","サーモン","えび","エビ","タコ","イカ","アサリ","ツナ","マグロ","アジ","ブリ","タラ","イワシ","サンマ","ししゃも","魚介","シーフード","西京","塩サバ"] },
  { icon:"🧅", color:"#48BB78", bg:"#F0FFF4", keys:["キャベツ","玉ねぎ","にんじん","もやし","ほうれん草","トマト","じゃがいも","大根","ブロッコリー","なす","ピーマン","きゅうり","レタス","白菜","ごぼう","れんこん","さつまいも","かぼちゃ","アスパラ","ねぎ","しょうが","にんにく","セロリ","水菜","小松菜","春菊","チンゲン菜","コーン"] },
  { icon:"🥚", color:"#ECC94B", bg:"#FFFFF0", keys:["卵","牛乳","チーズ","ヨーグルト","バター","クリーム"] },
  { icon:"🫘", color:"#68D391", bg:"#F0FFF4", keys:["豆腐","納豆","豆","油揚げ","厚揚げ","大豆","おから"] },
  { icon:"🍄", color:"#A0AEC0", bg:"#F7FAFC", keys:["しいたけ","えのき","まいたけ","なめこ","きのこ","エリンギ","しめじ"] },
  { icon:"🍚", color:"#F6AD55", bg:"#FFFAF0", keys:["米","うどん","そば","パスタ","麺","パン","餅","ごはん","チャーハン","ピラフ"] },
];
function getCategoryIcon(name) {
  for (const cat of CATEGORY_MAP) if (cat.keys.some(k => name.includes(k))) return cat;
  return { icon:"🫙", color:"#A0AEC0", bg:"#F7FAFC" };
}

function parseComponents(recipe) {
  const main = recipe.content.match(/🍖[^:：\n]*[:：]\s*([^／/\n]+)/)?.[1]?.trim() || null;
  const side = recipe.content.match(/🥗[^:：\n]*[:：]\s*([^／/\n]+)/)?.[1]?.trim() || null;
  const soup = recipe.content.match(/🍜[^:：\n]*[:：]\s*([^／/\n]+)/)?.[1]?.trim() || null;
  return { main, side, soup };
}

function parseRecipes(text) {
  const blocks = text.split(/(?=\d+[.．]\s*【)/m)
    .filter(b => b.trim() && /【.+?】/.test(b));
  if (blocks.length < 1) return [{ title:"今日の献立提案", content:text }];
  return blocks.map(block => {
    const m = block.match(/【(.+?)】/);
    return { title: m ? m[1] : block.split("\n")[0].replace(/^\d+[.．]\s*/,"").trim(), content:block };
  });
}

function Stars({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display:"flex", gap:2 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n}
          style={{ fontSize:22, cursor:onChange?"pointer":"default", color:n<=(hover||value)?"#F6AD55":"#E2E8F0", transition:"color .1s" }}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(0)}
          onClick={() => onChange && onChange(n)}>★</span>
      ))}
    </div>
  );
}

// view: "pantry" | "results" | "madeRecipes" | "history"
export default function KitchenManager({ user }) {
  const [ingredients, setIngredients] = useState({ fridge:[], freezer:[] });
  const [presets,     setPresets]     = useState(DEFAULT_PRESETS);
  const [history,     setHistory]     = useState([]);
  const [settings,    setSettings]    = useState(DEFAULT_SETTINGS);
  const [dataLoading, setDataLoading] = useState(true);

  const [activeLoc,   setActiveLoc]   = useState("fridge");
  const [activeKind,  setActiveKind]  = useState("ingredient");
  const [inputName,   setInputName]   = useState("");
  const [inputAmount, setInputAmount] = useState("たっぷり");
  const [editingId,   setEditingId]   = useState(null);

  const [editPresets, setEditPresets] = useState(false);
  const [presetInput, setPresetInput] = useState("");
  const [showOptions, setShowOptions] = useState(false);

  // Notion連携
  const [notionLoading,  setNotionLoading]  = useState(false);
  const [notionMsg,      setNotionMsg]      = useState("");
  const [notionItems,    setNotionItems]    = useState([]);
  const [notionSelected, setNotionSelected] = useState(new Set());

  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState(null);
  const [error,   setError]   = useState("");
  const [view,    setView]    = useState("pantry");
  const [fallbackPrompt, setFallbackPrompt] = useState("");
  const [copied, setCopied] = useState(false);
  const [promptForCopy, setPromptForCopy] = useState("");
  const [showPromptPanel, setShowPromptPanel] = useState(false);
  const [selectedComponents, setSelectedComponents] = useState({ main:null, side:null, soup:null });

  const [showManual, setShowManual] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualContent, setManualContent] = useState("");
  const [manualDate, setManualDate] = useState(() => new Date().toLocaleDateString("sv-SE"));

  const [notionOverrides, setNotionOverrides] = useState({});

  const [histDetail, setHistDetail] = useState(null);

  // ── 初期データ読み込み ──────────────────────────────
  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setDataLoading(true);
    const [iRes, pRes, hRes, sRes] = await Promise.all([
      supabase.from("ingredients").select("*").order("created_at"),
      supabase.from("presets").select("*"),
      supabase.from("history").select("*").order("created_at", { ascending:false }).limit(30),
      supabase.from("settings").select("data").eq("user_id", user.id).single(),
    ]);
    if (iRes.data) {
      const ingr = { fridge:[], freezer:[] };
      iRes.data.forEach(r => ingr[r.location].push({ id:r.id, name:r.name, amount:r.amount, kind:r.kind, addedAt:r.added_at, priority:r.priority||false }));
      setIngredients(ingr);
    }
    if (pRes.data && pRes.data.length > 0) {
      const p = { fridge:{ ingredient:[], retort:[] }, freezer:{ ingredient:[], retort:[] } };
      pRes.data.forEach(r => p[r.location][r.kind].push(r.name));
      setPresets(p);
    } else {
      await initDefaultPresets();
    }
    if (hRes.data) {
      setHistory(hRes.data.map(r => ({
        id:r.id, date:r.date, recipes:r.recipes, ingredients:r.ingredients,
        ratings:r.ratings||{}, memo:r.memo||"", createdAt:r.created_at,
        madeIndices:r.made_indices||[], madeComponents:r.made_components||null,
      })));
    }
    if (sRes.data?.data) setSettings({ ...DEFAULT_SETTINGS, ...sRes.data.data });
    setDataLoading(false);
  };

  const initDefaultPresets = useCallback(async () => {
    const rows = [];
    for (const [loc, kinds] of Object.entries(DEFAULT_PRESETS))
      for (const [kind, names] of Object.entries(kinds))
        for (const name of names)
          rows.push({ user_id:user.id, location:loc, kind, name });
    await supabase.from("presets").insert(rows);
    setPresets(DEFAULT_PRESETS);
  }, [user.id]);

  // ── 設定 ────────────────────────────────────────────
  const saveSettings = async (next) => {
    setSettings(next);
    await supabase.from("settings").upsert({ user_id:user.id, data:next });
  };
  const updSetting = (key, val) => saveSettings({ ...settings, [key]:val });

  // ── 魚トラッキング ──────────────────────────────────
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const fishThisWeek = history.filter(h =>
    h.createdAt && new Date(h.createdAt) > oneWeekAgo &&
    h.recipes.some(r => FISH_KEYWORDS.some(k => r.title.includes(k)))
  ).length;

  // ── 食材操作 ────────────────────────────────────────
  const addIngredient = async () => {
    const name = inputName.trim(); if (!name) return;
    const id = crypto.randomUUID();
    const addedAt = new Date().toLocaleDateString("ja-JP");
    setIngredients(prev => ({ ...prev, [activeLoc]:[...prev[activeLoc], { id, name, amount:inputAmount, kind:activeKind, addedAt, priority:false }] }));
    setInputName("");
    await supabase.from("ingredients").insert({ id, user_id:user.id, name, amount:inputAmount, kind:activeKind, location:activeLoc, added_at:addedAt });
  };
  const addFromPreset = async (loc, kind, name) => {
    if (ingredients[loc].some(i => i.name === name)) return;
    const id = crypto.randomUUID();
    const addedAt = new Date().toLocaleDateString("ja-JP");
    setIngredients(prev => ({ ...prev, [loc]:[...prev[loc], { id, name, amount:"たっぷり", kind, addedAt, priority:false }] }));
    await supabase.from("ingredients").insert({ id, user_id:user.id, name, amount:"たっぷり", kind, location:loc, added_at:addedAt });
  };
  const removeIngredient = async (loc, id) => {
    setIngredients(prev => ({ ...prev, [loc]:prev[loc].filter(i => i.id !== id) }));
    await supabase.from("ingredients").delete().eq("id", id);
  };
  const updateAmount = async (loc, id, amount) => {
    setIngredients(prev => ({ ...prev, [loc]:prev[loc].map(i => i.id===id ? {...i,amount} : i) }));
    setEditingId(null);
    await supabase.from("ingredients").update({ amount }).eq("id", id);
  };
  const togglePriority = async (loc, id) => {
    const item = ingredients[loc].find(i => i.id === id);
    const priority = !item.priority;
    setIngredients(prev => ({ ...prev, [loc]:prev[loc].map(i => i.id===id ? {...i,priority} : i) }));
    await supabase.from("ingredients").update({ priority }).eq("id", id);
  };

  // ── Notion連携 ──────────────────────────────────────
  const showNotionMsg = (msg) => { setNotionMsg(msg); setTimeout(()=>setNotionMsg(""), 3000); };

  const addToNotion = async (name) => {
    setNotionLoading(true);
    try {
      const res = await fetch("/api/notion?action=write", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      showNotionMsg(`🛒「${name}」を買い物リストに追加しました`);
    } catch { showNotionMsg("❌ Notion連携に失敗しました"); }
    setNotionLoading(false);
  };

  const fetchFromNotion = async () => {
    setNotionLoading(true);
    try {
      const res  = await fetch("/api/notion?action=read");
      const data = await res.json();
      const checked = (data.todos||[]).filter(t => !t.checked && t.text.trim());
      setNotionItems(checked);
      setNotionSelected(new Set(checked.map(t => t.id)));
      const ov = {};
      checked.forEach(t => { ov[t.id] = {
        location: FROZEN_KEYWORDS.some(k=>t.text.includes(k)) ? "freezer" : "fridge",
        kind:     RETORT_KEYWORDS.some(k=>t.text.includes(k)) ? "retort"  : "ingredient",
      }; });
      setNotionOverrides(ov);
      if (checked.length === 0) showNotionMsg("✅ 買う必要のある食材がありません");
    } catch { showNotionMsg("❌ Notionからの読み込みに失敗しました"); }
    setNotionLoading(false);
  };

  const closeNotionImport = () => {
    setNotionItems([]); setNotionSelected(new Set()); setNotionOverrides({});
  };

  const importFromNotion = async () => {
    const toImport = notionItems.filter(t => notionSelected.has(t.id));
    for (const item of toImport) {
      const name     = item.text.trim(); if (!name) continue;
      const ov       = notionOverrides[item.id] || {};
      const kind     = ov.kind     || (RETORT_KEYWORDS.some(k=>name.includes(k)) ? "retort" : "ingredient");
      const location = ov.location || (FROZEN_KEYWORDS.some(k=>name.includes(k)) ? "freezer" : "fridge");
      const id       = crypto.randomUUID();
      const addedAt  = new Date().toLocaleDateString("ja-JP");
      setIngredients(prev => ({ ...prev, [location]:[...prev[location],{id,name,amount:"たっぷり",kind,addedAt,priority:false}] }));
      await supabase.from("ingredients").insert({ id, user_id:user.id, name, amount:"たっぷり", kind, location, added_at:addedAt });
      // Notionをチェック済みに戻す（在庫あり）
      await fetch("/api/notion?action=check", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ blockId: item.id }),
      });
    }
    setNotionItems([]); setNotionSelected(new Set()); setNotionOverrides({});
    showNotionMsg(`📥 ${toImport.length}品をアプリに取り込みました`);
  };

  // ── プリセット操作 ──────────────────────────────────
  const addPreset = async () => {
    const name = presetInput.trim(); if (!name) return;
    if (presets[activeLoc][activeKind].includes(name)) { setPresetInput(""); return; }
    setPresets(prev => ({ ...prev, [activeLoc]:{ ...prev[activeLoc], [activeKind]:[...prev[activeLoc][activeKind], name] } }));
    setPresetInput("");
    await supabase.from("presets").insert({ user_id:user.id, location:activeLoc, kind:activeKind, name });
  };
  const removePreset = async (name) => {
    setPresets(prev => ({ ...prev, [activeLoc]:{ ...prev[activeLoc], [activeKind]:prev[activeLoc][activeKind].filter(p => p!==name) } }));
    await supabase.from("presets").delete().eq("user_id", user.id).eq("location", activeLoc).eq("kind", activeKind).eq("name", name);
  };

  // ── 献立提案（Gemini） ──────────────────────────────
  const getSuggestions = async () => {
    const rawItems = [
      ...ingredients.fridge.filter(i=>i.kind==="ingredient").map(i=>`${i.name}(${i.amount})`),
      ...ingredients.freezer.filter(i=>i.kind==="ingredient").map(i=>`${i.name}(${i.amount})`),
    ];
    const retortItems = [
      ...ingredients.fridge.filter(i=>i.kind==="retort").map(i=>`${i.name}(${i.amount})`),
      ...ingredients.freezer.filter(i=>i.kind==="retort").map(i=>`${i.name}(${i.amount})`),
    ];
    if (!rawItems.length && !retortItems.length) { setError("食材を登録してください！"); return; }
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setError("⚠️ Gemini APIキーが設定されていません。VercelのEnvironment Variablesに VITE_GEMINI_API_KEY を追加してRedeployしてください。");
      return;
    }
    setError(""); setFallbackPrompt(""); setLoading(true); setView("results"); setRecipes(null);
    setSelectedComponents({ main:null, side:null, soup:null });

    const priorityItems = [
      ...ingredients.fridge.filter(i=>i.priority).map(i=>i.name),
      ...ingredients.freezer.filter(i=>i.priority).map(i=>i.name),
    ];
    const mealDesc     = { main:"主菜1品のみ", main_side:"主菜1品と副菜1品", full:"主菜1品・副菜1〜2品・汁物1品のフルセット" }[settings.mealComposition];
    const priorityRule = priorityItems.length > 0 ? `・【必須】特に以下の食材を必ず使ってください：${priorityItems.join("、")}` : "";
    const timeRule     = settings.cookingTime > 0 ? `・調理時間は${settings.cookingTime}分以内で作れる献立にしてください。` : "";
    const fishRule     = fishThisWeek === 0 ? "・今週まだ魚料理を食べていないので、3案のうち少なくとも1案は魚料理を含めてください。"
                       : fishThisWeek < 2  ? "・今週の魚料理が少ないので、できれば1案は魚料理を含めてください。" : "";

    const mealFormat = settings.mealComposition === "full"
      ? `🍖 主菜: ○○ ／ 食材: ○○、○○ ／ 手順: ①②③
🥗 副菜: ○○ ／ 食材: ○○、○○ ／ 手順: ①②
🍜 汁物: ○○ ／ 食材: ○○、○○ ／ 手順: ①②`
      : settings.mealComposition === "main_side"
      ? `🍖 主菜: ○○ ／ 食材: ○○、○○ ／ 手順: ①②③
🥗 副菜: ○○ ／ 食材: ○○、○○ ／ 手順: ①②`
      : `🍖 主菜: ○○ ／ 食材: ○○、○○ ／ 手順: ①②③`;

    const systemPrompt = `家庭料理の献立プランナー。前置き・挨拶・余計な説明は一切不要。「1．【」から即座に開始。
条件：${settings.familySize}人分。${priorityRule}${timeRule}${fishRule}
夕食の献立を3案、以下の形式で出力：

1．【献立の総称】
${mealFormat}
調理時間: 約○分／難易度: ★〜★★★

2．【献立の総称】
（同形式）

3．【献立の総称】
（同形式）`;

    const userMsg = [
      rawItems.length    ? `【要調理の食材】: ${rawItems.join("、")}`   : "",
      retortItems.length ? `【レトルト品】: ${retortItems.join("、")}` : "",
    ].filter(Boolean).join("\n");

    const fullPrompt = `${systemPrompt}\n\n今日の食材：\n${userMsg}`;
    setPromptForCopy(fullPrompt);

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        { method:"POST", headers:{ "Content-Type":"application/json" },
          body: JSON.stringify({
            system_instruction:{ parts:[{ text:systemPrompt }] },
            contents:[{ role:"user", parts:[{ text:`今日の食材：\n${userMsg}` }] }],
            generationConfig:{ maxOutputTokens:4000, thinkingConfig:{ thinkingBudget:0 } },
          }),
        }
      );
      const data  = await res.json();
      if (!res.ok) {
        const msg = data.error?.message || `Gemini API error (${res.status})`;
        console.error("Gemini API error:", data);
        throw new Error(msg);
      }
      const text  = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (!text) {
        console.error("Gemini empty response:", data);
        throw new Error("empty response");
      }
      const parsed = parseRecipes(text);
      setRecipes(parsed);
      const entry = {
        id:crypto.randomUUID(),
        date: new Date().toLocaleString("ja-JP", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" }),
        recipes:parsed, ingredients:{ raw:rawItems, retort:retortItems },
        ratings:{}, memo:"", createdAt:new Date().toISOString(), madeIndices:[], madeComponents:null,
      };
      setHistory(prev => [entry, ...prev].slice(0, 30));
      const dbRes = await supabase.from("history").insert({ id:entry.id, user_id:user.id, date:entry.date, recipes:entry.recipes, ingredients:entry.ingredients, ratings:{}, memo:"", made_indices:[], made_components:null });
      if (dbRes.error) console.error("Supabase insert error:", dbRes.error);
    } catch(e) {
      console.error("getSuggestions failed:", e);
      setFallbackPrompt(fullPrompt);
      const msg = e.message || "";
      const isQuota    = msg.includes("exhausted") || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED");
      const isKeyError = msg.includes("API_KEY") || msg.includes("invalid") || msg.includes("403");
      const errText = isKeyError
        ? "⚠️ APIキーが無効です。Vercelの VITE_GEMINI_API_KEY を確認し、Redeployしてください。"
        : isQuota
        ? "⏳ AIの無料枠が上限に達しています。しばらく待つか、下のプロンプトをコピーしてClaude.ai/ChatGPTに貼り付けてください。"
        : `❌ 提案の取得に失敗しました（${msg}）。下のプロンプトをコピーしてClaude.ai/ChatGPTをお使いください。`;
      setError(errText);
      setView("pantry");
    }
    setLoading(false);
  };

  // ── 履歴操作 ────────────────────────────────────────
  const rateRecipe = async (histId, recipeIdx, stars) => {
    const entry = history.find(h => h.id === histId);
    const newRatings = { ...entry.ratings, [recipeIdx]:stars };
    const u = history.map(h => h.id!==histId ? h : { ...h, ratings:newRatings });
    setHistory(u);
    if (histDetail?.id === histId) setHistDetail(u.find(h => h.id===histId));
    await supabase.from("history").update({ ratings:newRatings }).eq("id", histId);
  };
  const updateMemo = async (histId, memo) => {
    const u = history.map(h => h.id!==histId ? h : { ...h, memo });
    setHistory(u);
    if (histDetail?.id === histId) setHistDetail(u.find(h => h.id===histId));
    await supabase.from("history").update({ memo }).eq("id", histId);
  };
  const deleteHistory = async (histId) => {
    setHistory(prev => prev.filter(h => h.id !== histId));
    if (histDetail?.id === histId) setHistDetail(null);
    await supabase.from("history").delete().eq("id", histId);
  };
  const toggleMade = async (histId, recipeIdx) => {
    const entry = history.find(h => h.id === histId);
    const current = entry.madeIndices || [];
    const madeIndices = current.includes(recipeIdx)
      ? current.filter(i => i !== recipeIdx)
      : [...current, recipeIdx];
    const u = history.map(h => h.id!==histId ? h : { ...h, madeIndices });
    setHistory(u);
    if (histDetail?.id === histId) setHistDetail(u.find(h => h.id===histId));
    await supabase.from("history").update({ made_indices:madeIndices }).eq("id", histId);
  };

  const saveMadeComponents = async (histId, components) => {
    const u = history.map(h => h.id!==histId ? h : { ...h, madeComponents:components });
    setHistory(u);
    if (histDetail?.id === histId) setHistDetail(u.find(h => h.id===histId));
    await supabase.from("history").update({ made_components:components }).eq("id", histId);
  };

  const saveManualRecipe = async () => {
    const title = manualTitle.trim(); if (!title) return;
    const d = new Date(manualDate);
    const dateLabel = `${d.getMonth()+1}/${d.getDate()}`;
    const entry = {
      id: crypto.randomUUID(),
      date: dateLabel,
      recipes: [{ title, content: manualContent.trim() }],
      ingredients: { raw:[], retort:[] },
      ratings: {}, memo: "", createdAt: new Date().toISOString(),
      madeIndices: [0],
    };
    setHistory(prev => [entry, ...prev].slice(0, 30));
    await supabase.from("history").insert({ id:entry.id, user_id:user.id, date:entry.date, recipes:entry.recipes, ingredients:entry.ingredients, ratings:{}, memo:"", made_indices:[0] });
    setManualTitle(""); setManualContent(""); setShowManual(false);
    setManualDate(new Date().toLocaleDateString("sv-SE"));
    setView("madeRecipes");
  };

  const handleLogout = () => supabase.auth.signOut();

  // ── 集計 ────────────────────────────────────────────
  const counts = {
    fridge:  { ingredient:ingredients.fridge.filter(i=>i.kind==="ingredient").length,  retort:ingredients.fridge.filter(i=>i.kind==="retort").length },
    freezer: { ingredient:ingredients.freezer.filter(i=>i.kind==="ingredient").length, retort:ingredients.freezer.filter(i=>i.kind==="retort").length },
  };
  const total       = ingredients.fridge.length + ingredients.freezer.length;
  const totalRaw    = counts.fridge.ingredient + counts.freezer.ingredient;
  const totalRetort = counts.fridge.retort     + counts.freezer.retort;

  // 作った献立（コンポーネント選択 or 旧インデックス方式）
  const madeRecipes = history.flatMap(h => {
    if (h.madeComponents && Object.keys(h.madeComponents).length > 0) {
      return [{ histId:h.id, date:h.date, madeComponents:h.madeComponents, memo:h.memo, type:"components" }];
    }
    return (h.madeIndices||[]).map(idx => ({
      histId:h.id, date:h.date, recipe:h.recipes[idx],
      rating:h.ratings[idx]||0, memo:h.memo, type:"recipe",
    }));
  });

  if (dataLoading) return (
    <div style={S.app}>
      <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
        <div style={S.spinner} className="spin"/>
        <div style={{ color:"#718096", fontSize:14, marginTop:12 }}>データを読み込み中…</div>
      </div>
    </div>
  );

  // ── 提案オプションUI ────────────────────────────────
  const OptionsPanel = () => (
    <div style={S.optCard}>
      <button style={S.optToggle} onClick={()=>setShowOptions(v=>!v)}>
        <span>⚙️ 提案オプション</span>
        <span style={{ fontSize:11, color:"#A0AEC0" }}>{showOptions?"▲ 閉じる":"▼ 開く"}</span>
      </button>
      {showOptions && (
        <div style={S.optBody}>
          <div style={S.optRow}>
            <span style={S.optLabel}>👨‍👩‍👦 家族の人数</span>
            <div style={S.optControls}>
              <button style={S.stepBtn} onClick={()=>updSetting("familySize", Math.max(1,settings.familySize-1))}>−</button>
              <span style={S.stepVal}>{settings.familySize}人</span>
              <button style={S.stepBtn} onClick={()=>updSetting("familySize", Math.min(8,settings.familySize+1))}>＋</button>
            </div>
          </div>
          <div style={S.optRow}>
            <span style={S.optLabel}>🍽️ 献立の構成</span>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
              {[["main","主菜のみ"],["main_side","主菜+副菜"],["full","フルセット"]].map(([v,label])=>(
                <button key={v} style={{...S.optChip,...(settings.mealComposition===v?S.optChipActive:{})}} onClick={()=>updSetting("mealComposition",v)}>{label}</button>
              ))}
            </div>
          </div>
          <div style={S.optRow}>
            <span style={S.optLabel}>⏱️ 調理時間</span>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
              {[[0,"制限なし"],[20,"20分"],[30,"30分"],[45,"45分"]].map(([v,label])=>(
                <button key={v} style={{...S.optChip,...(settings.cookingTime===v?S.optChipActive:{})}} onClick={()=>updSetting("cookingTime",v)}>{label}</button>
              ))}
            </div>
          </div>
          <div style={S.optRow}>
            <span style={S.optLabel}>🔤 文字サイズ</span>
            <div style={{ display:"flex", gap:5 }}>
              {[["sm","小"],["md","中"],["lg","大"]].map(([v,label])=>(
                <button key={v} style={{...S.optChip,...(settings.fontSize===v?S.optChipActive:{})}} onClick={()=>updSetting("fontSize",v)}>{label}</button>
              ))}
            </div>
          </div>
          <div style={{ ...S.optRow, borderBottom:"none", paddingBottom:0 }}>
            <span style={S.optLabel}>🐟 今週の魚メニュー</span>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontSize:18, fontWeight:800, color:fishThisWeek===0?"#E53E3E":fishThisWeek<2?"#D69E2E":"#2F855A" }}>{fishThisWeek}回</span>
              <span style={{ fontSize:11, color:"#A0AEC0" }}>{fishThisWeek===0?"→ 魚を優先提案します":fishThisWeek<2?"→ 魚を含めるよう提案":"→ 十分食べています"}</span>
            </div>
          </div>
        </div>
      )}
      {!showOptions && (
        <div style={S.optSummary}>
          <span>👨‍👩‍👦 {settings.familySize}人</span>
          <span>🍽️ {{ main:"主菜のみ", main_side:"主菜+副菜", full:"フルセット" }[settings.mealComposition]}</span>
          {settings.cookingTime > 0 && <span>⏱️ {settings.cookingTime}分以内</span>}
          <span style={{ color:fishThisWeek===0?"#E53E3E":fishThisWeek<2?"#D69E2E":"#2F855A" }}>🐟 今週{fishThisWeek}回</span>
        </div>
      )}
    </div>
  );

  // ── レンダー ─────────────────────────────────────────
  return (
    <div style={{...S.app, zoom:FONT_SCALE[settings.fontSize]}}>
      <style>{css}</style>

      {/* HEADER */}
      <header style={S.header}>
        <div style={S.hi}>
          <div style={S.logo}>
            <img src="/favicon.png" alt="" style={{ width:28, height:28, borderRadius:7 }}/>
            <div>
              <div style={S.logoTitle}>おうちキッチン</div>
              <div style={S.logoSub}>食材管理 &amp; 献立提案</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={S.navBtns}>
              {[["pantry","📦 食材"],["madeRecipes","🍽️ 献立"],["history","📋 履歴"]].map(([v,label])=>(
                <button key={v}
                  style={{...S.navBtn,...((view===v||(v==="pantry"&&view==="results"))?S.navActive:{})}}
                  onClick={()=>{ setView(v); setHistDetail(null); }}>
                  {label}
                </button>
              ))}
            </div>
            <button style={S.logoutBtn} onClick={handleLogout} title="ログアウト">⏻</button>
          </div>
        </div>
      </header>

      <main style={S.main}>

        {/* ═══ PANTRY ═══════════════════════════════════════ */}
        {view==="pantry" && (
          <div className="fade-in">
            <div style={S.statsBar}>
              {Object.entries(LOCATIONS).map(([loc,cat])=>(
                <div key={loc} style={S.statBlock}>
                  <div style={S.statLocLabel}>{cat.icon} {cat.label}</div>
                  <div style={S.statKindRow}>
                    <span style={{...S.skb,background:KINDS.ingredient.bg,color:KINDS.ingredient.color}}>{KINDS.ingredient.icon} {counts[loc].ingredient}</span>
                    <span style={{...S.skb,background:KINDS.retort.bg,color:KINDS.retort.color}}>{KINDS.retort.icon} {counts[loc].retort}</span>
                  </div>
                </div>
              ))}
              <div style={S.statTotalBlock}><div style={S.statTotalNum}>{total}</div><div style={S.statTotalLabel}>合計</div></div>
            </div>

            <div style={S.card}>
              <div style={S.cardTitle}>食材を追加</div>
              <div style={S.tabRow}>
                {Object.entries(LOCATIONS).map(([loc,cat])=>(
                  <button key={loc}
                    style={{...S.tab,...(activeLoc===loc?{borderColor:cat.color,color:cat.color,background:cat.bg,fontWeight:700}:{})}}
                    onClick={()=>setActiveLoc(loc)}>{cat.icon} {cat.label}</button>
                ))}
              </div>
              <div style={S.kindRow}>
                {Object.entries(KINDS).map(([k,kind])=>(
                  <button key={k}
                    style={{...S.kindBtn,...(activeKind===k?{background:kind.bg,borderColor:kind.border,color:kind.color,fontWeight:700}:{})}}
                    onClick={()=>setActiveKind(k)}>
                    <span style={{ fontSize:18 }}>{kind.icon}</span>
                    <span><span style={S.kindLabel}>{kind.label}</span><span style={S.kindDesc}>{kind.desc}</span></span>
                  </button>
                ))}
              </div>
              <div style={S.inputRow}>
                {inputName.trim() && (() => { const c = getCategoryIcon(inputName); return (
                  <span style={{ fontSize:18, width:32, height:32, borderRadius:7, background:c.bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }} title="自動判定アイコン">{c.icon}</span>
                ); })()}
                <input style={S.input} value={inputName}
                  onChange={e=>setInputName(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&addIngredient()}
                  placeholder={activeKind==="ingredient"?"例：鶏モモ肉、豚バラ…":"例：焼くだけ餃子、温めるだけ肉団子…"} />
                <select style={S.select} value={inputAmount} onChange={e=>setInputAmount(e.target.value)}>
                  {AMOUNT_OPTIONS.map(a=><option key={a}>{a}</option>)}
                </select>
                <button style={S.addBtn} onClick={addIngredient}>追加</button>
              </div>
              <div style={S.presetHeader}>
                <span style={S.presetLabel}>よく使う{KINDS[activeKind].label}</span>
                <button style={{...S.editToggleBtn,...(editPresets?S.editToggleBtnOn:{})}}
                  onClick={()=>{ setEditPresets(v=>!v); setPresetInput(""); }}>
                  {editPresets?"✅ 完了":"✏️ 編集"}
                </button>
              </div>
              {editPresets ? (
                <div style={S.presetEditBox}>
                  <div style={S.presetEditRow}>
                    <input style={S.presetEditInput} value={presetInput}
                      onChange={e=>setPresetInput(e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&addPreset()}
                      placeholder="新しい項目を入力…" />
                    <button style={S.presetAddBtn} onClick={addPreset}>+ 追加</button>
                  </div>
                  <div style={S.presets}>
                    {presets[activeLoc][activeKind].map(p=>(
                      <div key={p} style={{...S.presetChipEdit,borderColor:KINDS[activeKind].border,color:KINDS[activeKind].color}}>
                        <span>{p}</span>
                        <button style={S.presetDelBtn} onClick={()=>removePreset(p)}>✕</button>
                      </div>
                    ))}
                    {presets[activeLoc][activeKind].length===0 && <span style={S.presetEmpty}>項目がありません</span>}
                  </div>
                </div>
              ) : (
                <div style={S.presets}>
                  {presets[activeLoc][activeKind]
                    .filter(p=>!ingredients[activeLoc].some(i=>i.name===p))
                    .map(p=>(
                      <button key={p}
                        style={{...S.presetChip,borderColor:KINDS[activeKind].border,color:KINDS[activeKind].color}}
                        onClick={()=>addFromPreset(activeLoc,activeKind,p)}>+ {p}</button>
                    ))}
                  {presets[activeLoc][activeKind].filter(p=>!ingredients[activeLoc].some(i=>i.name===p)).length===0 &&
                    <span style={S.presetEmpty}>登録済みか、項目がありません</span>}
                </div>
              )}
            </div>

            {Object.entries(LOCATIONS).map(([loc,cat])=>(
              <div key={loc} style={S.card}>
                <div style={S.cardTitleRow}>
                  <span style={{...S.cardTitle,color:cat.color}}>{cat.icon} {cat.label}</span>
                  <span style={{...S.badge,background:cat.bg,color:cat.color}}>{ingredients[loc].length}品</span>
                </div>
                {ingredients[loc].length===0 ? <div style={S.empty}>食材が登録されていません</div> : (
                  Object.entries(KINDS).map(([k,kind])=>{
                    const items = ingredients[loc].filter(i=>i.kind===k);
                    if (!items.length) return null;
                    return (
                      <div key={k} style={{ marginBottom:10 }}>
                        <div style={{...S.kindSection,background:kind.bg,color:kind.color,borderColor:kind.border}}>
                          {kind.icon} {kind.label}<span style={{ fontWeight:400,fontSize:11 }}> — {kind.desc}</span>
                        </div>
                        <div style={S.itemList}>
                          {items.map(item=>(
                            <div key={item.id} style={{...S.item,...(item.priority?S.itemPriority:{})}} className="item-row">
                              {(() => { const cat = getCategoryIcon(item.name); return (
                                <span style={{ fontSize:15, width:24, height:24, borderRadius:6, background:cat.bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{cat.icon}</span>
                              ); })()}
                              <div style={S.itemName}>{item.name}</div>
                              {editingId===item.id ? (
                                <div style={S.amountEdit}>
                                  {AMOUNT_OPTIONS.map(a=>(
                                    <button key={a}
                                      style={{...S.amountChip,...(item.amount===a?S.amountChipActive:{})}}
                                      onClick={()=>updateAmount(loc,item.id,a)}>{a}</button>
                                  ))}
                                </div>
                              ) : (
                                <button style={{...S.amountTag,background:kind.bg,color:kind.color}}
                                  onClick={()=>setEditingId(item.id)}>{item.amount}</button>
                              )}
                              <div style={S.addedDate}>{item.addedAt}</div>
                              <button style={S.priorityBtn} onClick={()=>togglePriority(loc,item.id)}>
                                {item.priority?"⭐":"☆"}
                              </button>
                              <button style={{...S.notionBtn,...(notionLoading?{opacity:0.3,cursor:"not-allowed"}:{})}}
                                onClick={()=>!notionLoading&&addToNotion(item.name)} title={notionLoading?"追加中…":"買い物リストに追加"}>
                                {notionLoading?"⏳":"🛒"}
                              </button>
                              <button style={S.deleteBtn} onClick={()=>removeIngredient(loc,item.id)}>✕</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ))}

            {/* Notion連携パネル */}
            <div style={S.notionCard}>
              <div style={S.notionHeader}>
                <span style={S.notionTitle}>📋 Notion 買い物リスト</span>
                {notionItems.length === 0 ? (
                  <button style={{...S.optChip,...(notionLoading?{opacity:0.5}:{})}}
                    onClick={fetchFromNotion} disabled={notionLoading}>
                    {notionLoading?"読み込み中…":"📥 買ってきたものを取り込む"}
                  </button>
                ) : (
                  <button style={{...S.optChip, color:"#718096"}} onClick={closeNotionImport}>✕ 閉じる</button>
                )}
              </div>
              {notionMsg && <div style={S.notionMsg}>{notionMsg}</div>}
              {notionItems.length > 0 && (
                <div style={{ marginTop:10 }}>
                  <div style={{ fontSize:11, color:"#718096", marginBottom:8 }}>
                    買ってきた食材を選択・カテゴリを確認して取り込んでください（取り込むとNotionでも☒になります）
                  </div>
                  <div style={{ display:"flex", gap:6, marginBottom:8, flexWrap:"wrap" }}>
                    <button style={S.notionSelBtn} onClick={()=>setNotionSelected(new Set(notionItems.map(t=>t.id)))}>☑ 全選択</button>
                    <button style={S.notionSelBtn} onClick={()=>setNotionSelected(new Set())}>☐ 全解除</button>
                  </div>
                  {notionItems.map(item => {
                    const ov = notionOverrides[item.id] || {};
                    const setOv = (key, val) => setNotionOverrides(prev=>({...prev,[item.id]:{...prev[item.id],[key]:val}}));
                    return (
                      <div key={item.id} style={S.notionItemRow}>
                        <input type="checkbox"
                          checked={notionSelected.has(item.id)}
                          onChange={e => {
                            const s = new Set(notionSelected);
                            e.target.checked ? s.add(item.id) : s.delete(item.id);
                            setNotionSelected(s);
                          }}/>
                        <span style={{ fontSize:13, flex:1 }}>{item.text}</span>
                        <select style={S.notionSelBox} value={ov.location||"fridge"} onChange={e=>setOv("location",e.target.value)}>
                          <option value="fridge">🧊 冷蔵</option>
                          <option value="freezer">❄️ 冷凍</option>
                        </select>
                        <select style={S.notionSelBox} value={ov.kind||"ingredient"} onChange={e=>setOv("kind",e.target.value)}>
                          <option value="ingredient">🥩 食材</option>
                          <option value="retort">📦 レトルト</option>
                        </select>
                      </div>
                    );
                  })}
                  <button style={{...S.suggestBtn, marginTop:8, fontSize:13, padding:"10px"}}
                    onClick={importFromNotion} disabled={notionSelected.size===0}>
                    ✅ 選択した{notionSelected.size}品を取り込む
                  </button>
                </div>
              )}
            </div>

            <OptionsPanel />
            {error && <div style={S.errorMsg}>{error}</div>}
            {fallbackPrompt && (
              <div style={S.fallbackCard}>
                <div style={S.fallbackTitle}>📋 チャットAIへ貼り付け用プロンプト</div>
                <div style={S.fallbackLinks}>
                  <a href="https://claude.ai" target="_blank" rel="noreferrer" style={S.fallbackLink}>Claude.ai を開く →</a>
                  <a href="https://chatgpt.com" target="_blank" rel="noreferrer" style={S.fallbackLink}>ChatGPT を開く →</a>
                </div>
                <pre style={S.fallbackPre}>{fallbackPrompt}</pre>
                <button style={S.fallbackCopyBtn} onClick={()=>{
                  navigator.clipboard.writeText(fallbackPrompt);
                  setCopied(true); setTimeout(()=>setCopied(false), 2500);
                }}>
                  {copied ? "✅ コピーしました！" : "📋 プロンプトをコピー"}
                </button>
              </div>
            )}
            <button style={{...S.suggestBtn,...(loading?S.suggestBtnLoading:{})}}
              onClick={getSuggestions} disabled={loading} className="suggest-btn">
              {loading?"🔄 献立を考え中...":"🍽️ 今日の夕食を提案してもらう"}
            </button>

            <button style={S.manualToggleBtn} onClick={()=>{ setShowManual(v=>!v); setManualTitle(""); setManualContent(""); setManualDate(new Date().toLocaleDateString("sv-SE")); }}>
              {showManual ? "▲ 閉じる" : "📝 献立を手入力して記録する"}
            </button>
            {showManual && (
              <div style={S.manualCard}>
                <div style={S.manualTitle}>📝 献立を記録</div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                  <span style={{ fontSize:12, color:"#718096", flexShrink:0 }}>📅 日付</span>
                  <input type="date" style={{...S.input, flex:1}}
                    value={manualDate}
                    max={new Date().toLocaleDateString("sv-SE")}
                    onChange={e=>setManualDate(e.target.value)}/>
                </div>
                <input
                  style={{...S.input, width:"100%", boxSizing:"border-box", marginBottom:8}}
                  value={manualTitle}
                  onChange={e=>setManualTitle(e.target.value)}
                  placeholder="料理名（例：肉じゃが、鶏の照り焼き…）"
                  onKeyDown={e=>e.key==="Enter"&&manualContent===""&&saveManualRecipe()}
                />
                <textarea
                  style={{...S.memoInput, marginBottom:10}}
                  value={manualContent}
                  onChange={e=>setManualContent(e.target.value)}
                  placeholder="材料・作り方・メモなど（任意）"
                  rows={4}
                />
                <button
                  style={{...S.suggestBtn, background:"linear-gradient(135deg,#48BB78,#2F855A)", boxShadow:"0 4px 14px rgba(72,187,120,0.4)", opacity:manualTitle.trim()?1:0.5}}
                  onClick={saveManualRecipe}
                  disabled={!manualTitle.trim()}>
                  ✅ 作った献立として記録する
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══ RESULTS（一時的な提案結果画面） ════════════ */}
        {view==="results" && (
          <div className="fade-in">
            <button style={S.backBtn} onClick={()=>setView("pantry")}>← 食材管理に戻る</button>
            {loading ? (
              <div style={S.loadingBox}>
                <div style={S.spinner} className="spin"/>
                <div style={S.loadingText}>今日の食材から献立を考えています…</div>
                <div style={S.loadingSub}>🥩 食材 {totalRaw}品　📦 レトルト {totalRetort}品</div>
              </div>
            ) : recipes ? (
              <div>
                <div style={S.recipesHeader}>
                  <span style={S.recipesTitle}>🍽️ 今日の献立提案</span>
                  <button style={S.retryBtn} onClick={getSuggestions}>🔄 再提案</button>
                </div>
                <div style={S.ratingPrompt}>⭐ 気に入ったレシピに評価をつけましょう</div>
                {recipes.map((r,i)=>(
                  <div key={i} style={{...S.recipeCard,...((history[0]?.madeIndices||[]).includes(i)?S.recipeCardMade:{}),animationDelay:`${i*0.12}s`}} className="recipe-card">
                    <div style={S.recipeNum}>{(history[0]?.madeIndices||[]).includes(i)?"✅":i+1}</div>
                    <div style={S.recipeTitle}>{r.title}</div>
                    <div style={S.recipeContent}>{r.content.replace(/【.+?】/,"").replace(/^\d+[.．]\s*/,"").trim()}</div>
                    {history.length>0 && (
                      <div style={S.recipeFooter}>
                        <div style={S.recipeRatingRow}>
                          <span style={S.recipeRatingLabel}>評価：</span>
                          <Stars value={history[0].ratings[i]||0} onChange={s=>rateRecipe(history[0].id,i,s)}/>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {history.length>0 && (()=>{
                  const compData = recipes.map((r,idx)=>({ idx, ...parseComponents(r) }));
                  const hasComps = compData.some(c=>c.main && (c.side||c.soup));
                  const saved = history[0].madeComponents;
                  const TYPES = [
                    { key:"main", emoji:"🍖", label:"主菜", required:true  },
                    { key:"side", emoji:"🥗", label:"副菜", required:false },
                    { key:"soup", emoji:"🍜", label:"汁物", required:false },
                  ];
                  if (!hasComps) return (
                    <div style={S.madeSelectionCard}>
                      <div style={S.madeSelectionTitle}>🍳 今日はどれを作りましたか？</div>
                      <div style={S.madeSelectionSub}>実際に作ったレシピをタップして記録（複数選択可）</div>
                      {recipes.map((r,i)=>(
                        <button key={i} style={{...S.madeSelectBtn,...((history[0].madeIndices||[]).includes(i)?S.madeSelectBtnOn:{})}}
                          onClick={()=>toggleMade(history[0].id,i)}>
                          <span style={S.madeSelectCheck}>{(history[0].madeIndices||[]).includes(i)?"✅":"☐"}</span>
                          <span style={S.madeSelectName}>{r.title}</span>
                        </button>
                      ))}
                    </div>
                  );
                  return (
                    <div style={S.madeSelectionCard}>
                      <div style={S.madeSelectionTitle}>🍳 今日の組み合わせを選んでください</div>
                      <div style={S.madeSelectionSub}>提案①②③から主菜・副菜・汁物をそれぞれ選んで記録</div>
                      {saved && (
                        <div style={S.savedCompsRow}>
                          <span style={{ fontSize:11, color:"#2F855A", fontWeight:700 }}>✅ 記録済み：</span>
                          {saved.main && <span style={S.savedCompChip}>🍖 {saved.main.name}</span>}
                          {saved.side && <span style={S.savedCompChip}>🥗 {saved.side.name}</span>}
                          {saved.soup && <span style={S.savedCompChip}>🍜 {saved.soup.name}</span>}
                        </div>
                      )}
                      {TYPES.map(({ key, emoji, label, required }) => {
                        const opts = compData.filter(c=>c[key]);
                        if (!opts.length) return null;
                        return (
                          <div key={key} style={{ marginBottom:10 }}>
                            <div style={S.compTypeLabel}>{emoji} {label}</div>
                            {opts.map(c=>{
                              const isSel = selectedComponents[key]?.recipeIdx===c.idx;
                              return (
                                <button key={c.idx}
                                  style={{...S.madeSelectBtn,...(isSel?S.madeSelectBtnOn:{})}}
                                  onClick={()=>setSelectedComponents(prev=>({...prev,[key]:isSel?null:{recipeIdx:c.idx,name:c[key]}}))} >
                                  <span style={S.madeSelectCheck}>{isSel?"✅":"☐"}</span>
                                  <span style={{fontSize:11,color:"#A0AEC0",marginRight:4,flexShrink:0}}>提案{c.idx+1}</span>
                                  <span style={S.madeSelectName}>{c[key]}</span>
                                </button>
                              );
                            })}
                            {!required && (
                              <button style={{...S.madeSelectBtn,...(selectedComponents[key]==="none"?S.madeSelectBtnOn:{})}}
                                onClick={()=>setSelectedComponents(prev=>({...prev,[key]:prev[key]==="none"?null:"none"}))}>
                                <span style={S.madeSelectCheck}>{selectedComponents[key]==="none"?"✅":"☐"}</span>
                                <span style={{...S.madeSelectName,color:"#A0AEC0"}}>なし</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                      {selectedComponents.main && (
                        <button style={{...S.suggestBtn,marginTop:8,fontSize:13,padding:"11px",background:"linear-gradient(135deg,#48BB78,#2F855A)",boxShadow:"0 4px 14px rgba(72,187,120,0.4)"}}
                          onClick={()=>{
                            const comps = {};
                            if (selectedComponents.main) comps.main = selectedComponents.main;
                            if (selectedComponents.side && selectedComponents.side!=="none") comps.side = selectedComponents.side;
                            if (selectedComponents.soup && selectedComponents.soup!=="none") comps.soup = selectedComponents.soup;
                            saveMadeComponents(history[0].id, comps);
                            setSelectedComponents({ main:null, side:null, soup:null });
                          }}>✅ この組み合わせで記録する</button>
                      )}
                    </div>
                  );
                })()}
                {promptForCopy && (
                  <div style={{ marginTop:8 }}>
                    <button style={S.manualToggleBtn} onClick={()=>setShowPromptPanel(v=>!v)}>
                      {showPromptPanel ? "▲ プロンプトを閉じる" : "📋 他のAIに投げるプロンプトを表示"}
                    </button>
                    {showPromptPanel && (
                      <div style={S.fallbackCard}>
                        <div style={S.fallbackLinks}>
                          <a href="https://claude.ai" target="_blank" rel="noreferrer" style={S.fallbackLink}>Claude.ai →</a>
                          <a href="https://chatgpt.com" target="_blank" rel="noreferrer" style={S.fallbackLink}>ChatGPT →</a>
                        </div>
                        <pre style={S.fallbackPre}>{promptForCopy}</pre>
                        <button style={S.fallbackCopyBtn} onClick={()=>{
                          navigator.clipboard.writeText(promptForCopy);
                          setCopied(true); setTimeout(()=>setCopied(false), 2500);
                        }}>
                          {copied ? "✅ コピーしました！" : "📋 プロンプトをコピー"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* ═══ MADE RECIPES（作った献立） ═══════════════════ */}
        {view==="madeRecipes" && (
          <div className="fade-in">
            <div style={S.recipesHeader}>
              <span style={S.recipesTitle}>🍽️ 作った献立</span>
              <span style={{ fontSize:12, color:"#A0AEC0" }}>{madeRecipes.length}品</span>
            </div>
            {madeRecipes.length===0 ? (
              <div style={S.histEmpty}>
                <div style={{ fontSize:40, marginBottom:12 }}>🍳</div>
                <div style={{ fontSize:14, color:"#A0AEC0" }}>まだ「作った！」した献立がありません</div>
                <div style={{ fontSize:12, color:"#CBD5E0", marginTop:4 }}>献立提案後、実際に作ったレシピに✅をつけるとここに蓄積されます</div>
              </div>
            ) : (
              madeRecipes.map((item, idx) => (
                <div key={idx} style={{...S.recipeCard, animationDelay:`${idx*0.08}s`}} className="recipe-card">
                  <div style={S.recipeNum}>✅</div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                    {item.type==="components"
                      ? <div style={S.recipeTitle}>{item.madeComponents.main?.name || "手作り献立"}</div>
                      : <div style={S.recipeTitle}>{item.recipe?.title}</div>
                    }
                    <div style={{ fontSize:11, color:"#A0AEC0", flexShrink:0, marginLeft:8 }}>📅 {item.date}</div>
                  </div>
                  {item.type==="components" ? (
                    <div style={{ fontSize:12, color:"#4A5568", lineHeight:2 }}>
                      {item.madeComponents.main && <div>🍖 <b>主菜</b>：{item.madeComponents.main.name}</div>}
                      {item.madeComponents.side && <div>🥗 <b>副菜</b>：{item.madeComponents.side.name}</div>}
                      {item.madeComponents.soup && <div>🍜 <b>汁物</b>：{item.madeComponents.soup.name}</div>}
                    </div>
                  ) : (
                    <div style={S.recipeContent}>{item.recipe?.content.replace(/【.+?】/,"").replace(/^\d+[.．]\s*/,"").trim()}</div>
                  )}
                  <div style={S.recipeFooter}>
                    {item.type==="recipe" && (
                      <div style={S.recipeRatingRow}>
                        <span style={S.recipeRatingLabel}>評価：</span>
                        <Stars value={item.rating} onChange={null}/>
                      </div>
                    )}
                    {item.memo && <div style={{ fontSize:11, color:"#718096", fontStyle:"italic" }}>📝 {item.memo}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ═══ HISTORY ══════════════════════════════════════ */}
        {view==="history" && (
          <div className="fade-in">
            {histDetail ? (
              <div>
                <button style={S.backBtn} onClick={()=>setHistDetail(null)}>← 履歴一覧に戻る</button>
                <div style={S.histDetailHeader}>
                  <div style={S.histDetailDate}>📅 {histDetail.date}</div>
                  <button style={S.histDeleteBtn} onClick={()=>deleteHistory(histDetail.id)}>🗑️ 削除</button>
                </div>
                <div style={{...S.card,marginBottom:12}}>
                  <div style={S.cardTitle}>使用した食材</div>
                  <div style={{ fontSize:12, color:"#4A5568", lineHeight:2 }}>
                    {histDetail.ingredients.raw.length>0    && <div>🥩 {histDetail.ingredients.raw.join("　")}</div>}
                    {histDetail.ingredients.retort.length>0 && <div>📦 {histDetail.ingredients.retort.join("　")}</div>}
                  </div>
                </div>
                {histDetail.recipes.map((r,i)=>(
                  <div key={i} style={{...S.recipeCard,...((histDetail.madeIndices||[]).includes(i)?S.recipeCardMade:{})}} className="recipe-card">
                    <div style={S.recipeNum}>{(histDetail.madeIndices||[]).includes(i)?"✅":i+1}</div>
                    <div style={S.recipeTitle}>{r.title}</div>
                    <div style={S.recipeContent}>{r.content.replace(/【.+?】/,"").replace(/^\d+[.．]\s*/,"").trim()}</div>
                    <div style={S.recipeFooter}>
                      <div style={S.recipeRatingRow}>
                        <span style={S.recipeRatingLabel}>評価：</span>
                        <Stars value={histDetail.ratings[i]||0} onChange={s=>rateRecipe(histDetail.id,i,s)}/>
                      </div>
                      <button
                        style={{...S.madeBtn,...((histDetail.madeIndices||[]).includes(i)?S.madeBtnOn:{})}}
                        onClick={()=>toggleMade(histDetail.id,i)}>
                        {(histDetail.madeIndices||[]).includes(i)?"✅ 作った！":"☐ 作った？"}
                      </button>
                    </div>
                  </div>
                ))}
                <div style={S.card}>
                  <div style={S.cardTitle}>メモ</div>
                  <textarea style={S.memoInput} value={histDetail.memo}
                    onChange={e=>updateMemo(histDetail.id,e.target.value)}
                    placeholder="感想や次回への改善点など…" rows={3}/>
                </div>
              </div>
            ) : (
              <div>
                <div style={S.recipesHeader}>
                  <span style={S.recipesTitle}>📋 献立履歴</span>
                  <span style={{ fontSize:12, color:"#A0AEC0" }}>{history.length}件</span>
                </div>
                {history.length===0 ? (
                  <div style={S.histEmpty}>
                    <div style={{ fontSize:40, marginBottom:12 }}>📭</div>
                    <div style={{ fontSize:14, color:"#A0AEC0" }}>まだ献立の履歴がありません</div>
                  </div>
                ) : history.map(h=>{
                  const avgRating = Object.values(h.ratings).length
                    ? (Object.values(h.ratings).reduce((a,b)=>a+b,0)/Object.values(h.ratings).length).toFixed(1) : null;
                  const hasFishRecipe = h.recipes.some(r=>FISH_KEYWORDS.some(k=>r.title.includes(k)));
                  const madeCount = (h.madeIndices||[]).length;
                  return (
                    <div key={h.id} style={S.histCard} className="hist-card" onClick={()=>setHistDetail(h)}>
                      <div style={S.histCardTop}>
                        <div style={S.histDate}>📅 {h.date}</div>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          {madeCount>0 && <span style={S.madeBadge}>✅ {madeCount}品作った</span>}
                          {hasFishRecipe && <span style={S.fishBadge}>🐟</span>}
                          {avgRating && <div style={S.histRatingSummary}><span style={{ color:"#F6AD55" }}>★</span> {avgRating}</div>}
                        </div>
                      </div>
                      <div style={S.histRecipeNames}>
                        {h.recipes.map((r,i)=>(
                          <span key={i} style={{...S.histRecipeName,...((h.madeIndices||[]).includes(i)?S.histRecipeNameMade:h.ratings[i]>=4?S.histRecipeNameTop:{})}}>
                            {(h.madeIndices||[]).includes(i)?"✅ ":h.ratings[i]>=4?"⭐ ":""}{r.title}
                          </span>
                        ))}
                      </div>
                      {h.memo && <div style={S.histMemoPreview}>📝 {h.memo}</div>}
                      <div style={S.histIngredientSummary}>
                        {h.ingredients.raw.slice(0,3).join("・")}{h.ingredients.raw.length>3?"…":""}
                        {h.ingredients.retort.length>0?` ＋ 📦 ${h.ingredients.retort.slice(0,2).join("・")}`:""}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

const S = {
  app:{minHeight:"100vh",background:"linear-gradient(135deg,#FFF9F0 0%,#FFF3E0 60%,#F3F8FF 100%)",fontFamily:"'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif"},
  header:{background:"rgba(255,255,255,0.88)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(0,0,0,0.07)",position:"sticky",top:0,zIndex:100},
  hi:{maxWidth:680,margin:"0 auto",padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8},
  logo:{display:"flex",alignItems:"center",gap:8},
  logoTitle:{fontSize:14,fontWeight:700,color:"#2D3748"},
  logoSub:{fontSize:10,color:"#718096"},
  navBtns:{display:"flex",gap:5},
  navBtn:{padding:"5px 12px",borderRadius:20,border:"1.5px solid #E2E8F0",background:"white",fontSize:12,cursor:"pointer",color:"#4A5568",transition:"all .2s",position:"relative"},
  navActive:{background:"#2D3748",color:"white",borderColor:"#2D3748"},
  logoutBtn:{padding:"5px 9px",borderRadius:20,border:"1.5px solid #E2E8F0",background:"white",fontSize:14,cursor:"pointer",color:"#A0AEC0",lineHeight:1},
  main:{maxWidth:680,margin:"0 auto",padding:"14px 14px 48px"},

  statsBar:{display:"flex",background:"white",borderRadius:14,padding:"12px 14px",marginBottom:12,boxShadow:"0 2px 10px rgba(0,0,0,0.06)",alignItems:"center",gap:8},
  statBlock:{flex:1},
  statLocLabel:{fontSize:11,fontWeight:700,color:"#4A5568",marginBottom:4},
  statKindRow:{display:"flex",gap:4},
  skb:{borderRadius:8,padding:"2px 7px",fontSize:11,fontWeight:600},
  statTotalBlock:{display:"flex",flexDirection:"column",alignItems:"center",paddingLeft:10,borderLeft:"1px solid #E2E8F0"},
  statTotalNum:{fontSize:20,fontWeight:800,color:"#2D3748"},
  statTotalLabel:{fontSize:9,color:"#A0AEC0"},

  card:{background:"white",borderRadius:14,padding:16,marginBottom:12,boxShadow:"0 2px 10px rgba(0,0,0,0.06)"},
  cardTitle:{fontSize:14,fontWeight:700,color:"#2D3748",marginBottom:10},
  cardTitleRow:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10},
  badge:{borderRadius:8,padding:"2px 9px",fontSize:11,fontWeight:600},

  tabRow:{display:"flex",gap:7,marginBottom:9},
  tab:{flex:1,padding:"7px 0",borderRadius:9,border:"1.5px solid #E2E8F0",background:"white",fontSize:13,cursor:"pointer",color:"#718096",transition:"all .2s"},
  kindRow:{display:"flex",gap:7,marginBottom:10},
  kindBtn:{flex:1,padding:"9px 10px",borderRadius:10,border:"1.5px solid #E2E8F0",background:"white",cursor:"pointer",color:"#718096",transition:"all .2s",display:"flex",alignItems:"center",gap:7},
  kindLabel:{display:"block",fontSize:13,fontWeight:600},
  kindDesc:{display:"block",fontSize:10,marginTop:1,opacity:0.7},

  inputRow:{display:"flex",gap:7},
  input:{flex:1,padding:"9px 12px",borderRadius:9,border:"1.5px solid #E2E8F0",fontSize:14,outline:"none"},
  select:{padding:"9px 5px",borderRadius:9,border:"1.5px solid #E2E8F0",fontSize:13,background:"white",cursor:"pointer"},
  addBtn:{padding:"9px 14px",borderRadius:9,background:"#2D3748",color:"white",border:"none",fontSize:13,fontWeight:600,cursor:"pointer"},

  presetHeader:{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:12,marginBottom:6},
  presetLabel:{fontSize:12,color:"#718096"},
  editToggleBtn:{padding:"4px 10px",borderRadius:8,border:"1.5px solid #E2E8F0",background:"white",fontSize:12,cursor:"pointer",color:"#718096"},
  editToggleBtnOn:{background:"#F0FFF4",borderColor:"#9AE6B4",color:"#2F855A",fontWeight:700},

  presets:{display:"flex",flexWrap:"wrap",gap:6},
  presetChip:{padding:"4px 11px",borderRadius:20,border:"1px dashed",background:"transparent",fontSize:12,cursor:"pointer"},
  presetEmpty:{fontSize:12,color:"#CBD5E0",padding:"4px 0"},
  presetEditBox:{background:"#F7FAFC",borderRadius:10,padding:10,border:"1px solid #E2E8F0"},
  presetEditRow:{display:"flex",gap:7,marginBottom:8},
  presetEditInput:{flex:1,padding:"7px 10px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:13,outline:"none",background:"white"},
  presetAddBtn:{padding:"7px 12px",borderRadius:8,background:"#2F855A",color:"white",border:"none",fontSize:12,fontWeight:600,cursor:"pointer"},
  presetChipEdit:{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:20,border:"1px solid",fontSize:12},
  presetDelBtn:{background:"none",border:"none",color:"#FC8181",cursor:"pointer",fontSize:11,padding:"0 0 0 2px",lineHeight:1},

  kindSection:{fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:7,border:"1px solid",display:"inline-block",marginBottom:5},
  itemList:{display:"flex",flexDirection:"column",gap:5},
  item:{display:"flex",alignItems:"center",gap:7,padding:"7px 10px",borderRadius:9,background:"#F7FAFC",border:"1px solid #EDF2F7"},
  itemPriority:{background:"#FFFFF0",border:"1px solid #F6E05E"},
  itemName:{flex:1,fontSize:13,fontWeight:500,color:"#2D3748"},
  amountTag:{padding:"3px 9px",borderRadius:10,fontSize:11,border:"none",cursor:"pointer",fontWeight:600},
  amountEdit:{display:"flex",gap:4},
  amountChip:{padding:"3px 7px",borderRadius:7,border:"1px solid #E2E8F0",background:"white",fontSize:11,cursor:"pointer",color:"#4A5568"},
  amountChipActive:{background:"#2D3748",color:"white",borderColor:"#2D3748"},
  addedDate:{fontSize:10,color:"#A0AEC0"},
  priorityBtn:{padding:"2px 4px",border:"none",background:"transparent",cursor:"pointer",fontSize:15,lineHeight:1},
  notionBtn:{padding:"2px 4px",border:"none",background:"transparent",cursor:"pointer",fontSize:13,lineHeight:1},
  deleteBtn:{padding:"2px 5px",border:"none",background:"transparent",color:"#CBD5E0",cursor:"pointer",fontSize:11},
  notionCard:{background:"white",borderRadius:14,padding:14,marginBottom:12,boxShadow:"0 2px 10px rgba(0,0,0,0.06)"},
  notionHeader:{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8},
  notionTitle:{fontSize:13,fontWeight:700,color:"#2D3748"},
  notionMsg:{fontSize:12,color:"#2F855A",background:"#F0FFF4",border:"1px solid #9AE6B4",borderRadius:8,padding:"6px 10px",marginTop:8},
  notionItem:{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:9,background:"#F7FAFC",border:"1px solid #EDF2F7",marginBottom:5,cursor:"pointer"},
  empty:{textAlign:"center",color:"#A0AEC0",fontSize:13,padding:"12px 0"},

  optCard:{background:"white",borderRadius:14,padding:14,marginBottom:12,boxShadow:"0 2px 10px rgba(0,0,0,0.06)"},
  optToggle:{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"none",border:"none",cursor:"pointer",fontSize:13,fontWeight:700,color:"#2D3748",padding:0},
  optBody:{marginTop:12,display:"flex",flexDirection:"column",gap:12},
  optRow:{display:"flex",alignItems:"center",justifyContent:"space-between",paddingBottom:12,borderBottom:"1px solid #F7FAFC",flexWrap:"wrap",gap:8},
  optLabel:{fontSize:12,fontWeight:600,color:"#4A5568",minWidth:120},
  optControls:{display:"flex",alignItems:"center",gap:8},
  stepBtn:{width:28,height:28,borderRadius:8,border:"1.5px solid #E2E8F0",background:"white",fontSize:16,cursor:"pointer",color:"#4A5568",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1},
  stepVal:{fontSize:14,fontWeight:700,color:"#2D3748",minWidth:36,textAlign:"center"},
  optChip:{padding:"5px 11px",borderRadius:20,border:"1.5px solid #E2E8F0",background:"white",fontSize:11,cursor:"pointer",color:"#718096",transition:"all .15s"},
  optChipActive:{background:"#2D3748",color:"white",borderColor:"#2D3748",fontWeight:700},
  optSummary:{display:"flex",flexWrap:"wrap",gap:10,marginTop:10,paddingTop:10,borderTop:"1px solid #F7FAFC"},

  errorMsg:{color:"#E53E3E",fontSize:13,textAlign:"center",marginBottom:8},
  suggestBtn:{width:"100%",padding:"14px",borderRadius:14,background:"linear-gradient(135deg,#667eea 0%,#764ba2 100%)",color:"white",border:"none",fontSize:15,fontWeight:700,cursor:"pointer",marginTop:4,boxShadow:"0 4px 18px rgba(102,126,234,0.4)",letterSpacing:0.3},
  suggestBtnLoading:{opacity:0.7,cursor:"not-allowed"},

  backBtn:{background:"none",border:"none",color:"#667eea",fontSize:13,cursor:"pointer",padding:"0 0 12px",fontWeight:500},
  loadingBox:{textAlign:"center",padding:"52px 20px"},
  spinner:{width:44,height:44,border:"4px solid #E9D8FD",borderTopColor:"#667eea",borderRadius:"50%",margin:"0 auto 16px"},
  loadingText:{fontSize:15,fontWeight:600,color:"#2D3748",marginBottom:5},
  loadingSub:{fontSize:12,color:"#718096"},

  recipesHeader:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12},
  recipesTitle:{fontSize:17,fontWeight:800,color:"#2D3748"},
  retryBtn:{padding:"5px 12px",borderRadius:9,border:"1.5px solid #E2E8F0",background:"white",fontSize:12,cursor:"pointer",color:"#667eea"},
  ratingPrompt:{fontSize:12,color:"#B7791F",background:"#FFFFF0",border:"1px solid #FAF089",borderRadius:8,padding:"6px 12px",marginBottom:10,textAlign:"center"},

  recipeCard:{background:"white",borderRadius:14,padding:"16px 16px 12px 58px",marginBottom:10,boxShadow:"0 2px 10px rgba(0,0,0,0.06)",position:"relative"},
  recipeCardMade:{borderLeft:"3px solid #68D391",background:"#F0FFF4"},
  recipeNum:{position:"absolute",left:12,top:14,width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#667eea,#764ba2)",color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800},
  recipeTitle:{fontSize:15,fontWeight:700,color:"#2D3748",marginBottom:7},
  recipeContent:{fontSize:12,color:"#4A5568",lineHeight:1.85,whiteSpace:"pre-wrap",marginBottom:10},
  recipeFooter:{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:8,borderTop:"1px solid #EDF2F7",flexWrap:"wrap",gap:8},
  recipeRatingRow:{display:"flex",alignItems:"center",gap:6},
  recipeRatingLabel:{fontSize:11,color:"#A0AEC0"},
  madeBtn:{padding:"5px 12px",borderRadius:20,border:"1.5px solid #E2E8F0",background:"white",fontSize:12,cursor:"pointer",color:"#718096",fontWeight:600,transition:"all .15s"},
  madeBtnOn:{background:"#F0FFF4",borderColor:"#68D391",color:"#2F855A"},

  histEmpty:{textAlign:"center",padding:"60px 20px",background:"white",borderRadius:14,boxShadow:"0 2px 10px rgba(0,0,0,0.06)"},
  histCard:{background:"white",borderRadius:14,padding:14,marginBottom:10,boxShadow:"0 2px 10px rgba(0,0,0,0.06)",cursor:"pointer",border:"1.5px solid transparent",transition:"all .2s"},
  histCardTop:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:7},
  histDate:{fontSize:12,color:"#718096",fontWeight:600},
  histRatingSummary:{fontSize:13,fontWeight:700,color:"#2D3748"},
  madeBadge:{fontSize:11,background:"#F0FFF4",color:"#2F855A",border:"1px solid #9AE6B4",borderRadius:8,padding:"1px 7px",fontWeight:600},
  fishBadge:{fontSize:13,background:"#EBF8FF",borderRadius:8,padding:"1px 6px"},
  histRecipeNames:{display:"flex",flexWrap:"wrap",gap:5,marginBottom:6},
  histRecipeName:{fontSize:12,background:"#EDF2F7",color:"#4A5568",borderRadius:8,padding:"3px 8px"},
  histRecipeNameTop:{background:"#FFFFF0",color:"#B7791F",border:"1px solid #FAF089"},
  histRecipeNameMade:{background:"#F0FFF4",color:"#2F855A",border:"1px solid #9AE6B4"},
  histMemoPreview:{fontSize:11,color:"#718096",marginBottom:5,fontStyle:"italic"},
  histIngredientSummary:{fontSize:11,color:"#A0AEC0"},

  notionSelBtn:{padding:"4px 10px",borderRadius:8,border:"1.5px solid #E2E8F0",background:"white",fontSize:11,cursor:"pointer",color:"#4A5568"},
  notionItemRow:{display:"flex",alignItems:"center",gap:7,padding:"7px 8px",borderRadius:9,background:"#F7FAFC",border:"1px solid #EDF2F7",marginBottom:5},
  notionSelBox:{fontSize:11,padding:"3px 4px",borderRadius:6,border:"1px solid #E2E8F0",background:"white",cursor:"pointer",flexShrink:0},

  manualToggleBtn:{width:"100%",marginTop:10,padding:"11px",borderRadius:12,border:"1.5px dashed #CBD5E0",background:"white",fontSize:13,color:"#718096",cursor:"pointer",fontWeight:600},
  manualCard:{background:"white",borderRadius:14,padding:16,marginTop:8,boxShadow:"0 2px 10px rgba(0,0,0,0.06)",border:"1.5px solid #9AE6B4"},
  manualTitle:{fontSize:14,fontWeight:700,color:"#2F855A",marginBottom:12},

  fallbackCard:{background:"#FFFBEB",border:"1.5px solid #F6E05E",borderRadius:14,padding:14,marginBottom:12},
  fallbackTitle:{fontSize:13,fontWeight:700,color:"#B7791F",marginBottom:8},
  fallbackLinks:{display:"flex",gap:10,marginBottom:10,flexWrap:"wrap"},
  fallbackLink:{fontSize:12,color:"#667eea",fontWeight:600,textDecoration:"none"},
  fallbackPre:{fontSize:11,color:"#4A5568",background:"white",borderRadius:8,padding:10,overflowX:"auto",whiteSpace:"pre-wrap",wordBreak:"break-all",border:"1px solid #E2E8F0",maxHeight:160,overflowY:"auto",margin:"0 0 10px"},
  fallbackCopyBtn:{width:"100%",padding:"10px",borderRadius:9,background:"#2D3748",color:"white",border:"none",fontSize:13,fontWeight:600,cursor:"pointer"},

  madeSelectionCard:{background:"white",borderRadius:14,padding:16,marginTop:4,marginBottom:10,boxShadow:"0 2px 10px rgba(0,0,0,0.06)",border:"2px solid #9AE6B4"},
  madeSelectionTitle:{fontSize:15,fontWeight:800,color:"#2F855A",marginBottom:4},
  madeSelectionSub:{fontSize:11,color:"#718096",marginBottom:12},
  madeSelectBtn:{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderRadius:10,border:"1.5px solid #E2E8F0",background:"#F7FAFC",cursor:"pointer",marginBottom:6,textAlign:"left",transition:"all .15s"},
  madeSelectBtnOn:{background:"#F0FFF4",borderColor:"#68D391"},
  madeSelectCheck:{fontSize:16,flexShrink:0,width:20},
  madeSelectName:{fontSize:13,fontWeight:600,color:"#2D3748"},
  compTypeLabel:{fontSize:12,fontWeight:700,color:"#4A5568",marginBottom:5,marginTop:2},
  savedCompsRow:{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12,padding:"8px 10px",background:"#F0FFF4",borderRadius:9,alignItems:"center"},
  savedCompChip:{fontSize:11,background:"#C6F6D5",color:"#276749",borderRadius:8,padding:"2px 8px",fontWeight:600},

  histDetailHeader:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12},
  histDetailDate:{fontSize:14,fontWeight:700,color:"#2D3748"},
  histDeleteBtn:{padding:"5px 10px",borderRadius:8,border:"1.5px solid #FED7D7",background:"#FFF5F5",color:"#E53E3E",fontSize:12,cursor:"pointer"},
  memoInput:{width:"100%",padding:"8px 10px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:13,outline:"none",resize:"vertical",fontFamily:"inherit",boxSizing:"border-box"},
};

const css = `
  .fade-in{animation:fadeIn .3s ease}
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  .spin{animation:spin 1s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .recipe-card{animation:slideUp .4s ease both}
  @keyframes slideUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  .suggest-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 22px rgba(102,126,234,.5)!important}
  .item-row:hover{background:#EDF2F7!important}
  .hist-card:hover{border-color:#C3DAFE!important;transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,0,0,0.1)!important}
`;
