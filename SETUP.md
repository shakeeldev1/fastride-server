# Indrive Backend Setup - Complete Guide

## ✅ Backend Setup Completed Successfully!

Your NestJS backend for Indrive is now fully configured and ready to use. Here's what has been set up:

## 📁 Project Structure

```
server/
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── dto/
│   │   │   │   ├── signup.dto.ts          # User registration validation
│   │   │   │   ├── login.dto.ts           # Login validation
│   │   │   │   ├── verify-otp.dto.ts      # OTP verification validation
│   │   │   │   └── change-password.dto.ts # Password change validation
│   │   │   ├── guards/
│   │   │   │   └── jwt-auth.guard.ts      # JWT protection for routes
│   │   │   ├── services/
│   │   │   │   ├── auth.service.ts        # Authentication logic
│   │   │   │   └── email.service.ts       # Email sending with Nodemailer
│   │   │   ├── strategies/
│   │   │   │   └── jwt.strategy.ts        # JWT strategy implementation
│   │   │   ├── auth.controller.ts         # Auth endpoints
│   │   │   └── auth.module.ts             # Auth module definition
│   │   │
│   │   └── user/
│   │       ├── dto/
│   │       │   └── update-profile.dto.ts  # Profile update validation
│   │       ├── entities/
│   │       │   └── user.entity.ts         # User database entity
│   │       ├── services/
│   │       │   ├── user.service.ts        # User profile logic
│   │       │   └── cloudinary.service.ts  # Image upload service
│   │       ├── user.controller.ts         # User endpoints
│   │       └── user.module.ts             # User module definition
│   │
│   ├── app.controller.ts                  # Main controller
│   ├── app.service.ts                     # Main service
│   ├── app.module.ts                      # Main module (TypeORM & JWT setup)
│   └── main.ts                            # Application entry point
│
├── dist/                                  # Compiled JavaScript (auto-generated)
├── .env                                   # Environment variables
├── .env.example                           # Environment template
├── package.json                           # Dependencies
├── tsconfig.json                          # TypeScript configuration
├── .gitignore                             # Git ignore rules
├── .prettierrc                            # Code formatting rules
├── README.md                              # Documentation
└── SETUP.md                               # This file
```

## 🚀 Quick Start

### 1. Install Missing Type Packages (if needed)
```bash
npm install --save-dev @types/express @types/node
```

### 2. Set Up PostgreSQL Database
```bash
# Windows: Create database through pgAdmin or CLI
createdb indrive

# Or via psql:
psql -U postgres
CREATE DATABASE indrive;
```

### 3. Configure Environment Variables
Edit `.env` file with your credentials:
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=indrive

JWT_SECRET=your-super-secret-key

SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### 4. Run Development Server
```bash
npm run start:dev
```

### 5. Run Production Server
```bash
npm run build
npm start
```

## 📦 Installed Packages

### Core Dependencies
- `@nestjs/common` - Common NestJS utilities
- `@nestjs/core` - Core NestJS framework
- `@nestjs/platform-express` - Express adapter
- `reflect-metadata` - Metadata reflection
- `rxjs` - Reactive programming

### Database
- `@nestjs/typeorm` - TypeORM integration
- `typeorm` - ORM for database
- `pg` - PostgreSQL driver

### Authentication
- `@nestjs/jwt` - JWT token handling
- `@nestjs/passport` - Passport.js integration
- `passport` - Authentication middleware
- `passport-jwt` - JWT strategy
- `bcryptjs` - Password hashing

### Email
- `nodemailer` - Email sending service

### File Upload
- `cloudinary` - Image upload and management

### Validation
- `class-validator` - Data validation decorators
- `class-transformer` - Data transformation

### Utilities
- `dotenv` - Environment variables management

## 🔑 Key Features Implemented

### ✅ Authentication Module
- **Signup**: Register with name, email, phone, password
- **Email Verification**: OTP-based verification via Nodemailer
- **Login**: Email and password authentication
- **JWT**: Secure token-based sessions (24h expiry)
- **Password Change**: Change password with old password verification
- **OTP Resend**: Resend verification code

### ✅ User Profile Module
- **Get Profile**: Retrieve user information
- **Update Profile**: Update name, bio, address, etc.
- **Profile Picture**: Upload via Cloudinary
- **Delete Picture**: Remove profile picture
- **Account Status**: Activate/deactivate account

### ✅ Security Features
- Password hashing with bcryptjs (10 salt rounds)
- JWT authentication with 24-hour expiration
- Input validation with class-validator
- CORS enabled and configurable
- Global validation pipes

