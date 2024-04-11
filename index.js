const express = require('express');
const bodyParser = require('body-parser');
const UserData = require('./data_classes/user_data');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer'); // Make sure nodemailer is imported
const { v4: uuidv4 } = require('uuid');



const app = express();
const port = 3500;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const supabaseUrl = 'https://uqipqahdxbbsamiplqxi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxaXBxYWhkeGJic2FtaXBscXhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTI4MDcxMjMsImV4cCI6MjAyODM4MzEyM30.NHePDZKel3f8Dqj6_GNHSgx4dOiOsjY83VVLjMT5ju0';
const supabase = createClient(supabaseUrl, supabaseKey);

//TODO: Crud functions
// Function to create a new record
async function createRecord(tableName, data) {
  return await supabase.from(tableName).insert(data);
}

// Function to read a record
async function readRecord(tableName, filters) {
  return await supabase.from(tableName).select('*').match(filters);
}

// Function to update a record
async function updateRecord(tableName, filters, newData) {
  return await supabase.from(tableName).update(newData).match(filters);
}

// Function to delete a record
async function deleteRecord(tableName, filters) {
  return await supabase.from(tableName).delete().match(filters);
}



// CRUD function to handle all CRUD operations
async function crud(tableName, operation, filters = {}, newData = {}) {
  let result;
  switch (operation) {
    case 'create':
      result = await createRecord(tableName, newData);
      break;
    case 'read':
      result = await readRecord(tableName, filters);
      break;
    case 'update':
      result = await updateRecord(tableName, filters, newData);
      break;
    case 'delete':
      result = await deleteRecord(tableName, filters);
      break;
    default:
      result = { error: 'Invalid operation' };
  }
  return result;
}





