# MoonSun.ai Calendar Implementation

## Overview

The calendar page lives at `/calendar/` and is implemented with:

- `src/pages/calendar.astro` for layout, form controls, modal structure, and page-scoped styling.
- `src/scripts/calendar-app.ts` for calendar rendering, event persistence, and UI interactions.
- `src/scripts/calendar-reminders.ts` for site-wide reminder delivery while any MoonSun.ai page is open.

The page follows the existing MoonSun.ai design language: warm cream backgrounds, restrained borders, editorial serif headings, Anthropic Sans body text, low-saturation clay and olive accents, soft shadows, and small motion transitions.

## Features

- Daily, weekly, and monthly calendar views.
- Event creation and editing with title, description, start/end date and time, location, category, recurrence, and priority.
- Event deletion through a confirmation dialog.
- Multiple reminder offsets per event.
- Reminder methods: meow channel, browser notification, and in-app toast.
- Reminder frequency: once, every 5 minutes, every 15 minutes, or hourly until event start.
- Category color indicators and reminder markers in calendar cells, event chips, and details.
- Account-backed persistence through `/api/calendar/events`, with `localStorage` as a fast local cache and offline fallback.

## Meow Channel

Calendar reminders are sent to the built-in meow notification channel from `sendMeowNotification()` in `src/scripts/calendar-reminders.ts`. The MeoW API payload uses `title` and `msg`, and the message includes event title, time, location, reminder offset, priority, and frequency.

Reminder checks are initialized from `BaseLayout.astro`, so they run while any MoonSun.ai page is open in the browser. Fully background delivery after the browser is closed still requires a scheduled worker or push-notification backend.

The implementation also dispatches a `meow:notification` browser event after a meow reminder is sent so other MoonSun.ai interfaces can listen for consistent channel behavior.

## Usage

1. Open `/calendar/`.
2. Use the Month, Week, or Day segmented control to switch views.
3. Click `New Event`, or click a day or time slot to prefill event timing.
4. Add one or more reminder offsets.
5. Select reminder methods and repeat frequency.
6. Save the event.
7. Click an event to view, edit, or delete it.

## Accessibility And Responsiveness

- Primary controls use buttons, labels, and `aria-live` regions where state changes need to be announced.
- Event modals use `role="dialog"` or `role="alertdialog"` and can be dismissed with Escape.
- Month cells are keyboard activatable with Enter or Space.
- The layout collapses from main calendar plus sidebar into stacked mobile sections.

## Storage

Events are stored in the authenticated calendar API at `/api/calendar/events`. The browser also keeps a local cache under `meownote_calendar_events` so the calendar can render quickly and keep working if cloud sync is temporarily unavailable.

Reminder delivery state is stored under `meownote_reminder_checked` to prevent duplicate notification sends while still supporting repeated reminder frequencies.
