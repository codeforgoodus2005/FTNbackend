// auth.js
const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const connection = require('../db.js') // Import the database connection
const expiredTokens = new Set()

router.post('/adminlogin', async (req, res) => {
  if (connection) {
    const { email, password } = req.body

    connection.query(
      'SELECT * FROM admins WHERE email = ?',
      [email],
      async (error, results) => {
        if (error) {
          console.error('Error querying admins:', error)
          res.status(500).json({ error: 'Internal Server Error' })
        } else {
          if (results.length > 0) {
            const admin = results[0]
            // console.log(`admin info: ${admin}`)
            const passwordMatch = password === admin.Password
            if (passwordMatch) {
              const admin_sessionToken = jwt.sign(
                { userId: admin.Id, email: admin.Email },
                'MesaFarms',
                { expiresIn: '6h' }
              )
              // Set the session token in the response cookie
              res.cookie('admin_sessionToken', admin_sessionToken, {
                httpOnly: true,
                secure: true,
                sameSite: 'strict',
              })
              console.log(admin_sessionToken)

              res.status(200).json({
                message: 'Login successful',
                admin_sessionToken,
                admin: {
                  userId: admin.Id,
                  email: admin.Email,
                  location: admin.LocationName,
                },
              })
              // }
              // else{
              //   res.status(401).json({ error: 'Please Try to login at the premisis' });
              // }
            } else {
              res.status(402).json({ error: 'Invalid email or password' })
            }
          } else {
            res.status(404).json({ error: 'Admin not found' })
          }
        }
      }
    )
  } else {
    res.status(502).json({ error: '502: Database connection error' })
  }
})

router.post('/volunteerlogin', async (req, res) => {
  if (connection) {
    const { email, password } = req.body

    connection.query(
      'SELECT * FROM volunteer WHERE email = ?',
      [email],
      async (error, results) => {
        if (error) {
          console.error('Error querying volunteer:', error)
          res.status(500).json({ error: 'Internal Server Error' })
        } else {
          if (results.length > 0) {
            const volunteer = results[0]

            const passwordMatch = password === volunteer.Password
            if (passwordMatch) {
              const volunteer_sessionToken = jwt.sign(
                {
                  volunteer_userId: volunteer.VolunteerID,
                  email: volunteer.Email,
                },
                'MesaFarms',
                { expiresIn: '6h' }
              )
              // Set the session token in the response cookie
              res.cookie('volunteer_sessionToken', volunteer_sessionToken, {
                httpOnly: true,
                secure: true,
                sameSite: 'strict',
              })
              // console.log(sessionToken);

              res.status(200).json({
                message: 'Login successful',
                volunteer_sessionToken,
                volunteer: {
                  volunteer_userId: volunteer.VolunteerID,
                  email: volunteer.Email,
                },
              })
              // }
              // else{
              //   res.status(401).json({ error: 'Please Try to login at the premisis' });
              // }
            } else {
              res.status(402).json({ error: 'Invalid email or password' })
            }
          } else {
            res.status(404).json({ error: 'volunteer not found' })
          }
        }
      }
    )
  } else {
    res.status(502).json({ error: '502: Database connection error' })
  }
})

router.post('/adminlogout', async (req, res) => {
  if (connection) {
    const { email } = req.body
    const token = req.headers.authorization
      ? req.headers.authorization.split(' ')[1]
      : null

    connection.query(
      'SELECT * FROM admins WHERE email = ?',

      [email],
      // print(email)
      async (error, results) => {
        if (error) {
          console.error('Error querying admin:', error)
          res.status(500).json({ error: 'Internal Server Error' })
        } else {
          if (results.length > 0) {
            expiredTokens.add(token)
            res.status(200).json({
              message: 'Logged out successful',
            })
          } else {
            res.status(404).json({ error: 'admin not found' })
          }
        }
      }
    )
  } else {
    res.status(502).json({ error: '502: Database connection error' })
  }
})

router.post('/volunteerlogout', async (req, res) => {
  if (connection) {
    const { email } = req.body
    const token = req.headers.authorization
      ? req.headers.authorization.split(' ')[1]
      : null

    connection.query(
      'SELECT * FROM volunteer WHERE email = ?',

      [email],
      // print(email)
      async (error, results) => {
        if (error) {
          console.error('Error querying volunteer:', error)
          res.status(500).json({ error: 'Internal Server Error' })
        } else {
          if (results.length > 0) {
            expiredTokens.add(token)
            res.status(200).json({
              message: 'Logged out successful',
            })
          } else {
            res.status(404).json({ error: 'volunteer not found' })
          }
        }
      }
    )
  } else {
    res.status(502).json({ error: '502: Database connection error' })
  }
})

