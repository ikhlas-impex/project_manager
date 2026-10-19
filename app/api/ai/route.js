import { requireUser, json } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `You are TeamFlow's assistant for a small team (a manager and employees).
Be concise, practical and friendly. Use plain text with simple bullet points ("•") and short headings.
Never invent tasks or numbers that are not in the provided data.`;

const PROMPTS = {
  describe: ({ title, notes }) =>
    `Write a short task description (2-4 sentences) followed by a checklist of 3-6 concrete steps ("- [ ] step").
Task title: "${title}"${notes ? `\nExisting notes: ${notes}` : ""}
Return only the description and checklist.`,

  summary: ({ text }) =>
    `Rewrite this daily work update so it is clear and professional, ready to paste into chat or email.
Keep every task and fact, keep the emoji section headings, add a one-line "Highlights" at the top. Plain text only.

${text}`,

  report: ({ period, stats, tasks }) =>
    `Analyse this team performance data for ${period} and write a report with these sections:
1. Overview (2-3 sentences)
2. Key wins
3. Bottlenecks & waiting time (who/what is blocking)
4. Per-person notes
5. Recommendations for next period (3-5 actionable bullets)

Stats JSON: ${JSON.stringify(stats)}
Tasks JSON: ${JSON.stringify(tasks)}`,

  chat: ({ messages, context }) =>
    `Current team data (JSON): ${JSON.stringify(context)}

Conversation so far:
${messages.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`).join("\n")}

Reply to the user's last message as the Assistant.`,
};

export async function POST(req) {
  const auth = await requireUser(req);
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: "Gemini is not configured. Set GEMINI_API_KEY." }, 503);

  const body = await req.json();
  const build = PROMPTS[body.mode];
  if (!build) return json({ error: "Unknown AI mode" }, 400);

  const prompt = build(body).slice(0, 120_000);
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4 },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return json({ error: data?.error?.message || `Gemini error (${res.status})` }, 502);

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  if (!text) return json({ error: "Gemini returned an empty response." }, 502);
  return json({ text: text.trim() });
}