app.post('/login', async (req, res) => {
  let { username, password } = req.body;
  // Trim whitespace from username
  username = username.trim();
  console.log(username, "  ", password);
  const { data, error } = await crud('u_turn_user', 'read', { username });

  console.log("Retrieved data:", data);

  console.log("Retrieved data:", username);

  console.log("Retrieved data:", password);

  if (error) {
    console.error('Error occurred while fetching user data:', error.message);
    return res.status(500).json({ success: false, message: 'An error occurred. Please try again later.' });
  }

  // Check if data is retrieved and passwords match (case-insensitive)
  if (data && data.length > 0) {
    const user = data[0]; // Assuming username is unique, so we take the first user
    console.log("Retrieved data:", user);
    console.log("Retrieved data:", user.password);
    console.log("Retrieved data:", user.username);

    if (user.password.toLowerCase() === password.toLowerCase() && user.username.toLowerCase() === username.toLowerCase()) {
      res.json({ success: true, user });
    } else {
      console.log("Login failed");
      res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
  } else {
    console.log("User not found");
    res.status(404).json({ success: false, message: 'User not found' });
  }
});






// Signup route
app.post('/signup', async (req, res) => {
  const { name, age, username, email, mobile, password } = req.body;

  // Check if username or email already exists
  const { data: existingUser, error } = await crud('u_turn_user', 'read', {
    or: [
      { username },
      { email }
    ]
  });

  if (existingUser) {
    return res.status(400).json({ success: false, message: 'Username or email already exists' });
  }

  // Create new user object
  const newUser = {
    name,
    age,
    username,
    email,
    mobile,
    password
  };

  // Add new user to the Supabase table
  const { data: createdUser, error: createError } = await crud('u_turn_user', 'create', {}, newUser);

  if (createError) {
    return res.status(500).json({ success: false, message: 'Failed to create user' });
  }

  console.log('User signed up:', createdUser);
  res.status(200).json({ success: true, message: 'Signup successful', user: createdUser });
});





// Send OTP route
app.post('/send_otp', async (req, res) => {
  const { method, contact, isNumericOTP, otpDigitCount, otpCountdownTime } = req.body;

  try {
    // Check if there's an existing OTP entry for the provided contact and method
    const { data: existingOTP, error: existingOTError } = await supabase.from('u_turn_otpdata').select('id').eq('contact', contact).eq('method', method);

    // await crud('u_turn_otpdata', 'read', {'contact': contact, 'method': method}, newUser);

    if (existingOTError) {
      console.error('Error occurred while checking for existing OTP:', existingOTError.message);
      return res.status(500).json({ success: false, message: 'An error occurred. Please try again later.' });
    }

    let otp;
    if (existingOTP && existingOTP.length > 0) {
      // If there's an existing OTP entry, replace the OTP with a new one for resend
      otp = generateOTP(isNumericOTP, otpDigitCount);
      const existingOTPId = existingOTP[0].id;
      await supabase.from('u_turn_otpdata').update({ otp: otp }).eq('id', existingOTPId);
      console.log(`Resent OTP for ${contact}: ${otp}`);
    } else {
      // Generate OTP based on provided parameters
      otp = generateOTP(isNumericOTP, otpDigitCount);
      // Save OTP along with contact and method to Supabase table
      const { data: createdOTP, error: createError } = await supabase.from('u_turn_otpdata').insert([{ method, contact, otp: otp }]);

      if (createError) {
        // Error occurred while inserting OTP data
        console.log('Failed to save OTP data to the database:', createError);
        return res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again later.' });
      }
      console.log(`New OTP sent for ${contact}: ${otp}`);
    }

    // Implement sending OTP logic based on the method (email or mobile)
    if (method === 'email') {
      sendEmailOTP(contact, otp);
      console.log(`Email OTP sent to ${contact}: ${otp}`);
    } else if (method === 'mobile') {
      sendMobileOTP(contact, otp);
      console.log(`Mobile OTP sent to ${contact}: ${otp}`);
    } else {
      // Invalid method provided
      return res.status(400).json({ success: false, message: 'Invalid method' });
    }

    res.status(200).json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Error occurred while sending OTP:', error.message);
    res.status(500).json({ success: false, message: 'An error occurred. Please try again later.' });
  }
});


// Function to generate OTP based on provided parameters
function generateOTP(isNumeric, digitCount) {
  let otp = '';
  const characters = isNumeric ? '0123456789' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < digitCount; i++) {
    otp += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return otp;
}

// TODO: implement
function sendMobileOTP(mobile, OTP) {
  // Implement logic to send OTP through SMS to the provided mobile number
}

// Function to send OTP through email
async function sendEmailOTP(email, OTP) {
  try {
    // // Create a transporter object using SMTP transport or any other transport mechanism
    // let transporter = nodemailer.createTransport({
    //   service: 'gmail',
    //   auth: {
    //     user: 'indurangaharitha@gmail.com',
    //     pass: 'induranga289$@'
    //   }
    // });

    // // Define email content
    // let mailOptions = {
    //   from: 'indurangaharitha@gmail.com',
    //   to: email,
    //   subject: 'Your OTP for Verification',
    //   text: `Your OTP is: ${OTP}. Please use this OTP to verify your account.`
    //   // You can also use HTML content for email body if needed
    //   // html: `<p>Your OTP is: <strong>${OTP}</strong>. Please use this OTP to verify your account.</p>`
    // };

    // // Send email
    // let info = await transporter.sendMail(mailOptions);
    // console.log('Email sent:', info.response);
  } catch (error) {
    console.error('Error occurred while sending OTP through email:', error);
    // Handle error, maybe retry sending OTP or log the error for further investigation
  }
}





// Verify OTP route
app.post('/verify_otp', async (req, res) => {
  const { method, contact, otp } = req.body;

  try {
    // Find the OTP data based on the provided method and contact
    const { data: otpData, error } = await supabase.from('u_turn_otpdata').select('otp').eq('method', method).eq('contact', contact);

    if (error) {
      console.error('Error occurred while fetching OTP data:', error.message);
      return res.status(500).json({ success: false, message: 'An error occurred. Please try again later.' });
    }

    if (otpData && otpData.length > 0) {
      // OTP data found for the provided method and contact
      const storedOTP = otpData[0].otp;

      // Check if the provided OTP matches the stored OTP
      if (storedOTP === otp) {
        // OTP verification successful
        console.log(`OTP verification successful for ${contact}`);
        res.status(200).json({ success: true, message: 'OTP verification successful' });
      } else {
        // OTP verification failed
        console.log(`Incorrect OTP for ${contact}`);
        res.status(401).json({ success: false, message: 'Incorrect OTP' });
      }
    } else {
      // No OTP data found for the provided method and contact
      console.log(`No OTP data found for ${contact}`);
      res.status(404).json({ success: false, message: 'OTP data not found' });
    }
  } catch (error) {
    console.error('Error occurred while verifying OTP:', error.message);
    res.status(500).json({ success: false, message: 'An error occurred. Please try again later.' });
  }
});





// Reset password route
app.post('/reset_password', async (req, res) => {
  const { method, contact, password } = req.body;

  try {
    // Check if the provided method and contact exist in the Supabase table
    const { data: user, error } = await supabase.from('u_turn_user')
      .select('*')
      .eq(method === 'email' ? 'email' : 'mobile', contact)
      .single();

    if (error) {
      console.error('Error occurred while resetting password:', error.message);
      return res.status(500).json({ success: false, message: 'An error occurred. Please try again later.' });
    }

    if (user) {
      // User found, update the password
      const { data: updatedUser, updateError } = await supabase.from('u_turn_user')
        .update({ password })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error occurred while updating password:', updateError.message);
        return res.status(500).json({ success: false, message: 'Failed to reset password. Please try again later.' });
      }

      console.log(`Password reset successful for ${contact}`);
      res.status(200).json({ success: true, message: 'Password reset successful' });
    } else {
      // User not found
      console.log(`User not found for ${contact}`);
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error('Error occurred while resetting password:', error.message);
    res.status(500).json({ success: false, message: 'An error occurred. Please try again later.' });
  }
});




//TODO: APplication development

// Example data structure to store vehicles
let availableVehicles = [];

// Middleware to parse JSON bodies
app.use(express.json());

app.post('/save_vehicle', async (req, res) => {
  try {
    const vehicle = req.body;
    // Generate UUID for the vehicle
    vehicle.id = uuidv4();
    // Convert attribute names to lowercase
    const lowercaseVehicle = {};
    Object.keys(vehicle).forEach(key => {
      lowercaseVehicle[key.toLowerCase()] = vehicle[key];
    });

    // Check if the vehicle already exists in the database
    const { data: existingVehicles, error: existingError } = await supabase
      .from('u_turn_available_vehicles')
      .select('*')
      .eq('brand', lowercaseVehicle.brand)
      .eq('type', lowercaseVehicle.type)
      .eq('model', lowercaseVehicle.model)
      .eq('power', lowercaseVehicle.power)
      .eq('numberofpeople', lowercaseVehicle.numberofpeople)
      .eq('capacityforbags', lowercaseVehicle.capacityforbags)
      .eq('priceindollars', lowercaseVehicle.priceindollars)
      .eq('priceperkilometer', lowercaseVehicle.priceperkilometer)
      .eq('pricefordriverperday', lowercaseVehicle.pricefordriverperday)
      .eq('numberofvehiclesavailable', lowercaseVehicle.numberofvehiclesavailable)
      .eq('description', lowercaseVehicle.description);

    if (existingError) {
      console.error('Error while querying existing vehicles:', existingError);
      return res.status(500).json({ success: false, message: 'Failed to save vehicle data.' });
    }

    // If the vehicle already exists, return a success response without adding it again
    if (existingVehicles.length > 0) {
      console.log('Vehicle already exists:', [lowercaseVehicle]);
      return res.json({ success: true, message: 'Vehicle already exists.' });
    }

    // If the vehicle doesn't exist, add it to the database
    const { data, error } = await supabase
      .from('u_turn_available_vehicles')
      .insert(lowercaseVehicle);

    if (error) {
      console.error('Error while saving vehicle data to Supabase:', error);
      return res.status(500).json({ success: false, message: 'Failed to save vehicle data.' });
    }

    // Send success response
    res.json({ success: true, message: 'Vehicle data received and saved successfully.' });
  } catch (error) {
    console.error('Error while saving vehicle data:', error);
    // Send error response
    res.status(500).json({ success: false, message: 'Failed to save vehicle data.' });
  }
});




// // Define the POST method to handle the save_vehicle request
app.post('/test_post', async (req, res) => {
  try {
    // Query to select all rows from the u_turn_available_vehicles table
    const { data, error } = await supabase
      .from('u_turn_available_vehicles')
      .select('*');


    if (error) {
      console.error('Error while querying vehicle data:', error);
      return res.status(500).json({ success: false, message: 'Failed to retrieve vehicle data.' });
    }

    // If data is retrieved successfully, return it in the response
    res.json({ success: true, data: data });
  } catch (error) {
    console.error('Error while fetching vehicle data:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve vehicle data.' });
  }
});


