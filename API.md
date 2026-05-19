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

This module handles rider trip requests and dispatches alerts to matching approved drivers by `vehicleType`.

### POST /api/ride-requests
- Role: Authenticated User (Rider)
- Content-Type: `application/json`
- Body:
  - `pickupLocation` (string, required)
  - `dropoffLocation` (string, required)
  - `vehicleType` (string, required) allowed: `bike | car | auto | van`
  - `offeredPrice` (number, required)
  - `pickupArea` (string, optional)
  - `pickupLatitude` (number, optional)
  - `pickupLongitude` (number, optional)
  - `dropoffLatitude` (number, optional)
  - `dropoffLongitude` (number, optional)
  - `notes` (string, optional)
- Dispatch behavior:
  - Resolves target area:
    - uses `pickupArea` when provided,
    - otherwise auto-extracts from `pickupLocation` (last comma-separated segment).
  - Applies generic normalization on both rider target area and driver `operatingArea`:
    - lowercase conversion,
    - punctuation removal,
    - extra-space collapsing,
    - accent/diacritic cleanup.
  - This works for any city/area text format, not tied to a specific city.
  - Example: `street one, goheer town, bahawalpur` resolves area as `bahawalpur`.
  - Creates one `ride_request` record.
  - Finds drivers with:
    - approved registration (`driver_registrations.status = approved`)
    - same `vehicleType`
    - same normalized area (`operatingArea`)
    - active + verified + `is_driver = true`
  - Creates one `driver_ride_alert` record per matched driver.
  - Sends email alert to matched drivers.
  - Marks in-app/system delivery state in alert records.
- Response: 201
  - `message`
  - `rideRequest`
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

### PATCH /api/ride-requests/driver/alerts/:alertId
- Role: Authenticated User (Driver)
- Body:
  - `isRead` (boolean, required)
- Response: 200
  - `message`
  - `alert` (updated)

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

---

## Database Fields (high level)
- `users` table includes: `id (uuid)`, `name`, `email`, `phone`, `password`, `is_email_verified`, `profile_picture_url`, `profile_picture_public_id`, `is_active`, `is_admin`, `is_driver`, `created_at`, `updated_at`.
- `driver_registrations` table includes: `id (uuid)`, `user_id (uuid)`, `firstName`, `lastName`, `dateOfBirth`, `personalPictureUrl`, `personalPicturePublicId`, `licenseNumber`, `expirationDate`, `frontSideOfLicenseUrl`, `frontSideOfLicensePublicId`, `selfieWithDriverLicenseUrl`, `selfieWithDriverLicensePublicId`, `idNumber`, `cnicFrontUrl`, `cnicFrontPublicId`, `cnicBackUrl`, `cnicBackPublicId`, `photoOfVehicleUrl`, `photoOfVehiclePublicId`, `vehicleRegistrationCertificateUrl`, `vehicleRegistrationCertificatePublicId`, `backsideOfVehicleInformationUrl`, `backsideOfVehicleInformationPublicId`, `vehicleBrand`, `vehicleType`, `vehicleModel`, `vehicleColor`, `numberPlate`, `productionYear`, `status`, `createdAt`, `updatedAt`.
- `driver_registrations.operatingArea` is stored in normalized format for consistent matching.
- `ride_requests` table includes: `id (uuid)`, `rider_id (uuid)`, `pickupLocation`, `dropoffLocation`, `vehicleType`, `offeredPrice`, optional coordinates (`pickupLatitude`, `pickupLongitude`, `dropoffLatitude`, `dropoffLongitude`), `notes`, `status`, `createdAt`, `updatedAt`.
- `driver_ride_alerts` table includes: `id (uuid)`, `ride_request_id (uuid)`, `driver_id (uuid)`, `vehicleType`, `message`, `inAppStatus`, `systemStatus`, `emailStatus`, `emailError`, `isRead`, `createdAt`, `updatedAt`.

---

## Security & Notes
- All authenticated endpoints require `Authorization: Bearer <jwt>`.
- File uploads must be image types (jpeg/png/webp/gif) and are validated server-side. Consider adding explicit size limits in the client and server as needed.
- Current alert channels are in-app/system/email. SMS can replace email in a future iteration without changing ride request creation contract.
- For production, set `synchronize = false` for TypeORM migrations and use migrations to evolve schema safely.
- Consider adding audit logs and email notifications when admin approves/rejects registrations.

---

If you'd like, I can:
- Add API examples (curl) for each endpoint,
- Add OpenAPI (Swagger) decorators and generate an interactive docs page,
- Add notification emails on approval/rejection.

