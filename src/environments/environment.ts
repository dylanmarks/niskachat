export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000',
  smart: {
    clientId: 'your-client-id',
    issuer: 'https://launch.smarthealthit.org/v/r4/fhir',
    scope: 'openid profile launch/patient patient/*.read',
  },
};
