/**
 * Middleware to validate request body and headers against provided Joi schemas.
 * @function validateRequest
 * @param {object} [bodySchema] - Joi schema for validating the request body.
 * @param {object} [headersSchema] - Joi schema for validating the request headers.
 * @returns {function} Express middleware function.
 * @example
 * router.post('/endpoint', validateRequest(bodySchema, headersSchema), controller.method);
 * @description This middleware checks the request body and/or headers for validation errors based on the provided Joi schemas. If validation fails, it responds with a 400 status and an error message. Otherwise, it passes control to the next middleware.
 */
export const validateRequest = (bodySchema, headersSchema) => (req, res, next) => {
  const errors = [];

  // Validate request body if a body schema is provided
  if (bodySchema) {
    const { error: bodyError } = bodySchema.validate(req.body, { abortEarly: false });
    if (bodyError) errors.push(...bodyError.details.map(err => `Body: ${err.message}`));
  }

  // Validate request headers if a headers schema is provided
  if (headersSchema) {
    const { error: headersError } = headersSchema.validate(req.headers, { abortEarly: false });
    if (headersError) errors.push(...headersError.details.map(err => `Headers: ${err.message}`));
  }

  // Return validation errors if any
  if (errors.length) {
    return res.error('Invalid request.', errors, 400, 400);
  }

  // Proceed to the next middleware if validation passes
  next();
};
