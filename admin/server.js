require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// ============ CONFIG ============
const SESSION_SECRET = process.env.SESSION_SECRET || 'nova-edge-secret-key-' + uuidv4();
const UPLOAD_PATH = path.join(__dirname, 'uploads');
const DATA_PATH = path.join(process.cwd(), 'admin-data');

// Ensure directories exist
if (!fs.existsSync(UPLOAD_PATH)) {
  fs.mkdirSync(UPLOAD_PATH, { recursive: true });
}
if (!fs.existsSync(DATA_PATH)) {
  fs.mkdirSync(DATA_PATH, { recursive: true });
}

// ============ MIDDLEWARE ============
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    httpOnly: true, // Prevent XSS
    sameSite: 'strict', // Prevent CSRF
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// ============ MULTER CONFIG (File Upload) ============
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_PATH);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and videos are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  }
});

// ============ HELPER FUNCTIONS ============

// Read JSON file
function readJsonFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading file:', filePath, err);
    return [];
  }
}

// Write JSON file
function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing file:', filePath, err);
    return false;
  }
}

// Check authentication
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  // Check if it's an API request
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.redirect('/admin/login');
}

// Check admin role
function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  if (req.path.startsWith('/api/')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.status(403).send('Access Denied');
}

// ============ ROUTES ============

// Serve static files from admin directory
app.use('/admin/static', express.static(path.join(__dirname, 'static')));
// Serve main portfolio static files
app.use(express.static(path.join(__dirname, '..')));
// Login Page
app.get('/admin/login', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/admin/dashboard');
  }
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Dashboard Page
app.get('/admin/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Projects Page
app.get('/admin/projects', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'projects.html'));
});

// Add/Edit Project Page
app.get('/admin/projects/add', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'project-add.html'));
});

app.get('/admin/projects/:id/edit', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'project-edit.html'));
});

// Media Library
app.get('/admin/media', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'media.html'));
});

// Settings Page
app.get('/admin/settings', requireAuth, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'settings.html'));
});

// Serve uploads
app.use('/admin/uploads', requireAuth, express.static(UPLOAD_PATH));

// ============ API ROUTES ============

// Login API (POST only)
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  const users = readJsonFile(path.join(DATA_PATH, 'users.json'));
  const user = users.find(u => u.username === username);
  
  if (!user) {
    // Return generic error to prevent username enumeration
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  bcrypt.compare(password, user.passwordHash, (err, isMatch) => {
    if (err || !isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Set session
    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role
    };
    
    res.json({
      success: true,
      message: 'Login successful',
      user: { id: user.id, username: user.username, role: user.role }
    });
  });
});

// Logout API
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Could not logout' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// Check session
app.get('/api/session', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ authenticated: true, user: req.session.user });
  } else {
    res.json({ authenticated: false });
  }
});

// ============ PROJECTS API ============

// Get all projects
app.get('/api/projects', requireAuth, (req, res) => {
  const projects = readJsonFile(path.join(DATA_PATH, 'projects.json'));
  res.json(projects);
});

// Get single project
app.get('/api/projects/:id', requireAuth, (req, res) => {
  const projects = readJsonFile(path.join(DATA_PATH, 'projects.json'));
  const project = projects.find(p => p.id === req.params.id);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  res.json(project);
});

