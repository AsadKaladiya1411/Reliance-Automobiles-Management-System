# RAMS Project-Wide Audit Report

Audit date: 2026-07-25

## Final Recommendation

Not Ready for Production.

RAMS has a strong working ERP foundation, but it should not be declared production-ready yet. Critical runtime/build issues found in this audit were fixed, and the codebase passes local static/build verification. Production readiness still requires automated integration tests, deeper permission/action enforcement, workshop billing completion, stronger operational controls, and deployment hardening.

## Verification Performed

- Reviewed backend route mounting, middleware, authentication, RBAC, Prisma schema, key posting services, audit logging, and transaction boundaries.
- Reviewed frontend navigation, global data fetching, role-aware access, shared error notification behavior, and primary workspace integration.
- Ran `npm run typecheck`.
- Ran `npm run lint`.
- Ran `npm run prisma:generate`.
- Ran `npm test --workspaces --if-present`.
- Ran `npm run build`.

No unit or integration test scripts are currently defined, so `npm test --workspaces --if-present` completed without executing a real test suite.

## Bugs Found and Fixed

1. Settings-only API requests were executed for users without Settings access.
   - Impact: Staff users could receive avoidable 403 responses after login because the shell fetched company, financial years, number series, and audit logs regardless of visible navigation.
   - Fix: Settings-related frontend queries are now enabled only when the authenticated user can access Settings.

2. State-changing cookie-auth requests had no explicit same-origin mutation guard.
   - Impact: SameSite cookie behavior helped, but the API lacked an application-level origin check for POST/PATCH/PUT/DELETE requests.
   - Fix: Added `requireSameOriginForMutations`. Mutating requests with a foreign `Origin` are rejected with `403 INVALID_ORIGIN`.

3. Missing master route parameters produced generic server errors.
   - Impact: A malformed warehouse hierarchy route could produce a 500 instead of a client-safe API error.
   - Fix: `routeParam` now throws `ApiError(400, "MISSING_ROUTE_PARAMETER", ...)`.

## Remaining Known Issues

- No automated unit/integration/API workflow test suite exists yet.
- Posting workflows are implemented, but not covered by repeatable transaction tests.
- Permission enforcement is module-level and method-derived; special routes such as approval/post/cancel need finer action-specific policies.
- Workshop billing is incomplete. Parts issue exists, but customer billing for labor and issued parts needs a no-double-stock-consumption design.
- Master data mostly supports create/list only. Edit, deactivate, detail, search, and pagination are still incomplete.
- Reports lack date filters, exports, drilldowns, and reconciliation-grade registers.
- Number series generation increments inside transactions but is not explicitly protected by database row locking semantics.
- Fiscal period enforcement is incomplete; postings are not yet blocked by closed/locked financial years.
- Payment allocation against specific invoices is not implemented.
- Advanced GST reporting/export workflows are not implemented.

## Security Observations

- Authentication uses HTTP-only cookies and JWT-backed session lookup.
- Password hashing uses bcrypt with configurable salt rounds.
- Helmet and CORS are configured.
- Same-origin guard now protects mutating requests when an `Origin` header is present.
- Prisma query APIs reduce SQL injection risk.
- Sensitive password hashes are not returned in auth/user listing APIs.
- Remaining security work: rate limiting, account lockout enforcement, action-level RBAC policies, and production hosting security review.

## Performance Observations

- Many list endpoints cap results or order indexed columns, but pagination is inconsistent.
- Several frontend workspaces fetch many datasets at once when a workspace is opened.
- Dashboard summary APIs are lightweight aggregate calls and acceptable for MVP scale.
- Reports reuse existing APIs; this is consistent but will need dedicated filtered endpoints as data grows.
- Remaining performance work: pagination/search, date filters, index review with real data, and frontend module splitting.

## Code Quality Observations

- Backend route/service boundaries are consistent.
- Posting services generally use Prisma transactions and create accounting/inventory/audit records atomically.
- Error responses follow a consistent envelope via `ApiError`.
- There is duplicated helper logic for validation, date parsing, number series, account lookup, tax calculation, and location keys.
- Frontend is functional but concentrated in one very large `App.tsx`; this is now a maintainability risk.

## Module-Wise Health Status

| Module | Health | Notes |
| --- | --- | --- |
| Foundation | Fair | Working setup, env, API shell, audit, number series. Needs deployment/runbook/testing. |
| Auth/RBAC | Fair | Auth works, role assignment exists, module guard added. Needs rate limits, account lock enforcement, action policies. |
| Masters | Fair | Core master creation and listing work. Needs edit/deactivate/search/pagination. |
| Commercial Masters | Fair | Customers/suppliers/employees/vehicles/payment modes exist. Needs richer profiles and lifecycle controls. |
| Inventory | Fair | Stock movements, balances, transfers, negative stock checks, reorder alerts exist. Needs valuation depth and tracking. |
| Purchase | Fair | Posting/cancel/return workflows exist. Needs conversion workflows, partials, approvals, tests. |
| Sales | Fair | Posting/cancel/return workflows exist. Needs conversion workflows, pricing/discounts, tests. |
| Workshop | Needs Work | Job cards and parts issue exist. Billing and closure workflow remain major gaps. |
| Accounting | Fair | Journals, ledgers, statements exist. Needs fiscal controls, reconciliation, voucher depth. |
| GST | Basic | Summary exists. Needs registers, exports, reconciliation. |
| Reports | Basic | Workspace exists. Needs filters, exports, drilldowns. |
| Frontend UX | Basic/Fair | Usable desktop shell. Needs data tables, details, validation polish, modularization. |
| Testing | Poor | No real test suite yet. |
| Deployment/Ops | Poor | Build works, but production operations are not complete. |

## Production Readiness Checklist

- [x] Application builds successfully.
- [x] TypeScript typecheck passes.
- [x] Lint passes.
- [x] Prisma client generation succeeds.
- [x] Core auth flow exists.
- [x] Module-level RBAC guard exists.
- [x] Audit logs exist for important created/posted actions.
- [x] Key posting workflows use database transactions.
- [ ] Automated integration tests exist for posting workflows.
- [ ] Automated frontend workflow tests exist.
- [ ] Login/register rate limiting exists.
- [ ] Account lockout is enforced.
- [ ] Fiscal year close/lock posting controls exist.
- [ ] Master edit/deactivate/search/pagination exists.
- [ ] Workshop billing workflow exists.
- [ ] Report filters/exports exist.
- [ ] Production logging/monitoring exists.
- [ ] Backup/restore and migration runbooks exist.
- [ ] Deployment environment and secrets process are documented.

## Audit Conclusion

RAMS is suitable for local development and controlled demo/testing, but not for production business use yet. The next highest-value work is master-data lifecycle support, automated transaction tests, and workshop billing design/implementation.
