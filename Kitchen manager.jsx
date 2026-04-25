import { useState, useEffect, useCallback } from "react";

const KEY_INGREDIENTS = "kitchen-ingredients-v2";
const KEY_PRESETS     = "kitchen-presets-v2";
const KEY_HISTORY     = "kitchen-history-v2";

const LOCATIONS = {
  fridge:  { label: "冷蔵庫", icon: "🧊", color: "#4A90D9", bg: "#EBF8FF" },
  freezer: { label: "冷凍庫", icon: "❄️", color: "#7B68EE", bg: "#EDE9FE" },
};
const KINDS = {
  ingredient: { label: "食材",      icon: "🥩", color: "#2F855A", bg: "#F0FFF4", border: "#9AE6B4", desc: "下処理・調理が必要" },
  retort:     { label: "レトルト",  icon: "📦", color: "#C05621", bg: "#FFFAF0", border: "#FBD38D", desc: "焼くだけ・温めるだけ" },
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
const AMOUNT_OPTIONS = ["少量","半分","たっぷり"];
const VIEWS = ["pantry","recipes","history"];

function parseRecipes(text) {
  const blocks = text.split(/(?=\d+[.．]\s*【)/m).filter(Boolean);
  if (blocks.length < 2) return [{ title: "今日の献立提案", content: text }];
  return blocks.map((block) => {
    const m = block.match(/【(.+?)】/);
    return { title: m ? m[1] : block.split("\n")[0].replace(/^\d+[.．]\s*/,"").trim(), content: block };
  });
}

function Stars({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display:"flex", gap:2 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n}
          style={{ fontSize:22, cursor: onChange?"pointer":"default", color: n<=(hover||value)?"#F6AD55":"#E2E8F0", transition:"color .1s" }}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(0)}
          onClick={() => onChange && onChange(n)}>★</span>
      ))}
    </div>
  );
}

