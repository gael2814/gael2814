const url = process.env.TEST_DATABASE_URL ?? "postgresql://aytacos:aytacos@localhost:5432/aytacos_test";
process.env.DATABASE_URL = url;
process.env.DIRECT_DATABASE_URL = url;
process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-123";
process.env.PAYMENTS_PROVIDER = "mock";
process.env.APP_URL = "http://localhost:3000";
delete process.env.RESEND_API_KEY;
