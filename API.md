# Indrive API Documentation

This document lists server API endpoints, request/response fields, and role requirements. All endpoints are prefixed with `/api` and use JSON except where noted (multipart/form-data for file uploads).

---

## Roles
- Public: no authentication required (signup, login).
- Authenticated User: valid JWT required (`Authorization: Bearer <token>`).
- Admin: authenticated user with `is_admin = true` in the `users` table.

---

## Auth

### POST /api/auth/signup
- Role: Public
- Content-Type: `application/json`
- Body:
  - `name` (string, required)
  - `email` (string, required)
  - `phone` (string, required)
  - `password` (string, required)
- Response: 201
  - `message` (string)
  - `user` { `id`, `name`, `email`, `phone` }

### POST /api/auth/verify-otp
- Role: Public
- Content-Type: `application/json`
- Body:
  - `email` (string, required)
  - `otp` (string, required)
- Response: 200
  - `message`, `user` summary

### POST /api/auth/resend-otp
- Role: Public
- Content-Type: `application/json`
- Body:
  - `email` (string, required)
- Response: 200
  - `message`

### POST /api/auth/login
- Role: Public
- Content-Type: `application/json`
- Body:
  - `email` (string, required)
  - `password` (string, required)
- Response: 200
  - `message`, `token` (JWT), `user` summary

### GET /api/auth/me
- Role: Authenticated User
- Response: 200
  - current user summary

### POST /api/auth/change-password
- Role: Authenticated User
- Body:
  - `old_password` (string)
  - `new_password` (string)
  - `confirm_password` (string)
- Response: 200
  - `message`

### POST /api/auth/forgot-password
- Role: Public
- Content-Type: `application/json`
- Body:
  - `email` (string, required)
- Response: 200
  - `message`

### POST /api/auth/reset-password
- Role: Public
- Content-Type: `application/json`
- Body:
  - `token` (string, required) — token sent in reset email
  - `new_password` (string, required)
  - `confirm_password` (string, required)
- Response: 200
  - `message`

---

## Users

### GET /api/users/profile
- Role: Authenticated User
- Response: 200
  - `id`, `name`, `email`, `phone`, `bio`, `address`, `city`, `state`, `postal_code`, `country`, `profile_picture_url`, `is_email_verified`, `is_active`, `created_at`, `updated_at`

### PATCH /api/users/profile
- Role: Authenticated User
- Content-Type: `application/json`
- Body (all optional):
  - `name`, `bio`, `address`, `city`, `state`, `postal_code`, `country`, `phone`
- Response: 200
  - `message`, `user` (updated summary)

### POST /api/users/profile-picture
- Role: Authenticated User
- Content-Type: `multipart/form-data`
- Form Field: `file` (image)
- Response: 201
  - `message`, `url`, `user` (summary)

### DELETE /api/users/profile-picture
- Role: Authenticated User
- Response: 200
  - `message`, `user`

### POST /api/users/deactivate
- Role: Authenticated User
- Response: 200
  - `message`

### POST /api/users/activate
- Role: Authenticated User
- Response: 200
  - `message`

---

## Driver Registration

### POST /api/driver-registration
- Role: Authenticated User (applicant)
- Content-Type: `multipart/form-data`
- Text fields (body):
  - `vehicleType` (string, required) allowed: `bike | car | auto | van`
  - `firstName` (string, required)
  - `lastName` (string, required)
  - `dateOfBirth` (ISO date string, required)
  - `licenseNumber` (string, required)
  - `expirationDate` (ISO date string, required)
  - `idNumber` (string, required)
  - `vehicleBrand` (string, required)
  - `vehicleModel` (string, required)
  - `vehicleColor` (string, required)
  - `numberPlate` (string, required)
  - `productionYear` (integer, required)

- File fields (multipart):
  - `personalPicture` (image, required)
  - `frontSideOfLicense` (image, required)
  - `selfieWithDriverLicense` (image, required)
  - `cnicFront` (image, required)
  - `cnicBack` (image, required)
  - `photoOfVehicle` (image, required)
  - `vehicleRegistrationCertificate` (image, required)
  - `backsideOfVehicleInformation` (image, required)

- Response: 201
  - `message`
  - `driverRegistration` object (summary including `status` set to `pending`)

