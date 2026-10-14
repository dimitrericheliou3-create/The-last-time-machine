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

## Still required before public launch
- [x] Add operator name (Dimitre Richelieu), business address (Mourne Dou Don Road, Castries, Saint Lucia), and support/privacy email (richelieureserved@gmail.com) to legal pages and source documents.
- [ ] Obtain legal review for Saint Lucia and the countries targeted.
- [ ] Confirm Supabase Auth leaked-password protection is enabled: dashboard Auth security settings.
- [ ] `npm ci` succeeds from a clean checkout and `npm run build` succeeds.
- [ ] Test sign-up, confirmation, login, sign-out, password reset, and legal acceptance record on the deployed domain.
- [ ] Test with two separate accounts that neither can read or modify the other's workspace, solutions, members, or images, including direct API requests.
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
- [ ] Apply the migration to the intended Supabase project before deploying the UI; without the migration, the limit is only client-side.
- [ ] Test 10 creates, rejection of the 11th, deletion followed by a successful replacement, edits at the cap, and active paid-plan exemption.
- [ ] Before billing launches, connect verified subscription status to entitlements; checkout is currently a visual preview and does not activate paid plans.

## Plan-based solution allowances
- [x] Source UI describes Starter 10, Team 500, and Business 2,500 included solutions.
- [x] Business source UI estimates $0.05 per additional stored solution per month, without claiming a charge has occurred.
- [x] Migration `20261013_plan_solution_limits.sql` enforces Starter and Team caps in the database and allows Business overage.
- [ ] Apply the migration to the target Supabase project before deploying the UI.
- [ ] Test Starter 10 / 11th rejected, Team 500 / 501st rejected, Business 2,500 / 2,501st allowed, and edits/deletions at each threshold.
- [ ] Implement and test actual metered overage billing before charging Business customers; current checkout is a non-payment preview.


## Eight-month account inactivity deletion (prepared, not activated)
- [x] Add `profiles.last_active_at` and a rate-limited `record_user_activity()` RPC.
- [x] Record activity when the signed-in app opens or returns to the foreground.
- [x] Deploy `account-inactivity-sweep` with custom bearer-secret checks and dry-run-by-default behavior.
- [x] Add reminder history and Terms/Privacy copy for an eight-month inactivity window.
- [x] Protect accounts that own workspaces with other members or active/past-due subscriptions; preserve shared-workspace solution content for remaining members.
- [ ] Configure `INACTIVITY_CRON_SECRET`, `RESEND_API_KEY`, and a verified `INACTIVITY_FROM_EMAIL` in Supabase Edge Function secrets.
- [ ] Configure a daily scheduler that calls `POST /functions/v1/account-inactivity-sweep` with the bearer secret and `{"dry_run":true}`; review logs/results for at least several runs.
- [ ] Verify all three notices arrive at 30, 15, and 7 days before the eight-month deadline; confirm sign-in resets the timer.
- [ ] Only after testing reminders and reviewing dry-run results, explicitly switch the scheduler body to `{"dry_run":false}`.
- [ ] Test deletion against a disposable account with a sole-member workspace; verify image cleanup and deletion. Test separately that a shared-workspace owner and an account with an active/past-due subscription are protected.
- [ ] Monitor the scheduled function and logs. Auth, database, and storage cleanup span multiple services and are not one atomic transaction.
