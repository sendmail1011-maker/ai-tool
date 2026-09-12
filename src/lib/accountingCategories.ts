export const ACCOUNTING_TAXONOMY = {
  變動支出: ["餐飲伙食", "休閒娛樂", "交通通勤", "日常用品", "治裝美容"],
  固定支出: ["居住水電", "網路通訊", "人情投資", "保險醫療", "汽機車稅"],
  收入與資產: ["主動收入", "被動收入", "儲蓄投資"],
} as const;

export type AccountingGroup = keyof typeof ACCOUNTING_TAXONOMY;

export const ACCOUNTING_GROUPS = Object.keys(
  ACCOUNTING_TAXONOMY
) as AccountingGroup[];

export function groupType(group: AccountingGroup): "expense" | "income" {
  return group === "收入與資產" ? "income" : "expense";
}

export function groupsForType(type: "expense" | "income"): AccountingGroup[] {
  return ACCOUNTING_GROUPS.filter((group) => groupType(group) === type);
}

export const SUBCATEGORY_ICONS: Record<string, string> = {
  餐飲伙食: "🍜",
  休閒娛樂: "🎬",
  交通通勤: "🚗",
  日常用品: "🧴",
  治裝美容: "👗",
  居住水電: "🏠",
  網路通訊: "📶",
  人情投資: "🎁",
  保險醫療: "💊",
  汽機車稅: "🚙",
  主動收入: "💼",
  被動收入: "📈",
  儲蓄投資: "🏦",
};

export function subCategoryIcon(subCategory: string) {
  return SUBCATEGORY_ICONS[subCategory] ?? "💳";
}
