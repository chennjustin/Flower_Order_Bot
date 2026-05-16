export function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function taipeiPartsFromInstant(d: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = f.formatToParts(d);
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = Number(p.value);
  }
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
    second: map.second,
  };
}

export function startOfTodayTaipeiSql(): string {
  const map = taipeiPartsFromInstant(new Date());
  return `${map.year}-${pad(map.month)}-${pad(map.day)} 00:00:00`;
}

export function startOfMonthTaipeiSql(): string {
  const map = taipeiPartsFromInstant(new Date());
  return `${map.year}-${pad(map.month)}-01 00:00:00`;
}
