interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  location: string;
  category: string;
  reminders: number[];
  reminderMethods: ReminderMethod[];
  reminderFrequency: ReminderFrequency;
  recurrence: string;
  priority: string;
  createdAt: number;
}

type ReminderMethod = 'meow' | 'browser' | 'inapp';
type ReminderFrequency = 'once' | 'every-5' | 'every-15' | 'hourly';

interface ToastOptions {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

interface ReminderSentState {
  sentAt: number;
}

declare global {
  interface Window {
    __maxwellCalendarReminders?: {
      checkNow: () => Promise<void>;
    };
  }
}

const STORAGE_KEY = 'meownote_calendar_events';
const SYNC_STATUS_KEY = 'meownote_calendar_sync_status';
const API_BASE = 'https://api.ustc.dev';
const TOKEN_KEY = 'meownote_auth_token';
const MEOW_API_URL = 'https://api.chuckfang.com/5bf48882';

const categoryColors: Record<string, string> = {
  work: '#D97757',
  personal: '#b0c4b7',
  health: '#7d9a88',
  meeting: '#c2b7a8',
  reminder: '#d4927c',
  other: '#d8b070'
};

const categoryNames: Record<string, string> = {
  work: 'Work',
  personal: 'Personal',
  health: 'Health',
  meeting: 'Meeting',
  reminder: 'Reminder',
  other: 'Other'
};

export class CalendarApp {
  private currentView: 'month' | 'week' | 'day' = 'month';
  private currentDate: Date = new Date();
  private events: CalendarEvent[] = [];
  private selectedEventId: string | null = null;
  private deleteEventId: string | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    this.ensureRuntimeStyles();
    this.events = this.loadEvents();
    this.renderCalendar();
    this.initEventListeners();
    this.loadCloudEvents();
    window.__maxwellCalendarReminders?.checkNow?.();
  }

  private ensureRuntimeStyles(): void {
    if (document.getElementById('calendar-runtime-style')) return;

    const style = document.createElement('style');
    style.id = 'calendar-runtime-style';
    style.textContent = `
      .month-grid { display: flex !important; flex-direction: column !important; height: 100% !important; }
      .weekday-header,
      .month-days-grid { display: grid !important; grid-template-columns: repeat(7, minmax(0, 1fr)) !important; }
      .weekday-header { background: var(--bg-secondary); border-bottom: 1px solid var(--border-secondary); }
      .weekday-label { padding: 0.75rem 0.5rem; text-align: center; font-size: var(--text-xs); font-weight: var(--font-semibold); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; }
      .month-days-grid { min-height: 560px; }
      .day-cell { min-height: 92px; padding: 0.5rem; border-right: 1px solid var(--border-secondary); border-bottom: 1px solid var(--border-secondary); cursor: pointer; transition: background var(--duration-fast) var(--ease-default); }
      .day-cell:nth-child(7n) { border-right: none; }
      .day-cell:hover { background: var(--bg-secondary); }
      .day-cell.other-month { opacity: 0.42; }
      .day-cell.today { background: var(--color-primary-subtle); }
      .day-number { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; margin-bottom: 0.25rem; font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--text-secondary); }
      .day-cell.today .day-number { background: var(--color-primary); color: #fff; border-radius: 50%; }
      .event-chip { display: flex; align-items: center; gap: 0.25rem; min-width: 0; padding: 3px 6px; margin-bottom: 2px; border-radius: var(--radius-sm); font-size: 11px; font-weight: var(--font-medium); color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; transition: transform var(--duration-fast) var(--ease-default); }
      .event-chip:hover { transform: translateX(2px); }
      .event-chip-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
      .more-events { font-size: 11px; color: var(--text-tertiary); padding: 2px 4px; font-weight: var(--font-medium); }
      .category-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; border-radius: var(--radius-md); }
      .category-dot { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto; }
      .category-name { flex: 1; font-size: var(--text-sm); color: var(--text-primary); }
      .category-count { font-size: var(--text-xs); color: var(--text-tertiary); background: var(--bg-tertiary); padding: 2px 8px; border-radius: var(--radius-full); }
      .week-header,
      .week-time-row { display: grid !important; grid-template-columns: 60px repeat(7, minmax(0, 1fr)) !important; }
      .day-time-row { display: grid !important; grid-template-columns: 80px minmax(0, 1fr) !important; }
      @media (max-width: 768px) {
        .calendar-grid-container { overflow-x: auto; }
        .month-grid { min-width: 680px; }
        .day-cell { min-height: 78px; }
      }
    `;
    document.head.appendChild(style);
  }

