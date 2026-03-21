# FTNbackend
For the Need Foundation Backend

## Project Overview

**FTNbackend** is a Node.js/Express-based REST API backend for the "For the Need Foundation," a volunteer management and event coordination platform. The application manages user authentication, volunteer participation tracking, event management, and file storage through Google Drive integration.

## Architecture

The backend is structured around **Express.js** with three main components: server configuration, database connectivity, and route handlers.

### Database Layer (db.js)

The database module establishes a MySQL connection pool for efficient database management with a maximum of 10 concurrent connections. Passwords are base64-decoded for security, and a keep-alive mechanism executes every 5 minutes to prevent MySQL from closing idle connections.

### Server Setup (server.js)

The server initializes on port 3001 with comprehensive CORS configuration allowing cross-origin requests. It integrates with the **Google Drive API** using a service account for file management. File uploads are restricted to 5MB using Multer's memory storage.

Key features:
- Google Drive API integration for file storage and retrieval
- File download endpoint with proper headers and metadata
- CORS middleware for cross-origin compatibility
- Multer file upload handling with size limits

### Authentication Routes (routes/auth.js)

Handles two separate login flows for admins and volunteers using **JWT (JSON Web Tokens)** with 6-hour expiration. Credentials are verified against their respective database tables (`admins` or `volunteer`). Session tokens are set as HTTP-only cookies to protect against XSS attacks.

### Reports & Data Routes (routes/reports.js)

Provides volunteer and event data retrieval endpoints, including:
- Volunteer aggregation with event participation counts
- Event details retrieval with remaining slots calculation
- Event signup functionality with duplicate prevention

## Dependencies

Key npm packages include:
- **Express** - Web framework
- **JWT** - Authentication tokens
- **Multer** - File uploads
- **Google APIs** - Drive integration
- **MySQL** - Database queries
- **Bcrypt** - Password hashing
- **CORS** - Cross-origin support

Configuration uses environment variables from a `.env` file for sensitive information.# FTNbackend
For the Need Foundation Backend
