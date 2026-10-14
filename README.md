# The Last Time Machine

A React + Vite web app for recording and searching business troubleshooting knowledge. Supabase provides authentication and the database.

## What works in this build

- Email/password account creation and sign-in through Supabase Auth
- Creates a private workspace; the database trigger creates the owner membership
- Workspace picker lists all workspaces for the signed-in account and can create/switch workspaces without requiring a second account
- Account profile page with display name, unique optional username, short bio, and private profile picture; teammate handles and pictures are visible only inside shared workspaces
- Lists saved solutions from Supabase
- Creates, edits, and deletes solutions
- Workspace name settings and isolated workspace data/permissions when switching between workspaces
- Private profile avatar storage with per-account upload permissions, signed image URLs, and username uniqueness enforced by the database
- CSV export with UTF-8/newline formatting and spreadsheet-formula injection mitigation
- Export saved solutions to CSV for backup or spreadsheet analysis
- Password reset email request and a dedicated password-update screen for recovery links
- Searches title, description, category, steps, and outcome; filters by category (including category names that match the “All categories” label)
- Responsive dashboard for mobile and desktop; Ctrl/Cmd+K focuses search
- Secure workspace invitation links with server-side authorization, email matching, seven-day expiry, hashed tokens, single-use atomic acceptance, and manual email-draft delivery (requires the migration and Edge Function deployment)
- Row-level security relies on the policies in the connected Supabase project
- Sample records appear only when Supabase environment settings are missing (preview mode)

## Connect to your Supabase project

1. Install Node.js 20 or later.
2. Extract this folder and open a terminal in it.
3. Copy `.env.example` to `.env`.
4. In Supabase, open Project Settings → API Keys (or the Connect dialog).
5. Put the project URL in `VITE_SUPABASE_URL` and the **publishable** key (`sb_publishable_...`) in `VITE_SUPABASE_PUBLISHABLE_KEY`.
6. In Supabase Authentication settings, configure the Site URL and redirect URLs for the URL you will deploy to.
7. In Authentication → Providers → Email, choose whether to require email confirmation.
8. Run:

   ```bash
   npm install
   npm run dev
   ```

   Open the local URL Vite prints.

## Deploy

This is a standard Vite app and can be deployed to Vercel, Netlify, or another static host.

- Build command: `npm run build`
- Output directory: `dist`
- Add both environment variables from `.env` in your hosting provider's project settings.
- Add your deployed domain to Supabase Auth's allowed redirect URLs.

## Important current limitations

- This is an MVP, not yet a fully launch-ready paid SaaS.
- Role changes/removal, automated invitation email delivery, subscription billing, monitoring, and production abuse controls still need implementation. Do not market this as a production-ready paid service until those are addressed.
- The app must be tested with real accounts and separate workspaces before inviting customers.
- Never put Supabase `service_role` or secret keys in this frontend. The publishable key is designed for frontend use when row-level security is correctly configured.
- Demo records are not stored and are only shown if Supabase environment values are missing. With environment values configured, an authenticated user sees records from their own workspace.


## Save troubleshooting

The database needs to let a workspace owner read the workspace they just created, before their membership row exists. The Supabase project migration now allows owners to read their own workspaces and combines that with member access. If your app was already open, refresh the browser after the migration so the workspace can finish loading.

Save failures now remain visible inside the solution form instead of only appearing as a short toast. Never share your `.env` file publicly; it contains your project configuration.

## Latest feature build

- Solution cards include a direct delete button with a confirmation prompt.
- Search scans title, problem description, category, outcome, and all solution steps; category filtering and sorting by most recently updated, oldest, or title are available.
- Team invitations are created by a server-side Edge Function. Invite tokens are random, only their hashes are stored, links expire after seven days, and the accepting account must have a confirmed email matching the invite. Acceptance is atomic and membership is granted server-side. Email delivery is currently a mail-app draft/manual send, not automated. Role changes and member removal are not implemented.
- Plans page includes monthly/annual pricing and a visual checkout preview. The checkout preview intentionally does not call a payment provider, collect card data, create subscriptions, or change access. Payment processing is excluded from this draft.
- Billing foundations include a private subscription-status table, webhook-event idempotency table, owner/admin checkout authorization, server-controlled prices, and HMAC signature verification. Subscription entitlement enforcement and a complete billing-management/cancellation UI still require additional work before selling paid access.
- AI-assisted answers are not active yet; do not market this feature as available until a grounded retrieval workflow and safeguards are implemented.


## Workspace and profile migrations

The current Supabase project already has the workspace-creation policy and owner-membership trigger, and the profile/avatar changes have been applied. When setting up another Supabase project, review and apply the migrations for your intended deployment, including:

