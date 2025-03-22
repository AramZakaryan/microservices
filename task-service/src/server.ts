import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import axios from 'axios';
import {logger} from "./logger";

dotenv.config();
const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGO_URI as string)
    .then(() => logger.info("MongoDB connected"))
    .catch(err => logger.error(err));

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
    res.status(200).json({serviceName: "task-service", version: "0.0.1"});
});

app.get('/health', async (_, res) => {
    const isMongoDBConnected = mongoose.connection.readyState === 1;
    res.status(isMongoDBConnected ? 200 : 500).json({
        status: isMongoDBConnected ? 'ok' : 'error',
        mongo: isMongoDBConnected ? 'connected' : 'disconnected',
        service: 'task-service'
    });
});

app.get('/tasks', async (req, res) => {

    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) {
        res.status(401).json({message: "No token provided"});
        return
    }

    let data;

    try {
        const response = await axios.get(`${process.env.USER_SERVICE_URL}/me`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        data = response.data;
    } catch (error: any) {
        logger.error("Failed to fetch user info:", error.message);
        res.status(403).json({message: "Invalid or expired token"});
        return
    }

    if (!data) {
        res.status(401).json({message: "Unauthorized"});
        return
    }

    logger.info(`User ${data.user} with role ${data.role} accessed /tasks`);

    // Example: Admin sees all tasks, User sees only their own tasks
    const tasks = data.role === "admin"
        ? [
            {id: 1, title: "Admin Task 1", completed: false, assignedTo: "admin"},
            {id: 2, title: "User Task 2", completed: false, assignedTo: "user"}
        ]
        : [{id: 2, title: "User Task 2", completed: false, assignedTo: "user"}];

    res.json(tasks);
});

const PORT = process.env.PORT || 3300;
app.listen(PORT, () => logger.info(`task-service running on port ${PORT}`));
