# Running xbul

How to look after the live site. Setting it up is in [deploy.md](deploy.md). Commands here are for production; add `--env staging` for staging.

## Every day during launch

- Open `/admin/claims`. Suppliers aren't told by email and neither are you, so a waiting claim sits there until someone looks.
- Open `/admin/stats` to see progress against the targets. **Visitor-days** overstates customers, because one address counts once per day.
- In the Cloudflare dashboard, open **Workers & Pages → xbul → Observability** and look for these log lines:
  - `[evidence] could not delete`: a document wasn't deleted. The 90-day rule removes it later. If you see many, check R2's status.
  - `[db] pool error` or `[health] database check failed`: database trouble.

## Every month

- Compare the Cloudflare and Neon bills to what you expected.
- Download the latest dump from the `xbul-backups` bucket and run:

  ```bash
  bash scripts/verify-restore.sh <dump file>
  ```

  Delete the downloaded file afterwards, because it holds personal data.

## The site is down

Check these in order, and stop when you find the cause:

1. `node scripts/smoke.mjs https://xbul.io` shows which parts fail.
2. `https://xbul.io/api/health` answers 503 when the database can't be reached.
3. Neon's status page, then Cloudflare's status page.
4. Workers Logs, for the error behind it.
5. If it started right after a deploy, roll back (below).

## A deploy went wrong

```bash
pnpm wrangler rollback --message "<why>"
```

This takes effect right away and goes back to the previous version. To choose an older one, run `pnpm wrangler versions list` and pass the version id.

A rollback restores code, not the database. If the release included a migration, the migration stays. The old code still works with it, as long as the migration only added things, which is the rule below. Then run the smoke check again.

After a rollback, `main` still holds the bad code, and the next push deploys to staging but not production. Fix it on `main` before starting **Deploy production** again.

## Restore the database

1. Tell the suppliers first: anything saved after the restore point is lost.
2. **Within 7 days:** use Neon's instant restore on `xbul-production`, which goes back to a chosen moment.
3. **Older, or the Neon project is gone:** a dump only loads into an empty database, so use a new Neon project (Postgres 17, Frankfurt):

   ```bash
   bash scripts/verify-restore.sh <dump file>
   docker run --rm -i postgres:17 pg_restore --no-owner --no-privileges -d "<new neon url>" < <dump file>
   DATABASE_URL="<new neon url>" pnpm db:migrate
   ```

   The last line applies any migrations newer than the dump. Then create a new Hyperdrive config as in step 3 of [deploy.md](deploy.md), put its id in `wrangler.jsonc`, update the `PRODUCTION_DATABASE_URL` secret, and deploy.
4. Run the smoke check.

Uploaded documents aren't in the database, so a restore can list a file that has since been deleted. Its link answers 404. An admin rejects that claim with a note, and the supplier uploads again.

## Rotate a secret

```bash
pnpm wrangler secret put BETTER_AUTH_SECRET
```

The same goes for `RESEND_API_KEY` and `ADMIN_EMAILS`. It takes effect on the live worker straight away. Rotating `BETTER_AUTH_SECRET` signs everyone out, and counts each searcher as new once.

If a secret leaked, rotate it at its source too: Resend, Neon or Cloudflare. If the Neon password changed, update the Hyperdrive config and the GitHub secret.

## Fix a company with the wrong kind

The kind can't be changed in the app. In Neon's SQL editor, with the company's id:

```sql
begin;
update companies set kind = 'garment_maker' where id = '<company id>';
update claims set scope = 'garment' where company_id = '<company id>';
commit;
```

For the other direction, use `fabric_mill` and `fabric`. If the update fails on `claims_one_verified_original`, another supplier already holds the verified original for that product and scope, so remove the verification on one of them first.

## Delete a supplier or a user

Use this for a data request, or to remove a test supplier. The app can't do it. `/privacy` promises this and `/terms` allows it, so answer requests promptly.

In Neon's SQL editor, find the company's id and owner, then its stored files:

```sql
select id, owner_user_id from companies where slug = '<company slug>';

select e.storage_key
from claim_evidence e join claims c on c.id = e.claim_id
where c.company_id = '<company id>';
```

Delete each file listed. This has to come first, because deleting the company removes the only record of them:

```bash
pnpm wrangler r2 object delete "xbul-evidence/<storage key>" --remote
```

Then delete the company and its owner. The company's claims, codes and documents' rows go with it, and so do the owner's sessions:

```sql
begin;
delete from companies where id = '<company id>';
delete from "user" where id = '<owner user id>';
commit;
```

For someone with no company, run only the `user` line. Products stay, because other suppliers may have tagged them. The person's data remains in database backups until those expire, within 90 days.

## Change the database schema

Add first, ship, then remove in a later release. For example, to rename a column: add the new one and write to both, ship, copy the old values across, ship code that only uses the new one, and only then drop the old one. This keeps a rollback safe at every step.

```bash
pnpm db:generate
```

Commit the generated file in `drizzle/`. The deploy workflows apply it.
