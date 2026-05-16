import { pad, taipeiPartsFromInstant } from "./timeParts.js";

export function nowTaipeiNaiveSql(): string {
  const { year, month, day, hour, minute, second } = taipeiPartsFromInstant(new Date());
  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

export function formatTaipeiNaiveSql(d: Date): string {
  const { year, month, day, hour, minute, second } = taipeiPartsFromInstant(d);
  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

export function toTaipeiAwareIsoFromNaiveSql(sqlStr: string): string {
  const normalized = sqlStr.replace("T", " ").replace("Z", "");
  const [datePart, timePartRaw = "00:00:00"] = normalized.split(/[ T]/);
  const [y, m, d] = datePart.split("-").map(Number);
  const timePart = timePartRaw.split(".")[0];
  const [hh, mm, ss] = timePart.split(":").map(Number);
  return `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}:${pad(ss)}+08:00`;
}

export function weekdayEnglishFromNaiveSql(sqlStr: string): string {
  const iso = toTaipeiAwareIsoFromNaiveSql(sqlStr);
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "Asia/Taipei" }).format(d);
}

export function incomingIsoToTaipeiNaiveSql(dt: Date): string {
  return formatTaipeiNaiveSql(dt);
}
