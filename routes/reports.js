// backend/routes/volunteer.js
const express = require('express')
const router = express.Router()
const connection = require('../db.js') // Import the database connection

/* for single api call 
router.post('/ftnreport', async (req, res) => {
  if (connection) {
    connection.query(
      //`CALL sp_build_phase2_arrow_kpi(?);`,
      `SELECT  
        account_id , 
        full_name , 
        attendance_status , 
        event_date 
      FROM phase2_arrow_kpi_output;`,
      (error, results) => {
        if (error) {
          console.error('Error querying volunteer:', error)
          res.status(500).json({ error: 'Internal Server Error' })
        } else {
          res.status(200).json(results) // Send results as JSON
        }
      }
    )
  } else {
    res.status(500).json({ error: 'Database connection failed' })
  }
})
*/

router.post('/ftnreport', async (req, res) => {
  if (connection) {
    try{
      const [result1] = await connection.promise().query('CALL sp_update_805_totals_and_award();');
      const [result2] =await connection.promise().query('CALL sp_update_805_engagement_2023_2024();');
      const [result3] = await connection.promise().query('CALL sp_update_805_engagement_2025();');
      const [result4] = await connection.promise().query('CALL sp_update_805_engagement_2025_2026();');
      
      // Merge all 3 results by Account ID
      const merged = result1[0].map(row => {
        const r2 = result2[0].find(r => r['Account ID'] === row['Account ID']) || {};
        const r3 = result3[0].find(r => r['Account ID'] === row['Account ID']) || {};
        return { ...row, ...r2, ...r3 };
      });

      res.status(200).json(merged);
      //res.status(200).json(allVolunteersData);
    
  } catch (error) {
    console.error('Error querying volunteer:', error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
}
})

router.get('/get_eventdetails', (req, res) => {
  const { eventName } = req.query

  if (!connection) {
    return res.status(500).json({ error: 'Database connection failed' })
  }

  if (!eventName) {
    return res.status(400).json({ error: 'Event name is required' })
  }

  const query =
    'SELECT *, (numberOfPeople - signedUp) as remainingSlots FROM EventData WHERE eventName = ?'

  connection.query(query, [eventName], (error, results) => {
    if (error) {
      console.error('Error fetching event details:', error)
      return res.status(500).json({
        error: 'Failed to fetch event details',
        details: error.message,
      })
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Event not found' })
    }

    res.status(200).json(results[0])
  })
})

router.post('/signup_event', (req, res) => {
  const { eventID, volunteer_userId } = req.body

  // Validate input
  if (!eventID || !volunteer_userId) {
    return res
      .status(400)
      .json({ error: 'Event ID and volunteer ID are required' })
  }

  // Check if the volunteer already signed up for the event
  const checkExistingSignupQuery = `
    SELECT COUNT(*) AS signup_count
    FROM EventParticipation
    WHERE VolunteerID = ? AND EventID = ?
  `

  connection.query(
    checkExistingSignupQuery,
    [volunteer_userId, eventID],
    (checkError, checkResults) => {
      if (checkError) {
        return res.status(500).json({
          error: 'Failed to check existing signups',
          details: checkError.message,
        })
      }

      if (checkResults[0].signup_count > 0) {
        return res
          .status(400)
          .json({ error: 'You have already signed up for this event' })
      }

      // Fetch event details
      const checkEventQuery = `
      SELECT EventID, eventName, NumberOfPeople, SignedUp
      FROM EventData
      WHERE EventID = ?
    `

      connection.query(
        checkEventQuery,
        [eventID],
        (eventCheckError, eventResults) => {
          if (eventCheckError) {
            return res.status(500).json({
              error: 'Failed to fetch event details',
              details: eventCheckError.message,
            })
          }

          if (eventResults.length === 0) {
            return res.status(404).json({ error: 'Event not found' })
          }

          const event = eventResults[0]
          if (event.SignedUp >= event.NumberOfPeople) {
            return res.status(400).json({ error: 'Event is already full' })
          }

          // Fetch volunteer details
          const getVolunteerDetailsQuery = `
        SELECT HoursLogged, SignupDate
        FROM Volunteer
        WHERE VolunteerID = ?
      `

          connection.query(
            getVolunteerDetailsQuery,
            [volunteer_userId],
            (volunteerError, volunteerResults) => {
              if (volunteerError) {
                return res.status(500).json({
                  error: 'Failed to fetch volunteer details',
                  details: volunteerError.message,
                })
              }

              if (volunteerResults.length === 0) {
                return res.status(404).json({ error: 'Volunteer not found' })
              }

              const volunteer = volunteerResults[0]
              const hoursLogged = volunteer.HoursLogged || 0
              const signupDate = volunteer.SignupDate

              // Update the event's signed-up count
              const updateEventQuery = `
          UPDATE EventData
          SET SignedUp = SignedUp + 1
          WHERE EventID = ? AND SignedUp < NumberOfPeople
        `

              connection.query(
                updateEventQuery,
                [eventID],
                (updateError, updateResults) => {
                  if (updateError) {
                    return res.status(500).json({
                      error: 'Failed to update event signup count',
                      details: updateError.message,
                    })
                  }

                  if (updateResults.affectedRows === 0) {
                    return res.status(400).json({
                      error: 'Failed to sign up - event may already be full',
                    })
                  }

                  // Insert into EventParticipation
                  const insertParticipationQuery = `
            INSERT INTO EventParticipation (
              VolunteerID, EventID, SignupDate, IsAttending, RsvpFlag, RsvpDate, HoursLogged
            ) VALUES (?, ?, ?, TRUE, TRUE, CURDATE(), ?)
          `

                  connection.query(
                    insertParticipationQuery,
                    [volunteer_userId, eventID, signupDate, hoursLogged],
                    (insertError) => {
                      if (insertError) {
                        return res.status(500).json({
                          error: 'Failed to record event participation',
                          details: insertError.message,
                        })
                      }

                      res.status(200).json({
                        message: 'Signed up successfully!',
                        remainingSlots:
                          event.NumberOfPeople - (event.SignedUp + 1),
                      })
                    }
                  )
                }
              )
            }
          )
        }
      )
    }
  )
})

// Also adding a get_events route with the same connection pattern
router.get('/get_events', (req, res) => {
  if (!connection) {
    return res.status(500).json({ error: 'Database connection failed' })
  }

  const query = 'SELECT EventId, eventName, eventDate FROM EventData'

  connection.query(query, (error, results) => {
    if (error) {
      console.error('Error fetching events:', error)
      return res.status(500).json({
        error: 'Failed to fetch events',
        details: error.message,
      })
    }

    res.status(200).json(results)
  })
})

router.post('/insertEventdata', async (req, res) => {
  console.log(req.body)
  const {
    eventName,
    eventDate,
    startTime,
    endTime,
    description,
    eventLocation,
    numberOfPeople,
  } = req.body

  if (connection) {
    connection.query(
      `
    INSERT INTO EventData (
      eventName,
      eventDate,
      startTime,
      endTime,
      description,
      eventLocation,
      numberOfPeople,
      signedUp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  ;`,
      [
        eventName,
        eventDate,
        startTime,
        endTime,
        description,
        eventLocation,
        numberOfPeople,
      ],
      (error, results) => {
        if (error) {
          console.error('Error inserting event data:', error)
          return res.status(500).json({
            error: 'Failed to insert event data',
            details: error.message,
          })
        }

        res.status(200).json({
          message: 'Event data inserted successfully!',
          eventId: results.insertId,
        })
      }
    )
  } else {
    res.status(500).json({ error: 'Database connection failed' })
  }
})

router.post('/participants', async (req, res) => {
  if (connection) {
    connection.query(
      `SELECT
    y.YouthID,
    CONCAT(y.FirstName, ' ', y.LastName) AS YouthName,
    y.Age,
    y.MenteeStatus,
    y.Interests,
    COUNT(ep.ParticipationID) AS EventsParticipatedCount,
    MIN(ep.SignupDate) AS FirstSignupDate
FROM
    Youth y
LEFT JOIN
    EventParticipation ep ON y.YouthID = ep.VolunteerID
GROUP BY
    y.YouthID
ORDER BY
    EventsParticipatedCount DESC;`,
      (error, results) => {
        if (error) {
          console.error('Error querying participants:', error)
          res.status(500).json({ error: 'Internal Server Error' })
        } else {
          console.log(results)
          res.status(200).json(results) // Send results as JSON
        }
      }
    )
  } else {
    res.status(500).json({ error: 'Database connection failed' })
  }
})

router.post('/volunteerTrackedHours', async (req, res) => {
  if (connection) {
    connection.query(
      `SELECT
    v.VolunteerID,
    CONCAT(v.FirstName, ' ', v.LastName) AS VolunteerName,
    v.Email,
    SUM(ep.HoursLogged) AS TotalHoursLogged,
    es.EventName,
    es.EventDate,
    es.StartTime,
    es.EndTime
FROM
    Volunteer v
JOIN
    EventParticipation ep ON v.VolunteerID = ep.VolunteerID
JOIN
    EventSchedule es ON ep.EventID = es.EventID
GROUP BY
    v.VolunteerID, es.EventID
ORDER BY
    TotalHoursLogged DESC;`,
      (error, results) => {
        if (error) {
          console.error('Error querying volunteer:', error)
          res.status(500).json({ error: 'Internal Server Error' })
        } else {
          res.status(200).json(results) // Send results as JSON
        }
      }
    )
  } else {
    res.status(500).json({ error: 'Database connection failed' })
  }
})

// Get currently checked-in volunteers
router.get('/currentlyCheckedIn', async (req, res) => {
  if (connection) {
    const query = `
      SELECT v.VolunteerID, v.Email, vc.CheckInTime
      FROM Volunteer v
      JOIN VolunteerCheckIn vc ON v.VolunteerID = vc.VolunteerID
      WHERE vc.CheckInTime IS NOT NULL AND vc.CheckOutTime IS NULL;
    `
    connection.query(query, (error, results) => {
      if (error) {
        console.error('Error retrieving checked-in volunteers:', error)
        res.status(500).json({ error: 'Internal Server Error' })
      } else {
        res.status(200).json(results)
      }
    })
  } else {
    res.status(502).json({ error: 'Database connection error' })
  }
})

//get ischecked in or not
router.post('/ischeckedin', async (req, res) => {
  const { email } = req.body

  // Validate email is provided
  if (!email) {
    return res.status(400).json({
      error: 'Email is required',
    })
  }

  if (connection) {
    const query = `
      SELECT
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM Volunteer v
            JOIN VolunteerCheckIn vc ON v.VolunteerID = vc.VolunteerID
            WHERE v.Email = ?
            AND vc.CheckInTime IS NOT NULL
            AND vc.CheckOutTime IS NULL
          ) THEN TRUE
          ELSE FALSE
        END as isCheckedIn
    `

    try {
      // Using promise-based query execution for better error handling
      connection.query(query, [email], (error, results) => {
        if (error) {
          console.error('Error checking volunteer check-in status:', error)
          return res.status(500).json({
            error: 'Internal Server Error',
          })
        }

        // Return the boolean result matching the Flutter function
        return res.status(200).json({
          isCheckedIn: results[0].isCheckedIn === 1,
        })
      })
    } catch (error) {
      console.error('Error executing database query:', error)
      return res.status(500).json({
        error: 'Internal Server Error',
      })
    }
  } else {
    return res.status(502).json({
      error: 'Database connection error',
    })
  }
})

module.exports = router
