import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

dotenv.config();
const app = express();
app.use(express.json());

// Mock database of users
const users = {
    "admin": { password: "admin", role: "admin" },
    "user": { password: "user", role: "user" }
};

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI as string)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.error("MongoDB connection error:", err));

// Entry endpoint
app.get('/', (_, res) => {
    res.status(200).json({ serviceName: "user-service", version: "0.0.1" });
});

// Authentication endpoint
app.post('/login', (req, res) => {
    const { userName, password } = req.body;

    if (!users[userName as keyof typeof users] || users[userName as keyof typeof users].password !== password) {
         res.status(401).json({ message: "Invalid username or password" });
        return
    }

    // Include role in JWT
    const token = jwt.sign(
        { user: userName, role: users[userName as keyof typeof users].role },
        process.env.JWT_SECRET as string,
        { expiresIn: "7d" }
    );

    res.json({ token });
});

// Me endpoint - Verify JWT and return user info
app.get('/me', (req, res) => {
    const authHeader = req.header("Authorization");
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
         res.status(401).json({ message: "Access denied. No token provided" });
        return
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
        res.json(decoded); // Return user details
    } catch (error) {
         res.status(403).json({ message: "Invalid or expired token" });
        return
    }
});

const PORT = process.env.PORT || 3200;
app.listen(PORT, () => console.log(`user-service running on port ${PORT}`));