  private loadEvents(): CalendarEvent[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const events = stored ? JSON.parse(stored) : [];
      return Array.isArray(events) ? events.map(event => this.normalizeEvent(event)) : [];
    } catch {
      return [];
    }
  }

  private normalizeEvent(event: Partial<CalendarEvent>): CalendarEvent {
    return {
      id: event.id || this.generateId(),
      title: event.title || 'Untitled event',
      description: event.description || '',
      startDate: event.startDate || this.formatDate(new Date()),
      startTime: event.startTime || '09:00',
      endDate: event.endDate || event.startDate || this.formatDate(new Date()),
      endTime: event.endTime || '10:00',
      location: event.location || '',
      category: event.category || 'other',
      reminders: Array.isArray(event.reminders) ? event.reminders.map(Number).filter(Number.isFinite) : [],
      reminderMethods: Array.isArray(event.reminderMethods) && event.reminderMethods.length > 0
        ? event.reminderMethods.filter(method => ['meow', 'browser', 'inapp'].includes(method)) as ReminderMethod[]
        : ['meow', 'inapp'],
      reminderFrequency: event.reminderFrequency || 'once',
      recurrence: event.recurrence || 'none',
      priority: event.priority || 'low',
      createdAt: event.createdAt || Date.now()
    };
  }

  private getAuthToken(): string | null {
    const token = localStorage.getItem(TOKEN_KEY) || localStorage.getItem('auth_token');
    if (!token) return null;
    try {
      return decodeURIComponent(atob(token));
    } catch {
      return token;
    }
  }

  private getAuthHeaders(): HeadersInit {
    const token = this.getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private updateSyncStatus(message: string): void {
    localStorage.setItem(SYNC_STATUS_KEY, message);
    const el = document.getElementById('calendarStorageStatus');
    if (el) el.textContent = message;
  }

  private async loadCloudEvents(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/api/calendar/events`, {
        headers: this.getAuthHeaders(),
        cache: 'no-store'
      });
      const result = await response.json().catch(() => null) as { success?: boolean; data?: unknown } | null;
      if (!response.ok || !result?.success || !Array.isArray(result.data)) {
        throw new Error('Cloud calendar unavailable');
      }

      this.events = result.data.map(event => this.normalizeEvent(event as Partial<CalendarEvent>));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.events));
      this.updateSyncStatus('Synced to your Maxwell.Science account');
      this.renderCalendar();
    } catch (error) {
      console.warn('[Calendar] Cloud load failed, using local cache:', error);
      this.updateSyncStatus('Saved on this device; cloud sync unavailable');
    }
  }

  private saveEvents(eventsToSave: CalendarEvent[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(eventsToSave));
    this.syncCloudEvents(eventsToSave);
  }

  private async syncCloudEvents(eventsToSave: CalendarEvent[]): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/api/calendar/events`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        },
        body: JSON.stringify({ events: eventsToSave })
      });
      const result = await response.json().catch(() => null) as { success?: boolean; message?: string } | null;
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Cloud calendar save failed');
      }
      this.updateSyncStatus('Synced to your Maxwell.Science account');
    } catch (error) {
      console.error('[Calendar] Cloud save failed:', error);
      this.updateSyncStatus('Saved locally; cloud sync failed');
    }
  }

  private showToast(options: ToastOptions): void {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${options.type}`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
      <span class="toast-message">${this.escapeHtml(options.message)}</span>
      <button class="toast-close" aria-label="Close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;

    if (!document.getElementById('toast-dynamic-style')) {
      const style = document.createElement('style');
      style.id = 'toast-dynamic-style';
      style.textContent = `
        .toast {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 600;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: var(--card-bg, #fff);
          border: 1px solid var(--card-border, #e4dccf);
          border-radius: 14px;
          box-shadow: 0 24px 52px rgba(23,20,18,0.1);
          animation: toastSlideIn 0.3s ease-out;
          max-width: calc(100vw - 32px);
        }
        .toast-success { border-left: 3px solid #10B981; }
        .toast-error { border-left: 3px solid #EF4444; }
        .toast-info { border-left: 3px solid #3B82F6; }
        .toast-warning { border-left: 3px solid #F59E0B; }
        .toast-message { font-size: 14px; font-weight: 500; color: var(--text-primary, #1a1a1a); }
        .toast-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 12px;
          background: transparent;
          color: var(--text-tertiary, #8e877f);
          cursor: pointer;
        }
        .toast-close:hover { background: var(--bg-secondary, #f3eee6); }
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes toastSlideOut {
          from { opacity: 1; transform: translateX(-50%) translateY(0); }
          to { opacity: 0; transform: translateX(-50%) translateY(16px); }
        }
      `;
      document.head.appendChild(style);
    }

    container.appendChild(toast);
    const duration = options.duration || 3000;
    const timeoutId = setTimeout(() => this.dismissToast(toast), duration);

    toast.querySelector('.toast-close')?.addEventListener('click', () => {
      clearTimeout(timeoutId);
      this.dismissToast(toast);
    });
  }

  private dismissToast(el: HTMLElement): void {
    el.style.animation = 'toastSlideOut 0.25s ease forwards';
    setTimeout(() => el.remove(), 250);
  }

  private async sendMeowNotification(event: CalendarEvent, reminderMinutes: number): Promise<void> {
    try {
      let reminderText: string;
      if (reminderMinutes >= 1440) {
        reminderText = `${reminderMinutes / 1440} day(s)`;
      } else if (reminderMinutes >= 60) {
        reminderText = `${reminderMinutes / 60} hour(s)`;
      } else {
        reminderText = `${reminderMinutes} minute(s)`;
      }

      const payload = {
        title: 'Maxwell.Science Calendar Reminder',
        msg: `Event: ${event.title}\nTime: ${this.formatEventTime(event)}\nLocation: ${event.location || 'N/A'}\nReminder: ${reminderText} before\nPriority: ${event.priority}\nFrequency: ${this.formatFrequency(event.reminderFrequency)}`,
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

      this.updateMeowStatus(`Sent "${event.title}" through meow`);
      window.dispatchEvent(new CustomEvent('meow:notification', { detail: payload }));
      console.log(`[Meow] Reminder sent for "${event.title}" (${reminderText} before)`);
    } catch (error) {
      this.updateMeowStatus('Meow delivery failed');
      console.error('[Meow] Failed to send notification:', error);
      throw error;
    }
  }

  private updateMeowStatus(message: string): void {
    const status = document.getElementById('meowStatus');
    if (status) {
      status.innerHTML = `<span class="meow-status-dot"></span>${this.escapeHtml(message)}`;
    }
  }

  private formatFrequency(frequency: ReminderFrequency): string {
    const labels: Record<ReminderFrequency, string> = {
      once: 'Once per reminder',
      'every-5': 'Every 5 minutes until start',
      'every-15': 'Every 15 minutes until start',
      hourly: 'Hourly until start'
    };
    return labels[frequency] || labels.once;
  }

  private getFrequencyMinutes(frequency: ReminderFrequency): number {
    const intervals: Record<ReminderFrequency, number> = {
      once: 0,
      'every-5': 5,
      'every-15': 15,
      hourly: 60
    };
    return intervals[frequency] || 0;
  }

  private async deliverReminder(event: CalendarEvent, reminderMinutes: number): Promise<void> {
    if (event.reminderMethods.includes('inapp')) {
      this.showToast({
        message: `Reminder: ${event.title} starts ${this.formatReminderOffset(reminderMinutes)}`,
        type: event.priority === 'high' ? 'warning' : 'info',
        duration: 6000
      });
    }

    if (event.reminderMethods.includes('browser') && 'Notification' in window) {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      if (Notification.permission === 'granted') {
        new Notification('Maxwell.Science Calendar Reminder', {
          body: `${event.title} starts ${this.formatReminderOffset(reminderMinutes)}`,
          tag: `${event.id}-${reminderMinutes}`
        });
      } else {
        throw new Error('Browser notifications not allowed');
      }
    }

    if (event.reminderMethods.includes('meow')) {
      await this.sendMeowNotification(event, reminderMinutes);
    }
  }

  private formatReminderOffset(minutes: number): string {
    if (minutes >= 1440) return `in ${minutes / 1440} day(s)`;
    if (minutes >= 60) return `in ${minutes / 60} hour(s)`;
    return `in ${minutes} minute(s)`;
  }

  private normalizeTimeInput(value: string): string | null {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{1,2}):(\d{1,2})$/);
    if (!match) return null;

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  private formatEventTime(event: CalendarEvent): string {
    const start = new Date(`${event.startDate}T${event.startTime}`);
    const end = new Date(`${event.endDate}T${event.endTime}`);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  }

  private async checkReminders(): Promise<void> {
    const now = new Date();
    const checkedKey = 'meownote_reminder_checked';
    let checked: Record<string, ReminderSentState> = {};
    try {
      const stored = localStorage.getItem(checkedKey);
      checked = stored ? JSON.parse(stored) : {};
    } catch {}

    for (const event of this.events) {
      if (!event.reminders || event.reminders.length === 0) continue;

      const eventStart = this.getNextReminderOccurrence(event, now);
      if (!eventStart) continue;
      const minutesUntilEvent = (eventStart.getTime() - now.getTime()) / (1000 * 60);
      const occurrenceKey = this.formatDate(eventStart);
      const repeatAnchor = Math.min(...event.reminders);

      for (const minutes of event.reminders) {
        const reminderKey = `${event.id}_${occurrenceKey}_${minutes}`;
        const sentState = checked[reminderKey];
        const lastSentAt = typeof sentState?.sentAt === 'number' ? sentState.sentAt : 0;
        const frequencyMinutes = this.getFrequencyMinutes(event.reminderFrequency);
        const canRepeat = frequencyMinutes > 0 && minutes === repeatAnchor;
        const intervalElapsed = lastSentAt
          ? now.getTime() - lastSentAt >= frequencyMinutes * 60 * 1000
          : true;
        
        if (minutesUntilEvent <= minutes && minutesUntilEvent >= 0) {
          if (!lastSentAt || (canRepeat && intervalElapsed)) {
            try {
              await this.deliverReminder(event, minutes);
              checked[reminderKey] = { sentAt: now.getTime() };
              localStorage.setItem(checkedKey, JSON.stringify(checked));
            } catch (error) {
              console.error('[Calendar] Reminder delivery failed:', error);
            }
          }
        }
      }
    }

    localStorage.setItem(checkedKey, JSON.stringify(checked));
  }

  private getNextReminderOccurrence(event: CalendarEvent, now: Date): Date | null {
    if (event.recurrence === 'none') {
      return new Date(`${event.startDate}T${event.startTime}`);
    }

    const startDate = new Date(`${event.startDate}T00:00`);
    const searchDate = new Date(now);
    searchDate.setHours(0, 0, 0, 0);

    for (let offset = 0; offset <= 370; offset += 1) {
      const candidate = new Date(searchDate);
      candidate.setDate(searchDate.getDate() + offset);
      if (candidate < startDate) continue;
      const candidateStr = this.formatDate(candidate);
      if (!this.getEventsForDate(candidateStr).some(item => item.id === event.id)) continue;

      const occurrence = new Date(`${candidateStr}T${event.startTime}`);
      if (occurrence >= now) return occurrence;
    }

    return null;
  }

  private generateId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  private getFirstDayOfMonth(year: number, month: number): number {
    return new Date(year, month, 1).getDay();
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private isToday(date: Date): boolean {
    const today = new Date();
    return this.formatDate(date) === this.formatDate(today);
  }

  private getEventsForDate(dateStr: string): CalendarEvent[] {
    return this.events.filter(event => {
      if (event.recurrence === 'none') {
        const targetDate = new Date(`${dateStr}T00:00`);
        const eventStart = new Date(`${event.startDate}T00:00`);
        const eventEnd = new Date(`${event.endDate || event.startDate}T00:00`);
        return targetDate >= eventStart && targetDate <= eventEnd;
      }
      
      const eventStart = new Date(event.startDate);
      const targetDate = new Date(dateStr);
      
      if (targetDate < eventStart) return false;

      switch (event.recurrence) {
        case 'daily': return true;
        case 'weekly': {
          const diffDays = Math.floor((targetDate.getTime() - eventStart.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays % 7 === 0;
        }
        case 'biweekly': {
          const diffDays = Math.floor((targetDate.getTime() - eventStart.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays % 14 === 0;
        }
        case 'monthly': return eventStart.getDate() === targetDate.getDate();
        case 'yearly': return eventStart.getMonth() === targetDate.getMonth() && eventStart.getDate() === targetDate.getDate();
        default: return event.startDate === dateStr;
      }
    });
  }

  private getTimeMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return (hours * 60) + minutes;
  }

  private getEventSegmentForDate(event: CalendarEvent, dateStr: string): { start: string; end: string } {
    const eventStartDate = event.recurrence === 'none' ? event.startDate : dateStr;
    const eventEndDate = event.recurrence === 'none' ? event.endDate : dateStr;
    const start = dateStr === eventStartDate ? event.startTime : '00:00';
    const end = dateStr === eventEndDate ? event.endTime : '23:59';
    return { start, end };
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private renderCalendar(): void {
    switch (this.currentView) {
      case 'month': this.renderMonthView(); break;
      case 'week': this.renderWeekView(); break;
      case 'day': this.renderDayView(); break;
    }
    this.renderUpcomingEvents();
    this.renderCategories();
  }

  private renderMonthView(): void {
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const daysInMonth = this.getDaysInMonth(year, month);
    const firstDay = this.getFirstDayOfMonth(year, month);
    const prevMonthDays = this.getDaysInMonth(year, month - 1);

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const periodTitle = document.getElementById('periodTitle');
    if (periodTitle) {
      periodTitle.textContent = `${monthNames[month]} ${year}`;
    }

    let html = '<div class="month-grid">';
    
    html += '<div class="weekday-header">';
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
      html += `<div class="weekday-label">${day}</div>`;
    });
    html += '</div>';

    html += '<div class="month-days-grid">';

    for (let i = 0; i < firstDay; i++) {
      const dayNum = prevMonthDays - firstDay + i + 1;
      html += `<div class="day-cell other-month"><span class="day-number">${dayNum}</span></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = this.formatDate(date);
      const dayEvents = this.getEventsForDate(dateStr);
      const todayClass = this.isToday(date) ? ' today' : '';
      const hasReminders = dayEvents.some(e => e.reminders && e.reminders.length > 0);

      html += `<div class="day-cell${todayClass}" data-date="${dateStr}" tabindex="0" role="button" aria-label="${monthNames[month]} ${day}, ${year}">`;
      html += `<span class="day-number">${day}</span>`;
      
      if (hasReminders) {
        html += '<span class="reminder-indicator" aria-label="Has reminders"></span>';
      }

      dayEvents.slice(0, 3).forEach(event => {
        const color = categoryColors[event.category] || categoryColors.other;
        const hasReminder = event.reminders && event.reminders.length > 0;
        html += `<div class="event-chip" data-event-id="${event.id}" style="background: ${color}20; border-left: 2px solid ${color}">`;
        html += `<span class="event-chip-title">${this.escapeHtml(event.title)}</span>`;
        if (hasReminder) {
          html += '<span class="event-chip-reminder" aria-label="Has reminder"></span>';
        }
        html += '</div>';
      });

      if (dayEvents.length > 3) {
        html += `<div class="more-events">+${dayEvents.length - 3} more</div>`;
      }

      html += '</div>';
    }

    const totalCells = firstDay + daysInMonth;
    const remainingCells = 7 - (totalCells % 7);
    if (remainingCells < 7) {
      for (let i = 1; i <= remainingCells; i++) {
        html += `<div class="day-cell other-month"><span class="day-number">${i}</span></div>`;
      }
    }

    html += '</div></div>';
    grid.innerHTML = html;

    grid.querySelectorAll('.day-cell:not(.other-month)').forEach(cell => {
      cell.addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement;
        const eventChip = target.closest('.event-chip');
        if (eventChip) {
          const eventId = eventChip.getAttribute('data-event-id');
          if (eventId) this.showEventDetail(eventId);
          return;
        }
        const dateStr = cell.getAttribute('data-date');
        if (dateStr) {
          this.openNewEventModal(dateStr);
        }
      });

      (cell as Element).addEventListener('keydown', (e: Event) => {
        const ke = e as KeyboardEvent;
        if (ke.key === 'Enter' || ke.key === ' ') {
          ke.preventDefault();
          (cell as HTMLElement).click();
        }
      });
    });
  }

  private renderWeekView(): void {
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;

    const startOfWeek = new Date(this.currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const periodTitle = document.getElementById('periodTitle');
    if (periodTitle) {
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      periodTitle.textContent = `${monthNames[startOfWeek.getMonth()]} ${startOfWeek.getDate()} - ${monthNames[endOfWeek.getMonth()]} ${endOfWeek.getDate()}, ${endOfWeek.getFullYear()}`;
    }

    let html = '<div class="week-grid">';
    
    html += '<div class="week-header">';
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const isTodayClass = this.isToday(date) ? ' today' : '';
      html += `<div class="week-day-header${isTodayClass}">`;
      html += `<span class="week-day-name">${dayNames[date.getDay()]}</span>`;
      html += `<span class="week-day-num">${date.getDate()}</span>`;
      html += '</div>';
    }
    html += '</div>';

    html += '<div class="week-time-grid">';
    for (let hour = 0; hour < 24; hour++) {
      html += '<div class="week-time-row">';
      let hourLabel: string;
      if (hour === 0) hourLabel = '12 AM';
      else if (hour < 12) hourLabel = `${hour} AM`;
      else if (hour === 12) hourLabel = '12 PM';
      else hourLabel = `${hour - 12} PM`;
      
      html += `<div class="week-time-label">${hourLabel}</div>`;
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(date.getDate() + i);
        const dateStr = this.formatDate(date);
        const hourEvents = this.getEventsForDate(dateStr).filter(event => {
          const segment = this.getEventSegmentForDate(event, dateStr);
          const eventHour = parseInt(segment.start.split(':')[0]);
          return eventHour === hour;
        });

        html += `<div class="week-time-cell" data-date="${dateStr}" data-hour="${hour}">`;
        hourEvents.forEach(event => {
          const color = categoryColors[event.category] || categoryColors.other;
          const segment = this.getEventSegmentForDate(event, dateStr);
          const startMinutes = this.getTimeMinutes(segment.start);
          const endMinutes = this.getTimeMinutes(segment.end);
          const duration = endMinutes - startMinutes;
          const topOffset = ((startMinutes % 60) / 60) * 100;
          const height = Math.max((Math.max(duration, 15) / 60) * 100, 25);
          const hasReminder = event.reminders && event.reminders.length > 0;

          html += `<div class="week-event" data-event-id="${event.id}" style="background: ${color}25; border-left: 3px solid ${color}; top: ${topOffset}%; height: ${height}%;">`;
          html += `<span class="week-event-title">${this.escapeHtml(event.title)}</span>`;
          if (hasReminder) {
            html += '<span class="week-event-reminder"></span>';
          }
          html += '</div>';
        });
        html += '</div>';
      }
      html += '</div>';
    }
    html += '</div></div>';
    grid.innerHTML = html;

    grid.querySelectorAll('.week-time-cell').forEach(cell => {
      cell.addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement;
        const weekEvent = target.closest('.week-event');
        if (weekEvent) {
          const eventId = weekEvent.getAttribute('data-event-id');
          if (eventId) this.showEventDetail(eventId);
          return;
        }
        const dateStr = cell.getAttribute('data-date');
        const hour = cell.getAttribute('data-hour');
        if (dateStr && hour) {
          this.openNewEventModal(dateStr, `${hour.padStart(2, '0')}:00`);
        }
      });
    });
  }

  private renderDayView(): void {
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;

    const dateStr = this.formatDate(this.currentDate);
    const dayEvents = this.getEventsForDate(dateStr);

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const periodTitle = document.getElementById('periodTitle');
    if (periodTitle) {
      periodTitle.textContent = `${dayNames[this.currentDate.getDay()]}, ${monthNames[this.currentDate.getMonth()]} ${this.currentDate.getDate()}`;
    }

    let html = '<div class="day-grid">';
    
    html += '<div class="day-time-list">';
    for (let hour = 0; hour < 24; hour++) {
      const hourEvents = dayEvents.filter(event => {
        const segment = this.getEventSegmentForDate(event, dateStr);
        const eventHour = parseInt(segment.start.split(':')[0]);
        return eventHour === hour;
      });

      html += '<div class="day-time-row">';
      let hourLabel: string;
      if (hour === 0) hourLabel = '12 AM';
      else if (hour < 12) hourLabel = `${hour} AM`;
      else if (hour === 12) hourLabel = '12 PM';
      else hourLabel = `${hour - 12} PM`;
      
      html += `<div class="day-time-label">${hourLabel}</div>`;
      html += '<div class="day-time-content">';
      
      hourEvents.forEach(event => {
        const color = categoryColors[event.category] || categoryColors.other;
        const hasReminder = event.reminders && event.reminders.length > 0;
        const segment = this.getEventSegmentForDate(event, dateStr);

        html += `<div class="day-event" data-event-id="${event.id}" style="background: ${color}20; border-left: 3px solid ${color};">`;
        html += `<div class="day-event-time">${segment.start} - ${segment.end}</div>`;
        html += `<div class="day-event-title">${this.escapeHtml(event.title)}</div>`;
        if (event.location) {
          html += `<div class="day-event-location">${this.escapeHtml(event.location)}</div>`;
        }
        if (hasReminder) {
          html += '<div class="day-event-reminders">';
          event.reminders.forEach(min => {
            let label: string;
            if (min >= 1440) label = `${min/1440}d`;
            else if (min >= 60) label = `${min/60}h`;
            else label = `${min}m`;
            html += `<span class="reminder-badge">${label}</span>`;
          });
          html += '</div>';
        }
        html += '</div>';
      });

      html += '</div></div>';
    }
    html += '</div></div>';
    grid.innerHTML = html;

    grid.querySelectorAll('.day-event').forEach(eventEl => {
      eventEl.addEventListener('click', () => {
        const eventId = eventEl.getAttribute('data-event-id');
        if (eventId) this.showEventDetail(eventId);
      });
    });

    grid.querySelectorAll('.day-time-content').forEach(cell => {
      cell.addEventListener('dblclick', () => {
        const row = cell.closest('.day-time-row');
        const label = row?.querySelector('.day-time-label');
        const hourText = label?.textContent?.trim() || '9 AM';
        let hour: number;
        if (hourText.includes('AM')) {
          hour = hourText.includes('12') ? 0 : parseInt(hourText);
        } else {
          hour = hourText.includes('12') ? 12 : parseInt(hourText) + 12;
        }
        this.openNewEventModal(dateStr, `${hour.toString().padStart(2, '0')}:00`);
      });
    });
  }

  private renderUpcomingEvents(): void {
    const container = document.getElementById('upcomingList');
    if (!container) return;

    const now = new Date();
    const upcoming = this.events
      .filter(event => new Date(`${event.startDate}T${event.startTime}`) >= now)
      .sort((a, b) => new Date(`${a.startDate}T${a.startTime}`).getTime() - new Date(`${b.startDate}T${b.startTime}`).getTime())
      .slice(0, 10);

    if (upcoming.length === 0) {
      container.innerHTML = '<p class="empty-state">No upcoming events</p>';
      return;
    }

    container.innerHTML = upcoming.map(event => {
      const color = categoryColors[event.category] || categoryColors.other;
      const start = new Date(`${event.startDate}T${event.startTime}`);
      const timeStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + 
                      ' at ' + start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const hasReminder = event.reminders && event.reminders.length > 0;

      return `<div class="upcoming-item" data-event-id="${event.id}">
        <div class="upcoming-item-title" style="border-left: 3px solid ${color}; padding-left: 8px;">
          ${this.escapeHtml(event.title)}
          ${hasReminder ? '<span class="reminder-dot" title="Has reminders"></span>' : ''}
        </div>
        <div class="upcoming-item-time">${timeStr}</div>
      </div>`;
    }).join('');

    container.querySelectorAll('.upcoming-item').forEach(item => {
      item.addEventListener('click', () => {
        const eventId = item.getAttribute('data-event-id');
        if (eventId) this.showEventDetail(eventId);
      });
    });
  }

  private renderCategories(): void {
    const container = document.getElementById('categoryList');
    if (!container) return;

    const counts: Record<string, number> = {};
    this.events.forEach(event => {
      counts[event.category] = (counts[event.category] || 0) + 1;
    });

    container.innerHTML = Object.entries(categoryNames).map(([key, name]) => {
      const color = categoryColors[key];
      const count = counts[key] || 0;
      return `<div class="category-item">
        <span class="category-dot" style="background: ${color}"></span>
        <span class="category-name">${name}</span>
        <span class="category-count">${count}</span>
      </div>`;
    }).join('');
  }

  private openNewEventModal(dateStr?: string, timeStr?: string): void {
    const modal = document.getElementById('eventModal');
    if (!modal) return;

    document.getElementById('modalTitle')!.textContent = 'New Event';
    (document.getElementById('eventId') as HTMLInputElement).value = '';
    (document.getElementById('eventForm') as HTMLFormElement).reset();
    
    const today = this.formatDate(new Date());
    (document.getElementById('eventStartDate') as HTMLInputElement).value = dateStr || today;
    (document.getElementById('eventEndDate') as HTMLInputElement).value = dateStr || today;
    (document.getElementById('eventStartTime') as HTMLInputElement).value = timeStr || '09:00';
    if (timeStr) {
      const startHour = parseInt(timeStr, 10);
      const end = new Date(`${dateStr || today}T${timeStr}`);
      end.setHours(startHour + 1, 0, 0, 0);
      (document.getElementById('eventEndDate') as HTMLInputElement).value = this.formatDate(end);
      (document.getElementById('eventEndTime') as HTMLInputElement).value = `${end.getHours().toString().padStart(2, '0')}:00`;
    } else {
      (document.getElementById('eventEndTime') as HTMLInputElement).value = '10:00';
    }

    document.getElementById('remindersContainer')!.innerHTML = `
      <div class="reminder-item">
        <select class="form-input reminder-time">
          <option value="5">5 minutes before</option>
          <option value="15" selected>15 minutes before</option>
          <option value="30">30 minutes before</option>
          <option value="60">1 hour before</option>
          <option value="120">2 hours before</option>
          <option value="1440">1 day before</option>
        </select>
        <button type="button" class="btn-remove-reminder" aria-label="Remove reminder" hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `;

    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => (document.getElementById('eventTitle') as HTMLInputElement)?.focus(), 100);
  }

  private openEditModal(eventId: string): void {
    const event = this.events.find(e => e.id === eventId);
    if (!event) return;

    const modal = document.getElementById('eventModal');
    if (!modal) return;

    document.getElementById('modalTitle')!.textContent = 'Edit Event';
    (document.getElementById('eventId') as HTMLInputElement).value = event.id;
    (document.getElementById('eventTitle') as HTMLInputElement).value = event.title;
    (document.getElementById('eventDescription') as HTMLTextAreaElement).value = event.description;
    (document.getElementById('eventStartDate') as HTMLInputElement).value = event.startDate;
    (document.getElementById('eventStartTime') as HTMLInputElement).value = event.startTime;
    (document.getElementById('eventEndDate') as HTMLInputElement).value = event.endDate;
    (document.getElementById('eventEndTime') as HTMLInputElement).value = event.endTime;
    (document.getElementById('eventLocation') as HTMLInputElement).value = event.location;
    (document.getElementById('eventCategory') as HTMLSelectElement).value = event.category;
    (document.getElementById('eventRecurrence') as HTMLSelectElement).value = event.recurrence;
    (document.getElementById('reminderFrequency') as HTMLSelectElement).value = event.reminderFrequency;

    document.querySelectorAll<HTMLInputElement>('input[name="reminderMethod"]').forEach(input => {
      input.checked = event.reminderMethods.includes(input.value as ReminderMethod);
    });

    const remindersContainer = document.getElementById('remindersContainer');
    if (remindersContainer && event.reminders.length > 0) {
      remindersContainer.innerHTML = event.reminders.map((minutes, index) => `
        <div class="reminder-item">
          <select class="form-input reminder-time">
            <option value="5" ${minutes === 5 ? 'selected' : ''}>5 minutes before</option>
            <option value="15" ${minutes === 15 ? 'selected' : ''}>15 minutes before</option>
            <option value="30" ${minutes === 30 ? 'selected' : ''}>30 minutes before</option>
            <option value="60" ${minutes === 60 ? 'selected' : ''}>1 hour before</option>
            <option value="120" ${minutes === 120 ? 'selected' : ''}>2 hours before</option>
            <option value="1440" ${minutes === 1440 ? 'selected' : ''}>1 day before</option>
          </select>
          <button type="button" class="btn-remove-reminder" aria-label="Remove reminder" ${event.reminders.length === 1 ? 'hidden' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      `).join('');
    }

    const priorityRadio = document.querySelector(`input[name="priority"][value="${event.priority}"]`) as HTMLInputElement;
    if (priorityRadio) priorityRadio.checked = true;

    this.closeEventDetailModal();
    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }

  private closeModal(): void {
    const modal = document.getElementById('eventModal');
    if (modal) {
      modal.setAttribute('hidden', '');
      document.body.style.overflow = '';
    }
  }

  private showEventDetail(eventId: string): void {
    const event = this.events.find(e => e.id === eventId);
    if (!event) return;

    this.selectedEventId = eventId;
    const modal = document.getElementById('eventDetailModal');
    if (!modal) return;

    const color = categoryColors[event.category] || categoryColors.other;
    const start = new Date(`${event.startDate}T${event.startTime}`);
    const end = new Date(`${event.endDate}T${event.endTime}`);

    const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

    let remindersHtml = 'None';
    if (event.reminders && event.reminders.length > 0) {
      remindersHtml = event.reminders.map(min => {
        let label: string;
        if (min >= 1440) label = `${min/1440} day(s)`;
        else if (min >= 60) label = `${min/60} hour(s)`;
        else label = `${min} minute(s)`;
        return `<span class="reminder-badge">${label}</span>`;
      }).join(' ');
    }

    document.getElementById('detailTitle')!.textContent = event.title;
    document.getElementById('eventDetail')!.innerHTML = `
      <div class="detail-row">
        <span class="detail-label">Date</span>
        <span class="detail-value">${start.toLocaleDateString('en-US', dateOptions)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time</span>
        <span class="detail-value">${start.toLocaleTimeString('en-US', timeOptions)} - ${end.toLocaleTimeString('en-US', timeOptions)}</span>
      </div>
      ${event.description ? `<div class="detail-row">
        <span class="detail-label">Description</span>
        <span class="detail-value">${this.escapeHtml(event.description)}</span>
      </div>` : ''}
      ${event.location ? `<div class="detail-row">
        <span class="detail-label">Location</span>
        <span class="detail-value">${this.escapeHtml(event.location)}</span>
      </div>` : ''}
      <div class="detail-row">
        <span class="detail-label">Category</span>
        <span class="detail-value">
          <span class="category-badge" style="background: ${color}20; color: ${color}; border: 1px solid ${color}40;">
            ${categoryNames[event.category] || event.category}
          </span>
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Priority</span>
        <span class="detail-value">
          <span class="priority-badge priority-${event.priority}">${event.priority}</span>
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Reminders</span>
        <span class="detail-value">${remindersHtml}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Methods</span>
        <span class="detail-value">${event.reminderMethods.map(method => method === 'meow' ? 'Meow channel' : method).join(', ')}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Frequency</span>
        <span class="detail-value">${this.formatFrequency(event.reminderFrequency)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Recurrence</span>
        <span class="detail-value">${event.recurrence === 'none' ? 'Does not repeat' : event.recurrence}</span>
      </div>
    `;

    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }

  private closeEventDetailModal(): void {
    const modal = document.getElementById('eventDetailModal');
    if (modal) {
      modal.setAttribute('hidden', '');
      document.body.style.overflow = '';
    }
    this.selectedEventId = null;
  }

  private showDeleteModal(eventId: string): void {
    this.deleteEventId = eventId;
    const modal = document.getElementById('deleteModal');
    if (modal) {
      modal.removeAttribute('hidden');
      document.body.style.overflow = 'hidden';
    }
  }

  private closeDeleteModal(): void {
    const modal = document.getElementById('deleteModal');
    if (modal) {
      modal.setAttribute('hidden', '');
      document.body.style.overflow = '';
    }
    this.deleteEventId = null;
  }

  private deleteEvent(eventId: string): void {
    this.events = this.events.filter(e => e.id !== eventId);
    this.saveEvents(this.events);
    this.closeDeleteModal();
    this.closeEventDetailModal();
    this.renderCalendar();
    this.showToast({ message: 'Event deleted', type: 'success' });
  }

  private saveEvent(formData: FormData): void {
    const eventId = (document.getElementById('eventId') as HTMLInputElement).value;
    
    const reminders: number[] = [];
    document.querySelectorAll('.reminder-time').forEach(select => {
      reminders.push(parseInt((select as HTMLSelectElement).value));
    });
    const uniqueReminders = [...new Set(reminders)].sort((a, b) => a - b);

    const reminderMethods = formData.getAll('reminderMethod') as ReminderMethod[];
    if (reminderMethods.length === 0) {
      this.showToast({ message: 'Choose at least one reminder method', type: 'error' });
      return;
    }

    const priorityRadio = document.querySelector('input[name="priority"]:checked') as HTMLInputElement;
    const priority = priorityRadio ? priorityRadio.value : 'low';
    const title = ((formData.get('title') as string) || '').trim();
    if (!title) {
      this.showToast({ message: 'Event title is required', type: 'error' });
      return;
    }
    const startDate = formData.get('startDate') as string;
    const startTime = this.normalizeTimeInput(formData.get('startTime') as string);
    const endDate = formData.get('endDate') as string;
    const endTime = this.normalizeTimeInput(formData.get('endTime') as string);

    if (!startTime || !endTime) {
      this.showToast({ message: 'Use HH:MM time format, for example 09:30', type: 'error' });
      return;
    }

    (document.getElementById('eventStartTime') as HTMLInputElement).value = startTime;
    (document.getElementById('eventEndTime') as HTMLInputElement).value = endTime;

    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);

    if (end <= start) {
      this.showToast({ message: 'End time must be after start time', type: 'error' });
      return;
    }

    const eventData: CalendarEvent = {
      id: eventId || this.generateId(),
      title,
      description: formData.get('description') as string,
      startDate,
      startTime,
      endDate,
      endTime,
      location: formData.get('location') as string,
      category: formData.get('category') as string,
      reminders: uniqueReminders,
      reminderMethods,
      reminderFrequency: formData.get('reminderFrequency') as ReminderFrequency,
      recurrence: formData.get('recurrence') as string,
      priority: priority,
      createdAt: eventId ? (this.events.find(e => e.id === eventId) || {}).createdAt || Date.now() : Date.now()
    };

    if (eventId) {
      const index = this.events.findIndex(e => e.id === eventId);
      if (index !== -1) {
        this.events[index] = eventData;
      }
      this.showToast({ message: 'Event updated', type: 'success' });
    } else {
      this.events.push(eventData);
      this.showToast({ message: 'Event created', type: 'success' });
    }

    this.saveEvents(this.events);
    this.closeModal();
    this.renderCalendar();
  }

  private navigatePeriod(direction: number): void {
    switch (this.currentView) {
      case 'month':
        this.currentDate.setMonth(this.currentDate.getMonth() + direction);
        break;
      case 'week':
        this.currentDate.setDate(this.currentDate.getDate() + (direction * 7));
        break;
      case 'day':
        this.currentDate.setDate(this.currentDate.getDate() + direction);
        break;
    }
    this.renderCalendar();
  }

  private goToToday(): void {
    this.currentDate = new Date();
    this.renderCalendar();
  }

  private switchView(view: 'month' | 'week' | 'day'): void {
    this.currentView = view;
    document.querySelectorAll('.view-tab').forEach(tab => {
      tab.classList.remove('active');
      tab.setAttribute('aria-pressed', 'false');
    });
    const activeTab = document.querySelector(`.view-tab[data-view="${view}"]`);
    if (activeTab) {
      activeTab.classList.add('active');
      activeTab.setAttribute('aria-pressed', 'true');
    }
    this.renderCalendar();
  }

  private updateRemoveButtons(): void {
    const items = document.querySelectorAll('.reminder-item');
    items.forEach(item => {
      const btn = item.querySelector('.btn-remove-reminder');
      if (btn) {
        if (items.length <= 1) {
          btn.setAttribute('hidden', '');
        } else {
          btn.removeAttribute('hidden');
        }
      }
    });
  }

  private initEventListeners(): void {
    document.getElementById('todayBtn')?.addEventListener('click', () => this.goToToday());
    document.getElementById('prevBtn')?.addEventListener('click', () => this.navigatePeriod(-1));
    document.getElementById('nextBtn')?.addEventListener('click', () => this.navigatePeriod(1));
    document.getElementById('newEventBtn')?.addEventListener('click', () => this.openNewEventModal());

    document.querySelectorAll('.view-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchView((tab as HTMLElement).getAttribute('data-view') as 'month' | 'week' | 'day');
      });
    });

    document.getElementById('modalClose')?.addEventListener('click', () => this.closeModal());
    document.getElementById('cancelBtn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('eventModal')?.addEventListener('click', (e: MouseEvent) => {
      if (e.target === e.currentTarget) this.closeModal();
    });

    document.getElementById('detailClose')?.addEventListener('click', () => this.closeEventDetailModal());
    document.getElementById('eventDetailModal')?.addEventListener('click', (e: MouseEvent) => {
      if (e.target === e.currentTarget) this.closeEventDetailModal();
    });

    document.getElementById('editEventBtn')?.addEventListener('click', () => {
      if (this.selectedEventId) this.openEditModal(this.selectedEventId);
    });

    document.getElementById('deleteEventBtn')?.addEventListener('click', () => {
      if (this.selectedEventId) this.showDeleteModal(this.selectedEventId);
    });

    document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => this.closeDeleteModal());
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => {
      if (this.deleteEventId) this.deleteEvent(this.deleteEventId);
    });
    document.getElementById('deleteModal')?.addEventListener('click', (e: MouseEvent) => {
      if (e.target === e.currentTarget) this.closeDeleteModal();
    });

    document.getElementById('eventForm')?.addEventListener('submit', (e: Event) => {
      e.preventDefault();
      const formData = new FormData(e.target as HTMLFormElement);
      this.saveEvent(formData);
    });

    ['eventStartTime', 'eventEndTime'].forEach(id => {
      document.getElementById(id)?.addEventListener('blur', event => {
        const input = event.target as HTMLInputElement;
        const normalized = this.normalizeTimeInput(input.value);
        if (normalized) input.value = normalized;
      });
    });

    document.getElementById('addReminderBtn')?.addEventListener('click', () => {
      const container = document.getElementById('remindersContainer');
      if (!container) return;
      
      const reminderItem = document.createElement('div');
      reminderItem.className = 'reminder-item';
      reminderItem.innerHTML = `
        <select class="form-input reminder-time">
          <option value="5">5 minutes before</option>
          <option value="15">15 minutes before</option>
          <option value="30">30 minutes before</option>
          <option value="60" selected>1 hour before</option>
          <option value="120">2 hours before</option>
          <option value="1440">1 day before</option>
        </select>
        <button type="button" class="btn-remove-reminder" aria-label="Remove reminder">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      `;
      
      reminderItem.querySelector('.btn-remove-reminder')?.addEventListener('click', () => {
        reminderItem.remove();
        this.updateRemoveButtons();
      });
      
      container.appendChild(reminderItem);
      this.updateRemoveButtons();
    });

    document.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const removeBtn = target.closest('.btn-remove-reminder');
      if (removeBtn) {
        removeBtn.closest('.reminder-item')?.remove();
        this.updateRemoveButtons();
      }
    });

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const deleteModal = document.getElementById('deleteModal');
        const detailModal = document.getElementById('eventDetailModal');
        const eventModal = document.getElementById('eventModal');
        
        if (deleteModal && !deleteModal.hasAttribute('hidden')) {
          this.closeDeleteModal();
        } else if (detailModal && !detailModal.hasAttribute('hidden')) {
          this.closeEventDetailModal();
        } else if (eventModal && !eventModal.hasAttribute('hidden')) {
          this.closeModal();
        }
      }
    });
  }
}
