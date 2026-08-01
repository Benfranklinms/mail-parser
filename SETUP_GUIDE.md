# Setup Guide: Configuring your `.env` File

This guide will help you fill out the missing fields in your newly created `.env` file.

---

## 1. Supabase Credentials

To set up your database and authentication, log into your [Supabase Dashboard](https://supabase.com/dashboard) and select your project.

### Go to: `Project Settings` (gear icon at the bottom left) -> `API`

1. **`SUPABASE_URL`**: Copy the **Project URL** value under the "Project URL" section.
2. **`SUPABASE_ANON_KEY`**: Copy the `anon public` API key from the "Project API keys" section.
3. **`SUPABASE_SERVICE_ROLE_KEY`**: Copy the `service_role` API key from the "Project API keys" section.
   > [!CAUTION]
   > Keep this secret. This key bypasses Row Level Security and is used by the backend's background sync processor.

### Go to: `Project Settings` -> `API` (scroll to JWT Settings)

4. **`SUPABASE_JWT_SECRET`**: Copy the **JWT Secret** string. This is required for verifying user authentication tokens inside Flask.

---

## 2. Google OAuth & Gmail API Setup

To enable Gmail syncing, you need to create a project in the [Google Cloud Console](https://console.cloud.google.com/).

### Step 1: Create a Project
1. Go to the console and create a new project called `Placement Mail Tracker`.

### Step 2: Enable the Gmail API
1. In the search bar at the top, search for **Gmail API**.
2. Click on it and click **Enable**.

### Step 3: Configure the OAuth Consent Screen
1. Go to **APIs & Services** -> **OAuth consent screen**.
2. Choose **External** user type and click **Create**.
3. Fill in the App Information (e.g., App name: `Placement Mail Tracker`, Support email, Developer contact email).
4. Click **Save and Continue**.
5. Under **Scopes**, click **Add or Remove Scopes**.
6. Manually enter or select the `.../auth/gmail.readonly` scope:
   * Scope string: `https://www.googleapis.com/auth/gmail.readonly`
7. Under **Test Users**, click **Add Users** and add the Gmail address you will be testing the app with.

### Step 4: Create OAuth 2.0 Credentials
1. Go to **APIs & Services** -> **Credentials**.
2. Click **+ Create Credentials** at the top and select **OAuth client ID**.
3. Set Application Type to **Web application**.
4. Set name to `Placement Mail Tracker Backend`.
5. Under **Authorized redirect URIs**, add:
   * `http://localhost:5000/auth/gmail/callback`
6. Click **Create**.
7. Copy the **Client ID** and **Client Secret** and add them to your `.env` file:
   * **`GOOGLE_CLIENT_ID`**: Copy the full Client ID.
   * **`GOOGLE_CLIENT_SECRET`**: Copy the Client Secret.
