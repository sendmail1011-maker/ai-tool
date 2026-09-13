import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { openai } from "@/lib/openai";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import {
  ACCOUNTING_TAXONOMY,
  ACCOUNTING_GROUPS,
  groupsForType,
  groupType,
  type AccountingGroup,
} from "@/lib/accountingCategories";

const GROUP_ITEM_SCHEMAS: Record<AccountingGroup, z.ZodTypeAny> = {
  變動支出: z.object({
    group: z.literal("變動支出"),
    subCategory: z.enum(ACCOUNTING_TAXONOMY.變動支出),
    amount: z.number(),
    item: z.string(),
    date: z.string().nullable(),
  }),
  固定支出: z.object({
    group: z.literal("固定支出"),
    subCategory: z.enum(ACCOUNTING_TAXONOMY.固定支出),
    amount: z.number(),
    item: z.string(),
    date: z.string().nullable(),
  }),
  收入與資產: z.object({
    group: z.literal("收入與資產"),
    subCategory: z.enum(ACCOUNTING_TAXONOMY.收入與資產),
    amount: z.number(),
    item: z.string(),
    date: z.string().nullable(),
  }),
};

function buildAnalysisSchema(type: "expense" | "income") {
  const groups = groupsForType(type);
  const schemas = groups.map((group) => GROUP_ITEM_SCHEMAS[group]) as [
    z.ZodTypeAny,
    ...z.ZodTypeAny[],
  ];
  const itemSchema =
    schemas.length === 1 ? schemas[0] : z.discriminatedUnion("group", schemas as never);
  return z.object({ transactions: z.array(itemSchema) });
}

function buildAutoAnalysisSchema() {
  const schemas = ACCOUNTING_GROUPS.map((group) => GROUP_ITEM_SCHEMAS[group]) as [
    z.ZodTypeAny,
    ...z.ZodTypeAny[],
  ];
  return z.object({
    transactions: z.array(z.discriminatedUnion("group", schemas as never)),
  });
}

function taxonomyDescription(type: "expense" | "income") {
  return groupsForType(type)
    .map((group) => `- ${group}：${ACCOUNTING_TAXONOMY[group].join("、")}`)
    .join("\n");
}