// Create project (POST only)
app.post('/api/projects', requireAuth, upload.single('posterImage'), (req, res) => {
  const projects = readJsonFile(path.join(DATA_PATH, 'projects.json'));
  
  const newProject = {
    id: 'proj-' + uuidv4(),
    key: req.body.key || req.body.name.toLowerCase().replace(/\s+/g, '-'),
    name: req.body.name,
    title: req.body.title,
    category: req.body.category,
    role: req.body.role,
    year: req.body.year,
    description: req.body.description,
    challenge: req.body.challenge,
    approach: req.body.approach,
    result: req.body.result,
    posterImage: req.file ? '/admin/uploads/' + req.file.filename : req.body.posterImage,
    muxPlaybackId: req.body.muxPlaybackId,
    orientation: req.body.orientation || 'landscape',
    duration: parseInt(req.body.duration) || 0,
    moodColor: req.body.moodColor || '#D6FF3F',
    frames: req.body.frames ? JSON.parse(req.body.frames) : [],
    tags: req.body.tags ? JSON.parse(req.body.tags) : [],
    behanceUrl: req.body.behanceUrl,
    featured: req.body.featured === 'true',
    order: projects.length + 1,
    status: req.body.status || 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  projects.push(newProject);
  writeJsonFile(path.join(DATA_PATH, 'projects.json'), projects);
  
  res.json({ success: true, project: newProject });
});

// Update project (POST only for security)
app.post('/api/projects/:id', requireAuth, upload.single('posterImage'), (req, res) => {
  const projects = readJsonFile(path.join(DATA_PATH, 'projects.json'));
  const projectIndex = projects.findIndex(p => p.id === req.params.id);
  
  if (projectIndex === -1) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  const updatedProject = {
    ...projects[projectIndex],
    name: req.body.name || projects[projectIndex].name,
    title: req.body.title || projects[projectIndex].title,
    category: req.body.category || projects[projectIndex].category,
    role: req.body.role || projects[projectIndex].role,
    year: req.body.year || projects[projectIndex].year,
    description: req.body.description || projects[projectIndex].description,
    challenge: req.body.challenge || projects[projectIndex].challenge,
    approach: req.body.approach || projects[projectIndex].approach,
    result: req.body.result || projects[projectIndex].result,
    posterImage: req.file ? '/admin/uploads/' + req.file.filename : (req.body.posterImage || projects[projectIndex].posterImage),
    muxPlaybackId: req.body.muxPlaybackId || projects[projectIndex].muxPlaybackId,
    orientation: req.body.orientation || projects[projectIndex].orientation,
    duration: req.body.duration ? parseInt(req.body.duration) : projects[projectIndex].duration,
    moodColor: req.body.moodColor || projects[projectIndex].moodColor,
    frames: req.body.frames ? JSON.parse(req.body.frames) : projects[projectIndex].frames,
    tags: req.body.tags ? JSON.parse(req.body.tags) : projects[projectIndex].tags,
    behanceUrl: req.body.behanceUrl || projects[projectIndex].behanceUrl,
    featured: req.body.featured !== undefined ? req.body.featured === 'true' : projects[projectIndex].featured,
    order: req.body.order ? parseInt(req.body.order) : projects[projectIndex].order,
    status: req.body.status || projects[projectIndex].status,
    updatedAt: new Date().toISOString()
  };
  
  projects[projectIndex] = updatedProject;
  writeJsonFile(path.join(DATA_PATH, 'projects.json'), projects);
  
  res.json({ success: true, project: updatedProject });
});

// Delete project (POST only)
app.post('/api/projects/:id/delete', requireAuth, requireAdmin, (req, res) => {
  const projects = readJsonFile(path.join(DATA_PATH, 'projects.json'));
  const projectIndex = projects.findIndex(p => p.id === req.params.id);
  
  if (projectIndex === -1) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  projects.splice(projectIndex, 1);
  writeJsonFile(path.join(DATA_PATH, 'projects.json'), projects);
  
  res.json({ success: true, message: 'Project deleted' });
});

// Reorder projects (POST only)
app.post('/api/projects/reorder', requireAuth, (req, res) => {
  const { projectIds } = req.body;
  
  if (!projectIds || !Array.isArray(projectIds)) {
    return res.status(400).json({ error: 'Invalid project IDs' });
  }
  
  const projects = readJsonFile(path.join(DATA_PATH, 'projects.json'));
  
  projectIds.forEach((id, index) => {
    const project = projects.find(p => p.id === id);
    if (project) {
      project.order = index + 1;
    }
  });
  
  writeJsonFile(path.join(DATA_PATH, 'projects.json'), projects);
  
  res.json({ success: true, message: 'Projects reordered' });
});

// ============ MEDIA API ============

// Get all uploaded files
app.get('/api/media', requireAuth, (req, res) => {
  fs.readdir(UPLOAD_PATH, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Could not read uploads directory' });
    }
    
    const media = files.map(file => {
      const stats = fs.statSync(path.join(UPLOAD_PATH, file));
      return {
        filename: file,
        url: '/admin/uploads/' + file,
        size: stats.size,
        createdAt: stats.birthtime.toISOString()
      };
    });
    
    res.json(media);
  });
});

// Upload media (POST only)
app.post('/api/media/upload', requireAuth, upload.array('files', 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  
  const media = req.files.map(file => ({
    filename: file.filename,
    url: '/admin/uploads/' + file.filename,
    size: file.size,
    originalName: file.originalname,
    mimetype: file.mimetype
  }));
  
  res.json({ success: true, media });
});

// Delete media (POST only)
app.post('/api/media/:filename/delete', requireAuth, requireAdmin, (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(UPLOAD_PATH, filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  fs.unlink(filePath, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not delete file' });
    }
    res.json({ success: true, message: 'File deleted' });
  });
});

// ============ SETTINGS API ============

// Get settings
app.get('/api/settings', requireAuth, requireAdmin, (req, res) => {
  const settings = readJsonFile(path.join(DATA_PATH, 'settings.json'));
  res.json(settings);
});

// Update settings (POST only)
app.post('/api/settings', requireAuth, requireAdmin, (req, res) => {
  const settings = readJsonFile(path.join(DATA_PATH, 'settings.json'));
  
  const updatedSettings = {
    ...settings,
    agencyName: req.body.agencyName || settings.agencyName,
    tagline: req.body.tagline || settings.tagline,
    email: req.body.email || settings.email,
    phone: req.body.phone || settings.phone,
    whatsapp: req.body.whatsapp || settings.whatsapp,
    instagram: req.body.instagram || settings.instagram,
    behance: req.body.behance || settings.behance,
    linkedin: req.body.linkedin || settings.linkedin,
    updatedAt: new Date().toISOString()
  };
  
  writeJsonFile(path.join(DATA_PATH, 'settings.json'), updatedSettings);
  
  res.json({ success: true, settings: updatedSettings });
});

