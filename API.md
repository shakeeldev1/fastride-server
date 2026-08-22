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
  - `id`, `name`, `email`, `phone`, `bio`, `address`, `city`, `state`, `postal_code`, `country`, `profile_picture_url`, `is_email_verified`, `is_active`, `is_driver`, `jazzcash_account_number`, `jazzcash_account_title`, `created_at`, `updated_at`

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

### PATCH /api/users/driver/payment-method
- Role: Authenticated User (Driver, must already be approved — `is_driver = true`)
- Content-Type: `application/json`
- Body:
  - `jazzcashAccountNumber` (string, required, 4–20 chars) — the JazzCash mobile/account number riders will transfer to for online-payment rides
  - `jazzcashAccountTitle` (string, required, 2–100 chars) — the account holder name shown to riders alongside the number
- Response: 200
  - `message`, `user` (updated summary — includes `jazzcash_account_number`/`jazzcash_account_title`)
- Errors: 403 if the requesting user is not an approved driver (`is_driver` is only `true` once an admin has approved the driver's registration — see `POST /api/admin/driver-registrations/:id/approve`).
- **App integration note:** show the "Add Payment Method" action only once the driver's own registration status is `approved` (from `GET /api/driver-registration/me`, or simply once `GET /api/users/profile` returns `is_driver: true`). Calling this endpoint before approval will 403.
- This is exactly what riders are shown as `driverPaymentDetails` once they select this driver on an `online`-payment ride (see Ride Requests below).

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
- Once an admin approves the registration (`users.is_driver = true`), the driver should be prompted to set up their JazzCash payout details (`PATCH /api/users/driver/payment-method`) and, if they intend to accept rides, top up their wallet (see Wallet Top-Up below) — a driver with `0` wallet balance cannot respond `interested` to any ride that has a non-zero commission.

---

## Ride Requests & Driver Alerts

This module implements the request → bid → acceptance → completion flow. **Money for the ride fare itself never passes through this backend, for either payment method** — the platform only ever moves money for its own commission, via each driver's wallet. Summary of the flow:

1. Rider enters pickup and dropoff locations in the app.
2. Frontend computes distance (Haversine) using coordinates and calls `POST /api/ride-requests/estimate` to get a fare breakdown per vehicle type.
3. Frontend shows fares to the rider; the rider may optionally increase the offered price, picks a vehicle type, and picks a **payment method** — `cash` (handed to the driver in person) or `online` (rider transfers directly to the driver's JazzCash account once one is selected — see step 7). This choice is made once, here, and cannot be changed later.
4. Rider submits `POST /api/ride-requests` with all of the above. Backend creates the `ride_request` (`status = 'open'`), finds matching approved drivers in the same normalized operating area, and creates a `driver_ride_alert` for each (delivered in-app/system/email, and over Socket.IO — see notes below).
5. A targeted driver responds `interested` (optionally with a `counterOfferPrice`) or `declined` via `POST /api/ride-requests/:rideRequestId/driver/respond`. **Responding `interested` places a hold on that ride's `companyCommission` amount against the driver's wallet** — if the driver's available balance (`wallet_balance` minus every other still-active hold) can't cover it, the call fails with 400 and no response is recorded. This is why a driver needs wallet funds before they can keep accepting rides (see Wallet below).
6. Rider fetches responses with `GET /api/ride-requests/:rideRequestId/responses`.
7. Rider selects one driver via `POST /api/ride-requests/:rideRequestId/select-driver/:driverId` → `status = 'driver_selected'`. Every other interested driver's hold is released immediately (they weren't chosen, no reason to keep their funds tied up). If `paymentMethod = 'online'`, the response now includes `driverPaymentDetails` (the selected driver's JazzCash account number + title) — **this is the entire online-payment flow**: the app shows these details to the rider, and the rider sends the transfer themselves, outside the app. The backend never sees or confirms that transfer.
8. Either the ride completes normally, or the rider cancels it first:
   - `POST /api/ride-requests/:rideRequestId/cancel` (rider only, while `open` or `driver_selected`) → `status = 'cancelled'`, and any active hold on the ride is released back to the driver's available balance.
   - `POST /api/ride-requests/:rideRequestId/complete` (the selected driver only, while `driver_selected`) → `status = 'completed'`, and the ride's `companyCommission` is **debited** from the driver's wallet, capturing the earlier hold. This happens for **both** `cash` and `online` rides now — the driver already has the fare in hand (or received it directly), so commission is simply a standalone wallet debit, not something skimmed out of a payment the platform processed.

Notes on real-time behaviour:
- Integrate Socket.IO on both client and server for live updates:
  - `ride_request:created` — emitted to a driver's `area:{normalizedArea}:{vehicleFamily}` room when a new request matches them.
  - `ride_request:response` — emitted to the rider when a driver responds.
  - `ride_request:driver_selected` (to rider) / `ride_request:driver_assigned` (to driver) — emitted when a driver is selected.
  - `ride_request:cancelled` — emitted to the rider and (if one was selected) the driver when the rider cancels.
  - `chat:message` — chat messages once the ride is `driver_selected` (see `GET /:rideRequestId/chat` below for history).
  - Rooms: riders join `rider:{userId}`; drivers join `driver:{userId}` and `area:{normalizedArea}:{vehicleFamily}`.

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
  - `paymentMethod` (string, required) allowed: `online | cash` — chosen by the rider here, up front; fixed for the life of the ride, the driver cannot change it. `online` means the rider will pay the selected driver directly via JazzCash once one is chosen (see step 7 above) — the backend never processes this payment.
  - `pickupLocation` (string, required)
  - `dropoffLocation` (string, required)
  - `vehicleType` (string, required) allowed: `bike | rikshaw | car_without_ac | car_with_ac | business_car`
  - `pickupArea` (string, optional)
  - `pickupLatitude` (number, required)
  - `pickupLongitude` (number, required)
  - `dropoffLatitude` (number, required)
  - `dropoffLongitude` (number, required)
  - `serviceArea` (string, optional) allowed: `city | out_of_city`
  - `offeredPrice` (number, optional) — if provided, backend accepts this as the rider's offered price (recommended to be >= estimate). Note `companyCommission`/`driverPayout` are always derived from the backend's own calculated fare (12% of the distance/vehicle-type based total), **not** from a custom `offeredPrice`.
  - `notes` (string, optional)
- Response: 201
  - `message`
  - `rideRequest` (ride details including `estimatedDistanceKm`, `offeredPrice`, `driverPayout`, `companyCommission`, `paymentMethod`, `status`)
  - `dispatchedAlerts` (integer)

### GET /api/ride-requests/me
- Role: Authenticated User (Rider)
- Response: 200
  - `rideRequests` array (rider's own requests, latest first). Once a driver is selected and `paymentMethod = 'online'`, each entry also carries `driverPaymentDetails: { jazzcashAccountNumber, jazzcashAccountTitle }` — poll this endpoint (or use the `ride_request:driver_selected` socket event) to know when/where to show the transfer instructions, and keep showing them throughout tracking.

### GET /api/ride-requests/driver/alerts
- Role: Authenticated User (Driver app view)
- Response: 200
  - `alerts` array with:
    - `id`, `rideRequestId`, `driverId`, `vehicleType`, `message`
    - `inAppStatus`, `systemStatus`, `emailStatus`, `emailError`
    - `isRead`, `createdAt`, `updatedAt`
    - `ride` (embedded summary) — includes `paymentMethod` (`online | cash`) and `companyCommission`, so the driver's app can show upfront, before responding, both how they'll be paid and how much wallet balance responding `interested` will hold.

### POST /api/ride-requests/:rideRequestId/driver/respond
- Role: Authenticated User (Driver)
- Content-Type: `application/json`
- Body:
  - `decision` (string, required) — allowed values: `interested` | `declined`
  - `counterOfferPrice` (number, optional) — driver can propose a different price
  - `message` (string, optional)
- Response: 200
  - `message`, `response` (response details, including `counterOfferPrice` if provided)
- Errors: 400 if `decision = 'interested'` and the driver's available wallet balance (`wallet_balance` minus other active holds) is below this ride's `companyCommission` — **the response is not recorded** in that case; the app should surface this as "insufficient wallet balance, top up to accept this ride" and offer the top-up flow (see Wallet Top-Up below).
- Notes: a successful `interested` response places a hold on `companyCommission`. The hold is released if the driver later switches to `declined`, if the rider picks a different driver, or if the ride is cancelled — and is captured (converted into an actual debit) if this driver is selected and completes the ride. A driver can call this repeatedly on the same ride to flip their decision (e.g. `interested` → `declined` → `interested` again) — the hold is re-checked against the current balance each time it's (re)placed.

### GET /api/ride-requests/:rideRequestId/responses
- Role: Authenticated User (Rider)
- Response: 200
  - `rideRequestId`, `status`, `selectedDriverId`, `responses` array with each driver response: `driverId`, `decision`, `counterOfferPrice`, `message`, timestamps

### POST /api/ride-requests/:rideRequestId/select-driver/:driverId
- Role: Authenticated User (Rider)
- Action: sets `status = 'driver_selected'`, records `selectedDriverId`/`selectedAt`, and releases every other interested driver's wallet hold for this ride.
- Response: 200
  - `message`, `rideRequest` (includes `driverPaymentDetails: { jazzcashAccountNumber, jazzcashAccountTitle }` when `paymentMethod = 'online'`), `selectedResponse`
- Errors: 400 if the ride isn't `open`, or the given driver hasn't responded `interested`.

### POST /api/ride-requests/:rideRequestId/cancel
- Role: Authenticated User (Rider, own ride request only)
- Action: allowed while `status` is `open` or `driver_selected`. Sets `status = 'cancelled'`, records `cancelledAt`, and releases any active wallet hold(s) on the ride (every interested driver's hold if no one had been selected yet, or just the selected driver's if one had been).
- Response: 200
  - `message`, `rideRequest`
- Errors: 400 if the ride is already `completed` or `cancelled`; 403 if the caller isn't the owning rider.

### POST /api/ride-requests/:rideRequestId/complete
- Role: Authenticated User (Driver, must be the ride's `selectedDriverId`)
- Body: none — the driver has no input here. `paymentMethod` was already fixed by the rider at creation.
- Precondition: ride must currently be `status = 'driver_selected'`.
- Action: sets `status = 'completed'` and `completedAt`, then debits this ride's `companyCommission` from the driver's wallet (capturing the hold placed when they responded `interested`) — **for both `cash` and `online` rides**. This debit is idempotent: a duplicate/retried call cannot double-debit the same ride.
- Response: 200
  - `message`, `rideRequest` (updated), `wallet` (`{ balance }` reflecting the post-debit balance, or `null` if the commission was `0` or had already been debited)

### GET /api/ride-requests/:rideRequestId/chat
- Role: Authenticated User (the rider or the selected driver on this ride)
- Response: 200
  - Chat message history for the ride. Live messages arrive over the Socket.IO gateway's `chat:message` event once the ride is `driver_selected` (send with the same event name, body `{ rideRequestId, text }`); this REST endpoint is for loading history on screen load/reconnect.

### PATCH /api/ride-requests/driver/alerts/:alertId
- Role: Authenticated User (Driver)
- Body:
  - `isRead` (boolean, required)
- Response: 200
  - `message`, `alert` (updated)

---

## Online Ride Payments (Direct to Driver)

**There is no backend-mediated payment flow for ride fares anymore.** Earlier versions of this API had a JazzCash Hosted Checkout integration (`POST /api/payments/jazzcash/initiate`, `/callback`, `/status`, `/inquire`, `GET /api/payments/ride/:rideRequestId`) that routed the rider's payment through the company's own JazzCash merchant account. **Those endpoints have been removed.** If your app still calls them, remove that code — you'll get 404s.

The new model, for a ride created with `paymentMethod: "online"`:
1. Once the rider selects a driver (`POST /api/ride-requests/:rideRequestId/select-driver/:driverId`), the response — and every subsequent `GET /api/ride-requests/me` poll — includes `rideRequest.driverPaymentDetails: { jazzcashAccountNumber, jazzcashAccountTitle }`.
2. Show those details to the rider (e.g. "Send Rs {offeredPrice} to {jazzcashAccountTitle} — {jazzcashAccountNumber} via JazzCash") and let them complete the transfer in their own JazzCash app, or any P2P method they and the driver agree on. There is no in-app checkout, no webhook, nothing to poll for payment confirmation — the app's job here is purely informational/UI.
3. The driver marks the ride complete once they've received the funds (`POST /api/ride-requests/:rideRequestId/complete`), same call as for a `cash` ride. This is also the point the platform's own commission is deducted from the driver's wallet (see Ride Requests §8 above and Wallet below) — it is unrelated to, and independent of, whatever amount the rider actually transferred to the driver.

If a driver hasn't set up their JazzCash account yet (`PATCH /api/users/driver/payment-method`, see Users above), `driverPaymentDetails` fields will be `null` — the app should handle that gracefully (e.g. fall back to telling the rider to arrange payment directly with the driver via chat).

---

## Wallet (Drivers)

Every driver has a `wallet_balance` on their `users` row, backed by an append-only `wallet_transactions` ledger, plus a set of **holds** (`wallet_holds` table) that temporarily reserve funds against rides the driver has responded `interested` to but not yet completed or been passed over for.

- **`availableBalance`** (`wallet_balance` minus the sum of all currently-`active` holds) is what actually gates whether a driver can respond `interested` to a new ride (see `POST /api/ride-requests/:rideRequestId/driver/respond`) and how much they can withdraw. Always use `availableBalance`, not raw `balance`, when deciding in the UI whether to let the driver tap "Accept" on a ride, so the in-app message matches what the server will actually enforce.
- `wallet_transactions.type` values:
  - `wallet_top_up` — credited when a JazzCash wallet top-up completes (see Wallet Top-Up below).
  - `commission_debit` — debited when the driver completes a ride (`companyCommission`, both `cash` and `online` rides).
  - `withdrawal` — created by the driver via `POST /api/wallet/withdraw`; reserves funds immediately (`status = pending`) pending manual admin payout.
  - `withdrawal_rejected_refund` — created automatically when an admin rejects a pending withdrawal, crediting the reserved amount back.
  - `ride_earning` — legacy type from the old platform-mediated online-payment flow; no longer produced by any current code path, may still appear on old transaction history.

**Note on withdrawals:** the JazzCash credentials configured for this project are collection-only (used for wallet top-ups) — there is no disbursement/payout API wired up for withdrawals. A withdrawal request only reserves the funds in the ledger; actually paying the driver out (bank transfer, JazzCash mobile transfer, etc.) is a manual step the admin performs before calling the "complete" endpoint below. Withdrawal amount is checked against `availableBalance`, not raw balance, so a driver can't withdraw funds that are currently held against an accepted ride.

### GET /api/wallet/me
- Role: Authenticated User (must be a driver — `is_driver = true`, otherwise 403)
- Response: 200
  - `balance` (number) — raw `wallet_balance`
  - `heldBalance` (number) — sum of currently-active holds
  - `availableBalance` (number) — `balance - heldBalance`; this is the number to show as "usable" balance and to compare against a ride's commission before letting the driver tap Accept
  - `recentTransactions` (last 20 ledger entries)

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
- Behavior: rejects (400) if `amount` exceeds `availableBalance` (raw balance minus active holds). On success, immediately deducts the amount and creates a `pending` withdrawal ledger entry.
- Response: 201
  - `message`, `balance` (new raw balance after reservation), `transaction`

---

## Wallet Top-Up

Self-serve JazzCash checkout a driver uses to fund their wallet, so they have enough `availableBalance` to keep responding `interested` to rides. Structurally the same kind of flow the old ride-payment integration used (JazzCash Hosted Checkout Page redirect + server callback), but the money is credited to the driver's `wallet_balance` instead of being tied to a ride.

Flow:
1. Driver calls `POST /api/wallet/topup/jazzcash/initiate` with the `amount` they want to add.
2. Backend returns a `checkoutUrl` and a `fields` object (all `pp_*` parameters, including the signed `pp_SecureHash`).
3. Client auto-submits an HTML form (`POST` with all `fields`) to `checkoutUrl` — typically inside a WebView.
4. Driver completes payment on the JazzCash page. JazzCash POSTs the result to our server callback (`/api/wallet/topup/jazzcash/callback`), which the backend verifies and uses to credit the wallet, then redirects the browser to the configured frontend success/failure page with `topUpId`, `status`, `txnRefNo` query params.
5. Client can poll `GET /api/wallet/topup/:topUpId/status`, or call `POST /api/wallet/topup/:topUpId/inquire` to force a live JazzCash status check if the WebView was closed before the callback landed.

### POST /api/wallet/topup/jazzcash/initiate
- Role: Authenticated User (Driver)
- Content-Type: `application/json`
- Body:
  - `amount` (number, required, > 0)
- Behavior: reuses an existing non-expired `pending` top-up for the same amount instead of minting a new transaction reference, so re-opening the checkout screen doesn't risk a double charge.
- Response: 201
  - `message`, `topUpId`, `txnRefNo`, `checkoutUrl`, `fields` (object of `pp_*` form fields to POST to `checkoutUrl`)

### POST /api/wallet/topup/jazzcash/callback
- Role: Public (called by JazzCash, not by app clients)
- Content-Type: `application/x-www-form-urlencoded`
- Action: verifies `pp_SecureHash` and `pp_Amount`, updates the matching `wallet_topups` row by `pp_TxnRefNo`, credits the driver's wallet on first success, and issues an HTTP redirect (302) to the frontend success/failure URL.

### GET /api/wallet/topup/:topUpId/status
- Role: Authenticated User (must own the top-up)
- Response: 200
  - `topUp` { `id`, `userId`, `provider`, `amount`, `currency`, `status` (`pending | completed | failed | expired`), `txnRefNo`, `jazzcashResponseCode`, `jazzcashResponseMessage`, `paidAt`, `createdAt`, `updatedAt` }

### POST /api/wallet/topup/:topUpId/inquire
- Role: Authenticated User (must own the top-up)
- Action: if the top-up isn't already `completed`, calls JazzCash's Payment Inquiry API live and syncs the local status (crediting the wallet if this is what confirms success).
- Response: 200
  - `topUp` (same shape as status endpoint)

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
- `users` table includes: `id (uuid)`, `name`, `email`, `phone`, `password`, `is_email_verified`, `profile_picture_url`, `profile_picture_public_id`, `is_active`, `is_admin`, `is_driver`, `wallet_balance` (numeric), `jazzcash_account_number`, `jazzcash_account_title`, `created_at`, `updated_at`.
- `driver_registrations` table includes: `id (uuid)`, `user_id (uuid)`, `firstName`, `lastName`, `dateOfBirth`, `personalPictureUrl`, `personalPicturePublicId`, `licenseNumber`, `expirationDate`, `frontSideOfLicenseUrl`, `frontSideOfLicensePublicId`, `selfieWithDriverLicenseUrl`, `selfieWithDriverLicensePublicId`, `idNumber`, `cnicFrontUrl`, `cnicFrontPublicId`, `cnicBackUrl`, `cnicBackPublicId`, `photoOfVehicleUrl`, `photoOfVehiclePublicId`, `vehicleRegistrationCertificateUrl`, `vehicleRegistrationCertificatePublicId`, `backsideOfVehicleInformationUrl`, `backsideOfVehicleInformationPublicId`, `vehicleBrand`, `vehicleType`, `vehicleModel`, `vehicleColor`, `numberPlate`, `productionYear`, `status`, `createdAt`, `updatedAt`.
- `driver_registrations.operatingArea` is stored in normalized format for consistent matching.
- `ride_requests` table includes: `id (uuid)`, `rider_id (uuid)`, `pickupLocation`, `dropoffLocation`, `vehicleType`, `serviceArea`, `offeredPrice`, `estimatedDistanceKm`, `companyCommission`, `driverPayout`, optional coordinates (`pickupLatitude`, `pickupLongitude`, `dropoffLatitude`, `dropoffLongitude`), `notes`, `status` (`open | driver_selected | completed | cancelled`), `selected_driver_id`, `selectedAt`, `payment_method` (`online | cash`, chosen by the rider at creation, fixed for the life of the ride), `completed_at`, `cancelled_at`, `createdAt`, `updatedAt`.
- `driver_ride_alerts` table includes: `id (uuid)`, `ride_request_id (uuid)`, `driver_id (uuid)`, `vehicleType`, `message`, `inAppStatus`, `systemStatus`, `emailStatus`, `emailError`, `isRead`, `createdAt`, `updatedAt`.
- `driver_ride_responses` table includes: `id (uuid)`, `ride_request_id (uuid)`, `driver_id (uuid)`, `decision` (`interested | declined`), `counterOfferPrice`, `message`, `createdAt`, `updatedAt`. Unique on `(ride_request_id, driver_id)`.
- `wallet_transactions` table includes: `id (uuid)`, `user_id (uuid)`, `type` (`wallet_top_up | commission_debit | withdrawal | withdrawal_rejected_refund` — plus the now-unused legacy `ride_earning`), `amount` (signed), `balance_after`, `ride_request_id (uuid, nullable)`, `description`, `status` (`completed | pending | rejected`), `rejection_reason`, `createdAt`, `updatedAt`. A unique constraint on `(ride_request_id, type)` guarantees at most one `commission_debit` row per ride, which is what prevents double-debiting from a retried/duplicate `complete` call.
- `wallet_holds` table includes: `id (uuid)`, `driver_id (uuid)`, `ride_request_id (uuid)`, `amount`, `status` (`active | released | captured`), `createdAt`, `updatedAt`. Unique on `(ride_request_id, driver_id)` — one hold per driver per ride.
- `wallet_topups` table includes: `id (uuid)`, `user_id (uuid)`, `provider` (default `jazzcash`), `amount`, `currency` (default `PKR`), `status` (`pending | completed | failed | expired`), `txn_ref_no` (unique), `bill_reference`, `jazzcash_response_code`, `jazzcash_response_message`, `jazzcash_retrieval_reference_no`, `jazzcash_auth_code`, `raw_callback_payload` (jsonb), `paid_at`, `expires_at`, `createdAt`, `updatedAt` — same shape the old `payments` table used for ride payments.
- `payments` table: still physically exists in the database (holds historical ride-payment records from before this change) but is no longer read or written by any current code path — safe to ignore going forward.

---

## Security & Notes
- All authenticated endpoints require `Authorization: Bearer <jwt>`.
- File uploads must be image types (jpeg/png/webp/gif) and are validated server-side. Consider adding explicit size limits in the client and server as needed.
- Current alert channels are in-app/system/email. SMS can replace email in a future iteration without changing ride request creation contract.
- For production, set `synchronize = false` for TypeORM migrations and use migrations to evolve schema safely.
- Consider adding audit logs and email notifications when admin approves/rejects registrations.

---

## Payments & Wallet: What Changed, and What to Verify Before Shipping

This is a significant behavior change from the previous API version — summarized here so the mobile integration doesn't miss anything:

**Removed:**
- `POST /api/payments/jazzcash/initiate`, `POST /api/payments/jazzcash/callback`, `GET /api/payments/jazzcash/:paymentId/status`, `POST /api/payments/jazzcash/:paymentId/inquire`, `GET /api/payments/ride/:rideRequestId` — all gone. If the app calls any of these for an `online`-payment ride, that code needs to be replaced with the `driverPaymentDetails` flow described above.
- The old "credit `driverPayout` to the driver's wallet once online payment is confirmed" behavior — gone. A driver's wallet is no longer credited for ride earnings at all now; it only moves via top-ups, commission debits, and withdrawals.

**Added / changed:**
- `paymentMethod: "cash"` and `"online"` now behave almost identically from the backend's point of view — both are settled entirely outside the platform, and both debit `companyCommission` from the driver's wallet at `POST /.../complete`. The only difference is what the app shows the rider: nothing extra for `cash`, and `driverPaymentDetails` for `online`.
- Driver wallets now support **holds** (`wallet_holds`) — reserved against a ride from the moment a driver responds `interested` until it's released or captured. See the Wallet section above; this is the part of the integration most likely to need careful UI handling (the 400 error on `POST /driver/respond` when balance is insufficient, and using `availableBalance` rather than raw `balance` anywhere the app lets a driver decide whether to accept a ride).
- A new self-serve top-up flow (`/api/wallet/topup/jazzcash/*`) lets drivers fund their wallet themselves.
- A driver now sets their own JazzCash payout details (`PATCH /api/users/driver/payment-method`) rather than the platform holding a single merchant account that pays everyone out.
- Ride requests can now be cancelled (`POST /api/ride-requests/:rideRequestId/cancel`) — this didn't exist at all before.

**Not yet verified in this change (please confirm before relying on them in production):**
- This implementation was written and confirmed to compile (`npm run build`) cleanly, but has **not** been exercised against a real running database with live HTTP calls in this pass — unlike a prior version of this document which claimed full live verification for the old payments flow (no longer applicable, since that flow is removed). Before shipping, run through the full loop at least once against a real dev/staging DB: approve a driver → set their JazzCash payment method → top up their wallet → have them respond `interested` to a ride (including the insufficient-balance 400 case) → get selected → complete the ride (commission debited for both `cash` and `online`) → cancel a different ride and confirm the hold releases → attempt a withdrawal that would exceed available (held-aware) balance and confirm it's rejected.
- Run `npm run migration:run` against whichever database you're testing/deploying against — this change ships a new migration (`AddDriverPayoutWalletHoldsAndTopups`) adding `users.jazzcash_account_number`/`jazzcash_account_title`, `ride_requests.cancelled_at`, and the `wallet_holds`/`wallet_topups` tables. Production runs with `synchronize: false`, so none of this exists there until the migration runs.
- `JAZZCASH_ENV`, `JAZZCASH_RETURN_URL`, and the merchant credentials are now only exercised by the wallet top-up flow (ride payments no longer use JazzCash at all) — confirm these are still set correctly for whichever environment you're testing.
- The mobile app must be updated in lockstep: remove any call to the old `/api/payments/jazzcash/*` endpoints, add a screen to display `driverPaymentDetails` for online rides, add the driver-side "set payment method" and "top up wallet" flows, and surface the new insufficient-balance error from `driver/respond` and the new `cancel` action.

**A subtle environment gotcha worth knowing if you touch payment/wallet expiry logic further:** this server's host clock is UTC+5. Postgres `timestamp` (without timezone) columns populated by `now()`, when read back through the `pg` driver and compared against a freshly computed `Date.now()`/`new Date()` in the same request, come back shifted by the host's UTC offset — a well-known `node-postgres` default-parsing quirk. Both the old `payments.expires_at` and the new `wallet_topups.expires_at` avoid this by computing and storing the expiry explicitly in application code (same pattern as `otp_expires_at`) rather than deriving it from `createdAt` at read time. If you add new expiry logic elsewhere, follow the same pattern — or migrate the column to `timestamptz`, which round-trips correctly regardless of host timezone.

---

If you'd like, I can:
- Add API examples (curl) for each endpoint,
- Add OpenAPI (Swagger) decorators and generate an interactive docs page,
- Add notification emails on approval/rejection.