app.post('/save_vehicle_rental', async (req, res) => {
  try {
    const { vehicle, username, password } = req.body;
    // Generate UUID for the vehicle
    vehicle.id = uuidv4();
    // Convert attribute names to lowercase
    const lowercaseVehicle = {};
    Object.keys(vehicle).forEach(key => {
      lowercaseVehicle[key.toLowerCase()] = vehicle[key];
    });

    lowercaseVehicle["username".toLowerCase()] = username;
    lowercaseVehicle["password".toLowerCase()] = password;


    // If the vehicle doesn't exist, add it to the database
    const { data, error } = await supabase
      .from('u_turn_rented_vehicles')
      .insert(lowercaseVehicle);

    if (error) {
      console.error('Error while saving vehicle data to Supabase:', error);
      return res.status(500).json({ success: false, message: 'Failed to save vehicle data.' });
    }

    // Send success response
    res.json({ success: true, message: 'Vehicle data received and saved successfully.' });
  } catch (error) {
    console.error('Error while saving vehicle data:', error);
    // Send error response
    res.status(500).json({ success: false, message: 'Failed to save vehicle data.' });
  }
});





// // Define the POST method to handle the save_vehicle request
app.post('/test_post_rended', async (req, res) => {
  try {
    const { vehicle, username, password } = req.body;
    // Query to select all rows from the u_turn_available_vehicles table
    
    if (username === "" && password === "") {
      const { data, error } = await supabase
        .from('u_turn_rented_vehicles')
        .select('*');


        if (error) {
          console.error('Error while querying vehicle data:', error);
          return res.status(500).json({ success: false, message: 'Failed to retrieve vehicle data.' });
        }
    
        // If data is retrieved successfully, return it in the response
        res.json({ success: true, data: data });
    } else {
      const { data, error } = await supabase
        .from('u_turn_rented_vehicles')
        .select('*')
        .eq('username', username)
        .eq('password', password)


        if (error) {
          console.error('Error while querying vehicle data:', error);
          return res.status(500).json({ success: false, message: 'Failed to retrieve vehicle data.' });
        }
    
        // If data is retrieved successfully, return it in the response
        res.json({ success: true, data: data });
    }

  } catch (error) {
    console.error('Error while fetching vehicle data:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve vehicle data.' });
  }
});


