const secondTicks = 1000;
const minuteTicks = secondTicks * 60;
const hourTicks = minuteTicks * 60;
const dayTicks = hourTicks * 24;

export function addTime(date: Date, days: number = 0, hours: number = 0, minutes: number = 0, seconds: number = 0): Date {
  return new Date(date.valueOf() + (days * dayTicks) + (hours * hourTicks) + (minutes * minuteTicks) + (seconds * secondTicks));
}

export function subtractTime(date: Date, days: number = 0, hours: number = 0, minutes: number = 0, seconds: number = 0): Date {
  return addTime(date, -days, -hours, -minutes, -seconds);
}