export default function KitchenManager() {
  const [ingredients, setIngredients] = useState({ fridge:[], freezer:[] });
  const [presets, setPresets]         = useState(DEFAULT_PRESETS);
  const [history, setHistory]         = useState([]);

  const [activeLoc,  setActiveLoc]    = useState("fridge");
  const [activeKind, setActiveKind]   = useState("ingredient");
  const [inputName,  setInputName]    = useState("");
  const [inputAmount,setInputAmount]  = useState("たっぷり");
  const [editingId,  setEditingId]    = useState(null);

  // preset edit mode
  const [editPresets,  setEditPresets]  = useState(false);
  const [presetInput,  setPresetInput]  = useState("");

  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState(null);
  const [error,   setError]   = useState("");
  const [view,    setView]    = useState("pantry");

  // history detail
  const [histDetail, setHistDetail] = useState(null);

  // ── storage ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [si, sp, sh] = await Promise.all([
          window.storage.get(KEY_INGREDIENTS),
          window.storage.get(KEY_PRESETS),
          window.storage.get(KEY_HISTORY),
        ]);
        if (si?.value) setIngredients(JSON.parse(si.value));
        if (sp?.value) setPresets(JSON.parse(sp.value));
        if (sh?.value) setHistory(JSON.parse(sh.value));
      } catch {}
    })();
  }, []);

  const saveI = useCallback(async (d) => { try { await window.storage.set(KEY_INGREDIENTS, JSON.stringify(d)); } catch {} }, []);
  const saveP = useCallback(async (d) => { try { await window.storage.set(KEY_PRESETS,     JSON.stringify(d)); } catch {} }, []);
  const saveH = useCallback(async (d) => { try { await window.storage.set(KEY_HISTORY,     JSON.stringify(d)); } catch {} }, []);

  // ── ingredients ─────────────────────────────────────────
  const addIngredient = () => {
    const name = inputName.trim(); if (!name) return;
    const item = { id:Date.now(), name, amount:inputAmount, kind:activeKind, addedAt:new Date().toLocaleDateString("ja-JP") };
    const u = { ...ingredients, [activeLoc]: [...ingredients[activeLoc], item] };
    setIngredients(u); saveI(u); setInputName("");
  };
  const addFromPreset = (loc, kind, name) => {
    if (ingredients[loc].some(i=>i.name===name)) return;
    const item = { id:Date.now()+Math.random(), name, amount:"たっぷり", kind, addedAt:new Date().toLocaleDateString("ja-JP") };
    const u = { ...ingredients, [loc]: [...ingredients[loc], item] };
    setIngredients(u); saveI(u);
  };
  const removeIngredient = (loc, id) => {
    const u = { ...ingredients, [loc]: ingredients[loc].filter(i=>i.id!==id) };
    setIngredients(u); saveI(u);
  };
  const updateAmount = (loc, id, amount) => {
    const u = { ...ingredients, [loc]: ingredients[loc].map(i=>i.id===id?{...i,amount}:i) };
    setIngredients(u); saveI(u); setEditingId(null);
  };

  // ── presets ─────────────────────────────────────────────
  const addPreset = () => {
    const name = presetInput.trim(); if (!name) return;
    if (presets[activeLoc][activeKind].includes(name)) { setPresetInput(""); return; }
    const u = { ...presets, [activeLoc]: { ...presets[activeLoc], [activeKind]: [...presets[activeLoc][activeKind], name] } };
    setPresets(u); saveP(u); setPresetInput("");
  };
  const removePreset = (name) => {
    const u = { ...presets, [activeLoc]: { ...presets[activeLoc], [activeKind]: presets[activeLoc][activeKind].filter(p=>p!==name) } };
    setPresets(u); saveP(u);
  };

  // ── suggest ──────────────────────────────────────────────
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
    setError(""); setLoading(true); setView("recipes"); setRecipes(null);

    const userMsg = [
      rawItems.length   ? `【要調理の食材】: ${rawItems.join("、")}`   : "",
      retortItems.length? `【レトルト品】: ${retortItems.join("、")}` : "",
    ].filter(Boolean).join("\n");

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:1200,
          system:`あなたは家庭料理の献立プランナーです。今日の夕食として実際に作れる献立を3つ提案してください。
食材には「要調理の食材」と「レトルト・調理済み品（焼くだけ・温めるだけ）」の2種類があります。
各献立は以下の形式で：
【料理名】
使用食材: （使うものを列挙。レトルト品は「○○（焼くだけ）」と明記）
調理時間: 約○分
難易度: ★☆☆〜★★★
作り方: 簡潔に3〜4ステップ
レトルト品はそのまま主菜として活用し、副菜・汁物も含めた献立として提案してください。`,
          messages:[{ role:"user", content:`今日の食材：\n${userMsg}\n\n夕食の献立を3つ提案してください。` }],
        }),
      });
      const data = await res.json();
      const text = data.content?.find(b=>b.type==="text")?.text || "";
      const parsed = parseRecipes(text);
      setRecipes(parsed);

      // save to history
      const entry = {
        id: Date.now(),
        date: new Date().toLocaleString("ja-JP", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" }),
        recipes: parsed,
        ingredients: { raw: rawItems, retort: retortItems },
        ratings: {},
        memo: "",
      };
      const newHistory = [entry, ...history].slice(0, 30);
      setHistory(newHistory); saveH(newHistory);
    } catch {
      setError("提案の取得に失敗しました。もう一度お試しください。"); setView("pantry");
    }
    setLoading(false);
  };

  // ── history rating/memo ──────────────────────────────────
  const rateRecipe = (histId, recipeIdx, stars) => {
    const u = history.map(h => h.id !== histId ? h : { ...h, ratings: { ...h.ratings, [recipeIdx]: stars } });
    setHistory(u); saveH(u);
    if (histDetail?.id === histId) setHistDetail(u.find(h=>h.id===histId));
  };
  const updateMemo = (histId, memo) => {
    const u = history.map(h => h.id !== histId ? h : { ...h, memo });
    setHistory(u); saveH(u);
    if (histDetail?.id === histId) setHistDetail(u.find(h=>h.id===histId));
  };
  const deleteHistory = (histId) => {
    const u = history.filter(h=>h.id!==histId);
    setHistory(u); saveH(u);
    if (histDetail?.id === histId) setHistDetail(null);
  };

  const counts = {
    fridge:  { ingredient: ingredients.fridge.filter(i=>i.kind==="ingredient").length,  retort: ingredients.fridge.filter(i=>i.kind==="retort").length },
    freezer: { ingredient: ingredients.freezer.filter(i=>i.kind==="ingredient").length, retort: ingredients.freezer.filter(i=>i.kind==="retort").length },
  };
  const total = ingredients.fridge.length + ingredients.freezer.length;
  const totalRaw    = counts.fridge.ingredient + counts.freezer.ingredient;
  const totalRetort = counts.fridge.retort     + counts.freezer.retort;

  // ── render ───────────────────────────────────────────────
  return (
    <div style={S.app}>
      <style>{css}</style>

      {/* HEADER */}
      <header style={S.header}>
        <div style={S.hi}>
          <div style={S.logo}>
            <span style={{fontSize:24}}>🍱</span>
            <div>
              <div style={S.logoTitle}>おうちキッチン</div>
              <div style={S.logoSub}>食材管理 & 献立提案</div>
            </div>
          </div>
          <div style={S.navBtns}>
            {[["pantry","📦 食材"],["recipes","🍽️ 献立"],["history","📋 履歴"]].map(([v,label])=>(
              <button key={v}
                style={{...S.navBtn,...(view===v?S.navActive:{}),...(v==="recipes"&&!recipes&&!loading?S.navDisabled:{})}}
                onClick={()=>{ if(v==="recipes"&&!recipes&&!loading) return; setView(v); setHistDetail(null); }}>
                {label}{v==="history"&&history.length>0?<span style={S.histBadge}>{history.length}</span>:null}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main style={S.main}>

        {/* ═══ PANTRY ═══════════════════════════════════════ */}
        {view==="pantry" && (
          <div className="fade-in">
            {/* Stats */}
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

            {/* Add form */}
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
                    <span style={{fontSize:18}}>{kind.icon}</span>
                    <span><span style={S.kindLabel}>{kind.label}</span><span style={S.kindDesc}>{kind.desc}</span></span>
                  </button>
                ))}
              </div>
              <div style={S.inputRow}>
                <input style={S.input} value={inputName}
                  onChange={e=>setInputName(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&addIngredient()}
                  placeholder={activeKind==="ingredient"?"例：鶏モモ肉、豚バラ…":"例：焼くだけ餃子、温めるだけ肉団子…"} />
                <select style={S.select} value={inputAmount} onChange={e=>setInputAmount(e.target.value)}>
                  {AMOUNT_OPTIONS.map(a=><option key={a}>{a}</option>)}
                </select>
                <button style={S.addBtn} onClick={addIngredient}>追加</button>
              </div>

              {/* Presets */}
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
                      <div key={p} style={{...S.presetChipEdit, borderColor:KINDS[activeKind].border, color:KINDS[activeKind].color}}>
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
                        style={{...S.presetChip, borderColor:KINDS[activeKind].border, color:KINDS[activeKind].color}}
                        onClick={()=>addFromPreset(activeLoc,activeKind,p)}>
                        + {p}
                      </button>
                    ))}
                  {presets[activeLoc][activeKind].filter(p=>!ingredients[activeLoc].some(i=>i.name===p)).length===0 &&
                    <span style={S.presetEmpty}>登録済みか、項目がありません</span>}
                </div>
              )}
            </div>

            {/* Ingredient lists */}
            {Object.entries(LOCATIONS).map(([loc,cat])=>(
              <div key={loc} style={S.card}>
                <div style={S.cardTitleRow}>
                  <span style={{...S.cardTitle,color:cat.color}}>{cat.icon} {cat.label}</span>
                  <span style={{...S.badge,background:cat.bg,color:cat.color}}>{ingredients[loc].length}品</span>
                </div>
                {ingredients[loc].length===0 ? <div style={S.empty}>食材が登録されていません</div> : (
                  Object.entries(KINDS).map(([k,kind])=>{
                    const items=ingredients[loc].filter(i=>i.kind===k);
                    if(!items.length) return null;
                    return (
                      <div key={k} style={{marginBottom:10}}>
                        <div style={{...S.kindSection,background:kind.bg,color:kind.color,borderColor:kind.border}}>
                          {kind.icon} {kind.label}<span style={{fontWeight:400,fontSize:11}}> — {kind.desc}</span>
                        </div>
                        <div style={S.itemList}>
                          {items.map(item=>(
                            <div key={item.id} style={S.item} className="item-row">
                              <div style={S.itemName}>{item.name}</div>
                              {editingId===item.id ? (
                                <div style={S.amountEdit}>
                                  {AMOUNT_OPTIONS.map(a=>(
                                    <button key={a}
                                      style={{...S.amountChip,...(item.amount===a?S.amountChipActive:{})}}
                                      onClick={()=>updateAmount(loc,item.id,a)}>{a}</button>
                                  ))}
                                </div>
                              ):(
                                <button style={{...S.amountTag,background:kind.bg,color:kind.color}}
                                  onClick={()=>setEditingId(item.id)}>{item.amount}</button>
                              )}
                              <div style={S.addedDate}>{item.addedAt}</div>
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

            {error && <div style={S.errorMsg}>{error}</div>}
            <button style={{...S.suggestBtn,...(loading?S.suggestBtnLoading:{})}}
              onClick={getSuggestions} disabled={loading} className="suggest-btn">
              {loading?"🔄 献立を考え中...":"🍽️ 今日の夕食を提案してもらう"}
            </button>
          </div>
        )}

        {/* ═══ RECIPES ══════════════════════════════════════ */}
        {view==="recipes" && (
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
                {/* Rating for latest history entry */}
                {history.length>0 && (
                  <div style={S.ratingPrompt}>
                    ⭐ 気に入ったレシピに評価をつけましょう
                  </div>
                )}
                {recipes.map((r,i)=>(
                  <div key={i} style={{...S.recipeCard,animationDelay:`${i*0.12}s`}} className="recipe-card">
                    <div style={S.recipeNum}>{i+1}</div>
                    <div style={S.recipeTitle}>{r.title}</div>
                    <div style={S.recipeContent}>{r.content.replace(/【.+?】/,"").replace(/^\d+[.．]\s*/,"").trim()}</div>
                    {history.length>0 && (
                      <div style={S.recipeRatingRow}>
                        <span style={S.recipeRatingLabel}>評価：</span>
                        <Stars value={history[0].ratings[i]||0} onChange={s=>rateRecipe(history[0].id,i,s)}/>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {/* ═══ HISTORY ══════════════════════════════════════ */}
        {view==="history" && (
          <div className="fade-in">
            {histDetail ? (
              // Detail view
              <div>
                <button style={S.backBtn} onClick={()=>setHistDetail(null)}>← 履歴一覧に戻る</button>
                <div style={S.histDetailHeader}>
                  <div style={S.histDetailDate}>📅 {histDetail.date}</div>
                  <button style={S.histDeleteBtn} onClick={()=>{ deleteHistory(histDetail.id); }}>🗑️ 削除</button>
                </div>
                <div style={{...S.card, marginBottom:12}}>
                  <div style={S.cardTitle}>使用した食材</div>
                  <div style={{fontSize:12,color:"#4A5568",lineHeight:2}}>
                    {histDetail.ingredients.raw.length>0 && <div>🥩 {histDetail.ingredients.raw.join("　")}</div>}
                    {histDetail.ingredients.retort.length>0 && <div>📦 {histDetail.ingredients.retort.join("　")}</div>}
                  </div>
                </div>
                {histDetail.recipes.map((r,i)=>(
                  <div key={i} style={S.recipeCard} className="recipe-card">
                    <div style={S.recipeNum}>{i+1}</div>
                    <div style={S.recipeTitle}>{r.title}</div>
                    <div style={S.recipeContent}>{r.content.replace(/【.+?】/,"").replace(/^\d+[.．]\s*/,"").trim()}</div>
                    <div style={S.recipeRatingRow}>
                      <span style={S.recipeRatingLabel}>評価：</span>
                      <Stars value={histDetail.ratings[i]||0} onChange={s=>rateRecipe(histDetail.id,i,s)}/>
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
              // List view
              <div>
                <div style={S.recipesHeader}>
                  <span style={S.recipesTitle}>📋 献立履歴</span>
                  <span style={{fontSize:12,color:"#A0AEC0"}}>{history.length}件</span>
                </div>
                {history.length===0 ? (
                  <div style={S.histEmpty}>
                    <div style={{fontSize:40,marginBottom:12}}>📭</div>
                    <div style={{fontSize:14,color:"#A0AEC0"}}>まだ献立の履歴がありません</div>
                    <div style={{fontSize:12,color:"#CBD5E0",marginTop:4}}>食材を登録して提案を求めると、ここに記録されます</div>
                  </div>
                ) : history.map(h=>{
                  const avgRating = Object.values(h.ratings).length
                    ? (Object.values(h.ratings).reduce((a,b)=>a+b,0)/Object.values(h.ratings).length).toFixed(1)
                    : null;
                  const topRated = h.recipes.reduce((best,r,i)=> (h.ratings[i]||0)>(h.ratings[best]||0)?i:best, 0);
                  return (
                    <div key={h.id} style={S.histCard} className="hist-card" onClick={()=>setHistDetail(h)}>
                      <div style={S.histCardTop}>
                        <div style={S.histDate}>📅 {h.date}</div>
                        {avgRating && (
                          <div style={S.histRatingSummary}>
                            <span style={{color:"#F6AD55"}}>★</span> {avgRating}
                          </div>
                        )}
                      </div>
                      <div style={S.histRecipeNames}>
                        {h.recipes.map((r,i)=>(
                          <span key={i} style={{...S.histRecipeName,...(h.ratings[i]>=4?S.histRecipeNameTop:{})}}>
                            {h.ratings[i]>=4?"⭐ ":""}{r.title}
                          </span>
                        ))}
                      </div>
                      {h.memo && <div style={S.histMemoPreview}>📝 {h.memo}</div>}
                      <div style={S.histIngredientSummary}>
                        {h.ingredients.raw.slice(0,3).join("・")}{h.ingredients.raw.length>3?"…":""}
                        {h.ingredients.retort.length>0 ? ` ＋ 📦 ${h.ingredients.retort.slice(0,2).join("・")}` : ""}
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
  navDisabled:{opacity:0.4,cursor:"default"},
  histBadge:{position:"absolute",top:-6,right:-6,background:"#E53E3E",color:"white",borderRadius:"50%",width:16,height:16,fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700},
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
  itemName:{flex:1,fontSize:13,fontWeight:500,color:"#2D3748"},
  amountTag:{padding:"3px 9px",borderRadius:10,fontSize:11,border:"none",cursor:"pointer",fontWeight:600},
  amountEdit:{display:"flex",gap:4},
  amountChip:{padding:"3px 7px",borderRadius:7,border:"1px solid #E2E8F0",background:"white",fontSize:11,cursor:"pointer",color:"#4A5568"},
  amountChipActive:{background:"#2D3748",color:"white",borderColor:"#2D3748"},
  addedDate:{fontSize:10,color:"#A0AEC0"},
  deleteBtn:{padding:"2px 5px",border:"none",background:"transparent",color:"#CBD5E0",cursor:"pointer",fontSize:11},
  empty:{textAlign:"center",color:"#A0AEC0",fontSize:13,padding:"12px 0"},

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
  recipeNum:{position:"absolute",left:12,top:14,width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#667eea,#764ba2)",color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800},
  recipeTitle:{fontSize:15,fontWeight:700,color:"#2D3748",marginBottom:7},
  recipeContent:{fontSize:12,color:"#4A5568",lineHeight:1.85,whiteSpace:"pre-wrap",marginBottom:10},
  recipeRatingRow:{display:"flex",alignItems:"center",gap:6,paddingTop:8,borderTop:"1px solid #EDF2F7"},
  recipeRatingLabel:{fontSize:11,color:"#A0AEC0"},

  // History
  histEmpty:{textAlign:"center",padding:"60px 20px",background:"white",borderRadius:14,boxShadow:"0 2px 10px rgba(0,0,0,0.06)"},
  histCard:{background:"white",borderRadius:14,padding:14,marginBottom:10,boxShadow:"0 2px 10px rgba(0,0,0,0.06)",cursor:"pointer",border:"1.5px solid transparent",transition:"all .2s"},
  histCardTop:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:7},
  histDate:{fontSize:12,color:"#718096",fontWeight:600},
  histRatingSummary:{fontSize:13,fontWeight:700,color:"#2D3748"},
  histRecipeNames:{display:"flex",flexWrap:"wrap",gap:5,marginBottom:6},
  histRecipeName:{fontSize:12,background:"#EDF2F7",color:"#4A5568",borderRadius:8,padding:"3px 8px"},
  histRecipeNameTop:{background:"#FFFFF0",color:"#B7791F",border:"1px solid #FAF089"},
  histMemoPreview:{fontSize:11,color:"#718096",marginBottom:5,fontStyle:"italic"},
  histIngredientSummary:{fontSize:11,color:"#A0AEC0"},

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