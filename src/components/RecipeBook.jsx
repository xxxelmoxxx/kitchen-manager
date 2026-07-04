import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase.js";

const GENRES = ["和食", "洋食", "中華", "韓国", "エスニック", "副菜", "汁物", "お弁当", "その他"];

const EMPTY_RECIPE = {
  title: "",
  genre: "その他",
  sourceType: "manual",
  sourceUrl: "",
  sourceName: "",
  imageUrl: "",
  servings: 2,
  ingredients: [{ name: "", quantity: "", unit: "", note: "" }],
  steps: [""],
  notes: "",
  cookMemo: "",
  tags: [],
  favorite: false,
  cookedCount: 0,
  lastCookedAt: null,
};

const RECOMMENDED_RECIPES = [
  {
    title: "豚バラと白菜の重ね蒸し",
    genre: "和食",
    sourceType: "recommendation",
    sourceName: "おうちキッチンおすすめ",
    servings: 2,
    ingredients: [
      { name: "白菜", quantity: "1/4", unit: "株", note: "" },
      { name: "豚バラ薄切り", quantity: "200", unit: "g", note: "" },
      { name: "ポン酢", quantity: "", unit: "適量", note: "" },
    ],
    steps: ["白菜と豚バラを交互に重ねる。", "フライパンに入れて弱めの中火で蒸す。", "火が通ったらポン酢で食べる。"],
    notes: "冷蔵庫の白菜と豚肉を消費しやすい定番。",
    tags: ["時短", "白菜", "豚肉"],
  },
  {
    title: "冷凍うどんの卵あんかけ",
    genre: "和食",
    sourceType: "recommendation",
    sourceName: "おうちキッチンおすすめ",
    servings: 1,
    ingredients: [
      { name: "冷凍うどん", quantity: "1", unit: "玉", note: "" },
      { name: "卵", quantity: "1", unit: "個", note: "" },
      { name: "めんつゆ", quantity: "2", unit: "大さじ", note: "濃縮タイプは調整" },
    ],
    steps: ["うどんを温める。", "鍋でつゆを作り、溶き卵を流す。", "水溶き片栗粉で軽くとろみをつける。"],
    notes: "体調が悪い日や昼食にも使いやすい。",
    tags: ["冷凍うどん", "卵", "昼食"],
  },
  {
    title: "鶏もも肉の照り焼き",
    genre: "和食",
    sourceType: "recommendation",
    sourceName: "おうちキッチンおすすめ",
    servings: 2,
    ingredients: [
      { name: "鶏もも肉", quantity: "1", unit: "枚", note: "" },
      { name: "しょうゆ", quantity: "2", unit: "大さじ", note: "" },
      { name: "みりん", quantity: "2", unit: "大さじ", note: "" },
      { name: "砂糖", quantity: "1", unit: "小さじ", note: "" },
    ],
    steps: ["鶏肉を皮目から焼く。", "余分な油をふき、調味料を入れて煮からめる。", "食べやすく切って盛る。"],
    notes: "お弁当にも夕食にも回しやすい。",
    tags: ["鶏肉", "定番", "お弁当"],
  },
];