function fullTaxonomyDescription() {
  return ACCOUNTING_GROUPS.map(
    (group) => `- ${group}：${ACCOUNTING_TAXONOMY[group].join("、")}`
  ).join("\n");
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = await request.json();
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const imageBase64 =
    typeof body.imageBase64 === "string" && body.imageBase64.startsWith("data:image/")
      ? body.imageBase64
      : "";
  const dateParam = typeof body.date === "string" ? body.date : "";
  const type = body.type === "income" ? "income" : body.type === "expense" ? "expense" : null;

  if (!text && !imageBase64) {
    return NextResponse.json(
      { error: "請輸入文字或附上一張收據照片" },
      { status: 400 }
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json(
      { error: "date 為必填欄位，格式須為 YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const autoMode = Boolean(imageBase64);

  if (!autoMode && !type) {
    return NextResponse.json(
      { error: "type 為必填欄位，須為 expense 或 income" },
      { status: 400 }
    );
  }

  const TransactionAnalysis = autoMode
    ? buildAutoAnalysisSchema()
    : buildAnalysisSchema(type!);
  const referenceYear = dateParam.slice(0, 4);

  const instructions = autoMode
    ? `你是記帳助理，請從使用者提供的照片（收據、發票、信用卡或銀行帳單）中擷取記帳資訊。
請把上面每一項有金額的個別交易都拆開，不要合併或只取第一筆；請忽略小計、合計、應繳金額、上期餘額等匯總列，那些不是個別交易。有文字說明時也要一併納入考量。

方向判斷規則（每一筆都要自行判斷是支出還是收入，不可以整批套用同一個方向）：
- 如果原始畫面上這筆金額是負數（例如信用卡帳單裡的現金回饋、退款、折抵），代表方向是「收入」，請選用「收入與資產」群組（挑最貼切的子分類，例如現金回饋、退款類可用「被動收入」）。
- 其餘正數金額一律視為「支出」，從「變動支出」或「固定支出」群組中挑最貼切的子分類；國外交易服務費、手續費等雜項費用也算支出。
- amount 欄位一律填正數（絕對值），方向完全由 group 決定，不要出現負數。
- 如果項目名稱中出現「真耶穌」字樣，不論金額正負，一律歸類為「固定支出」群組、「奉獻」子分類。
- 如果項目名稱或說明中出現「本行自動扣繳」字樣（通常是信用卡帳單裡由銀行帳戶自動扣款繳清帳款的那一筆），這不是消費也不是收入，請完全跳過這筆，不要放進 transactions 陣列。

日期（date 欄位）規則：
- 帳單或收據上如果同時有「消費日」與「入帳日」兩種日期欄位，一律使用「消費日」作為 date。
- 請把該筆項目自己的日期換算成 YYYY-MM-DD 格式填入 date。
- 如果日期沒有年份（例如「08/17」「9/2」），請用 ${referenceYear} 年組合；但如果組合後的日期會晚於參考日期 ${dateParam}，代表這筆其實是去年的，請改用 ${Number(referenceYear) - 1} 年。
- 如果完全看不出這筆項目自己的日期，date 欄位請填 null（會自動使用使用者選擇的日期）。

每一筆都必須從下面的分類架構中，選出一個 group 與對應的 subCategory（subCategory 一定要屬於該 group 底下列出的項目，不可以自創）：
${fullTaxonomyDescription()}

item 請用簡短文字描述該筆項目內容。`
    : `你是記帳助理，請從使用者提供的內容（文字說明，或是一張收據/發票/帳單照片）中擷取記帳資訊。
使用者已經明確指定這裡面的每一筆都是「${type === "expense" ? "支出" : "收入"}」，不需要也不可以判斷是支出還是收入。
如果是收據、發票或信用卡帳單照片，請把上面每一項有金額的個別交易都拆開，不要合併或只取第一筆；請忽略小計、總計、應繳金額等匯總列，那些不是個別交易。有文字說明時也要一併納入考量。
amount 一律為正數。

日期（date 欄位）規則：
- 如果該筆項目本身有標示日期（例如收據上的交易日期、信用卡帳單裡每一列前面的日期欄位），請把它換算成 YYYY-MM-DD 格式填入 date。
- 如果日期沒有年份（例如「08/17」「9/2」），請用 ${referenceYear} 年組合；但如果組合後的日期會晚於參考日期 ${dateParam}，代表這筆其實是去年的，請改用 ${Number(referenceYear) - 1} 年。
- 如果完全看不出這筆項目自己的日期，date 欄位請填 null（會自動使用使用者選擇的日期）。

每一筆都必須從下面的分類架構中，選出一個 group 與對應的 subCategory（subCategory 一定要屬於該 group 底下列出的項目，不可以自創）：
${taxonomyDescription(type!)}

item 請用簡短文字描述該筆項目內容。`;

  const response = await openai.responses.parse({
    model: "gpt-4o-mini",
    instructions,
    input: imageBase64
      ? [
          {
            role: "user" as const,
            content: [
              {
                type: "input_text" as const,
                text: text || "請直接讀取這張收據照片並擷取記帳資訊。",
              },
              {
                type: "input_image" as const,
                image_url: imageBase64,
                detail: "auto" as const,
              },
            ],
          },
        ]
      : text,
    text: { format: zodTextFormat(TransactionAnalysis, "transaction_analysis") },
  });

  const analysis = response.output_parsed as {
    transactions: {
      group: AccountingGroup;
      subCategory: string;
      amount: number;
      item: string;
      date: string | null;
    }[];
  } | null;

  if (!analysis) {
    return NextResponse.json({ error: "AI 分析失敗，請重新輸入" }, { status: 502 });
  }

  if (analysis.transactions.length === 0) {
    return autoMode
      ? NextResponse.json({ transactions: [] })
      : NextResponse.json({ error: "AI 分析失敗，請重新輸入" }, { status: 502 });
  }

  const ITEM_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  return NextResponse.json({
    transactions: analysis.transactions.map((t) => ({
      type: autoMode ? groupType(t.group) : type!,
      group: t.group,
      subCategory: t.subCategory,
      amount: t.amount,
      item: t.item,
      date: t.date && ITEM_DATE_PATTERN.test(t.date) ? t.date : dateParam,
    })),
  });
}
