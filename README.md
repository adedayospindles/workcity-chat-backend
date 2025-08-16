# Workcity Chat Backend

Node.js/Express + MongoDB + Socket.IO backend for **Workcity real-time chat application**.

---

## Features

- **JWT Authentication:** Signup/Login
- **User roles:** `admin`, `agent`, `customer`, `designer`, `merchant`
- **Conversations & Messages:** Full CRUD operations
- **Real-time messaging:** Using Socket.IO
- **Read/unread receipts & typing indicators**
- **File upload:** Supports file messages using Multer (stored on local disk by default)
- **Test users:** Easily create test users for development/testing

---

## Requirements

- Node.js v18+
- MongoDB (local or remote)
- npm

---

## Test Users Example

You can use these JSON objects to quickly create test users:

```json
{
	"name": "tolulope",
	"email": "tolu@lope.com",
	"password": "123456",
	"role": "customer",
}

{
  "name": "User Two",
  "email": "user2@example.com",
  "password": "password123",
  "role": "agent"
}
```

---

## Quickstart

1. Copy environment variables template:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Run the development server:

```bash
npm run dev
```

4. Run all backend tests (including Socket.IO chat test):

```bash
node backend_socket_test.js
node backend_alltest.js
```

---

## Usage

### Authentication

- **Signup:** `POST /auth/signup`
- **Login:** `POST /auth/login`

### Conversations

- **Create:** `POST /conversations`
- **Read:** `GET /conversations`
- **Update/Delete:** `PUT /conversations/:id` / `DELETE /conversations/:id`

### Messages

- **Send text:** `POST /messages`
- **Send file:** `POST /messages` (multipart/form-data with `conversationId` & `file`)
- **Read/Mark as read:** via Socket.IO `markRead` event

### Real-time

- Connect via Socket.IO at `http://localhost:5000/chat` for messaging, typing indicators, and read receipts

---

## Socket.IO Events

- **joinRoom:** Join a conversation room (`{ conversationId }`)
- **sendMessage:** Send a message (`{ conversationId, body }`)
- **typing:** Typing indicator (`{ conversationId, isTyping: true/false }`)
- **markRead:** Mark messages as read (`{ conversationId }`)
- **message:** Event received when a message is sent
- **read:** Event received when a message is read
- **typing:** Event received when another user is typing

---

## File Uploads

- Uses **Multer** to handle file uploads
- Files are stored on the local disk under `uploads/` by default
- Ensure `conversationId` is included in the request when sending a file message

---

## Notes

- Use test users for development and quickly testing chat features
- Make sure your MongoDB instance is running before starting the backend
- All endpoints require JWT authentication except `/auth/signup` and `/auth/login`
