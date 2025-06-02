import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app from './app/app';

const port = process.env.PORT || 3000;

// * MongoDB connection function
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DB_URI || '3000');
    console.log('Connected to DB server');
  } catch (err) {
    console.log(`DB error for error ${err}`);
    throw err;
  }
};

// * Server listening port functionality
app.listen(port, async () => {
  try {
    await connectDB();
    console.log(`Server is listening on port ${port}`);
  } catch (err) {
    console.log('Server cannot be connected because of the error:');
    console.log(err);
  }
});