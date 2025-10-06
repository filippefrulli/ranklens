# Production Logging Strategy

## Overview

This document outlines the logging strategy implemented for monitoring the application in Vercel production environment. All logs follow a consistent format for easy filtering and analysis.

## Log Format

All logs follow this pattern:
```
[Category] Context: Message { metadata }
```

### Categories

- `[API]` - API endpoint calls
- `[Load]` - Server-side page data loading
- `[Action]` - Form action submissions
- `[Auth]` - Authentication flows
- `[Service]` - Service layer operations

## What We Log

### ✅ DO Log

1. **Authorization Failures**
   - Unauthorized access attempts
   - Access denied to resources
   - Missing authentication

2. **Critical Operations**
   - Business creation
   - Analysis runs started
   - Password updates
   - Query creation

3. **Errors & Exceptions**
   - Database errors
   - Service failures
   - API errors

4. **Status Changes**
   - Analysis status changes (completed, failed)
   - Important state transitions

### ❌ DO NOT Log

1. **Sensitive Data**
   - Passwords
   - Session tokens
   - Email addresses (only in extreme debug scenarios)

2. **High-Frequency Operations**
   - Running analysis status polls (too noisy)
   - Every successful data load

3. **Personal Information**
   - User IDs are OK, but not names/emails
   - Business names are OK

## Implemented Logging

### API Endpoints

#### `/api/query/[id]/run-data`
```typescript
✅ Unauthorized attempts
✅ Missing parameters
✅ Unauthorized access to specific queries
✅ Success with counts
✅ Errors with context
```

#### `/api/analysis-status/[id]`
```typescript
✅ Unauthorized attempts
✅ Unauthorized access to specific analysis
✅ Status changes (except 'running' to reduce noise)
✅ Errors with context
```

#### `/api/update-password`
```typescript
✅ Invalid password format
✅ Password too short
✅ No valid session
✅ Update failures
✅ Success
✅ Exceptions
```

### Server-Side Page Loads

#### Dashboard (`/+page.server.ts`)
```typescript
✅ Loading start
✅ Errors during data load
```

#### Query Detail (`/query/[id]/+page.server.ts`)
```typescript
✅ Unauthorized attempts
✅ Missing query ID
✅ Loading start
✅ Access denied
✅ Success with counts
✅ Errors
```

### Form Actions

#### `createBusiness`
```typescript
✅ Unauthorized attempts
✅ Missing required fields
✅ Creation start
✅ Success with business ID
✅ Errors
```

#### `runAnalysis`
```typescript
✅ Unauthorized attempts
✅ Missing business ID
✅ Analysis start
✅ Weekly limit reached
✅ Analysis failures
✅ Success with analysis ID
✅ Exceptions
```

### Authentication Flows

#### Auth Callback
```typescript
✅ Code exchange start
✅ Exchange failures
✅ Exchange success
```

#### Signout
```typescript
✅ Signout start
✅ Success
✅ Errors
```

## Vercel Monitoring

### How to View Logs in Vercel

1. Go to your project in Vercel
2. Click on "Logs" tab
3. Use filters to find issues:
   - `[API]` - Filter API issues
   - `[Action]` - Filter form action issues
   - `Error` - Filter all errors
   - `Unauthorized` - Filter auth issues

### Common Patterns to Watch

#### High Authorization Failures
```
[API] query/run-data: Unauthorized access attempt
```
**Action:** Possible attack or auth flow issue

#### Repeated Analysis Failures
```
[Action] runAnalysis: Analysis failed
```
**Action:** Check LLM API keys or service health

#### Password Reset Issues
```
[API] update-password: Failed to update
```
**Action:** Check Supabase auth configuration

#### Database Errors
```
[Load] Dashboard: Error loading data
```
**Action:** Check Supabase connection and RLS policies

## Log Retention

- **Vercel Pro**: Logs retained for 7 days
- **Vercel Enterprise**: Logs retained for 30+ days

Consider exporting critical logs to external service if needed.

## Future Enhancements

### Recommended (Not Yet Implemented)

1. **Structured Logging Service**
   - Consider Axiom, Logtail, or Datadog for better log aggregation
   - Enables better querying and alerting

2. **Error Tracking**
   - Sentry or similar for error aggregation
   - User impact tracking

3. **Performance Monitoring**
   - Response time logging for slow operations
   - Database query performance

4. **User Journey Tracking**
   - Anonymous flow tracking through critical paths
   - Conversion funnel monitoring

## Quick Reference

### Filter Patterns for Vercel

| What to Find | Search Pattern |
|--------------|----------------|
| All errors | `Error` or `error:` |
| API issues | `[API]` |
| Auth problems | `Unauthorized` or `[Auth]` |
| Analysis runs | `runAnalysis` |
| Business creation | `createBusiness` |
| Password issues | `update-password` |
| Access denied | `Access denied` or `403` |

### Log Levels (Implicit)

- `console.log()` - Info level (operational events)
- `console.error()` - Error level (failures, exceptions)

## Security Notes

1. **Never log passwords** - Even hashed ones
2. **Never log full session tokens** - Only log presence (`hasSession: true`)
3. **Sanitize database errors** - Don't expose schema details to logs
4. **Be careful with user data** - GDPR compliance

## Testing Your Logs

Before deploying, test that logs appear correctly:

1. **Local Development:**
   ```bash
   npm run dev
   # Perform actions and check terminal output
   ```

2. **Preview Deployment:**
   - Deploy to Vercel preview
   - Check Vercel logs tab
   - Verify format and filtering works

3. **Production:**
   - Monitor logs for first 24 hours after deployment
   - Set up alerts for critical errors

---

**Last Updated:** 6 October 2025
