# QistonPe Backend API

## Base URL

```
http://localhost:3000
```

## Authentication

Protected endpoints require a **Bearer** token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

- **Access token** expires in **15 minutes**.
- **Refresh token** is stored in an **httpOnly cookie** (`refresh_token`) and expires in **7 days**.

---

## Endpoints

### 1. Signup Step 1 — Personal Details

Saves personal details to an onboarding draft. Does **not** create a User or Company.

```
POST /auth/signup/step1
```

**Request Body**

| Field       | Type   | Required | Description            |
| ----------- | ------ | -------- | ---------------------- |
| fullName    | string | Yes      | Full name of the user  |
| email       | string | Yes      | Email address          |
| phoneNumber | string | Yes      | Phone number           |

**Example Request**

```json
{
  "fullName": "John Doe",
  "email": "user@example.com",
  "phoneNumber": "9876543210"
}
```

**Success Response** `201 Created`

```json
{
  "message": "Step 1 completed. Proceed to step 2.",
  "draftId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "currentStep": 1,
  "email": "user@example.com"
}
```

**Error Responses**

| Status | Description              |
| ------ | ------------------------ |
| 409    | Email or phone number already registered |

---

### 2. Signup Step 2 — Business Details & Registration

Creates User + Company atomically from draft data. No tokens are issued — login separately.

```
POST /auth/signup/step2
```

**Request Body**

| Field     | Type   | Required | Description                          |
| --------- | ------ | -------- | ------------------------------------ |
| email     | string | Yes      | Email used in step 1                 |
| pan       | string | Yes      | Business PAN (format: `ABCDE1234F`) |
| legalName | string | Yes      | Company legal name                   |
| gstin     | string | No       | GSTIN number                         |
| address   | string | No       | Registered business address          |

**Example Request**

```json
{
  "email": "user@example.com",
  "pan": "ABCDE1234F",
  "legalName": "QistonPe Pvt Ltd",
  "gstin": "27XXXXX1234X1Z5",
  "address": "123, MG Road, Mumbai 400001"
}
```

**Success Response** `201 Created`

```json
{
  "message": "Signup completed successfully. Please login to continue.",
  "user": {
    "id": "uuid",
    "fullName": "John Doe",
    "email": "user@example.com",
    "mobile": "9876543210"
  },
  "company": {
    "id": "uuid",
    "legalName": "QistonPe Pvt Ltd",
    "pan": "ABCDE1234F",
    "gstin": "27XXXXX1234X1Z5",
    "address": "123, MG Road, Mumbai 400001"
  }
}
```

**Error Responses**

| Status | Description                                  |
| ------ | -------------------------------------------- |
| 400    | Incomplete step 1 data / Already completed   |
| 404    | No onboarding draft found — complete step 1  |
| 409    | Email or PAN already registered              |

---

### 3. Get Onboarding Draft Status

Returns current onboarding step and saved data for an email.

```
GET /auth/signup/status?email=user@example.com
```

**Query Parameters**

| Param | Type   | Required | Description          |
| ----- | ------ | -------- | -------------------- |
| email | string | Yes      | Email used in step 1 |

