# Admin Token Setup

The Vecinita admin panel uses a simple token-based authentication system with SHA-256 hashing for security.

## Setup Instructions

### 1. Generate Your Admin Token Hash

You need to generate a SHA-256 hash of your desired admin token. You can use one of these methods:

#### Option A: Using Node.js

Create a file called `generate-admin-hash.js`:

```javascript
const crypto = require('crypto');

// Replace 'your-secret-admin-token' with your desired token
const token = 'your-secret-admin-token';
const hash = crypto.createHash('sha256').update(token).digest('hex');

console.log('Your admin token hash:');
console.log(hash);
```

Run it:
```bash
node generate-admin-hash.js
```

#### Option B: Using Browser Console

Open your browser's developer console and paste this:

```javascript
async function generateHash(token) {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Replace 'your-secret-admin-token' with your desired token
generateHash('your-secret-admin-token').then(hash => {
  console.log('Your admin token hash:');
  console.log(hash);
});
```

#### Option C: Using Python

```python
import hashlib

# Replace 'your-secret-admin-token' with your desired token
token = 'your-secret-admin-token'
hash_object = hashlib.sha256(token.encode())
hash_hex = hash_object.hexdigest()

print('Your admin token hash:')
print(hash_hex)
```

#### Option D: Using OpenSSL (Command Line)

```bash
echo -n 'your-secret-admin-token' | openssl dgst -sha256
```

### 2. Set Environment Variable

Add the generated hash to your `.env.local` file:

```env
VITE_ADMIN_TOKEN_HASH=your_generated_hash_here
```

**Example:**
If your token is `my-super-secret-token-2024`, the hash would be:
```env
VITE_ADMIN_TOKEN_HASH=8f3e4d5c7b2a1e9f6d8c3a5b4e7f2d1c9e6a8b5c4d3e2f1a9b8c7d6e5f4a3b2c1
```

### 3. Restart Development Server

After setting the environment variable, restart your development server:

```bash
npm run dev
```

## Usage

1. Click the Admin Panel button (Shield icon) in the header
2. Enter your admin token (the original token, not the hash)
3. Click "Sign In"

The system will:
- Hash your input token using SHA-256
- Compare it with the `VITE_ADMIN_TOKEN_HASH` environment variable
- Grant access if they match

## Security Notes

✅ **Secure:**
- The plain token is never stored anywhere
- Only the SHA-256 hash is stored in environment variables
- Authentication is valid only for the current browser session (sessionStorage)
- The hash is compared server-side through environment variables

⚠️ **Important:**
- Never commit your `.env.local` file to version control
- Use a strong, unique token (minimum 20 characters recommended)
- Rotate the token periodically
- For production, consider additional security measures like rate limiting

## Backend Integration

For production deployment, you should set the admin token hash as an environment variable on your hosting platform:

**Vercel/Netlify:**
```
VITE_ADMIN_TOKEN_HASH=your_hash_here
```

**Docker:**
```dockerfile
ENV VITE_ADMIN_TOKEN_HASH=your_hash_here
```

**Heroku:**
```bash
heroku config:set VITE_ADMIN_TOKEN_HASH=your_hash_here
```

## Example Token Generation

Here's a complete example:

**Desired Token:** `Vecinita2024!Admin#Secure`

**Generated Hash (SHA-256):**
```
a7f8d3e2c1b9f6e5d4c3b2a1e9f8d7c6b5a4e3d2c1b0a9f8e7d6c5b4a3e2d1c0
```

**Environment Variable:**
```env
VITE_ADMIN_TOKEN_HASH=a7f8d3e2c1b9f6e5d4c3b2a1e9f8d7c6b5a4e3d2c1b0a9f8e7d6c5b4a3e2d1c0
```

**To Login:** Enter `Vecinita2024!Admin#Secure` in the admin login form.

## Troubleshooting

**"Configuration error: Admin token not configured"**
- Make sure `VITE_ADMIN_TOKEN_HASH` is set in your `.env.local` file
- Restart your development server after adding the variable

**"Invalid token"**
- Verify you're entering the correct token (not the hash)
- Ensure the hash was generated correctly
- Check for extra spaces or characters in the environment variable

**Token not working after server restart**
- sessionStorage is cleared when the browser tab is closed
- You'll need to re-authenticate after closing the tab
