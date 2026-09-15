import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { getLifeLogModels } from "@/lib/mongoose-lifelog";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range");

  let start: Date;
  let end: Date;
  let period: string;

  if (range === "day") {
    const dateParam = searchParams.get("date");
    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json(
        { error: "date 參數格式須為 YYYY-MM-DD" },
        { status: 400 }
      );
    }
    start = new Date(`${dateParam}T00:00:00.000Z`);
    end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    period = dateParam;
  } else if (range === "month") {
    const monthParam = searchParams.get("month");
    if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
      return NextResponse.json(
        { error: "month 參數格式須為 YYYY-MM" },
        { status: 400 }
      );
    }
    const [y, m] = monthParam.split("-").map(Number);
    start = new Date(Date.UTC(y, m - 1, 1));
    end = new Date(Date.UTC(y, m, 1));
    period = monthParam;
  } else if (range === "year") {
    const yearParam = searchParams.get("year");
    if (!yearParam || !/^\d{4}$/.test(yearParam)) {
      return NextResponse.json(
        { error: "year 參數格式須為 YYYY" },
        { status: 400 }
      );
    }
    const y = Number(yearParam);
    start = new Date(Date.UTC(y, 0, 1));
    end = new Date(Date.UTC(y + 1, 0, 1));
    period = yearParam;
  } else {
    return NextResponse.json(
      { error: "range 參數須為 day、month 或 year" },
      { status: 400 }
    );
  }

  const { Entry } = await getLifeLogModels();

  const rows = await Entry.aggregate<{
    _id: {
      categoryId: Types.ObjectId;
      categoryName: string;
      categoryIcon: string;
    };
    minutes: number;
  }>([
    {
      $match: {
        userId: new Types.ObjectId(session.userId),
        date: { $gte: start, $lt: end },
      },
    },
    {
      $group: {
        _id: {
          categoryId: "$categoryId",
          categoryName: "$categoryName",
          categoryIcon: "$categoryIcon",
        },
        minutes: { $sum: "$minutes" },
      },
    },
    { $sort: { minutes: -1 } },
  ]);

  const categories = rows.map((row) => ({
    categoryId: String(row._id.categoryId),
    name: row._id.categoryName,
    icon: row._id.categoryIcon,
    minutes: row.minutes,
    hours: Math.round((row.minutes / 60) * 10) / 10,
  }));

  const totalMinutes = categories.reduce((sum, c) => sum + c.minutes, 0);

  return NextResponse.json({
    range,
    period,
    categories,
    totalMinutes,
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
  });
}