### GET /api/driver-registration/me
- Role: Authenticated User
- Response: 200
  - `driverRegistration` object (detailed)

Notes:
- Uploaded images are stored via Cloudinary; stored fields include `_Url` and `_PublicId` for each uploaded file in the `driver_registrations` table.
- A user can have at most one driver registration (unique on `user_id`).

---

## Ride Requests & Driver Alerts

This module implements the Indrive-style request, bidding and acceptance flow. Summary of the user flow:

- Rider enters pickup and dropoff locations in the app.
- Frontend computes distance (Haversine) using coordinates and calls the backend `POST /api/ride-requests/estimate` to receive a professional fare breakdown for each vehicle type.
- Frontend shows fares to the rider; the rider may optionally increase the offered price.
- Rider selects a vehicle type **and a payment method (`online` or `cash`)**, then submits the ride request (`POST /api/ride-requests`). The request includes coordinates, selected vehicle type, payment method, and the (possibly adjusted) `offeredPrice`. The payment method is chosen once here by the rider and is fixed for the ride — the driver cannot change it.
- Backend creates a `ride_request` record, finds matching approved drivers in the same normalized operating area, and creates a `driver_ride_alert` for each. Alerts are delivered via in-app/system/email. (Socket delivery may be used; see notes.)
- Drivers targeted by the alert can respond with `interested` plus an optional `counterOfferPrice` (they may raise their price) using `POST /api/ride-requests/:rideRequestId/driver/respond`.
- Rider fetches responses with `GET /api/ride-requests/:rideRequestId/responses` and sees all interested drivers and any counter-offers.
- Rider selects one driver by calling `POST /api/ride-requests/:rideRequestId/select-driver/:driverId`, which marks the ride as `driver_selected` and stores the chosen driver.

Notes on real-time behaviour:
- For a real-time experience, integrate Socket.IO on both client and server:
  - Emit a `ride_request:created` event with `rideRequestId` and details when a request is created.
  - Drivers should be subscribed to a room for their normalized `operatingArea` and vehicle family (e.g., `area:bahawalpur:car`).
  - When a driver responds, emit a `ride_request:response` event to the rider's socket so the UI updates live.

### POST /api/ride-requests/estimate
- Role: Public
- Content-Type: `application/json`
- Body:
  - `pickupLatitude` (number, required)
  - `pickupLongitude` (number, required)
  - `dropoffLatitude` (number, required)
  - `dropoffLongitude` (number, required)
  - `serviceArea` (string, optional) allowed: `city | out_of_city`
- Response: 200
  - `estimatedDistanceKm` (number)
  - `serviceArea` (string)
  - `fares` (object) — fare breakdown per vehicle type, each entry includes `totalFare`, `companyCommission`, `driverPayout`, `estimatedDistanceKm` and breakdown details returned by the fare calculator.

### POST /api/ride-requests
- Role: Authenticated User (Rider)
- Content-Type: `application/json`
- Body:
  - `pickupLocation` (string, required)
  - `dropoffLocation` (string, required)
  - `vehicleType` (string, required) allowed: `bike | rikshaw | car_without_ac | car_with_ac | business_car`
  - `paymentMethod` (string, required) allowed: `online | cash` — chosen by the rider here, up front. This is the only place it's set; it can't be changed by the driver later at ride completion.
  - `pickupArea` (string, optional)
  - `pickupLatitude` (number, required)
  - `pickupLongitude` (number, required)
  - `dropoffLatitude` (number, required)
  - `dropoffLongitude` (number, required)
  - `serviceArea` (string, optional) allowed: `city | out_of_city`
  - `offeredPrice` (number, optional) — if provided, backend will accept this as the rider's offered price (recommended to be >= estimate).
  - `notes` (string, optional)
- Response: 201
  - `message`
  - `rideRequest` (ride details including `estimatedDistanceKm`, `offeredPrice`, `driverPayout`, `companyCommission`, `paymentMethod`)
  - `dispatchedAlerts` (integer)