- `20261014000300_create_profile_avatars_and_usernames.sql`
- `20261014000400_add_profiles_updated_at_trigger.sql`
- `20261014000500_allow_teammate_profile_avatars.sql`

The `profile-avatars` bucket is private. Profile pictures are stored under the signed-in user's ID and delivered with short-lived signed URLs. Do not make this bucket public.

## Optional solution images

Solutions can be saved without an image. To enable optional reference images:

1. Open your Supabase project and go to **SQL Editor**.
2. Run the SQL in `supabase/migrations/20261012_optional_solution_images.sql`.
3. Refresh the app. The migration adds `image_path`, creates a **private** Storage bucket, and limits image access to signed-in workspace members.
4. Use JPG, PNG, WebP, or GIF images up to 5 MB.

The app generates temporary signed image URLs when it loads a solution. Avoid uploading highly sensitive screenshots until you have tested your workspace membership and Storage policies with separate test accounts.


## Launch-readiness status (October 2026)

This build includes password recovery, private solution images, solution CRUD, search, CSV export, workspace settings, a live membership list, public legal pages, versioned signup consent recording, account-deletion UI/Edge Function, and secure server-side invitations. Invitation delivery is still a manual email draft. The checkout modal is not connected to payments. The connected Supabase project has the `solution-images` private bucket and its workspace-member policies configured. Legal pages now include the supplied operator contact details. Legal pages and account deletion still need end-to-end testing and jurisdiction-specific legal review before public launch.

**Do not accept paid customers until these launch gates are completed and tested:**

- [ ] Enable leaked-password protection in Supabase Auth settings.
- [ ] Configure production Site URL and redirect allowlist; test sign-up, email confirmation, sign-in, sign-out, and password recovery on the deployed domain.
- [ ] Test isolation using two independent accounts/workspaces, including direct database requests and private image URLs.
- [ ] Apply `supabase/migrations/20261013_secure_workspace_invitations.sql`, deploy `supabase/functions/workspace-invitations`, set the `APP_URL` secret to the deployed app origin, and test invitations with two accounts. Email delivery remains manual until an email provider is configured.
- [ ] Finish HandyPay merchant onboarding and confirm payout country/currency, fees, recurring billing eligibility, refunds, and legal account ownership.
- [ ] Configure `HANDYPAY_API_KEY`, `HANDYPAY_WEBHOOK_SECRET`, and `APP_URL` as Supabase Edge Function secrets; deploy both functions and register the HTTPS webhook endpoint in HandyPay.
- [ ] Run HandyPay test-mode checkout and verify successful, failed, duplicate, refunded, canceled, and expired subscription events before live mode.
- [ ] Implement and test server-enforced plan entitlements and a customer cancellation/billing-management path before selling paid plans.
- [x] Add account deletion and solution export workflows (account deletion not end-to-end tested).
- [ ] Complete and test a backup/restore procedure.
- [x] Add public privacy notice, terms, and acceptable-use pages, with signup consent and version recording.
- [x] Add account-deletion UI and JWT-protected deletion function (not end-to-end tested).
- [x] Add operator name, business address, and support/privacy contact to the legal pages.
- [ ] Confirm legal entity/trading-name requirements, provider details, retention periods, and jurisdiction-specific disclosures; obtain legal review.
- [ ] Test account deletion in a disposable test project and verify storage cleanup.
- [ ] Enable Supabase leaked-password protection: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- [ ] Deploy to a production host, configure the custom domain and HTTPS, and verify a clean production build.
- [ ] Add monitoring/error reporting, rate limits/abuse controls, and a documented incident response process.
- [ ] Test image create/edit/remove flows. Replacing or removing an image may leave an unused Storage object until cleanup is implemented.

No production build, live image upload, external payment, invitation delivery, or independent-workspace security test is claimed by this source package. These require validation in the actual deployment and provider accounts.


## HandyPay billing integration (prepared, not activated)

The Supabase project has prepared HandyPay Edge Functions and a subscription table from earlier work, but the current frontend deliberately does not invoke them. The Plans page is a visual checkout preview only. Displayed draft prices are Team USD $20/month or $200/year and Business USD $39/month or $390/year; these are draft UI values and are not wired to provider prices.

The billing migration has been applied to the connected Supabase project, and both Edge Functions are deployed (`create-handypay-checkout` with JWT verification on, and `handypay-webhook` with JWT verification off because HandyPay must call it). **They are not active for real checkout yet** because the HandyPay merchant account, `HANDYPAY_API_KEY`, `HANDYPAY_WEBHOOK_SECRET`, and final `APP_URL` have not been connected/configured. The frontend is also not yet deployed to Cloudflare Pages.

### Important fee note

