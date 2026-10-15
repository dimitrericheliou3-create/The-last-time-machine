# Pre-launch QA — The Last Time Machine

This checklist is intentionally separate from payment setup. Do not mark tests passed unless actually run on the intended deployment.

## Implemented in this build (not yet end-to-end verified)
- [x] Public Terms of Service page reachable with `?legal=terms`.
- [x] Public Privacy Policy page reachable with `?legal=privacy`.
- [x] Public Acceptable Use Policy page reachable with `?legal=acceptable-use`.
- [x] Signup requires a checkbox for Terms and Privacy Policy.
- [x] Signup sends versioned legal acceptance metadata; database trigger records it in `public.user_legal_acceptances`.
- [x] Account deletion UI and a JWT-protected `delete-account` Edge Function are present. The function refuses deletion when the user owns a workspace with other members, cleans private image files for personal workspaces, removes owned workspace data, and preserves shared-workspace solution records by reassigning authorship.
- [x] CSV export formula injection mitigation, solution image replacement cleanup, and secure single-use team invitations are present in this source build.
- [x] Business-only Solution review toggle, submission states, reviewer actions, and database-side entitlement/RLS checks are implemented in this source build; end-to-end role tests remain outstanding.

## Still required before public launch
- [x] Add operator name (Dimitre Richelieu), business address (Mourne Dou Don Road, Castries, Saint Lucia), and support/privacy email (richelieureserved@gmail.com) to legal pages and source documents.
- [ ] Obtain legal review for Saint Lucia and the countries targeted.
- [ ] Leaked-password protection is not included on this organization's Free plan; if upgrading to Pro or above, enable it in Supabase Auth settings (see https://supabase.com/docs/guides/auth/password-security).
- [ ] `npm ci` succeeds from a clean checkout and `npm run build` succeeds.
- [ ] Test sign-up, confirmation, login, sign-out, password reset, and legal acceptance record on the deployed domain.
- [ ] Test with two separate accounts that neither can read or modify the other's workspace, solutions, members, or images, including direct API requests.
- [ ] Test creating multiple workspaces on one account, switching between them, refreshing, and confirming each workspace's solutions and permissions remain isolated.
- [ ] Test profile display name, unique username conflicts, bio, avatar upload/removal, signed URL expiry, and that avatar/profile details are only visible to members of shared workspaces.
- [ ] Test all five color schemes, confirm Dark is the first/default preset, and verify the chosen scheme persists after refresh and on another signed-in browser.
- [ ] Test account deletion in a disposable test project: owned workspace with one member; shared workspace membership; image cleanup; workspace with other members (must safely refuse); database errors/retry.
- [ ] Test invitation authorization, matching verified email, expiry, reuse, and cross-workspace isolation. Automated invitation email delivery is not configured; current flow opens a mail-app draft.
- [ ] Test image upload/replacement/deletion and private signed URL expiry.
- [ ] Confirm backup schedule and complete a restore test; configure monitoring, rate limits/abuse controls, and incident response.
- [ ] Confirm hosting/provider details and retention schedules in the privacy notice.
- [ ] Reassess cookie consent if analytics, advertising, or non-essential tracking is introduced. Current source does not intentionally use those tools.
- [ ] Payment-related tasks are intentionally excluded from this checklist. Do not accept paid customers until checkout, webhooks, entitlements, cancellations, refunds, and failed renewals are separately verified.


## Follow-up code changes

- [ ] Test invite acceptance for a user who already belongs to another workspace; verify the invited workspace remains selected after URL cleanup and refresh.
- [ ] Confirm frontend preview pricing and server-controlled checkout price values match (Team $20/$200; Business $39/$390).
- [ ] Keep checkout in preview mode until HandyPay secrets are configured and payment/webhook flows are tested end to end.
- [ ] Add a scalable existing-user lookup to workspace invitations before growth makes the current first-1,000-user scan insufficient.
- [ ] Decide whether users need a separate delete-workspace action that preserves their account.