### ✅ Email Services (Nodemailer)
- OTP emails with HTML template
- Password reset email (ready to implement)
- Secure SMTP configuration

### ✅ Image Management (Cloudinary)
- Automatic image optimization
- File type validation (JPEG, PNG, WebP, GIF)
- File size limit (5MB)
- Public ID tracking for deletion
- Folder organization

## 📍 API Base URL
```
http://localhost:3001/api
```

## 🧪 Testing Endpoints

### 1. Health Check
```bash
curl http://localhost:3001/health
```

### 2. Sign Up
```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+91-9876543210",
    "password": "SecurePass123"
  }'
```

### 3. Verify OTP
```bash
curl -X POST http://localhost:3001/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "otp": "123456"
  }'
```

### 4. Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123"
  }'
```

### 5. Get Profile (Requires JWT)
```bash
curl http://localhost:3001/api/users/profile \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

## 🔐 Email Setup (Gmail Example)

1. Enable 2-Factor Authentication on Gmail
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use generated password in `SMTP_PASSWORD` in `.env`

## ☁️ Cloudinary Setup

1. Create account at https://cloudinary.com
2. Get credentials from Dashboard
3. Add to `.env`:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

## 📊 Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  otp VARCHAR(6),
  otp_expires_at TIMESTAMP,
  is_email_verified BOOLEAN DEFAULT FALSE,
  profile_picture_url VARCHAR(255),
  profile_picture_public_id VARCHAR(500),
  bio TEXT,
  address VARCHAR(100),
  city VARCHAR(50),
  state VARCHAR(50),
  postal_code VARCHAR(20),
  country VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🛠️ Available Commands

```bash
# Development
npm run start:dev          # Start with auto-reload
npm run start:debug        # Debug mode

# Production
npm run build              # Build TypeScript
npm start                  # Run production server
npm run start:prod         # Run production server

# Code Quality
npm run lint              # Linting (when configured)
npm run format            # Format code (when configured)

# Testing
npm test                  # Run tests (when configured)
```

## ⚠️ Important Notes

1. **Change JWT_SECRET**: Use a strong random string in production
2. **Use HTTPS**: Always use HTTPS in production
3. **Database Backup**: Regular backups recommended
4. **Rate Limiting**: Consider adding rate limiting for production
5. **Logging**: Extend logger service for better monitoring
6. **Error Handling**: Use error filters for consistent error responses
7. **CORS**: Adjust CORS_ORIGIN for your frontend

## 🐛 Troubleshooting

### Build Errors
```bash
# Clear cache and rebuild
rm -rf dist node_modules
npm install
npm run build
```

### Database Connection Errors
```
Check:
1. PostgreSQL is running
2. Credentials in .env are correct
3. Database exists
4. Port 5432 is accessible
```

### Email Not Sending
```
Check:
1. Gmail App Password is correct
2. Less secure apps setting (if using Gmail)
3. SMTP credentials in .env
4. Internet connection
```

### TypeScript Errors
```bash
# Clear TypeScript cache
tsc --noEmit
npm run build
```

## 📚 Next Steps

1. **Implement Ride Booking**: Create rides module
2. **Add Rating System**: Implement ratings and reviews
3. **Payment Integration**: Add Stripe/Razorpay
4. **Real-time Updates**: Implement Socket.io
5. **Admin Dashboard**: Create admin routes
6. **Testing**: Add unit and integration tests
7. **Documentation**: Generate API docs with Swagger

## 🔗 Useful Links

- [NestJS Documentation](https://docs.nestjs.com)
- [TypeORM Documentation](https://typeorm.io)
- [Nodemailer Guide](https://nodemailer.com)
- [Cloudinary Docs](https://cloudinary.com/documentation)
- [JWT.io](https://jwt.io)

## 📞 Support

For issues or questions:
1. Check the README.md for detailed API documentation
2. Review error messages carefully
3. Check environment variable configuration
4. Verify database connection
5. Check console logs for detailed error messages

## ✨ Success Indicators

Your backend is ready when:
- ✅ `npm run start:dev` runs without errors
- ✅ Health check returns status: "ok"
- ✅ User signup works and OTP is sent
- ✅ Email verification works
- ✅ Login returns JWT token
- ✅ Protected routes require valid JWT
- ✅ Profile picture upload to Cloudinary works

---

**Happy Coding! 🚀**

Backend setup completed on: ${new Date().toLocaleString()}