HandyPay's public API documentation currently lists 4.9% + US$0.40 per transaction on Free/Brand, or 4.2% + US$0.40 on Pro. That means the fee is not a universal flat US$1.13: at the public Free/Brand rate, the estimate is US$0.89 on $10, US$1.82 on $29, US$5.30 on $100, and US$14.61 on $290. These are estimates; the merchant dashboard/contract controls the real fee, and cross-border payout or currency conversion may add costs. The Plans page shows estimated fees and does not automatically add a surcharge to customers.

### Activate after merchant approval

1. Create/verify the HandyPay merchant account and confirm Saint Lucia onboarding, payout method, USD/XCD handling, recurring subscriptions, and the exact fee schedule. Use test mode first.
2. Install the Supabase CLI and sign in. From this project folder, link the project and deploy both functions:

   ```bash
   supabase login
   supabase link --project-ref nbhdxyvypqtqaowekvdj
   supabase functions deploy create-handypay-checkout --project-ref nbhdxyvypqtqaowekvdj
   supabase functions deploy handypay-webhook --project-ref nbhdxyvypqtqaowekvdj
   ```

3. Set the secrets in Supabase (replace placeholders locally; never commit them):

   ```bash
   supabase secrets set HANDYPAY_API_KEY=hp_test_REPLACE_ME HANDYPAY_WEBHOOK_SECRET=REPLACE_ME APP_URL=https://YOUR-PROJECT.pages.dev --project-ref nbhdxyvypqtqaowekvdj
   ```

   The API key and webhook signing secret are different values. Use the test key/signing secret until test events pass; switch to the live key/secret only after approval and test validation.
4. In HandyPay, register an HTTPS webhook to `https://nbhdxyvypqtqaowekvdj.supabase.co/functions/v1/handypay-webhook` and subscribe to at least `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `payment_intent.payment_failed`, and `charge.refunded`. Store the endpoint's signing secret as `HANDYPAY_WEBHOOK_SECRET`.
5. Add your final `pages.dev` URL to Supabase Authentication → URL Configuration → Site URL and Redirect URLs. Set the same URL as `APP_URL`, redeploy the functions after changing secrets if required, then test the whole purchase flow in test mode.
6. Do not advertise paid access until plan limits are actually enforced server-side and cancellation/refund handling has been tested. The current migration only records subscription status; it does not yet block features when a plan expires.

Never put HandyPay keys or the Supabase service-role key in any `VITE_*` variable or browser code.

## Security controls that require dashboard setup

- In Supabase Dashboard, open **Authentication → Security and Protection** (wording may vary) and enable **Leaked password protection**. This is a project-level Auth setting and cannot be safely enabled from the browser app.
- Before launch, test with two separate accounts that each belong to different workspaces. Verify solution rows, workspace records, and image objects cannot be accessed across workspaces.
- The Team screen currently prepares an email draft only. It does not send invitations or grant membership. Do not treat it as an access-control mechanism; a secure server-side invitation flow and email provider are still required.
- The Plans screen is a visual preview. It does not read subscription status or activate paid entitlements. The Starter label is explicitly marked as a default preview.


## Secure team invitations

1. In Supabase SQL Editor, run `supabase/migrations/20261013_secure_workspace_invitations.sql` after the existing workspace tables/migrations.
2. Deploy the Edge Function: `supabase functions deploy workspace-invitations`.
3. Set the `APP_URL` Edge Function secret to the exact deployed app origin, for example `https://your-domain.example`. Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Never place the service-role key in the frontend or share it in chat.
4. Ensure the app's redirect/site URL is configured in Supabase Auth.
5. Test with two separate accounts: an owner creates an invite, the invited user opens the link, confirms their email, signs in using the matching email, and accepts it. Confirm the new member can access the invited workspace but cannot access unrelated workspaces. Also test wrong email, expired token, reused token, and an ordinary member attempting to invite.

The function does not send email automatically yet. It opens a mail-app draft containing the generated invitation link. To automate delivery, connect a transactional email provider and send the link server-side.


## Legal pages, consent, and account deletion (non-payment)

The frontend includes public legal pages at `/?legal=terms`, `/?legal=privacy`, and `/?legal=acceptable-use`. Signup requires the terms/privacy checkbox and sends version metadata. Apply `supabase/migrations/20261013_record_legal_acceptance.sql` to a fresh project; it creates a versioned acceptance table, an auth trigger that requires acceptance metadata on signup, and a trigger that records the acceptance. On the connected Supabase project these database changes have already been applied in separate migrations.

The `delete-account` Edge Function is deployed to the connected Supabase project with JWT verification enabled. It refuses to delete an account that owns a workspace with other members, removes solution images and data for single-member owned workspaces, cancels invitations sent by the user, removes memberships, preserves shared-workspace solutions by reassigning their author to the workspace owner, and deletes the auth user. Test it only in a disposable project before relying on it in production; database/storage operations are not one atomic transaction.

