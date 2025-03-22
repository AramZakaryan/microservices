import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import {logger} from "./logger";

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
    .then(() => logger.info("MongoDB connected"))
    .catch(err => logger.error("MongoDB connection error:", err));

// request logging middleware
app.use((req, _, next) => {
    const authHeader = req.header('Authorization');
    const token = authHeader?.split(' ')[1] || 'no-token';

    logger.info({
        method: req.method,
        url: req.url,
        token: token.substring(0, 10) + '...', // don't log full token in production
    }, 'Incoming request');

    next();
});

// response logging middleware
app.use((req, res, next) => {
    const startTime = Date.now();

    const originalJson = res.json;

    res.json = function (body: any) {
        const duration = Date.now() - startTime;

        logger.info({
            method: req.method,
            url: req.url,
            status: res.statusCode,
            responseTimeMs: duration,
            responseBody: body,
        }, 'Response sent');

        return originalJson.call(this, body);
    };

    next();
});

app.get('/', (_, res) => {
    logger.info('Root route hit');
    res.status(200).json({ serviceName: "user-service", version: "0.0.1" });
});

app.get('/health', async (_, res) => {
    const isMongoDBConnected = mongoose.connection.readyState === 1;
    res.status(isMongoDBConnected ? 200 : 500).json({
        status: isMongoDBConnected ? 'ok' : 'error',
        mongo: isMongoDBConnected ? 'connected' : 'disconnected',
        service: 'user-service'
    });
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
app.listen(PORT, () => logger.info(`user-service running on port ${PORT}`));
