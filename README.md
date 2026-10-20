# TeamFlow — Project Manager

A glass-morphism task manager for a small team (manager + employees), built with **Next.js**, **Supabase** and deployed on **Vercel**.

## Features

- **Google Workspace Authentication (Domain Restricted)**: Employees sign in via Google with corporate emails (restricted to `@impexappliances.com`). Users outside the domain are blocked.
- **Role Selection & Admin Approval**: Upon first sign-in, employees choose either **Employee** (instant access) or **Manager** (requires admin approval).
- **Master Admin Portal (`/admin`)**: A separate administrative portal secured with the password `Ikhlas@123`. The admin can review pending manager requests, approve or decline them, manage team roles, and view domain security settings.
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

### 3. Gmail: each user sends from their own account (Google OAuth)
1. In [Google Cloud Console](https://console.cloud.google.com), create a project, then open **APIs & Services → Library** and enable the **Gmail API**.
2. Under **Google Auth Platform → Branding / Audience**, set up the consent screen:
   - Audience **Internal** if everyone uses your Google Workspace domain. No review is needed and connections don't expire.
   - Otherwise choose **External** and add each person under **Test users**. In Testing mode, Google expires connections after 7 days.
3. Under **Data Access**, add the scope `https://www.googleapis.com/auth/gmail.send`.
4. Under **Clients → Create client → Web application**, add these **Authorized redirect URIs**:
   - `https://YOUR-APP.vercel.app/api/google/callback`
   - `http://localhost:3000/api/google/callback`
5. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. `SUPABASE_SERVICE_ROLE_KEY` must also be set on the server.
6. Each user opens **Profile → Connect with Google**. Emails they trigger are then sent from their own Gmail. The app asks only for the *send* permission and cannot read inboxes.
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
app/api/         email (Gmail API), google (connect Gmail), ai (Gemini), status
components/      AppShell, TaskModal, TaskCard, providers, UI kit
lib/             supabase client, task actions, daily summary + report builders
supabase/        database schema, security rules, triggers
```