The legal documents now identify the operator and contact, describe Supabase hosting for authentication/database/private image storage in the US East (North Virginia) region, and include expanded privacy rights, liability, governing-law, and future billing clauses. The frontend hosting provider is not confirmed in this project source; update the Privacy Policy if deployment introduces a known frontend host or material third-party processor. Confirm actual data-retention operations and obtain qualified jurisdiction-specific legal review before commercial launch. Supabase's leaked-password protection remains disabled and should be enabled in the dashboard.


## Audit follow-up (13 October 2026)

- Fixed invitation acceptance state so the workspace just joined is preserved when the `invite` token is removed from the URL; the normal workspace loader now prefers that workspace for the immediate reload.
- Reconciled the server-controlled checkout price table with the current pricing preview: Team US$20/month or US$200/year; Business US$39/month or US$390/year.
- **Payments remain disabled in the frontend preview.** These source changes do not configure HandyPay secrets, deploy Edge Functions, or activate subscriptions. Before enabling checkout, configure the required server-side secrets and test checkout, webhook verification, subscription state changes, cancellation/refunds, and error handling.
- The workspace-invitations user-existence check still lists up to 1,000 users and should be replaced with a scalable lookup before the application grows beyond that range.
- Separate workspace deletion while retaining the account is not currently exposed in Settings; account deletion is a different operation.

### Free preview limit
The Starter/free preview allows up to **10 saved solutions per workspace**. The UI blocks additional creates and the database migration `supabase/migrations/20261013_free_preview_solution_limit.sql` enforces the cap for direct API requests too. Apply that migration to Supabase before deploying this build. The database exemption checks for an active Team or Business subscription, but billing is still preview-only, so paid entitlements must be fully wired and tested before accepting payments. A solution cap alone does not prevent people from sharing one login; use individual accounts and workspace invitations for team accountability.

## Plan solution allowances (source draft)
- Starter/free preview: 10 saved solutions per workspace.
- Team: 500 saved solutions per workspace.
- Business: 2,500 saved solutions included; additional stored solutions are priced at $0.05 per extra solution per month.
- Business overage is currently shown as an estimate only. The current checkout is a mock preview, so no payment or overage charge is collected. Do not advertise automated overage billing until metered billing, usage snapshots, proration, cancellations, failed payments, and webhook reconciliation are implemented and tested.
- Apply `supabase/migrations/20261013_plan_solution_limits.sql` before deploying the app. The database enforces Starter and Team caps; Business overage collection is not yet implemented.


## Eight-month account inactivity policy (prepared, not activated)

The live database now records foreground account activity in `public.profiles.last_active_at`, throttled to at most one update per hour through the `record_user_activity()` RPC. The app calls this when the signed-in user opens or returns to the app. Existing profiles were baselined at rollout, so prior inactivity won't trigger deletion immediately.

The `account-inactivity-sweep` Edge Function is deployed but **automatic deletion is not scheduled or enabled yet**. It requires an authorization secret and a verified email-sending setup. It is safe by default: requests run in dry-run mode unless the caller explicitly sends `{"dry_run":false}`. Do not schedule a destructive run until reminder emails are configured and a dry-run has been reviewed.

Required Edge Function secrets:
- `INACTIVITY_CRON_SECRET`: a long random secret used only by the scheduler and this function.
- `RESEND_API_KEY`: API key for the chosen Resend account.
- `INACTIVITY_FROM_EMAIL`: a sender address verified in Resend.
- `APP_URL`: optional; defaults to `https://the-last-time-machine.pages.dev`.

The scheduler must invoke `POST /functions/v1/account-inactivity-sweep` once per day with `Authorization: Bearer <INACTIVITY_CRON_SECRET>` and JSON body `{"dry_run":true}` for an initial observation period. Only after the candidate list and notices have been reviewed should the scheduled body change to `{"dry_run":false}`. Store the cron credential in Supabase Vault and do not commit it to GitHub or paste it into source code. The final warning must be recorded at least seven days before an account can be deleted.

Safeguards: account activity warnings are staged at roughly 30, 15, and 7 days before the eight-month deadline; accounts owning a workspace with other members or an active/past-due subscription are protected from automatic deletion; sole-member workspaces owned by an eligible inactive account may be deleted; shared-workspace solutions are retained and their author attribution reassigned. Database/storage/Auth deletion spans multiple services and is not one atomic transaction, so the sweep must be monitored before commercial use. The inactivity policy is not operational until secrets, a verified sender, and a scheduled job are all configured and tested.