## Free preview solution cap
- [x] UI prevents creating an 11th solution in the Starter/free preview and directs the user to Plans.
- [x] Database migration `20261013_free_preview_solution_limit.sql` enforces a 10-solution cap unless the workspace has an active Team or Business subscription.
- [x] Database enforcement is active through the newer plan-based migration enforce_plan_solution_limits (Starter/Free limit: 10). The older free-preview-only migration is superseded.
- [ ] Test 10 creates, rejection of the 11th, deletion followed by a successful replacement, edits at the cap, and active paid-plan exemption.
- [ ] Before billing launches, connect verified subscription status to entitlements; checkout is currently a visual preview and does not activate paid plans.

## Plan-based solution allowances
- [x] Source UI describes Starter 10, Team 500, and Business 2,500 included solutions.
- [x] Business source UI estimates $0.05 per additional stored solution per month, without claiming a charge has occurred.
- [x] Migration `20261013_plan_solution_limits.sql` enforces Starter and Team caps in the database and allows Business overage.
- [x] Applied migration enforce_plan_solution_limits to the production Supabase project; it enforces Starter 10 and Team 500 limits and permits Business overage without collecting fees.
- [ ] Test Starter 10 / 11th rejected, Team 500 / 501st rejected, Business 2,500 / 2,501st allowed, and edits/deletions at each threshold.
- [ ] Implement and test actual metered overage billing before charging Business customers; current checkout is a non-payment preview.


## Eight-month account inactivity deletion (prepared, not activated)
- [x] Add `profiles.last_active_at` and a rate-limited `record_user_activity()` RPC.
- [x] Record activity when the signed-in app opens or returns to the foreground.
- [x] Deploy `account-inactivity-sweep` with custom bearer-secret checks and dry-run-by-default behavior.
- [x] Add reminder history and Terms/Privacy copy for an eight-month inactivity window.
- [x] Protect accounts that own workspaces with other members or active/past-due subscriptions; preserve shared-workspace solution content for remaining members.
- [x] Require the final inactivity warning to be recorded at least seven full days before deletion; a missing/invalid timestamp or warning-history write failure fails closed. Edge Function deployed as version 2.
- [ ] Test the seven-day gate using a disposable account or test fixtures: missing warning sends notice but never deletes; a warning less than seven days old is held; a warning at least seven days old may proceed only after workspace/subscription protection checks; invalid timestamp must be held.
- [ ] Configure `INACTIVITY_CRON_SECRET`, `RESEND_API_KEY`, and a verified `INACTIVITY_FROM_EMAIL` in Supabase Edge Function secrets.
- [ ] Configure a daily scheduler that calls `POST /functions/v1/account-inactivity-sweep` with the bearer secret and `{"dry_run":true}`; review logs/results for at least several runs.
- [ ] Verify all three notices arrive at 30, 15, and 7 days before the eight-month deadline; confirm sign-in resets the timer.
- [ ] Only after testing reminders and reviewing dry-run results, explicitly switch the scheduler body to `{"dry_run":false}`.
- [ ] Test deletion against a disposable account with a sole-member workspace; verify image cleanup and deletion. Test separately that a shared-workspace owner and an account with an active/past-due subscription are protected.
- [ ] Monitor the scheduled function and logs. Auth, database, and storage cleanup span multiple services and are not one atomic transaction.

## UI audit follow-up — search counter, empty state, and footer
- [x] Make the result counter render a complete singular/plural label (1 result, 0 results, 2 results).
- [x] On a genuinely empty workspace, show one primary “Add your first solution” action; hide duplicate header and sidebar creation actions.
- [x] When a query or category filter has no matches, show “Clear search and filters” instead of another create button.
- [x] Group main-footer links in a labeled navigation element, separate the tagline, and give the footer a responsive layout.
- [x] Wrap legal-page links in a labeled navigation element.
- [ ] Verify the deployed UI visually at desktop, tablet, and narrow mobile widths; test empty workspace, filtered no-results, focus states, and legal links after deployment.

## Signup verification auto-login follow-up