// ============ USER MANAGEMENT API ============

// Get all users (Admin only)
app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
  const users = readJsonFile(path.join(DATA_PATH, 'users.json'));
  // Remove password hashes for security
  const safeUsers = users.map(u => ({
    id: u.id,
    username: u.username,
    role: u.role,
    createdAt: u.createdAt
  }));
  res.json(safeUsers);
});

// Create user (POST only, Admin only)
app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  const { username, password, role } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  const users = readJsonFile(path.join(DATA_PATH, 'users.json'));
  
  // Check if username exists
  if (users.some(u => u.username === username)) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  
  // Hash password
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
      return res.status(500).json({ error: 'Could not create user' });
    }
    
    const newUser = {
      id: 'user-' + uuidv4(),
      username,
      passwordHash: hash,
      role: role || 'editor',
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    writeJsonFile(path.join(DATA_PATH, 'users.json'), users);
    
    // Return without password hash
    const { passwordHash, ...safeUser } = newUser;
    res.json({ success: true, user: safeUser });
  });
});

// Update user (POST only, Admin only)
app.post('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  const { username, password, role } = req.body;
  const users = readJsonFile(path.join(DATA_PATH, 'users.json'));
  const userIndex = users.findIndex(u => u.id === req.params.id);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const user = users[userIndex];
  
  // Check if username is being changed to an existing one
  if (username && username !== user.username && users.some(u => u.username === username)) {
    return res.status(400).json({ error: 'Username already exists' });
  }
  
  if (password) {
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        return res.status(500).json({ error: 'Could not update password' });
      }
      updateUser(hash);
    });
  } else {
    updateUser(user.passwordHash);
  }
  
  function updateUser(hashedPassword) {
    users[userIndex] = {
      ...user,
      username: username || user.username,
      passwordHash: password ? hashedPassword : user.passwordHash,
      role: role || user.role
    };
    
    writeJsonFile(path.join(DATA_PATH, 'users.json'), users);
    
    const { passwordHash, ...safeUser } = users[userIndex];
    res.json({ success: true, user: safeUser });
  }
});

// Delete user (POST only, Admin only)
app.post('/api/users/:id/delete', requireAuth, requireAdmin, (req, res) => {
  const users = readJsonFile(path.join(DATA_PATH, 'users.json'));
  const userIndex = users.findIndex(u => u.id === req.params.id);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Cannot delete current user
  if (req.session.user.id === users[userIndex].id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  
  users.splice(userIndex, 1);
  writeJsonFile(path.join(DATA_PATH, 'users.json'), users);
  
  res.json({ success: true, message: 'User deleted' });
});

// ============ ERROR HANDLING ============

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ============ START SERVER ============

// Create default settings if not exists
if (!fs.existsSync(path.join(DATA_PATH, 'settings.json'))) {
  writeJsonFile(path.join(DATA_PATH, 'settings.json'), {
    agencyName: 'NOVA EDGE',
    tagline: 'We Make Brands Impossible To Ignore',
    email: 'novaedgework@gmail.com',
    phone: '+91 88666 99702',
    whatsapp: '+918866699702',
    instagram: 'https://instagram.com/novaedge.here',
    behance: 'https://www.behance.net/nova-edge',
    linkedin: 'https://in.linkedin.com/company/novaedge',
    updatedAt: new Date().toISOString()
  });
}

// Create default user if not exists
if (!fs.existsSync(path.join(DATA_PATH, 'users.json'))) {
  bcrypt.hash('Nova@Admin2026!', 10, (err, hash) => {
    if (!err) {
      writeJsonFile(path.join(DATA_PATH, 'users.json'), [
        {
          id: 'admin-001',
          username: 'novaAdmin',
          passwordHash: hash,
          role: 'admin',
          createdAt: new Date().toISOString()
        }
      ]);
    }
  });
}

// Create default projects if not exists
if (!fs.existsSync(path.join(DATA_PATH, 'projects.json'))) {
  writeJsonFile(path.join(DATA_PATH, 'projects.json'), []);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║`);
  console.log(`║  🚀 NOVA EDGE Admin Panel Server Running`);
  console.log(`║`);
  console.log(`║  📍 Admin URL: http://localhost:${PORT}/admin/login`);
  console.log(`║`);
  console.log(`║  👤 Default Username: novaAdmin`);
  console.log(`║  🔑 Default Password: Nova@Admin2026!`);
  console.log(`║`);
  console.log(`║  ⚠️  IMPORTANT: Change password after first login!`);
  console.log(`║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);
});

module.exports = app;
