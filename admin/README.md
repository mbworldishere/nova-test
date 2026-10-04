# NOVA EDGE Admin Panel

A secure, feature-rich admin panel for managing the NOVA EDGE portfolio website.

## 📁 Structure

```
admin/
├── index.html           # Main admin entry (redirects to login)
├── login.html           # Login page
├── dashboard.html       # Admin dashboard
├── projects.html        # Projects management
├── project-add.html     # Add new project
├── project-edit.html    # Edit existing project
├── media.html           # Media library
├── users.html           # User management
├── settings.html        # Settings page
├── server.js            # Node.js backend server
├── static/
│   └── css/             # All CSS files
└── README.md            # This file

admin-data/
├── users.json           # Admin users data
├── projects.json        # Client projects data
└── settings.json        # Agency settings

admin/uploads/          # Uploaded media files
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or later)
- npm or yarn

### Installation

1. Navigate to the project directory:
```bash
cd nova-edge-portfolio
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

The admin panel will be available at: `http://localhost:3001/admin/login`

## 🔐 Default Credentials

- **Username:** `novaAdmin`
- **Password:** `Nova@Admin2026!`

> ⚠️ **IMPORTANT:** Change the password immediately after first login!

## 📊 Features

### Authentication
- Secure session-based authentication
- POST-only login (no GET parameters)
- Password hashing with bcrypt
- Session timeout (24 hours)

### Dashboard
- Overview statistics
- Recent projects
- Quick actions
- Activity log

### Projects Management
- Add, edit, delete projects
- Upload poster images
- Manage project details (name, category, description, etc.)
- Set mood colors
- Add tags and frame timecodes
- Featured project toggle
- Bulk actions (publish, archive, delete)
- Search and filter
- Pagination

### Media Library
- Upload images and videos
- Drag & drop support
- File preview
- Delete media files
- Bulk delete
- Search and filter by type

### User Management
- Add, edit, delete admin users
- Set user roles (admin, editor)
- Prevent self-deletion

### Settings
- Agency information (name, tagline, contact)
- Social media links
- Display settings

## 🔒 Security Features

1. **POST-only Authentication**: Login form uses POST method, preventing credentials in URL
2. **Session Management**: Secure sessions with httpOnly cookies
3. **Password Hashing**: All passwords are hashed with bcrypt
4. **CSRF Protection**: SameSite cookie policy
5. **Input Validation**: Server-side validation for all inputs
6. **File Upload Security**: File type validation and size limits
7. **Authentication Middleware**: Protected routes require valid session
8. **Role-Based Access**: Admin-only actions restricted to admin users

## 🌐 API Endpoints

### Authentication
- `POST /api/login` - Login
- `POST /api/logout` - Logout
- `GET /api/session` - Check session

### Projects
- `GET /api/projects` - Get all projects
- `GET /api/projects/:id` - Get single project
- `POST /api/projects` - Create project
- `POST /api/projects/:id` - Update project
- `POST /api/projects/:id/delete` - Delete project
- `POST /api/projects/reorder` - Reorder projects

### Media
- `GET /api/media` - Get all media
- `POST /api/media/upload` - Upload media
- `POST /api/media/:filename/delete` - Delete media

### Settings
- `GET /api/settings` - Get settings
- `POST /api/settings` - Update settings

### Users
- `GET /api/users` - Get all users
- `POST /api/users` - Create user
- `POST /api/users/:id` - Update user
- `POST /api/users/:id/delete` - Delete user

## 📦 Deployment

### Production Deployment

1. Set environment variables:
```bash
export NODE_ENV=production
export SESSION_SECRET=your-strong-secret-key
export PORT=3001
```

2. Build and start:
```bash
npm install --production
npm start
```

3. Use a process manager (recommended):
```bash
npm install -g pm2
pm2 start server.js --name "nova-edge-admin"
pm2 save
pm2 startup
```

### With HTTPS

Use a reverse proxy like Nginx or configure HTTPS directly:

```javascript
// In server.js, add:
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('path/to/private-key.pem'),
  cert: fs.readFileSync('path/to/certificate.pem')
};

https.createServer(options, app).listen(PORT);
```

Set `SECURE_COOKIES=true` in environment.

## 🎨 Customization

### Changing Default Credentials

1. Edit `admin-data/users.json`
2. Hash the password using bcrypt:
```javascript
const bcrypt = require('bcryptjs');
bcrypt.hash('your-password', 10, (err, hash) => {
  console.log(hash);
});
```
3. Update the user object with the new hash

### Adding Custom Fields

1. Add field to the project form (HTML)
2. Add field to the API endpoint (server.js)
3. Update the projects.json structure

## 🔧 Troubleshooting

### Common Issues

1. **Port already in use**: Change PORT in .env file
2. **Missing dependencies**: Run `npm install`
3. **Permission errors**: Ensure write permissions for uploads directory
4. **Session not persisting**: Check SESSION_SECRET is set

### Debug Mode

Set `NODE_ENV=development` for detailed error messages.

## 📝 License

This admin panel is custom-built for NOVA EDGE and is proprietary software.

## 🙏 Credits

- Built with Node.js + Express
- Frontend: HTML5, CSS3, Vanilla JavaScript
- Icons: Feather Icons (via inline SVG)
- Password Hashing: bcryptjs
- File Uploads: multer

---

**© 2026 NOVA EDGE | Ahmedabad, India**