- [x] Signup now requests a redirect to the current app origin after email confirmation.
- [x] The browser Supabase client explicitly enables URL-session detection and persistent sessions, so a successful confirmation can restore the session and render the signed-in workspace without a second login.
- [x] Signup instructions now tell the user that confirming the email will open the workspace automatically.
- [ ] End-to-end test with a new disposable account: submit signup, open the email confirmation link, confirm the browser returns to the deployed app already signed in, and verify the new private workspace loads.
- [ ] In Supabase Authentication → URL Configuration, verify the deployed app origin is an allowed Redirect URL (and set the correct Site URL). If a custom domain is used, allow-list that domain as well.

## Dashboard UI audit follow-up — legal routes, metric affordances, and naming

- [x] Legal links now use clean app routes: `/terms`, `/privacy`, and `/acceptable-use`; the app continues to accept the older `?legal=...` URLs for compatibility.
- [x] Signup consent, auth footer, dashboard footer, and legal-page footer use the clean legal routes.
- [x] Static metrics no longer show the extra activity/action glyph or move/shine on hover, avoiding a false clickable affordance.
- [x] Newly generated default workspace names capitalize the email local-part's first character.
- [x] Existing auto-generated workspace labels display using the owner's saved profile display name (or a capitalized email local-part fallback); custom workspace names are preserved.
- [ ] Live production smoke test: open all three clean legal paths directly, confirm each correct document renders, and test the signup consent links.
- [ ] Responsive visual check on dashboard metric cards and workspace picker in desktop and mobile widths.


## Supabase access-control hardening — 2026-10-14

- [x] Revoked broad table, sequence, and column grants from anon, authenticated, and PUBLIC across the app's public tables; granted only the client operations the app uses.
- [x] Removed direct client write access to workspace membership rows; database triggers and the invitation Edge Function remain responsible for membership.
- [x] Prevented clients from changing solution workspace IDs, workspace ownership, profile email, or account activity timestamps.
- [x] Added an explicit deny-all RLS policy for server-only account inactivity notices and removed duplicate legal-acceptance read policy.
- [x] Restricted default table/sequence/function grants for objects created by the postgres migration role; hardened record_user_activity() with an empty search path while keeping its intended authenticated RPC.
- [x] Applied Starter/Team plan-limit enforcement in the database. Business overage remains a preview allowance only; do not bill until metered billing is implemented and tested.
- [x] Removed the internal permissions-implementation note from the Team page UI.
- [ ] Run two-account end-to-end tests of workspace isolation, member permission boundaries, image access, plan caps, sign-up, and account deletion against the deployed app.
- [ ] Supabase Security Advisor still reports the intentionally authenticated SECURITY DEFINER activity RPC and that leaked-password protection is disabled. The RPC is constrained to updating only the caller's activity timestamp and has a locked search path; leaked-password protection needs Pro or above.
- [ ] Check default privileges for any future objects created by Supabase-managed supabase_admin; the active migration role's defaults are locked down, but that managed role's defaults are controlled by Supabase.


## Business Solution review (implemented, not yet end-to-end verified)
- [x] Workspace owners can enable/disable Solution review only while the workspace has an active Business subscription.
- [x] New and edited solutions become pending when review is enabled; only approved solutions are visible to ordinary workspace members.
- [x] Owners and admins can approve submissions or request changes; the latest submitter can still see their own pending revision.
- [x] Reviewers can attach an optional note to a change request, and the submitter sees the feedback.
- [x] Private image reads are filtered through visible solution rows so review-pending images are not visible to unrelated workspace members.
- [x] Disabling review or losing Business entitlement automatically approves pending solutions and disables the setting.
- [ ] Test with separate owner, admin, editor, and view-only accounts: pending visibility, approval, request-changes, resubmission, and attempts to spoof review status over the API.
- [ ] Test that Starter/Team workspaces cannot enable the setting directly through the API, and that cancelling/downgrading a Business subscription disables the feature safely.
- [ ] Test an editor revising a solution created by another member, image replacement while pending, and turning review off with pending items.