// Check-in route
router.post('/volunteercheckin', async (req, res) => {
  if (connection) {
    const { email } = req.body

    // Retrieve the volunteer's ID based on their email
    connection.query(
      'SELECT VolunteerID FROM volunteer WHERE email = ?',
      [email],
      async (error, results) => {
        if (error) {
          console.error('Error querying volunteer:', error)
          res.status(500).json({ error: 'Internal Server Error' })
        } else {
          if (results.length > 0) {
            const volunteerId = results[0].VolunteerID

            // Check if the volunteer is already checked in without checking out
            connection.query(
              'SELECT * FROM VolunteerCheckIn WHERE VolunteerID = ? AND Status = "Checked In"',
              [volunteerId],
              (checkError, checkResults) => {
                if (checkError) {
                  console.error('Error checking previous check-in:', checkError)
                  res.status(500).json({ error: 'Internal Server Error' })
                } else {
                  if (checkResults.length > 0) {
                    // Already checked in without checking out
                    res.status(409).json({ message: 'Already checked in' })
                  } else {
                    // Insert a new check-in record
                    const checkInTime = new Date()
                    connection.query(
                      'INSERT INTO VolunteerCheckIn (VolunteerID, CheckInTime, Status) VALUES (?, ?, "Checked In")',
                      [volunteerId, checkInTime],
                      (insertError, insertResults) => {
                        if (insertError) {
                          console.error(
                            'Error inserting check-in record:',
                            insertError
                          )
                          res
                            .status(500)
                            .json({ error: 'Internal Server Error' })
                        } else {
                          res.status(200).json({
                            message: 'Check-in successful',
                            checkInTime: checkInTime,
                          })
                        }
                      }
                    )
                  }
                }
              }
            )
          } else {
            res.status(404).json({ error: 'Volunteer not found' })
          }
        }
      }
    )
  } else {
    res.status(502).json({ error: 'Database connection error' })
  }
})

// Check-out route
router.post('/volunteercheckout', async (req, res) => {
  if (connection) {
    const { email } = req.body

    // Retrieve the volunteer's ID based on their email
    connection.query(
      'SELECT VolunteerID FROM volunteer WHERE email = ?',
      [email],
      async (error, results) => {
        if (error) {
          console.error('Error querying volunteer:', error)
          res.status(500).json({ error: 'Internal Server Error' })
        } else {
          if (results.length > 0) {
            const volunteerId = results[0].VolunteerID

            // Find the latest check-in record where Status is "Checked In"
            connection.query(
              'SELECT * FROM VolunteerCheckIn WHERE VolunteerID = ? AND Status = "Checked In" ORDER BY CheckInID DESC LIMIT 1',
              [volunteerId],
              (checkError, checkResults) => {
                if (checkError) {
                  console.error('Error retrieving check-in record:', checkError)
                  res.status(500).json({ error: 'Internal Server Error' })
                } else {
                  if (checkResults.length > 0) {
                    const checkInId = checkResults[0].CheckInID
                    const checkOutTime = new Date()

                    // Update the check-in record with CheckOutTime and change Status to "Checked Out"
                    connection.query(
                      'UPDATE VolunteerCheckIn SET CheckOutTime = ?, Status = "Checked Out" WHERE CheckInID = ?',
                      [checkOutTime, checkInId],
                      (updateError, updateResults) => {
                        if (updateError) {
                          console.error(
                            'Error updating check-out time:',
                            updateError
                          )
                          res
                            .status(500)
                            .json({ error: 'Internal Server Error' })
                        } else {
                          res.status(200).json({
                            message: 'Check-out successful',
                            checkOutTime: checkOutTime,
                          })
                        }
                      }
                    )
                  } else {
                    res
                      .status(409)
                      .json({ message: 'No active check-in found' })
                  }
                }
              }
            )
          } else {
            res.status(404).json({ error: 'Volunteer not found' })
          }
        }
      }
    )
  } else {
    res.status(502).json({ error: 'Database connection error' })
  }
})

const verifyToken = async (token) => {
  return new Promise((resolve) => {
    if (!token) {
      resolve(false) // Token is missing
    } else if (expiredTokens.has(token)) {
      resolve(false) // Token is expired
    } else {
      jwt.verify(token, 'MesaFarms', (err, decoded) => {
        if (err) {
          resolve(false)
        } else {
          resolve(true)
        }
      })
    }
  })
}

module.exports = {
  router,
  verifyToken,
}