function toCamel(row) {
  return {
    id: row.id,
    title: row.title || "",
    genre: row.genre || "その他",
    sourceType: row.source_type || "manual",
    sourceUrl: row.source_url || "",
    sourceName: row.source_name || "",
    imageUrl: row.image_url || "",
    servings: Number(row.servings || 2),
    ingredients: Array.isArray(row.ingredients) && row.ingredients.length ? row.ingredients : EMPTY_RECIPE.ingredients,
    steps: Array.isArray(row.steps) && row.steps.length ? row.steps : [""],
    notes: row.notes || "",
    cookMemo: row.cook_memo || "",
    tags: Array.isArray(row.tags) ? row.tags : [],
    favorite: Boolean(row.favorite),
    cookedCount: row.cooked_count || 0,
    lastCookedAt: row.last_cooked_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(recipe, userId) {
  return {
    id: recipe.id,
    user_id: userId,
    title: recipe.title.trim(),
    genre: recipe.genre || "その他",
    source_type: recipe.sourceType || "manual",
    source_url: recipe.sourceUrl || "",
    source_name: recipe.sourceName || "",
    image_url: recipe.imageUrl || "",
    servings: Number(recipe.servings || 2),
    ingredients: recipe.ingredients.filter(i => i.name.trim()),
    steps: recipe.steps.map(s => s.trim()).filter(Boolean),
    notes: recipe.notes || "",
    cook_memo: recipe.cookMemo || "",
    tags: recipe.tags.filter(Boolean),
    favorite: Boolean(recipe.favorite),
    cooked_count: recipe.cookedCount || 0,
    last_cooked_at: recipe.lastCookedAt || null,
    updated_at: new Date().toISOString(),
  };
}

function parseTags(text) {
  return text.split(",").map(t => t.trim()).filter(Boolean);
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

function scaleQuantity(quantity, baseServings, targetServings) {
  const raw = String(quantity || "").trim();
  if (!raw) return "";
  const num = Number(raw);
  if (!Number.isFinite(num)) return raw;
  const scaled = num * (Number(targetServings || baseServings) / Number(baseServings || 1));
  return Number.isInteger(scaled) ? String(scaled) : String(Math.round(scaled * 10) / 10);
}

export default function RecipeBook({ user }) {
  const [recipes, setRecipes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [targetServings, setTargetServings] = useState(2);
  const [filterGenre, setFilterGenre] = useState("すべて");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { loadRecipes(); }, []);

  const loadRecipes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("saved_recipes")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      setMessage("レシピ集の読み込みに失敗しました。Supabaseで saved_recipes テーブルを追加してください。");
    } else {
      setRecipes((data || []).map(toCamel));
    }
    setLoading(false);
  };

  const filteredRecipes = useMemo(() => recipes.filter(recipe => {
    if (filterGenre !== "すべて" && recipe.genre !== filterGenre) return false;
    if (favoriteOnly && !recipe.favorite) return false;
    return true;
  }), [recipes, filterGenre, favoriteOnly]);

  const openRecipe = (recipe) => {
    setSelected(recipe.id || "new");
    setDraft({ ...recipe, ingredients: recipe.ingredients.map(i => ({ ...i })), steps: [...recipe.steps], tags: [...recipe.tags] });
    setTargetServings(Number(recipe.servings || 2));
    setMessage("");
  };

  const newRecipe = () => {
    openRecipe({ ...EMPTY_RECIPE, id: crypto.randomUUID(), sourceType: "manual" });
  };

  const saveRecipe = async (nextDraft = draft, notice = "保存しました") => {
    if (!nextDraft?.title.trim()) {
      setMessage("料理名を入力してください。");
      return;
    }
    setSaving(true);
    const recipe = {
      ...nextDraft,
      id: nextDraft.id || crypto.randomUUID(),
      ingredients: nextDraft.ingredients.length ? nextDraft.ingredients : EMPTY_RECIPE.ingredients,
      steps: nextDraft.steps.length ? nextDraft.steps : [""],
    };
    const { error } = await supabase.from("saved_recipes").upsert(toRow(recipe, user.id));
    if (error) {
      setMessage(`保存に失敗しました: ${error.message}`);
    } else {
      const saved = { ...recipe, updatedAt: new Date().toISOString() };
      setRecipes(prev => [saved, ...prev.filter(r => r.id !== saved.id)]);
      setDraft(saved);
      setSelected(saved.id);
      setMessage(notice);
    }
    setSaving(false);
  };

  const deleteRecipe = async () => {
    if (!draft?.id || !window.confirm("このレシピを削除しますか？")) return;
    setRecipes(prev => prev.filter(r => r.id !== draft.id));
    setSelected(null);
    setDraft(null);
    await supabase.from("saved_recipes").delete().eq("id", draft.id);
  };

  const saveCookMemo = async () => {
    const next = {
      ...draft,
      cookedCount: (draft.cookedCount || 0) + 1,
      lastCookedAt: new Date().toISOString(),
    };
    setDraft(next);
    await saveRecipe(next, "作ったメモを残しました");
  };

  const saveRecommended = async (recipe) => {
    await saveRecipe({ ...EMPTY_RECIPE, ...recipe, id: crypto.randomUUID(), favorite: false, cookMemo: "" }, "おすすめレシピを保存しました");
    setSelected(null);
    setDraft(null);
  };

  const importFromUrl = async () => {
    const sourceUrl = url.trim();
    if (!sourceUrl) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/recipe-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sourceUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "取得に失敗しました");
      const imported = {
        ...EMPTY_RECIPE,
        ...data.recipe,
        id: crypto.randomUUID(),
        sourceType: "url",
        sourceUrl,
        sourceName: data.recipe.sourceName || new URL(sourceUrl).hostname,
      };
      openRecipe(imported);
      setUrl("");
      setMessage(data.partial ? "取れる範囲で読み込みました。必要に応じて手直ししてください。" : "URLから読み込みました。保存前に内容を確認してください。");
    } catch (e) {
      openRecipe({ ...EMPTY_RECIPE, id: crypto.randomUUID(), sourceType: "url", sourceUrl, sourceName: safeHost(sourceUrl) });
      setMessage(`自動取得できませんでした。URLだけ入れた編集画面を作りました: ${e.message}`);
    }
    setLoading(false);
  };

  const setIngredient = (index, key, value) => {
    setDraft(prev => ({
      ...prev,
      ingredients: prev.ingredients.map((item, i) => i === index ? { ...item, [key]: value } : item),
    }));
  };

  const setStep = (index, value) => {
    setDraft(prev => ({ ...prev, steps: prev.steps.map((step, i) => i === index ? value : step) }));
  };

  if (draft) {
    return (
      <div className="fade-in">
        <button style={S.backBtn} onClick={() => { setDraft(null); setSelected(null); }}>← レシピ集に戻る</button>
        {message && <div style={S.message}>{message}</div>}
        <div style={S.editor}>
          <div style={S.editorTop}>
            <input
              style={S.titleInput}
              value={draft.title}
              onChange={e => setDraft({ ...draft, title: e.target.value })}
              placeholder="料理名"
            />
            <button
              style={{ ...S.favoriteBtn, ...(draft.favorite ? S.favoriteBtnOn : {}) }}
              onClick={() => setDraft({ ...draft, favorite: !draft.favorite })}>
              {draft.favorite ? "★" : "☆"}
            </button>
          </div>

          <div style={S.metaGrid}>
            <label style={S.fieldLabel}>ジャンル
              <select style={S.select} value={draft.genre} onChange={e => setDraft({ ...draft, genre: e.target.value })}>
                {GENRES.map(g => <option key={g}>{g}</option>)}
              </select>
            </label>
            <label style={S.fieldLabel}>基準量
              <input style={S.input} type="number" min="1" value={draft.servings} onChange={e => setDraft({ ...draft, servings: Number(e.target.value || 1) })} />
            </label>
            <label style={S.fieldLabel}>表示量
              <input style={S.input} type="number" min="1" value={targetServings} onChange={e => setTargetServings(Number(e.target.value || 1))} />
            </label>
          </div>

          <label style={S.fieldLabel}>出典URL
            <input style={S.input} value={draft.sourceUrl} onChange={e => setDraft({ ...draft, sourceUrl: e.target.value })} placeholder="https://..." />
          </label>
          <label style={S.fieldLabel}>タグ（カンマ区切り）
            <input style={S.input} value={draft.tags.join(", ")} onChange={e => setDraft({ ...draft, tags: parseTags(e.target.value) })} placeholder="時短, 鶏肉, 作り置き" />
          </label>

          <div style={S.sectionTitle}>材料</div>
          <div style={S.adjustNotice}>{draft.servings}人分 → {targetServings}人分で表示</div>
          {draft.ingredients.map((item, index) => (
            <div key={index} style={S.ingredientRow}>
              <input style={{ ...S.input, flex: 1.5 }} value={item.name} onChange={e => setIngredient(index, "name", e.target.value)} placeholder="材料名" />
              <input style={{ ...S.input, flex: 0.7 }} value={item.quantity} onChange={e => setIngredient(index, "quantity", e.target.value)} placeholder="量" />
              <input style={{ ...S.input, flex: 0.7 }} value={item.unit} onChange={e => setIngredient(index, "unit", e.target.value)} placeholder="単位" />
              <button style={S.smallGhostBtn} onClick={() => setDraft({ ...draft, ingredients: draft.ingredients.filter((_, i) => i !== index) })}>✕</button>
            </div>
          ))}
          <button style={S.addLineBtn} onClick={() => setDraft({ ...draft, ingredients: [...draft.ingredients, { name: "", quantity: "", unit: "", note: "" }] })}>+ 材料を追加</button>

          <div style={S.previewBox}>
            {draft.ingredients.filter(i => i.name.trim()).map((item, index) => (
              <div key={index} style={S.previewLine}>
                <span>{item.name}</span>
                <strong>{scaleQuantity(item.quantity, draft.servings, targetServings)}{item.unit}</strong>
              </div>
            ))}
          </div>

          <div style={S.sectionTitle}>作り方</div>
          {draft.steps.map((step, index) => (
            <div key={index} style={S.stepRow}>
              <span style={S.stepNum}>{index + 1}</span>
              <textarea style={S.textarea} rows={2} value={step} onChange={e => setStep(index, e.target.value)} placeholder="手順を入力" />
              <button style={S.smallGhostBtn} onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, i) => i !== index) })}>✕</button>
            </div>
          ))}
          <button style={S.addLineBtn} onClick={() => setDraft({ ...draft, steps: [...draft.steps, ""] })}>+ 手順を追加</button>

          <label style={S.fieldLabel}>メモ
            <textarea style={S.textarea} rows={3} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="次回のための調整、代用食材など" />
          </label>

          <label style={S.fieldLabel}>作った際のメモ
            <textarea style={S.textarea} rows={3} value={draft.cookMemo} onChange={e => setDraft({ ...draft, cookMemo: e.target.value })} placeholder="実際に作った感想、家族の反応、次回の改善点" />
          </label>
          <div style={S.cookedInfo}>
            {draft.cookedCount > 0 ? `${draft.cookedCount}回作成 / 最終 ${formatDate(draft.lastCookedAt)}` : "まだ作った記録はありません"}
          </div>

          <div style={S.actionRow}>
            <button style={S.primaryBtn} onClick={() => saveRecipe()} disabled={saving}>{saving ? "保存中…" : "保存"}</button>
            <button style={S.greenBtn} onClick={saveCookMemo} disabled={saving}>作ったメモを残す</button>
            {draft.createdAt && <button style={S.deleteBtn} onClick={deleteRecipe}>削除</button>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div style={S.headerRow}>
        <div>
          <div style={S.pageTitle}>📖 レシピ集</div>
          <div style={S.pageSub}>外部レシピも自分のメモも、家で使いやすい形に整えて保存</div>
        </div>
        <button style={S.primaryMiniBtn} onClick={newRecipe}>+ 自分で作成</button>
      </div>

      {message && <div style={S.message}>{message}</div>}

      <div style={S.importCard}>
        <div style={S.cardTitle}>URLから保存</div>
        <div style={S.importRow}>
          <input style={S.input} value={url} onChange={e => setUrl(e.target.value)} placeholder="レシピサイトのURLを貼り付け" />
          <button style={S.primaryMiniBtn} onClick={importFromUrl} disabled={loading}>{loading ? "取得中…" : "取得"}</button>
        </div>
      </div>

      <div style={S.filterRow}>
        <select style={S.select} value={filterGenre} onChange={e => setFilterGenre(e.target.value)}>
          <option>すべて</option>
          {GENRES.map(g => <option key={g}>{g}</option>)}
        </select>
        <button style={{ ...S.filterBtn, ...(favoriteOnly ? S.filterBtnOn : {}) }} onClick={() => setFavoriteOnly(v => !v)}>
          ★ お気に入り
        </button>
        <span style={S.countText}>{filteredRecipes.length}件</span>
      </div>

      <div style={S.sectionTitle}>おすすめ</div>
      <div style={S.recommendGrid}>
        {RECOMMENDED_RECIPES.map(recipe => (
          <div key={recipe.title} style={S.recipeCard}>
            <div style={S.genreBadge}>{recipe.genre}</div>
            <div style={S.recipeTitle}>{recipe.title}</div>
            <div style={S.recipeMeta}>{recipe.servings}人分 / {recipe.tags.join("・")}</div>
            <button style={S.saveSmallBtn} onClick={() => saveRecommended(recipe)}>保存</button>
          </div>
        ))}
      </div>

      <div style={S.sectionTitle}>保存済み</div>
      {loading ? (
        <div style={S.empty}>読み込み中…</div>
      ) : filteredRecipes.length === 0 ? (
        <div style={S.empty}>まだレシピがありません</div>
      ) : (
        <div style={S.list}>
          {filteredRecipes.map(recipe => (
            <button key={recipe.id} style={S.savedCard} onClick={() => openRecipe(recipe)}>
              <div style={S.savedTop}>
                <span style={S.genreBadge}>{recipe.genre}</span>
                <span style={recipe.favorite ? S.starOn : S.starOff}>{recipe.favorite ? "★" : "☆"}</span>
              </div>
              <div style={S.savedTitle}>{recipe.title}</div>
              <div style={S.savedMeta}>
                {recipe.sourceName || (recipe.sourceUrl ? safeHost(recipe.sourceUrl) : "手入力")}
                {recipe.cookedCount > 0 ? ` / ${recipe.cookedCount}回作成` : ""}
              </div>
              {recipe.tags.length > 0 && <div style={S.tagRow}>{recipe.tags.slice(0, 4).map(tag => <span key={tag} style={S.tag}>{tag}</span>)}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function safeHost(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

const S = {
  headerRow: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 12 },
  pageTitle: { fontSize: 18, fontWeight: 800, color: "#2D3748" },
  pageSub: { fontSize: 11, color: "#718096", marginTop: 2 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: "#2D3748", marginBottom: 8 },
  importCard: { background: "white", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.06)" },
  importRow: { display: "flex", gap: 8 },
  filterRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 },
  countText: { marginLeft: "auto", fontSize: 12, color: "#A0AEC0" },
  input: { flex: 1, padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E2E8F0", fontSize: 13, outline: "none", minWidth: 0, boxSizing: "border-box" },
  select: { padding: "9px 10px", borderRadius: 9, border: "1.5px solid #E2E8F0", fontSize: 13, background: "white", cursor: "pointer" },
  textarea: { width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E2E8F0", fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" },
  primaryMiniBtn: { padding: "9px 13px", borderRadius: 10, background: "#2D3748", color: "white", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 },
  primaryBtn: { flex: 1, padding: 12, borderRadius: 11, background: "#2D3748", color: "white", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  greenBtn: { flex: 1, padding: 12, borderRadius: 11, background: "#2F855A", color: "white", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  deleteBtn: { padding: "12px 14px", borderRadius: 11, border: "1.5px solid #FED7D7", background: "#FFF5F5", color: "#E53E3E", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  filterBtn: { padding: "8px 12px", borderRadius: 20, border: "1.5px solid #E2E8F0", background: "white", color: "#718096", cursor: "pointer", fontSize: 12 },
  filterBtnOn: { background: "#FFFFF0", color: "#B7791F", borderColor: "#F6E05E", fontWeight: 700 },
  sectionTitle: { fontSize: 14, fontWeight: 800, color: "#2D3748", margin: "14px 0 8px" },
  recommendGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 8, marginBottom: 12 },
  recipeCard: { background: "white", borderRadius: 12, padding: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.06)" },
  recipeTitle: { fontSize: 13, fontWeight: 800, color: "#2D3748", marginTop: 7, marginBottom: 4 },
  recipeMeta: { fontSize: 11, color: "#718096", minHeight: 30 },
  saveSmallBtn: { width: "100%", marginTop: 9, padding: 8, borderRadius: 9, background: "#F0FFF4", border: "1.5px solid #9AE6B4", color: "#2F855A", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  savedCard: { textAlign: "left", background: "white", border: "1.5px solid transparent", borderRadius: 12, padding: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.06)", cursor: "pointer" },
  savedTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  savedTitle: { fontSize: 14, fontWeight: 800, color: "#2D3748", marginBottom: 4 },
  savedMeta: { fontSize: 11, color: "#A0AEC0" },
  genreBadge: { display: "inline-block", fontSize: 11, fontWeight: 700, color: "#4A5568", background: "#EDF2F7", borderRadius: 8, padding: "2px 8px" },
  starOn: { color: "#D69E2E", fontSize: 17 },
  starOff: { color: "#CBD5E0", fontSize: 17 },
  tagRow: { display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 },
  tag: { fontSize: 11, color: "#4A5568", background: "#F7FAFC", border: "1px solid #EDF2F7", borderRadius: 8, padding: "2px 7px" },
  empty: { textAlign: "center", color: "#A0AEC0", fontSize: 13, padding: "36px 20px", background: "white", borderRadius: 14, boxShadow: "0 2px 10px rgba(0,0,0,0.06)" },
  message: { fontSize: 12, color: "#2F855A", background: "#F0FFF4", border: "1px solid #9AE6B4", borderRadius: 9, padding: "8px 10px", marginBottom: 10 },
  backBtn: { background: "none", border: "none", color: "#667eea", fontSize: 13, cursor: "pointer", padding: "0 0 12px", fontWeight: 600 },
  editor: { background: "white", borderRadius: 14, padding: 16, boxShadow: "0 2px 10px rgba(0,0,0,0.06)" },
  editorTop: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 },
  titleInput: { flex: 1, border: "none", borderBottom: "1.5px solid #E2E8F0", padding: "8px 0", fontSize: 22, fontWeight: 800, color: "#2D3748", outline: "none", minWidth: 0 },
  favoriteBtn: { width: 38, height: 38, borderRadius: 12, border: "1.5px solid #E2E8F0", background: "white", color: "#CBD5E0", fontSize: 20, cursor: "pointer" },
  favoriteBtnOn: { color: "#D69E2E", background: "#FFFFF0", borderColor: "#F6E05E" },
  metaGrid: { display: "grid", gridTemplateColumns: "1.2fr .8fr .8fr", gap: 8, marginBottom: 10 },
  fieldLabel: { display: "flex", flexDirection: "column", gap: 5, fontSize: 12, fontWeight: 700, color: "#4A5568", marginBottom: 10 },
  adjustNotice: { fontSize: 11, color: "#718096", marginBottom: 6 },
  ingredientRow: { display: "flex", gap: 6, marginBottom: 6 },
  stepRow: { display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 },
  stepNum: { width: 24, height: 24, borderRadius: "50%", background: "#EDF2F7", color: "#4A5568", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0, marginTop: 7 },
  smallGhostBtn: { width: 32, borderRadius: 8, border: "1.5px solid #E2E8F0", background: "white", color: "#A0AEC0", cursor: "pointer", flexShrink: 0 },
  addLineBtn: { padding: "7px 10px", borderRadius: 9, border: "1.5px dashed #CBD5E0", background: "white", color: "#718096", fontSize: 12, cursor: "pointer", marginBottom: 8 },
  previewBox: { background: "#F7FAFC", borderRadius: 10, padding: 10, border: "1px solid #EDF2F7", marginBottom: 12 },
  previewLine: { display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: "#4A5568", padding: "3px 0" },
  cookedInfo: { fontSize: 11, color: "#A0AEC0", marginTop: -4, marginBottom: 12 },
  actionRow: { display: "flex", gap: 8, flexWrap: "wrap" },
};