app.post('/save_vehicle_availability', async (req, res) => {
  try {
    const { vehicle } = req.body;

    // Convert attribute names to lowercase
    const lowercaseVehicle = {};
    Object.keys(vehicle).forEach(key => {
      lowercaseVehicle[key.toLowerCase()] = vehicle[key];
    });

    // Check if the vehicle already exists in the database
    const { data: existingVehicle, error: existingError } = await supabase
      .from('u_turn_available_vehicles')
      .select('*')
      .eq('brand', lowercaseVehicle.brand)
      .eq('type', lowercaseVehicle.type)
      .eq('model', lowercaseVehicle.model)
      .eq('power', lowercaseVehicle.power)
      .eq('numberofpeople', lowercaseVehicle.numberofpeople)
      .eq('capacityforbags', lowercaseVehicle.capacityforbags)
      .eq('priceindollars', lowercaseVehicle.priceindollars)
      .eq('priceperkilometer', lowercaseVehicle.priceperkilometer)
      .eq('pricefordriverperday', lowercaseVehicle.pricefordriverperday)
      .eq('numberofvehiclesavailable', lowercaseVehicle.numberofvehiclesavailable)
      .eq('description', lowercaseVehicle.description);

    if (existingError) {
      console.error('Error while querying existing vehicle:', existingError);
      return res.status(500).json({ success: false, message: 'Failed to check vehicle availability.' });
    }

    // If the vehicle exists, update the existing row
    if (existingVehicle.length > 0) {
      const { data: updatedData, error: updateError } = await supabase
        .from('u_turn_available_vehicles')
        .update(lowercaseVehicle)
        .eq('id', existingVehicle[0].id);

      if (updateError) {
        console.error('Error while updating vehicle availability:', updateError);
        return res.status(500).json({ success: false, message: 'Failed to update vehicle availability.' });
      }

      return res.json({ success: true, message: 'Vehicle availability updated successfully.' });
    }

    // If the vehicle doesn't exist, do nothing
    res.json({ success: true, message: 'Vehicle does not exist. No updates performed.' });
  } catch (error) {
    console.error('Error while saving vehicle availability:', error);
    res.status(500).json({ success: false, message: 'Failed to save vehicle availability.' });
  }
});




// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