### GET /api/ride-requests/me
- Role: Authenticated User (Rider)
- Response: 200
  - `rideRequests` array (rider's own requests, latest first)

### GET /api/ride-requests/driver/alerts
- Role: Authenticated User (Driver app view)
- Response: 200
  - `alerts` array with:
    - `id`, `rideRequestId`, `driverId`, `vehicleType`, `message`
    - `inAppStatus`, `systemStatus`, `emailStatus`, `emailError`
    - `isRead`, `createdAt`, `updatedAt`
    - `ride` (embedded summary) — includes `paymentMethod` (`online | cash`) so the driver knows upfront, before responding, whether they'll collect cash or get paid out online

### POST /api/ride-requests/:rideRequestId/driver/respond
- Role: Authenticated User (Driver)
- Content-Type: `application/json`
- Body:
  - `decision` (string, required) — allowed values: `interested` | `not_interested`
  - `counterOfferPrice` (number, optional) — driver can increase price
  - `message` (string, optional)
- Response: 200
  - `message`, `response` (response details, including `counterOfferPrice` if provided)

### GET /api/ride-requests/:rideRequestId/responses
- Role: Authenticated User (Rider)
- Response: 200
  - `rideRequestId`, `status`, `selectedDriverId`, `responses` array with each driver response: `driverId`, `decision`, `counterOfferPrice`, `message`, timestamps

### POST /api/ride-requests/:rideRequestId/select-driver/:driverId
- Role: Authenticated User (Rider)
- Action: sets the ride request `status = 'driver_selected'` and records `selectedDriverId` and `selectedAt`.
- Response: 200
  - `message`, `rideRequest`, `selectedResponse`

### PATCH /api/ride-requests/driver/alerts/:alertId
- Role: Authenticated User (Driver)
- Body:
  - `isRead` (boolean, required)
- Response: 200
  - `message`, `alert` (updated)

### POST /api/ride-requests/:rideRequestId/complete
- Role: Authenticated User (Driver, must be the ride's `selectedDriverId`)
- Body: none — the driver has no input here. The payment method was already fixed by the rider at ride creation (`POST /api/ride-requests`); the driver cannot choose or override it.
- Precondition: ride must currently be `status = 'driver_selected'` and must already have a valid `paymentMethod` set (always true for rides created after this change).
- Action: sets `status = 'completed'` and `completedAt`, then settles the driver's wallet based on the ride's existing `paymentMethod`:
  - `cash`: the driver already collected the full fare by hand, so the company's cut (`companyCommission`) is immediately **debited** from the driver's wallet (`wallet_transactions.type = 'commission_debit'`). The wallet balance is allowed to go negative — a driver with insufficient balance simply carries a debt forward.
  - `online`: no wallet movement happens yet. The rider must separately pay via `POST /api/payments/jazzcash/initiate`; the driver's payout is credited only once that payment succeeds (see Payments section).
- Response: 200
  - `message`, `rideRequest` (updated, includes `paymentMethod`, `completedAt`), `wallet` (`{ balance }` for the `cash` case, otherwise `null`)

---

## Payments (JazzCash)

Ride fare payments are processed through JazzCash's Hosted Checkout Page (HCP). The rider's browser/webview is redirected to a JazzCash-hosted page (supports JazzCash wallet, debit/credit card, and bank account) and JazzCash POSTs the transaction result back to a server callback URL, which then redirects the rider to a frontend success/failure page.

Flow:
1. This flow only applies to rides where the rider chose `paymentMethod: "online"` at creation. The driver must first call `POST /api/ride-requests/:rideRequestId/complete` (no body) — payment cannot be initiated on a ride that's still `driver_selected`, and a ride created with `paymentMethod: "cash"` can't be paid online at all.
2. Rider calls `POST /api/payments/jazzcash/initiate` with the `rideRequestId` they want to pay for.
3. Backend creates a `payments` record (`status = pending`) and returns a `checkoutUrl` plus a `fields` object (all `pp_*` parameters including the signed `pp_SecureHash`). If the rider re-opens checkout for the same ride while an earlier attempt is still pending and unexpired, the **same** `paymentId`/`txnRefNo` is returned instead of minting a new one — this avoids the rider being charged twice for the same ride from two separate live checkout sessions.
4. Client auto-submits an HTML form (`POST` with all `fields`) to `checkoutUrl` — typically inside a WebView.
5. Rider completes payment on the JazzCash page. JazzCash POSTs the result to our `pp_ReturnURL` (`/api/payments/jazzcash/callback`).
6. Backend verifies `pp_SecureHash` and that `pp_Amount` matches the amount we recorded for that payment (protects against a tampered callback), then updates the payment record (`completed` if the hash and amount check out and `pp_ResponseCode == "000"`, otherwise `failed`), and redirects the browser to the configured frontend success/failure URL with `paymentId`, `status`, and `txnRefNo` query params.
7. On a successful transition to `completed`, the driver's payout (`ride_requests.driverPayout`) is credited to their wallet exactly once — a retried callback or a manual `/inquire` re-check afterwards cannot double-credit it (enforced at the database level, not just in application code).
8. Client can poll `GET /api/payments/jazzcash/:paymentId/status` to confirm the final state, or call `POST /api/payments/jazzcash/:paymentId/inquire` to force a live JazzCash status check (useful if the browser was closed before the callback landed).

### POST /api/payments/jazzcash/initiate
- Role: Authenticated User (Rider, must own the ride request)
- Content-Type: `application/json`
- Body:
  - `rideRequestId` (string uuid, required)
  - `description` (string, optional, max 100 chars)
- Behavior: amount charged is `ride_requests.offeredPrice`. Rejects (400) if: the ride isn't `status = 'completed'` yet, the ride was settled with `cash`, or it already has a `completed` payment. Reuses an existing non-expired `pending` payment for the same ride instead of creating a new one.
- Response: 201
  - `message`, `paymentId`, `txnRefNo`, `checkoutUrl`, `fields` (object of `pp_*` form fields to POST to `checkoutUrl`)

### POST /api/payments/jazzcash/callback
- Role: Public (called by JazzCash, not by app clients)
- Content-Type: `application/x-www-form-urlencoded`
- Action: verifies `pp_SecureHash` and `pp_Amount`, updates the matching `payments` row by `pp_TxnRefNo`, credits the driver's wallet on first success, and issues an HTTP redirect (302) to the frontend success/failure URL.

### GET /api/payments/jazzcash/:paymentId/status
- Role: Authenticated User (must own the payment)
- Response: 200
  - `payment` { `id`, `rideRequestId`, `riderId`, `provider`, `amount`, `currency`, `status` (`pending | completed | failed | expired`), `txnRefNo`, `jazzcashResponseCode`, `jazzcashResponseMessage`, `paidAt`, `createdAt`, `updatedAt` }

### POST /api/payments/jazzcash/:paymentId/inquire
- Role: Authenticated User (must own the payment)
- Action: if the payment isn't already `completed`, calls JazzCash's Payment Inquiry API live and syncs the local status (crediting the driver's wallet if this is what confirms success).
- Response: 200
  - `payment` (same shape as status endpoint)

### GET /api/payments/ride/:rideRequestId
- Role: Authenticated User (Rider, must own the ride request)
- Response: 200
  - `payments` array (all payment attempts for that ride request, latest first)

---

## Wallet (Drivers)

Every driver has a running `wallet_balance` on their `users` row, backed by an append-only `wallet_transactions` ledger. The balance **can go negative** — a driver who collects cash owes the company's commission even if they haven't earned enough online to cover it yet.

- `ride_earning`: credited automatically when an online JazzCash payment for one of the driver's rides completes (amount = `driverPayout`).
- `commission_debit`: debited automatically when the driver marks a ride completed with `paymentMethod: "cash"` (amount = `companyCommission`).
- `withdrawal`: created by the driver via `POST /api/wallet/withdraw`; reserves the funds immediately (`status = pending`) pending manual fulfillment by an admin.
- `withdrawal_rejected_refund`: created automatically when an admin rejects a pending withdrawal, crediting the reserved amount back.

**Note on withdrawals:** JazzCash credentials configured for this project are collection-only (Merchant ID/Password/Integrity Salt) — there is no disbursement/payout API wired up. A withdrawal request only reserves the funds in the ledger; actually paying the driver out (bank transfer, JazzCash mobile transfer, etc.) is a manual step the admin performs before calling the "complete" endpoint below.

### GET /api/wallet/me
- Role: Authenticated User (must be a driver — `is_driver = true`, otherwise 403)
- Response: 200
  - `balance` (number), `recentTransactions` (last 20 ledger entries)

### GET /api/wallet/transactions?page&limit
- Role: Authenticated User (driver)
- Query params: `page` (default 1), `limit` (default 20, max 100)
- Response: 200
  - `transactions` array, `pagination` { `page`, `limit`, `total` }

### POST /api/wallet/withdraw
- Role: Authenticated User (driver)
- Content-Type: `application/json`
- Body:
  - `amount` (number, required, > 0)
- Behavior: rejects (400) if `amount` exceeds the current wallet balance. On success, immediately deducts the amount and creates a `pending` withdrawal ledger entry.
- Response: 201
  - `message`, `balance` (new balance after reservation), `transaction`

---

## Admin

> Admin-only endpoints require: 1) authentication with JWT, 2) the requesting user must have `is_admin = true`.

### GET /api/admin/driver-registrations?status={optional}
- Role: Admin
- Query params:
  - `status` (optional): filter by `pending` / `approved` / `rejected`
- Response: 200
  - `registrations`: array of registration objects

### GET /api/admin/driver-registrations/:id
- Role: Admin
- Response: 200
  - `registration` object

### POST /api/admin/driver-registrations/:id/approve
- Role: Admin
- Action: sets `driver_registrations.status = 'approved'` and sets the corresponding `users.is_driver = true`.
- Response: 200
  - `message`, updated `registration`

### POST /api/admin/driver-registrations/:id/reject
- Role: Admin
- Body (optional):
  - `reason` (string) — admin-provided rejection reason
- Action: sets `driver_registrations.status = 'rejected'`.
- Response: 200
  - `message`, updated `registration`, `reason` (if provided)

### GET /api/admin/wallet/withdrawals?status={optional}
- Role: Admin
- Query params:
  - `status` (optional): filter by `pending` / `completed` / `rejected`
- Response: 200
  - `withdrawals`: array of wallet ledger entries with `type = 'withdrawal'`

### POST /api/admin/wallet/withdrawals/:id/complete
- Role: Admin
- Action: marks a `pending` withdrawal as `completed`, confirming the admin has actually paid the driver out by some external means (bank transfer, JazzCash mobile transfer, etc.). Does not move any money itself.
- Response: 200
  - `message`, `transaction` (updated)

### POST /api/admin/wallet/withdrawals/:id/reject
- Role: Admin
- Body (optional):
  - `reason` (string)
- Action: marks a `pending` withdrawal as `rejected` and refunds the reserved amount back into the driver's wallet balance.
- Response: 200
  - `message`, `transaction` (updated)

---

## Database Fields (high level)
- `users` table includes: `id (uuid)`, `name`, `email`, `phone`, `password`, `is_email_verified`, `profile_picture_url`, `profile_picture_public_id`, `is_active`, `is_admin`, `is_driver`, `wallet_balance` (numeric, can be negative), `created_at`, `updated_at`.
- `driver_registrations` table includes: `id (uuid)`, `user_id (uuid)`, `firstName`, `lastName`, `dateOfBirth`, `personalPictureUrl`, `personalPicturePublicId`, `licenseNumber`, `expirationDate`, `frontSideOfLicenseUrl`, `frontSideOfLicensePublicId`, `selfieWithDriverLicenseUrl`, `selfieWithDriverLicensePublicId`, `idNumber`, `cnicFrontUrl`, `cnicFrontPublicId`, `cnicBackUrl`, `cnicBackPublicId`, `photoOfVehicleUrl`, `photoOfVehiclePublicId`, `vehicleRegistrationCertificateUrl`, `vehicleRegistrationCertificatePublicId`, `backsideOfVehicleInformationUrl`, `backsideOfVehicleInformationPublicId`, `vehicleBrand`, `vehicleType`, `vehicleModel`, `vehicleColor`, `numberPlate`, `productionYear`, `status`, `createdAt`, `updatedAt`.
- `driver_registrations.operatingArea` is stored in normalized format for consistent matching.
- `ride_requests` table includes: `id (uuid)`, `rider_id (uuid)`, `pickupLocation`, `dropoffLocation`, `vehicleType`, `offeredPrice`, `companyCommission`, `driverPayout`, optional coordinates (`pickupLatitude`, `pickupLongitude`, `dropoffLatitude`, `dropoffLongitude`), `notes`, `status` (`open | driver_selected | completed`), `selected_driver_id`, `selectedAt`, `payment_method` (`online | cash`, chosen by the rider at creation, fixed for the life of the ride), `completed_at`, `createdAt`, `updatedAt`.
- `driver_ride_alerts` table includes: `id (uuid)`, `ride_request_id (uuid)`, `driver_id (uuid)`, `vehicleType`, `message`, `inAppStatus`, `systemStatus`, `emailStatus`, `emailError`, `isRead`, `createdAt`, `updatedAt`.
- `payments` table includes: `id (uuid)`, `ride_request_id (uuid)`, `rider_id (uuid)`, `provider` (default `jazzcash`), `amount`, `currency` (default `PKR`), `status` (`pending | completed | failed | expired`), `txn_ref_no` (unique), `bill_reference`, `expires_at`, `jazzcash_response_code`, `jazzcash_response_message`, `jazzcash_retrieval_reference_no`, `jazzcash_auth_code`, `rawCallbackPayload` (jsonb), `paid_at`, `createdAt`, `updatedAt`.
- `wallet_transactions` table includes: `id (uuid)`, `user_id (uuid)`, `type` (`ride_earning | commission_debit | withdrawal | withdrawal_rejected_refund`), `amount` (signed), `balance_after`, `ride_request_id (uuid, nullable)`, `description`, `status` (`completed | pending | rejected`), `rejection_reason`, `createdAt`, `updatedAt`. A unique constraint on `(ride_request_id, type)` guarantees at most one `ride_earning` and one `commission_debit` row per ride, which is what prevents double-crediting/double-debiting from a retried webhook or race.

---

## Security & Notes
- All authenticated endpoints require `Authorization: Bearer <jwt>`.
- File uploads must be image types (jpeg/png/webp/gif) and are validated server-side. Consider adding explicit size limits in the client and server as needed.
- Current alert channels are in-app/system/email. SMS can replace email in a future iteration without changing ride request creation contract.
- For production, set `synchronize = false` for TypeORM migrations and use migrations to evolve schema safely.
- Consider adding audit logs and email notifications when admin approves/rejects registrations.

---

## Payments & Wallet: Production Readiness Notes

Everything below was verified against the real database with live HTTP calls (signup → complete ride → pay → wallet credit/debit → withdraw → admin fulfillment) before shipping, including the edge cases: idempotent double-callback, tampered-amount callback, concurrent-safe balance locking, and negative-balance cash settlement.

**Before going live:**
- Set `JAZZCASH_ENV=production` and `JAZZCASH_RETURN_URL` to your real public API domain — right now both default to sandbox/localhost values in `.env`.
- Confirm with JazzCash whether `MC990680` / the current password+salt are sandbox-only or also valid in production; if sandbox-only, you'll get new production credentials to swap in.
- Run `npm run migration:run` against the production database before deploying (production runs with `synchronize: false`, so schema changes only apply via migrations).
- Withdrawals are payout **requests** only — see the Wallet section above. There's no automated bank/JazzCash disbursement wired in; an admin must actually move the money before marking a withdrawal complete.

**Two issues found in the wider codebase (not part of this payments/wallet work, flagging since they affect production hardening generally):**
- `main.ts` calls `app.enableCors({ origin: true, ... })`, which reflects any request origin. The `.env` file defines `CORS_ORIGIN` but nothing in the code reads it — that variable is currently dead config. Worth deciding whether to lock CORS down to `CORS_ORIGIN` before production.
- `JwtAuthGuard` logs the first 80 characters of every request's `Authorization` header to stdout, which includes a meaningful chunk of the JWT itself. Fine for local debugging, but worth removing before those logs go anywhere persistent/shared in production.

**A subtle environment gotcha worth knowing if you extend this further:** this server's host clock is UTC+5. Postgres `timestamp` (without timezone) columns populated by `now()`/`@CreateDateColumn`, when read back through the `pg` driver and compared against a freshly computed `Date.now()`/`new Date()` in the same request, come back shifted by the host's UTC offset — a well-known `node-postgres` default-parsing quirk. This was caught and fixed for the JazzCash pending-payment expiry check (`payments.expires_at` is now computed and stored explicitly in application code, the same pattern already used for `otp_expires_at`, rather than derived from `createdAt` at read time). If you add new logic elsewhere that compares "now" against a DB-generated timestamp column, use the same pattern — or migrate the column to `timestamptz`, which round-trips correctly regardless of host timezone.

---

If you'd like, I can:
- Add API examples (curl) for each endpoint,
- Add OpenAPI (Swagger) decorators and generate an interactive docs page,
- Add notification emails on approval/rejection.

