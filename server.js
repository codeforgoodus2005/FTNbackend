const express = require('express')
const cors = require('cors')
const multer = require('multer')
const stream = require('stream')
const { google } = require('googleapis')
const dotenv = require('dotenv')
dotenv.config()
const path = require('path')
const authRoutes = require('./routes/auth')
const reportsRoutes = require('./routes/reports')

const app = express()
const port = 3001

// CORS configuration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  )

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

// Apply CORS middleware
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  })
)

// Authenticate using Service Account
const auth = new google.auth.GoogleAuth({
  // keyFile: path.resolve(__dirname, 'service-account-key.json'),
  keyFile: path.resolve(
    __dirname,
    '../frontend/assets/jsonKeys/fluttermesa-e584cce186d4.json'
  ),
  // Path to your service account JSON file
  scopes: ['https://www.googleapis.com/auth/drive'],
})
const drive = google.drive({ version: 'v3', auth })
// const oauth2Client = new google.auth.OAuth2(
//   process.env.CLIENT_ID,
//   process.env.CLIENT_SECRET,
//   process.env.REDIRECT_URI
// )
// oauth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN })
// const drive = google.drive({ version: 'v3', auth: oauth2Client })

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
}).single('file')

// Wrap multer middleware in a Promise
app.get('/files/:id/download', async (req, res) => {
  try {
    const fileId = req.params.id

    // Get file metadata
    const fileMetadata = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType',
    })

    // Download file
    const response = await drive.files.get(
      {
        fileId: fileId,
        alt: 'media',
      },
      { responseType: 'arraybuffer' }
    )

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileMetadata.data.name}"`
    )
    res.setHeader('Content-Type', fileMetadata.data.mimeType)
    res.send(Buffer.from(response.data))
  } catch (error) {
    console.error('Download error:', error)
    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// Upload endpoint
app.post('/upload', (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        error: err.message,
      })
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        })
      }

      const bufferStream = new stream.PassThrough()
      bufferStream.end(req.file.buffer)

      const fileMetadata = {
        name: req.file.originalname,
        parents: [process.env.FOLDER_ID],
      }

      const media = {
        mimeType: req.file.mimetype,
        body: bufferStream,
      }

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name',
      })

      res.status(200).json({
        success: true,
        file: response.data,
      })
    } catch (error) {
      console.error('Upload error:', error)
      res.status(500).json({
        success: false,
        error: error.message,
      })
    }
  })
})

// Update your delete endpoint
app.delete('/files/:id', async (req, res) => {
  try {
    // First verify if the file exists and is in the correct folder
    const file = await drive.files.get({
      fileId: req.params.id,
      fields: 'id, parents',
    })

    if (!file.data.parents.includes(process.env.FOLDER_ID)) {
      return res.status(403).json({
        success: false,
        error: 'File is not in the authorized folder',
      })
    }

    await drive.files.delete({
      fileId: req.params.id,
    })

    res.status(200).json({
      success: true,
      message: 'File deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting file:', error)

    if (error.code === 404) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
      })
    }

    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})
// Endpoint to list files
app.get('/files', async (req, res) => {
  try {
    const response = await drive.files.list({
      q: `'${process.env.FOLDER_ID}' in parents`,
      fields: 'files(id, name)',
    })
    res.status(200).json(response.data.files)
  } catch (error) {
    console.error('Error listing files:', error)
    res.status(500).send('Failed to list files')
  }
})

app.use(express.json())

app.use('/auth', authRoutes.router)
app.use('/reports', reportsRoutes)

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
