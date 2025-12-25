# LabMtuci - Project TODO

## Phase 1: Architecture & UI/UX Design
- [x] Define database schema (users, labs, submissions, grades)
- [x] Design UI mockups for login, student dashboard, teacher journal
- [x] Plan API endpoints structure
- [x] Define authentication flow with JWT

## Phase 2: Project Setup & Configuration
- [x] Update Tailwind CSS with Scandinavian color palette (pale gray, pastels)
- [x] Configure global styles and typography
- [x] Set up project structure and file organization
- [x] Install and configure necessary dependencies

## Phase 3: Database & CRUD Endpoints
- [x] Create database schema (users, labs, submissions, grades)
- [x] Seed database with 30 students + 1 teacher (hashed passwords)
- [x] Create CRUD endpoints for labs
- [x] Create CRUD endpoints for submissions
- [x] Create CRUD endpoints for grades
- [x] Create database query helpers in server/db.ts

## Phase 4: JWT Authentication & API Protection
- [x] Implement custom password-based login (replace OAuth)
- [x] Create JWT token generation and validation
- [x] Implement authentication middleware
- [x] Create protected procedures for student/teacher roles
- [x] Add role-based access control

## Phase 5: Frontend Components & React Router
- [x] Create login page with role selection
- [x] Create student dashboard with lab list
- [x] Create file upload component for students
- [x] Create teacher journal with student table
- [x] Create grading interface for teachers
- [x] Set up React Router with protected routes
- [x] Implement logout functionality

## Phase 6: Frontend-Backend Integration & Testing
- [x] Integrate login with backend authentication
- [x] Connect student dashboard to API
- [x] Implement file upload to S3
- [x] Connect teacher journal to API
- [x] Implement grading functionality
- [x] Test all user flows
- [x] Write vitest tests for critical features

## Phase 7: Final Review & Delivery
- [ ] Verify all requirements are met
- [ ] Test responsive design
- [ ] Performance optimization
- [ ] Create checkpoint and deliver to user


## Bugs Found & Fixed
- [x] OAuth callback redirect happening instead of JWT login
- [x] Context still trying to use OAuth instead of JWT
- [x] Need to remove OAuth dependency from context completely
- [x] Fixed main.tsx to use JWT tokens instead of OAuth
- [x] Fixed TypeScript type errors in components
- [x] Fixed downloadFile endpoint (query -> mutation)
- [x] All 5 login tests passing

## Current Bug
- [x] File upload shows success but files not appearing in teacher journal
- [x] uploadFile endpoint not saving to database
- [x] Need to implement S3 upload and DB update in uploadFile mutation
- [x] Added createOrUpdateSubmission function to save files to DB
- [x] Updated uploadFile mutation to save to DB after S3 upload
- [x] Updated gradeSubmission to save grades to DB
