# TeamFlow — Project Manager

A glass-morphism task manager for a small team (manager + employees), built with **Next.js**, **Supabase** and deployed on **Vercel**.

## Features

- **Login with simple usernames**: `manager / manager@123` and `user / user@123` by default. Each user can change their display name, avatar colour, notification Gmail and password from **Profile**.
- **Assign tasks to each other** with priority, start time, **deadline (time to end)**, and status: To do → In progress → Waiting → Done. Drag cards between columns on the board.
- **Waiting tracking**: mark a task as *Waiting on <person>* with a reason. The waiting time is counted automatically (live + accumulated), the person is emailed, and it shows on their dashboard as "Someone is waiting on you".
- **Daily Summary**: an auto-generated, copy-paste-ready daily update (completed, in progress, waiting, new, up next) with each task described and your progress notes. You can view it for yourself, a teammate or the whole team, polish it with AI, and email it.
- **Calendar**: a month view of deadlines, with click-to-add on a day and an **Add to Google Calendar** button on every task.
- **Reports**: weekly and monthly stats (completed, on-time %, overdue, average completion time, waiting time, per person), charts, CSV export, **Gemini AI analysis** and email.
- **AI Assistant** (Gemini): "plan my day", deadline-risk checks, who's blocking whom, follow-up drafts. Gemini can also write task descriptions for you.
- **Gmail**: automatic email notifications (task assigned, someone waiting on you, task completed), plus emailing tasks, summaries and reports.
- **Realtime**: the manager's and employee's screens update live.

## Setup

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste [supabase/schema.sql](supabase/schema.sql) and click **Run**.
3. In **Authentication → Providers → Email**, turn **off** "Confirm email". The seed script confirms its own users, but this avoids surprises.
4. Copy **Project URL**, **anon key** and **service_role key** from **Project Settings → API**.

### 2. Environment
```bash
cp .env.example .env.local   # then fill in the values
npm install
npm run seed                 # creates manager/manager@123 and user/user@123
npm run dev                  # http://localhost:3000
```

### 3. Gmail (for sending emails)
1. Use a Gmail account with **2-Step Verification** turned on.
2. Create an **App password** at https://myaccount.google.com/apppasswords.
3. Set `GMAIL_USER` (that Gmail address) and `GMAIL_APP_PASSWORD` (the 16-character code).
4. Each user adds their own Gmail in **Profile → Gmail for notifications**.

### 4. Google Gemini
Get a key at https://aistudio.google.com/apikey and set `GEMINI_API_KEY`. `GEMINI_MODEL` defaults to `gemini-2.5-flash`.

### 5. Deploy to Vercel
1. Push this repo to GitHub, then **Import** it at [vercel.com/new](https://vercel.com/new).
2. Add every variable from `.env.example` under **Settings → Environment Variables**, and set `NEXT_PUBLIC_APP_URL` to your Vercel URL.
3. Deploy. That's it: the API routes run as Vercel serverless functions.

## Adding more people
Add entries to the `users` array in [scripts/seed.mjs](scripts/seed.mjs) and run `npm run seed` again. The role is either `manager` or `employee`.

## Project structure
```
app/(app)/       dashboard, tasks, calendar, summary, reports, assistant, profile
app/api/         email (Gmail via nodemailer), ai (Gemini), status
components/      AppShell, TaskModal, TaskCard, providers, UI kit
lib/             supabase client, task actions, daily summary + report builders
supabase/        database schema, security rules, triggers
```
