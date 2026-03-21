const mysql = require('mysql2')
require('dotenv').config()

function curTime() {
  const date = new Date()
  const pstDate = date.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
  })
  return pstDate
}

// create a mysql pool
const connection = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: atob(process.env.DB_PASSWORD),
  database: process.env.DB_DATABASE,
  port: 3306,
})

// define a keep-alive function
function keepAlive() {
  connection
    .promise()
    .getConnection()
    .then((conn) => {
      conn
        .execute('SELECT 1')
        .then(() => {
          console.log('Database connection alive ' + curTime())
        })
        .catch((err) => {
          console.error('Error executing query:', err)
        })
        .finally(() => {
          conn.release() // release back to pool
        })
    })
    .catch((err) => {
      console.error('Error getting conn from pool:', err)
      process.exit(1)
    })
}

console.log('Starting the db connection ' + curTime())
console.log('dbg ' + process.env.DB_HOST)
// execute the keep-alive function every 5 minutes
setInterval(keepAlive, 300000) // 300000 ms = 5 min

//const connection = mysql.createConnection({
//  host: process.env.DB_HOST,
//  user: process.env.DB_USER ,
//  password: process.env.DB_PASSWORD ,
//  database: process.env.DB_DATABASE,
//  port: 3306
//});

//
//connection.connect((err) => {
//  if (err) {
//    console.error('Error connecting to database:', err);
//    process.exit(1);
//  } else {
//    console.log('Connected to database');
//  }
//});

module.exports = connection
