import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const PAGE_ID = process.env.NOTION_PAGE_ID;

export default async function handler(req, res) {
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const { action } = req.query;

  try {
    // チェック済み（買ってきた）食材を取得
    if (action === "read") {
      let todos = [];
      let cursor;
      do {
        const resp = await notion.blocks.children.list({
          block_id: PAGE_ID, page_size: 100, start_cursor: cursor,
        });
        todos = todos.concat(
          resp.results
            .filter(b => b.type === "to_do")
            .map(b => ({
              id:      b.id,
              text:    b.to_do.rich_text.map(t => t.plain_text).join(""),
              checked: b.to_do.checked,
            }))
        );
        cursor = resp.has_more ? resp.next_cursor : null;
      } while (cursor);
      res.json({ todos });
    }

    // 買い物リストに追記
    else if (action === "write" && req.method === "POST") {
      const { name } = req.body;
      await notion.blocks.children.append({
        block_id: PAGE_ID,
        children: [{
          type:   "to_do",
          to_do: {
            rich_text: [{ type:"text", text:{ content: name } }],
            checked:   false,
          },
        }],
      });
      res.json({ success: true });
    }

    // 取り込み後にチェックを外す
    else if (action === "uncheck" && req.method === "POST") {
      const { blockId } = req.body;
      await notion.blocks.update({ block_id: blockId, to_do: { checked: false } });
      res.json({ success: true });
    }

    else {
      res.status(400).json({ error: "Unknown action" });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
