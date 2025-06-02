// * Function to create an error
const createError = (statusCode, errorMessage) => {

  const err = new Error();
  err.status = statusCode;
  err.message = errorMessage;
  
  return err;
};

export default createError;