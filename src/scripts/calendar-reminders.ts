interface CalendarReminderEvent {
  id: string;
  title: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  location: string;
  reminders: number[];
  reminderMethods: ReminderMethod[];
  reminderFrequency: ReminderFrequency;
  recurrence: string;
  priority: string;
}

type ReminderMethod = 'meow' | 'browser' | 'inapp';
type ReminderFrequency = 'once' | 'every-5' | 'every-15' | 'hourly';

interface ReminderSentState {
  sentAt: number;
}

declare global {
  interface Window {
    __moonSunCalendarReminders?: {
      checkNow: () => Promise<void>;
    };
    __meownoteToast?: {
      show: (message: string, type?: string, duration?: number) => void;
    };
  }
}

const STORAGE_KEY = 'meownote_calendar_events';
const CHECKED_KEY = 'meownote_reminder_checked';
const MEOW_API_URL = 'https://api.chuckfang.com/5bf48882';

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readEvents(): CalendarReminderEvent[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const events = stored ? JSON.parse(stored) : [];
    return Array.isArray(events) ? events : [];
  } catch {
    return [];
  }
}

function readChecked(): Record<string, ReminderSentState> {
  try {
    const stored = localStorage.getItem(CHECKED_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function writeChecked(checked: Record<string, ReminderSentState>): void {
  localStorage.setItem(CHECKED_KEY, JSON.stringify(checked));
}

function formatFrequency(frequency: ReminderFrequency): string {
  const labels: Record<ReminderFrequency, string> = {
    once: 'Once per reminder',
    'every-5': 'Every 5 minutes until start',
    'every-15': 'Every 15 minutes until start',
    hourly: 'Hourly until start'
  };
  return labels[frequency] || labels.once;
}

function getFrequencyMinutes(frequency: ReminderFrequency): number {
  const intervals: Record<ReminderFrequency, number> = {
    once: 0,
    'every-5': 5,
    'every-15': 15,
    hourly: 60
  };
  return intervals[frequency] || 0;
}

function formatReminderOffset(minutes: number): string {
  if (minutes >= 1440) return `in ${minutes / 1440} day(s)`;
  if (minutes >= 60) return `in ${minutes / 60} hour(s)`;
  return `in ${minutes} minute(s)`;
}

function eventOccursOnDate(event: CalendarReminderEvent, dateStr: string): boolean {
  const targetDate = new Date(`${dateStr}T00:00`);
  const eventStart = new Date(`${event.startDate}T00:00`);
  const eventEnd = new Date(`${event.endDate || event.startDate}T00:00`);

  if (event.recurrence === 'none') {
    return targetDate >= eventStart && targetDate <= eventEnd;
  }

  if (targetDate < eventStart) return false;

  switch (event.recurrence) {
    case 'daily':
      return true;
    case 'weekly': {
      const diffDays = Math.floor((targetDate.getTime() - eventStart.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays % 7 === 0;
    }
    case 'biweekly': {
      const diffDays = Math.floor((targetDate.getTime() - eventStart.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays % 14 === 0;
    }
    case 'monthly':
      return eventStart.getDate() === targetDate.getDate();
    case 'yearly':
      return eventStart.getMonth() === targetDate.getMonth() && eventStart.getDate() === targetDate.getDate();
    default:
      return dateStr === event.startDate;
  }
}

function getNextOccurrence(event: CalendarReminderEvent, now: Date): Date | null {
  if (event.recurrence === 'none') {
    return new Date(`${event.startDate}T${event.startTime}`);
  }

  const searchDate = new Date(now);
  searchDate.setHours(0, 0, 0, 0);

  for (let offset = 0; offset <= 370; offset += 1) {
    const candidate = new Date(searchDate);
    candidate.setDate(searchDate.getDate() + offset);
    const candidateStr = formatDate(candidate);
    if (!eventOccursOnDate(event, candidateStr)) continue;

    const occurrence = new Date(`${candidateStr}T${event.startTime}`);
    if (occurrence >= now) return occurrence;
  }

  return null;
}

async function sendMeowNotification(event: CalendarReminderEvent, reminderMinutes: number): Promise<void> {
  let reminderText: string;
  if (reminderMinutes >= 1440) {
    reminderText = `${reminderMinutes / 1440} day(s)`;
  } else if (reminderMinutes >= 60) {
    reminderText = `${reminderMinutes / 60} hour(s)`;
  } else {
    reminderText = `${reminderMinutes} minute(s)`;
  }

  const start = new Date(`${event.startDate}T${event.startTime}`);
  const end = new Date(`${event.endDate}T${event.endTime}`);
  const payload = {
    title: 'MoonSun.ai Calendar Reminder',
    msg: `Event: ${event.title}\nTime: ${start.toLocaleString()} - ${end.toLocaleTimeString()}\nLocation: ${event.location || 'N/A'}\nReminder: ${reminderText} before\nPriority: ${event.priority}\nFrequency: ${formatFrequency(event.reminderFrequency)}`,
    type: 'calendar_reminder'
  };

  const response = await fetch(MEOW_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => null) as { data?: boolean; msg?: string } | null;
  if (!response.ok || result?.data !== true) {
    throw new Error(result?.msg || 'Meow notification failed');
  }
  window.dispatchEvent(new CustomEvent('meow:notification', { detail: payload }));
}

async function deliverReminderMethod(event: CalendarReminderEvent, reminderMinutes: number, method: ReminderMethod): Promise<void> {
  if (method === 'inapp') {
    window.__meownoteToast?.show?.(
      `Reminder: ${event.title} starts ${formatReminderOffset(reminderMinutes)}`,
      event.priority === 'high' ? 'warning' : 'info',
      6000
    );
    return;
  }

  if (method === 'browser') {
    if (!('Notification' in window)) throw new Error('Browser notifications unavailable');
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    if (Notification.permission !== 'granted') {
      throw new Error('Browser notifications not allowed');
    }
    new Notification('MoonSun.ai Calendar Reminder', {
      body: `${event.title} starts ${formatReminderOffset(reminderMinutes)}`,
      tag: `${event.id}-${reminderMinutes}`
    });
    return;
  }

  await sendMeowNotification(event, reminderMinutes);
}

async function checkCalendarReminders(): Promise<void> {
  const now = new Date();
  const events = readEvents();
  const checked = readChecked();

  for (const event of events) {
    if (!event.reminders?.length || !event.reminderMethods?.length) continue;

    const occurrence = getNextOccurrence(event, now);
    if (!occurrence) continue;

    const minutesUntilEvent = (occurrence.getTime() - now.getTime()) / (1000 * 60);
    const occurrenceKey = formatDate(occurrence);
    const repeatAnchor = Math.min(...event.reminders);

    for (const minutes of event.reminders) {
      if (minutesUntilEvent > minutes || minutesUntilEvent < 0) continue;

      const frequencyMinutes = getFrequencyMinutes(event.reminderFrequency);
      const canRepeat = frequencyMinutes > 0 && minutes === repeatAnchor;

      for (const method of event.reminderMethods) {
        const reminderKey = `${event.id}_${occurrenceKey}_${minutes}_${method}`;
        const sentState = checked[reminderKey];
        const lastSentAt = typeof sentState?.sentAt === 'number' ? sentState.sentAt : 0;
        const intervalElapsed = lastSentAt
          ? now.getTime() - lastSentAt >= frequencyMinutes * 60 * 1000
          : true;

        if (lastSentAt && (!canRepeat || !intervalElapsed)) continue;

        try {
          await deliverReminderMethod(event, minutes, method);
          checked[reminderKey] = { sentAt: now.getTime() };
          writeChecked(checked);
        } catch (error) {
          console.error(`[Calendar] ${method} reminder failed:`, error);
        }
      }
    }
  }
}

function initCalendarReminderRunner(): void {
  if (window.__moonSunCalendarReminders) return;

  let running = false;
  const checkNow = async () => {
    if (running) return;
    running = true;
    try {
      await checkCalendarReminders();
    } finally {
      running = false;
    }
  };

  window.__moonSunCalendarReminders = { checkNow };
  window.setInterval(checkNow, 60 * 1000);
  window.addEventListener('focus', checkNow);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkNow();
  });
  checkNow();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCalendarReminderRunner, { once: true });
} else {
  initCalendarReminderRunner();
}

export {};
