# Auth email templates

Two branded templates for Supabase Auth. Supabase keeps them in each project's dashboard, not in
this repo's migrations, so they are pasted by hand into **each project** (staging first, then
production at release time).

| File | Dashboard template | Subject (first line of the file, in a comment) |
|---|---|---|
| `confirm-signup.html` | **Confirm signup** | Confirm your email for [App] |
| `reset-password.html` | **Reset password** | Reset your [App] password |

`[App]` is the placeholder product name (`src/config/site.ts`). Replace it in both files, in the
subjects and in the dashboard once the product has a name.

## How the links work

The button links to `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=…`.

- The app always passes `<current origin>/auth/confirm` as the redirect, so a link opens on the
  same deployment that sent it (a preview stays on the preview).
- `type=email` for **Confirm signup** and `type=recovery` for **Reset password**. These are the
  values the current Supabase server-side docs use. `/auth/confirm` accepts them and passes the
  same `type` to `verifyOtp`.
- If Supabase rejects the redirect URL it substitutes the **Site URL** (the link then lands on
  `/`). The app forwards any `/` request that carries `token_hash` and `type` to `/auth/confirm`,
  so the link still works.
- Opening the link only shows a button. The token is used when the person presses it, so email
  security scanners can't use it up.

## Paste a template (do this in each project)

1. Open the [Supabase dashboard](https://supabase.com/dashboard) and choose the project
   (**staging** first).
2. In the left sidebar choose **Authentication**.
3. Under **Configuration** choose **Email** (older dashboards: **Emails → Templates**), then the
   **Templates** tab.
4. Select **Confirm signup**.
5. In **Subject heading** type the subject from the table above.
6. In **Message body** make sure the **Source** view is selected, select everything, delete it,
   and paste the whole content of `confirm-signup.html` **except the first line** (the
   `<!-- Subject: … -->` comment is only a note for you; leaving it in is harmless).
7. Click **Save changes**.
8. Select **Reset password** and repeat steps 5–7 with `reset-password.html`.

## Also check, once per project

1. **Authentication → URL Configuration**
   - **Site URL**: the project's own URL (staging: the Vercel staging URL; production: the
     production URL).
   - **Redirect URLs**: add each of these, one per line:
     - `https://brew-v2-*-aaron1999xs-projects.vercel.app/**` (Vercel previews, **staging only**)
     - `http://localhost:3000/**` (local development, **staging only**)
     - the project's own URL followed by `/**`
2. **Authentication → Sign In / Providers → Email**: **Confirm email** is on, **Secure password
   change** and **Require current password** are on.
3. **Authentication → Emails → SMTP Settings**: custom SMTP is on (sender
   `no-reply@brew.atys.dev`).

## Test an email without sending one

The Playwright specs never make Supabase send mail. They use the Admin API
(`auth.admin.generateLink`) to get a `hashed_token` and open `/auth/confirm?token_hash=…&type=…`
directly, the same URL the real email contains.