**Success Response** `200 OK`

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "currentStep": 1,
  "status": "IN_PROGRESS",
  "formData": {
    "fullName": "John Doe",
    "email": "user@example.com",
    "phoneNumber": "9876543210"
  }
}
```

**Error Responses**

| Status | Description                   |
| ------ | ----------------------------- |
| 404    | No draft found for this email |

---

### 4. Send OTP (Login Step 1)

Sends a 6-digit OTP to the user's registered email via Mailtrap sandbox. OTP expires in 5 minutes.

```
POST /auth/login/send-otp
```

**Request Body**

| Field | Type   | Required | Description              |
| ----- | ------ | -------- | ------------------------ |
| email | string | Yes      | Registered email address |

**Example Request**

```json
{
  "email": "user@example.com"
}
```

**Success Response** `200 OK`

```json
{
  "message": "OTP sent to your email"
}
```

**Error Responses**

| Status | Description                                      |
| ------ | ------------------------------------------------ |
| 400    | OTP already sent — wait before requesting again  |
| 404    | No account found with this email                 |

---

### 5. Verify OTP (Login Step 2)

Verifies the OTP and issues tokens. Access token in body, refresh token as httpOnly cookie.

```
POST /auth/login/verify-otp
```

**Request Body**

| Field | Type   | Required | Description          |
| ----- | ------ | -------- | -------------------- |
| email | string | Yes      | Registered email     |
| otp   | string | Yes      | 6-digit OTP from email |

**Example Request**

```json
{
  "email": "user@example.com",
  "otp": "482913"
}
```

**Success Response** `200 OK`

```json
{
  "user": {
    "id": "uuid",
    "fullName": "John Doe",
    "email": "user@example.com",
    "mobile": "9876543210"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

> A `refresh_token` httpOnly cookie is also set automatically (path: `/auth/refresh`, 7-day expiry).

**Error Responses**

| Status | Description                                  |
| ------ | -------------------------------------------- |
| 401    | Invalid OTP / OTP expired / Too many attempts |

---

### 6. Refresh Access Token

Issues a new access token using the refresh token from the httpOnly cookie.

```
POST /auth/refresh
```

**Auth:** Refresh token cookie (set automatically on login)

**Request Body:** None

**Success Response** `200 OK`

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

> A new `refresh_token` cookie is set with each refresh (token rotation).

**Error Responses**

| Status | Description                                      |
| ------ | ------------------------------------------------ |
| 403    | Access denied — invalid or expired refresh token |

---

### 7. Logout

Invalidates the refresh token and clears the cookie.

```
POST /auth/logout
```

**Auth:** `Authorization: Bearer <access_token>`

**Request Body:** None

**Success Response** `200 OK`

```json
{
  "message": "Logged out successfully"
}
```

**Error Responses**

| Status | Description  |
| ------ | ------------ |
| 401    | Unauthorized |

---

### 8. Get Profile

Returns the authenticated user's profile with company details.

```
GET /auth/profile
```

**Auth:** `Authorization: Bearer <access_token>`

**Success Response** `200 OK`

```json
{
  "id": "uuid",
  "fullName": "John Doe",
  "email": "user@example.com",
  "mobile": "9876543210",
  "company": {
    "id": "uuid",
    "legalName": "QistonPe Pvt Ltd",
    "pan": "ABCDE1234F",
    "gstin": "27XXXXX1234X1Z5",
    "address": "123, MG Road, Mumbai 400001",
    "userId": "uuid"
  }
}
```

**Error Responses**

| Status | Description  |
| ------ | ------------ |
| 401    | Unauthorized |

---

## Environment Variables

| Variable                    | Description                       |
| --------------------------- | --------------------------------- |
| PORT                        | Server port (default: 3000)       |
| DB_HOST                     | PostgreSQL host                   |
| DB_PORT                     | PostgreSQL port                   |
| DB_USERNAME                 | Database username                 |
| DB_PASSWORD                 | Database password                 |
| DB_DATABASE                 | Database name                     |
| JWT_ACCESS_SECRET           | Secret for signing access tokens  |
| JWT_REFRESH_SECRET          | Secret for signing refresh tokens |
| COMMON_SMTP_EMAIL_SMTP_HOST | SMTP host (Mailtrap sandbox)      |
| COMMON_SMTP_EMAIL_SMTP_PORT | SMTP port (587)                   |
| COMMON_SMTP_EMAIL_USERNAME  | SMTP username                     |
| COMMON_SMTP_EMAIL_PASSWORD  | SMTP password                     |
| COMMON_EMAIL_FROM           | Sender email address              |

## Running the App

```bash
# Install dependencies
npm install

# Development
npm run start:dev

# Production build
npm run build
npm run start:prod
```
