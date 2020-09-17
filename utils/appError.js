function AppError(statusCode, message) {
  Error.call(this);
  Error.captureStackTrace(this);
  this.status = statusCode;
  this.message = message;
}

AppError.prototype = Object.create(Error.prototype);
AppError.prototype.constructor = AppError;

module.exports = AppError;
